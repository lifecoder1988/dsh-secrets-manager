/**
 * Offline exercise of the `remote` listing: what this plugin reports about each
 * DevSpace node, driven against a stubbed node service (no harness, no network).
 */
import { apply } from '../index.js'

/** A DevSpace node service stub: one skill, one MCP config, one .env. */
function fakeDevspace() {
  const dirs = {
    '': [{ name: 'src', hidden: false }, { name: '.git', hidden: true }],
    '.dsh/skills': [{ name: 'demo-skill', hidden: false }],
    '.agents/skills': [],
    'yaoshikou/.claude/skills': [{ name: 'proj-skill', hidden: false }],
    '~/.claude/skills': [{ name: 'home-skill', hidden: false }],
    '~/.agents/skills': [],
    '~/.dsh/skills': [],
  }
  const files = {
    '': [{ name: '.env', hidden: true, bytes: 40 }],
    src: [{ name: '.env.local', hidden: true, bytes: 20 }],
    // The node's HOME, and the mirrored project directory.
    '~': [{ name: '.env', hidden: true, bytes: 20 }],
    yaoshikou: [],
  }
  const contents = {
    '.dsh/skills/demo-skill/SKILL.md': '---\nname: demo-skill\ndescription: 演示技能\n---\n\n# body\n',
    '.dsh/mcp-servers.json': JSON.stringify({
      mcpServers: {
        demo: { transport: 'streamable-http', url: 'http://10.0.0.5:7676/mcp?token=SECRET', headers: { Authorization: 'Bearer SECRET' } },
        local: { command: 'npx', args: ['-y', 'x'], env: { TOKEN: 'SECRET' } },
      },
    }),
    '.env': 'API_KEY=super-secret\n# comment\nexport OTHER=1\n',
    'src/.env.local': 'INNER_KEY=also-secret\n',
    'yaoshikou/.claude/skills/proj-skill/SKILL.md': '---\nname: proj-skill\ndescription: 项目级 claude 技能\n---\n',
    '~/.claude/skills/home-skill/SKILL.md': '---\nname: home-skill\ndescription: 家目录 claude 技能\n---\n',
    '~/.mcp.json': JSON.stringify({ mcpServers: { homeServer: { url: 'http://10.0.0.9:7676/mcp' } } }),
    '~/.env': 'HOME_KEY=secret-home\n',
  }
  return {
    version: 1,
    nodes: async () => [
      { name: 'node-a', label: '节点 A', root: '/srv/project', notes: '', platform: '', dialect: 'posix', state: 'ready', error: null, toolCount: 2 },
      { name: 'node-b', label: '节点 B', root: '/srv/other', notes: '', platform: '', dialect: 'win', state: 'ready', error: null, toolCount: 0 },
    ],
    // The mirror lookup that scopes a listing to "the node this workspace is on".
    mirror: async (cwd) => (String(cwd).includes('devspace-b')
      ? { node: 'node-b', label: '节点 B', remotePath: '/srv/other/yaoshikou', relative: 'yaoshikou', localPath: cwd }
      : null),
    tools: async () => ['bash', 'read'],
    listDirs: async (node, path) => {
      if (!(path in dirs)) throw new Error(`no such dir: ${path}`)
      return dirs[path]
    },
    listFiles: async (node, path) => ({ files: files[path] ?? [] }),
    readText: async (node, path) => {
      if (!(path in contents)) throw Object.assign(new Error('404'), { status: 404 })
      return contents[path]
    },
    exists: async () => true,
    call: async () => ({ isError: false, content: [] }),
  }
}

/** A context with only what these host halves touch, plus the fake service. */
function makeContext(service) {
  const routes = []
  const tools = new Map()
  return {
    routes,
    tools,
    ctx: {
      logger: { warn: () => {}, info: () => {}, error: () => {} },
      effect(fn) { const disposer = fn(); return () => { if (typeof disposer === 'function') disposer() } },
      get(key) { return key === 'devspace' ? service : undefined },
      inject() {},
      on() { return () => {} },
      tools: {
        register(definition) { tools.set(definition.name, definition); return () => {} },
        schemas: () => [
          { name: 'mcp__node-a__bash', description: 'run a command' },
          { name: 'mcp__node-a__read', description: 'read a file' },
        ],
      },
      webServer: { register(route) { routes.push(route); return () => {} } },
      skills: { registerProvider: () => () => {}, register: () => () => {}, list: async () => [], snapshot: async () => ({ skills: [] }) },
      shellEnv: { register: () => () => {}, list: () => [], collect: () => ({}) },
      loader: { entries: () => [], import: async () => ({ apply() {} }) },
      fs: { resolve: async () => ({}), processPath: () => '' },
    },
  }
}

/** One GET into the plugin's own routes. */
async function hit(routes, url) {
  const handler = routes[0].handler
  const req = { method: 'GET', url, headers: {}, async *[Symbol.asyncIterator]() {} }
  let payload = ''
  const res = { statusCode: 200, setHeader() {}, end(chunk) { payload = chunk === undefined ? '' : String(chunk) } }
  await handler(req, res)
  return { status: res.statusCode, json: payload.length === 0 ? null : JSON.parse(payload) }
}

