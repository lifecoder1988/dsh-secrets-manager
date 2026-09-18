/**
 * Secrets Manager — host half.
 *
 * One place for a project's `.env` files, monorepo included: it discovers the
 * repository root plus every workspace package (pnpm-workspace.yaml or
 * package.json `workspaces`), finds each package's env files in dotenv layering
 * order, and edits them without destroying comments or key order.
 *
 * It also tells the model how to reach those secrets from the shell. The shell
 * tool only accepts harness-owned `DSH_*` facts, so this plugin contributes:
 *   - `DSH_ENV_FILE`  nearest env file for the executing directory
 *   - `DSH_ENV_FILES` the full root→nearest chain, colon separated
 *   - `DSH_ENV_KEYS`  available key names (never values)
 * and one short prompt section with the sourcing idiom. Values themselves never
 * enter the environment of every command and never enter the transcript.
 *
 * `ShellEnvRegistry.collect()` calls `resolve()` synchronously for every shell
 * call and lets a throw escape, so resolution is a pure index lookup; discovery
 * runs ahead of it and is re-warmed after every write.
 *
 * Deliberately dependency-free: only `node:*` builtins and Cordis services.
 */

import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'secrets-manager'

/** Services this plugin consumes. */
export const inject = ['tools', 'webServer', 'shellEnv']

/** Route prefix owned by this plugin. */
const ROUTE_PREFIX = '/secrets-manager'

/** Environment key grammar accepted in a dotenv file. */
const ENV_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/

/** Bound on one request body. */
const MAX_BODY_BYTES = 1 << 20

/** Env files probed in every directory, in dotenv layering order. */
const BASE_ENV_FILES = ['.env', '.env.local']

/** Bound on workspace-package expansion. */
const MAX_PACKAGES = 400

/* ------------------------------------------------------------------ *
 * dotenv reading and writing
 * ------------------------------------------------------------------ */

/**
 * Parse one dotenv body into positioned lines so a rewrite can replace a value
 * in place and keep comments, blank lines and ordering intact.
 * @param {string} text - file content.
 * @returns {{ lines: Array<object>, entries: Array<object> }} parsed structure.
 */
function parseEnvFile(text) {
  const lines = []
  const entries = []
  for (const raw of text.split(/\r?\n/)) {
    const trimmed = raw.trim()
    if (trimmed.length === 0) {
      lines.push({ kind: 'blank' })
      continue
    }
    if (trimmed.startsWith('#')) {
      lines.push({ kind: 'comment', raw })
      continue
    }
    const match = /^(?<prefix>\s*(?:export\s+)?(?<key>[A-Za-z_][A-Za-z0-9_]*)\s*=\s*)(?<value>.*)$/.exec(raw)
    if (match === null || match.groups === undefined) {
      lines.push({ kind: 'comment', raw })
      continue
    }
    const parsed = parseValue(match.groups.value)
    const line = { kind: 'entry', key: match.groups.key, prefix: match.groups.prefix, value: parsed.value, suffix: parsed.suffix }
    lines.push(line)
    entries.push({ key: line.key, value: line.value })
  }
  return { lines, entries }
}

/**
 * Split a raw dotenv value into its value and any trailing inline comment.
 * @param {string} raw - the text after `=`.
 * @returns {{ value: string, suffix: string }} parts.
 */
function parseValue(raw) {
  const text = raw.replace(/\s+$/, '')
  const quote = text.startsWith('"') ? '"' : text.startsWith("'") ? "'" : null
  if (quote !== null) {
    const closing = text.indexOf(quote, 1)
    if (closing > 0) {
      const body = text.slice(1, closing)
      const value = quote === '"' ? body.replace(/\\(["\\nrt])/g, (_m, c) => (c === 'n' ? '\n' : c === 'r' ? '\r' : c === 't' ? '\t' : c)) : body
      return { value, suffix: text.slice(closing + 1) }
    }
  }
  const hash = text.indexOf(' #')
  if (hash >= 0) return { value: text.slice(0, hash).trim(), suffix: text.slice(hash) }
  return { value: text.trim(), suffix: '' }
}

/** Render one value for a dotenv file, quoting only when needed. */
function renderValue(value) {
  const text = String(value ?? '')
  if (text.length > 0 && /^[A-Za-z0-9_./:@%+,-]*$/.test(text)) return text
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r')}"`
}

/**
 * Write a parsed file back: kept entries hold their position, prefix and inline
 * comment; `updates` replaces values; `removals` drops lines; `additions` append.
 * @param {{ lines: Array<object>, entries: Array<object> }} parsed - parsed file.
 * @param {Map<string, string>} updates - key → new value.
 * @param {Array<{key: string, value: string}>} additions - keys to append.
 * @param {Set<string>} removals - keys to drop.
 * @returns {string} the new file text.
 */
function renderEnvFile(parsed, updates, additions, removals) {
  const out = []
  for (const line of parsed.lines) {
    if (line.kind === 'blank') {
      out.push('')
      continue
    }
    if (line.kind === 'comment') {
      out.push(line.raw)
      continue
    }
    if (removals.has(line.key)) continue
    const value = updates.has(line.key) ? updates.get(line.key) : line.value
    out.push(`${line.prefix}${renderValue(value)}${line.suffix}`)
  }
  for (const addition of additions) out.push(`${addition.key}=${renderValue(addition.value)}`)
  let text = out.join('\n')
  if (!text.endsWith('\n')) text += '\n'
  return text
}

/* ------------------------------------------------------------------ *
 * Discovery
 * ------------------------------------------------------------------ */

/** Walk upward for the repository root the rest of the harness uses. */
function findProjectRoot(cwd) {
  let current = resolve(cwd)
  while (true) {
    if (existsSync(join(current, '.git'))) return current
    const parent = dirname(current)
    if (parent === current) return resolve(cwd)
    current = parent
  }
}

/** Whether `candidate` is `root` or lives under it. */
function isInside(root, candidate) {
  const rel = relative(root, candidate)
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
}

/** Env file names for one directory, including NODE_ENV variants. */
function envFileNames() {
  const names = [...BASE_ENV_FILES]
  const nodeEnv = process.env.NODE_ENV
  if (typeof nodeEnv === 'string' && nodeEnv.length > 0) {
    names.push(`.env.${nodeEnv}`, `.env.${nodeEnv}.local`)
  } else {
    names.push('.env.development', '.env.development.local')
  }
  return names
}

/** Read the workspace globs a repository declares, if any. */
async function workspacePatterns(root) {
  try {
    const yaml = await readFile(join(root, 'pnpm-workspace.yaml'), 'utf8')
    const patterns = []
    let inPackages = false
    for (const rawLine of yaml.split(/\r?\n/)) {
      const line = rawLine.replace(/#.*$/, '').trimEnd()
      if (/^packages\s*:/.test(line)) {
        inPackages = true
        continue
      }
      if (!inPackages) continue
      const item = /^\s*-\s*(.+)$/.exec(line)
      if (item === null) {
        if (line.trim().length > 0 && !line.startsWith(' ')) inPackages = false
        continue
      }
      patterns.push(item[1].trim().replace(/^['"]|['"]$/g, ''))
    }
    if (patterns.length > 0) return patterns
  } catch {
    // No pnpm workspace file.
  }
  try {
    const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
    const workspaces = manifest?.workspaces
    if (Array.isArray(workspaces)) return workspaces.filter(entry => typeof entry === 'string')
    if (Array.isArray(workspaces?.packages)) return workspaces.packages.filter(entry => typeof entry === 'string')
  } catch {
    // No readable root manifest.
  }
  return []
}

/**
 * Expand one workspace glob into package directories.
 * Supports a literal path, `dir/*`, and `dir/**`.
 * @param {string} root - repository root.
 * @param {string} pattern - workspace glob.
 * @returns {Promise<string[]>} absolute directories.
 */
async function expandPattern(root, pattern) {
  const clean = pattern.replace(/\/+$/, '')
  if (!clean.includes('*')) {
    const dir = resolve(root, clean)
    return isInside(root, dir) && existsSync(dir) ? [dir] : []
  }
  const star = clean.indexOf('*')
  const parent = resolve(root, clean.slice(0, star).replace(/\/+$/, '') || '.')
  const deep = clean.slice(star).startsWith('**')
  if (!isInside(root, parent) || !existsSync(parent)) return []
  const found = []
  const walk = async (dir, depth) => {
    let entries = []
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue
      const child = join(dir, entry.name)
      if (existsSync(join(child, 'package.json'))) found.push(child)
      if (deep && depth > 0) await walk(child, depth - 1)
    }
  }
  if (deep) await walk(parent, 3)
  else {
    try {
      for (const entry of await readdir(parent, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        const child = join(parent, entry.name)
        if (existsSync(join(child, 'package.json'))) found.push(child)
      }
    } catch {
      return []
    }
  }
  return found
}

/* ------------------------------------------------------------------ *
 * Plugin
 * ------------------------------------------------------------------ */

/**
 * Install the secrets manager: the Settings routes, the model-facing
 * `project_secrets` tool, the `DSH_ENV_*` shell facts and the prompt guidance.
 * @param {import('@deepseek-ai/cordis').Context} ctx - host plugin context.
 * @param {{ maxPackages?: number }} [config] - optional bounds.
 */
export function apply(ctx, config = {}) {
  const maxPackages = config.maxPackages ?? MAX_PACKAGES
  const warn = message => ctx.logger.warn(message)

  /**
   * Warm discovery index: one entry per directory that holds env files.
   * `chains` maps a directory to its root→nearest env-file chain and the union
   * of key names, so shell resolution stays a synchronous lookup.
   */
  const index = new Map()
  /** Directories seen but not yet scanned, so resolution can re-warm itself. */
  const knownRoots = new Set()

  /** Scan one repository root and index every directory that has env files. */
  const scanRoot = async (root) => {
    knownRoots.add(root)
    const names = envFileNames()
    const directories = [root]
    const patterns = await workspacePatterns(root)
    for (const pattern of patterns) {
      for (const dir of await expandPattern(root, pattern)) {
        if (directories.length >= maxPackages) break
        if (!directories.includes(dir)) directories.push(dir)
      }
    }
    const perDirectory = new Map()
    for (const dir of directories) {
      const files = names.map(name => join(dir, name)).filter(path => existsSync(path))
      if (files.length === 0) continue
      const keys = new Set()
      for (const file of files) {
        try {
          for (const entry of parseEnvFile(await readFile(file, 'utf8')).entries) keys.add(entry.key)
        } catch (error) {
          warn(`secrets-manager: cannot read ${file}: ${String(error)}`)
        }
      }
      perDirectory.set(dir, { files, keys: [...keys] })
    }
    // Every directory inherits its ancestors' chain, so a bash call in a nested
    // path resolves without walking the filesystem itself.
    const allDirs = [...new Set([...directories, root])]
    const chains = new Map()
    for (const dir of allDirs) {
      const chain = []
      const keys = new Set()
      let current = dir
      const ancestors = []
      while (true) {
        ancestors.unshift(current)
        if (current === root) break
        const parent = dirname(current)
        if (!isInside(root, parent) || parent === current) break
        current = parent
      }
      for (const ancestor of ancestors) {
        const own = perDirectory.get(ancestor)
        if (own === undefined) continue
        for (const file of own.files) chain.push(file)
        for (const key of own.keys) keys.add(key)
      }
      if (chain.length > 0) chains.set(dir, { files: chain, keys: [...keys] })
    }
    for (const [dir, value] of chains) index.set(dir, value)
    for (const dir of allDirs) if (!chains.has(dir) && !index.has(dir)) index.delete(dir)
    return chains
  }

  /** Resolve the indexed chain for one directory by walking up to its project root. */
  const lookupChain = (cwd) => {
    if (typeof cwd !== 'string' || cwd.length === 0) return undefined
    let current = resolve(cwd)
    while (true) {
      const hit = index.get(current)
      if (hit !== undefined) return hit
      if (knownRoots.has(current)) return undefined
      const parent = dirname(current)
      if (parent === current) return undefined
      current = parent
    }
  }

  /** Warm the index for a directory without blocking the caller. */
  const warm = (cwd) => {
    if (typeof cwd !== 'string' || cwd.length === 0) return
    const root = findProjectRoot(cwd)
    if (knownRoots.has(root) && lookupChain(cwd) !== undefined) return
    void scanRoot(root).catch(error => warn(`secrets-manager: scan failed: ${String(error)}`))
  }

  // ---- DSH_* shell facts -------------------------------------------

  ctx.shellEnv.register({
    name: 'secrets-manager',
    variables: {
      DSH_ENV_FILE: { description: 'Nearest .env file for this shell call’s directory; empty when the project has none.' },
      DSH_ENV_FILES: { description: 'Colon-separated root→nearest chain of .env files for this shell call; source them in order to load project secrets.' },
      DSH_ENV_KEYS: { description: 'Comma-separated names of the secret keys available from DSH_ENV_FILES; never contains values.' },
    },
    /**
     * Synchronous, total resolution: an index lookup only.
     * @param {object} execution - the shell tool execution.
     * @returns {Record<string, string>} the facts available for this call.
     */
    resolve(execution) {
      const cwd = execution?.agent?.session?.header?.cwd
      const chain = lookupChain(cwd)
      if (chain === undefined) {
        warm(cwd)
        return {}
      }
      // The index can outlive a deleted file; a stale pointer would make the
      // sourcing idiom fail on a missing path.
      const files = chain.files.filter(path => existsSync(path))
      if (files.length === 0) {
        warm(cwd)
        return {}
      }
      return {
        DSH_ENV_FILE: files[files.length - 1],
        DSH_ENV_FILES: files.join(':'),
        DSH_ENV_KEYS: chain.keys.join(','),
      }
    },
  })

  // ---- prompt guidance ---------------------------------------------

  const prompt = ctx.get('systemPrompt')
  if (prompt !== undefined) {
    try {
      ctx.effect(() => prompt.section({
        name: 'secrets-manager:env',
        order: 1050,
        interpolate: false,
        text: [
          'Some projects keep secrets in dotenv files. When a command needs them, source the chain first:',
          '`set -a; for f in ${DSH_ENV_FILES//:/ }; do [ -f "$f" ] && . "$f"; done; set +a`',
          '`DSH_ENV_FILES` is the root→nearest chain (colon separated) and `DSH_ENV_KEYS` lists the available names.',
          'Never print secret values into the conversation; reference them through the environment instead.',
        ].join('\n'),
      }), 'secrets-manager: prompt section')
    } catch (error) {
      warn(`secrets-manager: prompt section registration failed: ${String(error)}`)
    }
  }

  // ---- state and routes --------------------------------------------

  /** Everything the Settings page needs for one workspace. */
  const buildState = async (cwd) => {
    const root = typeof cwd === 'string' && cwd.length > 0 ? findProjectRoot(cwd) : null
    if (root !== null) await scanRoot(root)
    const names = envFileNames()
    const packages = []
    if (root !== null) {
      const dirs = [root]
      for (const pattern of await workspacePatterns(root)) {
        for (const dir of await expandPattern(root, pattern)) {
          if (!dirs.includes(dir)) dirs.push(dir)
        }
      }
      for (const dir of dirs.slice(0, maxPackages)) {
        const files = []
        for (const name of names) {
          const path = join(dir, name)
          if (!existsSync(path)) continue
          let entries = []
          try {
            entries = parseEnvFile(await readFile(path, 'utf8')).entries
          } catch (error) {
            warn(`secrets-manager: cannot read ${path}: ${String(error)}`)
          }
          files.push({
            path,
            name,
            relative: relative(root, path),
            keys: entries.map(entry => entry.key),
          })
        }
        if (files.length === 0) continue
        packages.push({ dir, relative: relative(root, dir) || '.', files })
      }
    }
    const chain = lookupChain(cwd)
    return {
      cwd: cwd ?? null,
      projectRoot: root,
      packages,
      keys: chain?.keys ?? [],
      shell: {
        DSH_ENV_FILE: chain?.files[chain.files.length - 1] ?? '',
        DSH_ENV_FILES: chain?.files.join(':') ?? '',
        DSH_ENV_KEYS: chain?.keys.join(',') ?? '',
      },
      nodeEnv: process.env.NODE_ENV ?? null,
      envFileNames: names,
      workspaces: await listWorkspaces(ctx),
      activeCwd: activeCwd(ctx),
    }
  }

  /** Require a path inside the project root. */
  const requireInsideProject = async (cwd, path) => {
    if (typeof path !== 'string' || path.length === 0) throw new HttpError(400, 'a file path is required')
    if (typeof cwd !== 'string' || cwd.length === 0) throw new HttpError(400, 'a workspace directory is required')
    const root = findProjectRoot(cwd)
    const target = resolve(path)
    if (!isInside(root, target)) throw new HttpError(400, `path is outside the project root: ${target}`)
    return { root, target }
  }

  /** Read one env file as positioned entries. */
  const readFileEntries = async (input) => {
    const { target } = await requireInsideProject(input.cwd, input.path)
    let text = ''
    try {
      text = await readFile(target, 'utf8')
    } catch (error) {
      if (error?.code !== 'ENOENT') throw new HttpError(500, String(error))
    }
    return { path: target, entries: parseEnvFile(text).entries.map(entry => ({ key: entry.key, value: entry.value })) }
  }

  /** Apply add/update/remove operations to one env file. */
  const writeEntries = async (input) => {
    const { root, target } = await requireInsideProject(input.cwd, input.path)
    let text = ''
    try {
      text = await readFile(target, 'utf8')
    } catch (error) {
      if (error?.code !== 'ENOENT') throw new HttpError(500, String(error))
    }
    const parsed = parseEnvFile(text)
    const existing = new Set(parsed.entries.map(entry => entry.key))
    const updates = new Map()
    const additions = []
    const removals = new Set()
    const changes = Array.isArray(input.changes) ? input.changes : []
    for (const change of changes) {
      const key = String(change?.key ?? '')
      if (!ENV_KEY.test(key)) throw new HttpError(400, `invalid environment key ${JSON.stringify(key)}`)
      if (change?.remove === true) {
        removals.add(key)
        updates.delete(key)
        continue
      }
      const value = String(change?.value ?? '')
      if (existing.has(key) && !removals.has(key)) updates.set(key, value)
      else {
        removals.delete(key)
        additions.push({ key, value })
        existing.add(key)
      }
    }
    const rendered = renderEnvFile(parsed, updates, additions, removals)
    await mkdir(dirname(target), { recursive: true })
    const temporary = `${target}.tmp-${String(process.pid)}`
    await writeFile(temporary, rendered, { encoding: 'utf8', mode: 0o600 })
    await rename(temporary, target)
    await scanRoot(root)
    return { ok: true, path: target, changed: changes.length }
  }

  const handle = async (req, res) => {
    try {
      if (rejectUnauthenticated(ctx, req, res)) return
      const url = new URL(String(req.url), 'http://localhost')
      const route = url.pathname.slice(ROUTE_PREFIX.length) || '/'
      if (req.method === 'GET' && route === '/state') {
        const cwd = url.searchParams.get('cwd')
        sendJson(res, 200, await buildState(cwd === null ? undefined : cwd))
        return
      }
      if (req.method === 'POST') {
        const body = await readJsonBody(req)
        if (route === '/file') return void sendJson(res, 200, await readFileEntries(body))
        if (route === '/write') return void sendJson(res, 200, await writeEntries(body))
        if (route === '/refresh') {
          const root = typeof body.cwd === 'string' && body.cwd.length > 0 ? findProjectRoot(body.cwd) : null
          if (root !== null) await scanRoot(root)
          return void sendJson(res, 200, await buildState(body.cwd))
        }
      }
      sendJson(res, 404, { code: 'not-found', message: `no secrets-manager route for ${req.method} ${route}` })
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500
      if (status >= 500) warn(`secrets-manager: ${String(error)}`)
      sendJson(res, status, { code: status === 500 ? 'internal' : 'bad-request', message: messageOf(error) })
    }
  }

  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: ROUTE_PREFIX, handler: handle }), 'secrets-manager: routes')

  // ---- model-facing tool -------------------------------------------

  ctx.effect(() => ctx.tools.register({
    name: 'project_secrets',
    description:
      'List and edit a project’s dotenv files (monorepo included) without reading secret values into the conversation. '
      + '`list` reports every .env file under the repository root and the key NAMES each holds; `set` and `remove` change keys. '
      + 'Shell commands reach the values through the managed DSH_ENV_FILE / DSH_ENV_FILES facts instead of printing them.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'files', 'set', 'remove'], description: 'Operation to perform.' },
        key: { type: 'string', description: 'Environment key name; required for set/remove.' },
        value: { type: 'string', description: 'New value; required for set.' },
        path: { type: 'string', description: 'Target .env path; defaults to the project root .env.' },
        packageDir: { type: 'string', description: 'Workspace package directory (relative); its .env is the target.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object' },
      render: (args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    /** @param {any} args - validated arguments. @param {any} exec - execution context. */
    async execute(args, exec) {
      const cwd = exec.agent?.session?.header?.cwd
      const state = await buildState(cwd)
      if (state.projectRoot === null) throw new HttpError(400, 'this session has no workspace directory')
      switch (args.action) {
        case 'list':
        case 'files':
          return {
            projectRoot: state.projectRoot,
            files: state.packages.flatMap(pkg => pkg.files.map(file => ({ path: file.path, relative: file.relative, keys: file.keys }))),
            shellFacts: state.shell,
          }
        case 'set':
        case 'remove': {
          {
            const key = String(args.key ?? '')
            if (!ENV_KEY.test(key)) throw new HttpError(400, `invalid environment key ${JSON.stringify(args.key ?? null)}`)
            const target = typeof args.path === 'string' && args.path.length > 0
              ? args.path
              : typeof args.packageDir === 'string' && args.packageDir.length > 0
                ? join(state.projectRoot, args.packageDir, '.env')
                : join(state.projectRoot, '.env')
            return await writeEntries({
              cwd,
              path: target,
              changes: [{ key, value: args.value, remove: args.action === 'remove' }],
            })
          }
        }
        /* c8 ignore next 2 -- the enum above is enforced before execute runs. */
        default:
          throw new HttpError(400, `unsupported action "${String(args.action)}"`)
      }
    },
  }), 'secrets-manager: project_secrets tool')

  // ---- read-only self-check ----------------------------------------

  const inspect = ctx.get('cordisInspect')
  if (inspect !== undefined) {
    try {
      ctx.effect(() => inspect.register({
        manifest: {
          id: 'SecretsManager',
          description: 'Live facts about the secrets manager: the discovery index, per-directory env chains and the DSH_ENV_* facts a shell call would receive.',
          methods: [{
            name: 'report',
            description: 'Return the indexed directories, their env-file chains and key names, plus the shell facts for one optional cwd.',
            inputSchema: {
              type: 'object',
              properties: { cwd: { type: 'string', description: 'Directory to resolve shell facts for.' } },
              additionalProperties: false,
            },
            outputSchema: { description: 'Discovery index and resolved shell facts.' },
          }],
        },
        query: async (method, input, context) => {
          const cwd = typeof input?.cwd === 'string'
            ? input.cwd
            : context?.agent?.session?.header?.cwd
          const chain = lookupChain(cwd)
          return {
            knownRoots: [...knownRoots],
            indexedDirectories: [...index.entries()].map(([dir, value]) => ({ dir, files: value.files, keys: value.keys })),
            cwd: cwd ?? null,
            resolved: chain === undefined
              ? null
              : {
                  DSH_ENV_FILE: chain.files[chain.files.length - 1] ?? '',
                  DSH_ENV_FILES: chain.files.join(':'),
                  DSH_ENV_KEYS: chain.keys.join(','),
                },
          }
        },
      }), 'secrets-manager: inspect provider')
    } catch (error) {
      warn(`secrets-manager: inspect provider registration failed: ${String(error)}`)
    }
  }

  // Warm the index for every known workspace, and for each new session's cwd.
  void (async () => {
    try {
      const registry = ctx.get('workspaceRegistry')
      for (const workspace of (await registry?.list?.()) ?? []) await scanRoot(findProjectRoot(workspace.path))
    } catch (error) {
      warn(`secrets-manager: initial scan failed: ${String(error)}`)
    }
  })()
  ctx.on('agent/created', (payload) => {
    const cwd = payload?.agent?.session?.header?.cwd
    if (typeof cwd === 'string' && cwd.length > 0) warm(cwd)
  })
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/** An expected refusal with an HTTP status. */
class HttpError extends Error {
  /** @param {number} status - HTTP status. @param {string} message - client-facing message. */
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}

/** Live workspace records the Settings page can pick from. */
async function listWorkspaces(ctx) {
  try {
    const registry = ctx.get('workspaceRegistry')
    if (registry === undefined) return []
    return (await registry.list()).map(workspace => ({ id: workspace.id, title: workspace.title, path: workspace.path }))
  } catch (error) {
    ctx.logger.warn(`secrets-manager: workspace list failed: ${String(error)}`)
    return []
  }
}

/** The directory of a live root agent, used as the page's default selection. */
function activeCwd(ctx) {
  try {
    const agent = ctx.agents?.roots?.()[0] ?? ctx.agents?.list?.()[0]
    const cwd = agent?.session?.header?.cwd
    return typeof cwd === 'string' ? cwd : null
  } catch {
    return null
  }
}

/** Answer an unauthenticated or non-loopback request; true when it was rejected. */
function rejectUnauthenticated(ctx, req, res) {
  const connection = ctx.get('connection')
  if (connection === undefined) return false
  const rejection = connection.requestRejection(req)
  if (rejection === undefined) return false
  res.statusCode = rejection
  res.end()
  return true
}

/** Send one JSON response. */
function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(payload ?? null))
}

/** Read one bounded JSON request body. */
async function readJsonBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'request body too large')
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks).toString('utf8').trim()
  if (text.length === 0) return {}
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new HttpError(400, 'request body must be JSON')
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new HttpError(400, 'request body must be a JSON object')
  }
  return parsed
}