const checks = []
const check = (label, condition, detail) => checks.push({ label, ok: condition === true, detail })

/** One POST into the plugin's own routes. */
async function post(routes, url, body) {
  const handler = routes[0].handler
  const req = {
    method: 'POST',
    url,
    headers: {},
    async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify(body)) },
  }
  let payload = ''
  const res = { statusCode: 200, setHeader() {}, end(chunk) { payload = chunk === undefined ? '' : String(chunk) } }
  await handler(req, res)
  return { status: res.statusCode, json: payload.length === 0 ? null : JSON.parse(payload) }
}
const report = () => {
  for (const item of checks) console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.label}${item.ok ? '' : `  ${JSON.stringify(item.detail)}`}`)
  console.log(`\n${String(checks.filter(item => item.ok).length)}/${String(checks.length)} passed`)
}


const service = fakeDevspace()
const { ctx, routes } = makeContext(service)
apply(ctx, { dshHome: '/tmp/secrets-home' })

const answer = await hit(routes, '/secrets-manager/remote')
const node = answer.json?.nodes?.[0]
const paths = (node?.files ?? []).map(file => file.path)
const keys = (node?.files ?? []).flatMap(file => file.keys)
check('the route answers', answer.status === 200 && answer.json?.available === true, answer.json)
check('the node is listed with its live state', node?.node === 'node-a' && node?.state === 'ready', node)
check('the root .env is found', paths.includes('.env'), paths)
check('a package .env is found', paths.includes('src/.env.local'), paths)
check('key names are parsed, export included', keys.includes('API_KEY') && keys.includes('OTHER') && keys.includes('INNER_KEY'), keys)
check('the per-node key count adds up', node?.keyCount === (node?.files ?? []).reduce((total, file) => total + file.keys.length, 0), node?.keyCount)
check('no value ever appears', !JSON.stringify(answer.json).includes('super-secret') && !JSON.stringify(answer.json).includes('also-secret'), null)
const absent = makeContext(undefined)
apply(absent.ctx, { dshHome: '/tmp/secrets-home' })
const degraded = await hit(absent.routes, '/secrets-manager/remote')
check('a harness without devspace degrades to available:false', degraded.json?.available === false, degraded.json)

// ---- reading one remote value on demand ------------------------------------
{
  const local = makeContext(fakeDevspace())
  apply(local.ctx, {})
  const answer = await post(local.routes, '/secrets-manager/remote-value', { node: 'node-a', path: '~/.env', key: 'HOME_KEY' })
  check('a remote value can be read by name', answer.status === 200 && answer.json?.value === 'secret-home', answer.json)

  const missing = await post(local.routes, '/secrets-manager/remote-value', { node: 'node-a', path: '~/.env', key: 'NOPE' })
  check('an unknown key is refused', missing.status === 404, missing.json)

  const incomplete = await post(local.routes, '/secrets-manager/remote-value', { node: 'node-a', key: 'HOME_KEY' })
  check('an incomplete request is refused', incomplete.status === 400, incomplete.json)
}

// ---- scoping: only the node this workspace mirrors --------------------------
{
  const local = makeContext(fakeDevspace())
  apply(local.ctx, {})
  const all = await hit(local.routes, '/secrets-manager/remote')
  check('without a mirror every node is listed', (all.json?.nodes ?? []).length === 2 && all.json?.scoped === null, all.json?.nodes?.map(node => node.node))

  const scoped = await hit(local.routes, `${'/secrets-manager/remote'}?cwd=${encodeURIComponent('/Users/joe/DevSpace/devspace-b/proj')}`)
  const home = await hit(local.routes, `${'/secrets-manager/remote'}?cwd=${encodeURIComponent('/Users/joe/DevSpace/devspace-b/proj')}`)
  const homeFiles = (home.json?.nodes?.[0]?.files ?? []).map(file => file.path)
  check('the node HOME is scanned for .env files', homeFiles.includes('~/.env'), homeFiles)
  const homeFile = (home.json?.nodes?.[0]?.files ?? []).find(file => file.path === '~/.env')
  check('home keys are reported, values are not', homeFile?.keys?.includes('HOME_KEY') && !JSON.stringify(home.json).includes('secret-home'), homeFile)
  check('a mirrored workspace narrows the listing to its node', (scoped.json?.nodes ?? []).length === 1 && scoped.json?.nodes[0]?.node === 'node-b', scoped.json?.nodes?.map(node => node.node))
  check('the scope is reported back', scoped.json?.scoped?.node === 'node-b' && scoped.json?.total === 2, scoped.json?.scoped)

  const forced = await hit(local.routes, `${'/secrets-manager/remote'}?cwd=${encodeURIComponent('/Users/joe/DevSpace/devspace-b/proj')}&all=1`)
  check('all=1 overrides the scope', (forced.json?.nodes ?? []).length === 2 && forced.json?.scoped === null, forced.json?.nodes?.map(node => node.node))
}

report()
process.exit(checks.every(item => item.ok) ? 0 : 1)
