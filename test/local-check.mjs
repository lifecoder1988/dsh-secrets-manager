/**
 * Standalone behaviour check for the secrets manager host half.
 *
 * Exercises monorepo discovery, the global (Harness-home) env layer, the
 * synchronous DSH_ENV_* resolution a shell call performs, comment-preserving
 * writes, path safety and the route/tool surface, against a temporary
 * pnpm-style workspace with its own fake home.
 * Run: node test/local-check.mjs
 */

import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../index.js'

const root = await mkdtemp(join(tmpdir(), 'secm-check-'))
const repo = join(root, 'repo')
const api = join(repo, 'packages', 'api')
const web = join(repo, 'packages', 'web')
const home = join(root, 'home')
const globalEnv = join(home, '.env')
await mkdir(join(repo, '.git'), { recursive: true })
await mkdir(api, { recursive: true })
await mkdir(web, { recursive: true })
await mkdir(home, { recursive: true })
await writeFile(join(repo, 'pnpm-workspace.yaml'), "packages:\n  - 'packages/*'\n", 'utf8')
await writeFile(join(api, 'package.json'), JSON.stringify({ name: 'api' }), 'utf8')
await writeFile(join(web, 'package.json'), JSON.stringify({ name: 'web' }), 'utf8')

// The global layer every project shares; its SHARED_TOKEN is the weaker one.
await writeFile(globalEnv, [
  '# machine-wide secrets',
  'GLOBAL_TOKEN=global-token',
  'SHARED_TOKEN=global-weaker',
  '',
].join('\n'), 'utf8')
// Root env keeps comments, a quoted value, an inline comment and blank lines.
await writeFile(join(repo, '.env'), [
  '# shared secrets',
  'SHARED_TOKEN=root-token',
  '',
  'QUOTED="a value with spaces" # keep me',
  'export EXPORTED=yes',
  '',
].join('\n'), 'utf8')
// The package adds its own file plus a .env.local override.
await writeFile(join(api, '.env'), 'API_KEY=package-key\nSHARED_TOKEN=package-override\n', 'utf8')
await writeFile(join(api, '.env.local'), 'LOCAL_ONLY=1\n', 'utf8')

/** Captured shellEnv contributor and registered surfaces. */
const registered = { routes: [], tools: [], contributors: [], sections: [] }
const ctx = {
  logger: { warn: () => {}, error: () => {}, info: () => {} },
  get: (name) => (name === 'workspaceRegistry'
    ? { list: async () => [{ id: 'w1', title: 'repo', path: repo }] }
    : undefined),
  effect: (callback) => {
    const disposer = callback()
    return () => { if (typeof disposer === 'function') void disposer() }
  },
  on: () => () => {},
  shellEnv: { register: (contributor) => { registered.contributors.push(contributor); return () => {} } },
  webServer: { register: (route) => { registered.routes.push(route); return () => {} } },
  tools: { register: (tool) => { registered.tools.push(tool); return () => {} } },
}

// The global file is redirected into the fake home: the check must never touch
// the operator's real $DSH_HOME/.env.
apply(ctx, { globalEnv })
await new Promise(resolve => setTimeout(resolve, 60))

/** Drive one registered route with a synthetic request. */
async function request(method, path, body) {
  const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body), 'utf8')]
  const req = { method, url: path, headers: {}, async *[Symbol.asyncIterator]() { yield* chunks } }
  const res = { statusCode: 0, body: '', setHeader() {}, end(text) { this.body = text ?? '' } }
  await registered.routes[0].handler(req, res)
  return { status: res.statusCode, json: res.body.length === 0 ? null : JSON.parse(res.body) }
}

assert.equal(registered.routes.length, 1)
assert.equal(registered.routes[0].path, '/secrets-manager')
assert.equal(registered.tools.length, 1)
assert.equal(registered.tools[0].name, 'project_secrets')
assert.equal(registered.contributors.length, 1)

// ---- the shell facts a bash call receives --------------------------------
const contributor = registered.contributors[0]
assert.deepEqual(Object.keys(contributor.variables).sort(), ['DSH_ENV_FILE', 'DSH_ENV_FILES', 'DSH_ENV_KEYS'])
const apiFacts = contributor.resolve({ agent: { session: { header: { cwd: api } } } })
assert.equal(apiFacts.DSH_ENV_FILE, join(api, '.env.local'), 'nearest file is the override')
assert.equal(
  apiFacts.DSH_ENV_FILES,
  [globalEnv, join(repo, '.env'), join(api, '.env'), join(api, '.env.local')].join(':'),
  'the global file leads, then the root→nearest chain',
)
assert.equal(apiFacts.DSH_ENV_KEYS.split(',').sort().join(','), ['GLOBAL_TOKEN', 'API_KEY', 'EXPORTED', 'LOCAL_ONLY', 'QUOTED', 'SHARED_TOKEN'].sort().join(','))
assert.equal(apiFacts.DSH_ENV_KEYS.includes('root-token'), false, 'keys never carry values')
const webFacts = contributor.resolve({ agent: { session: { header: { cwd: web } } } })
assert.equal(webFacts.DSH_ENV_FILES, [globalEnv, join(repo, '.env')].join(':'), 'a package without its own file inherits the root chain')
const coldFacts = contributor.resolve({ agent: { session: { header: { cwd: root } } } })
assert.equal(coldFacts.DSH_ENV_FILES, globalEnv, 'a directory in no project still gets the global layer alone')
assert.equal(coldFacts.DSH_ENV_FILE, globalEnv, 'and the global file is then the nearest one')

// ---- monorepo discovery through the route --------------------------------
const state = await request('GET', `/secrets-manager/state?cwd=${encodeURIComponent(repo)}`)
assert.equal(state.status, 200)
assert.equal(state.json.projectRoot, repo)
const relativeFiles = state.json.packages.flatMap(pkg => pkg.files.map(file => file.relative)).sort()
assert.deepEqual(relativeFiles, ['.env', 'packages/api/.env', 'packages/api/.env.local'].sort())
const rootEnv = state.json.packages.find(pkg => pkg.relative === '.').files.find(file => file.name === '.env')
assert.deepEqual(rootEnv.keys, ['SHARED_TOKEN', 'QUOTED', 'EXPORTED'])
// The global layer is reported beside the project packages, not inside them.
assert.equal(state.json.global.path, globalEnv)
assert.equal(state.json.global.exists, true)
assert.deepEqual(state.json.global.keys, ['GLOBAL_TOKEN', 'SHARED_TOKEN'])
assert.equal(state.json.shell.DSH_ENV_FILES.startsWith(`${globalEnv}:`), true, 'the shell preview leads with the global file')

// ---- read one file -------------------------------------------------------
const file = await request('POST', '/secrets-manager/file', { cwd: repo, path: join(repo, '.env') })
assert.equal(file.status, 200)
assert.deepEqual(file.json.entries, [
  { key: 'SHARED_TOKEN', value: 'root-token' },
  { key: 'QUOTED', value: 'a value with spaces' },
  { key: 'EXPORTED', value: 'yes' },
])

// ---- comment-preserving writes ------------------------------------------
const written = await request('POST', '/secrets-manager/write', {
  cwd: repo,
  path: join(repo, '.env'),
  changes: [
    { key: 'SHARED_TOKEN', value: 'rotated-token' },
    { key: 'NEW_KEY', value: 'needs "quotes"' },
    { key: 'EXPORTED', remove: true },
  ],
})
assert.equal(written.status, 200)
const text = await readFile(join(repo, '.env'), 'utf8')
// New keys append after the file's own last line, trailing blank included.
assert.equal(text, [
  '# shared secrets',
  'SHARED_TOKEN=rotated-token',
  '',
  'QUOTED="a value with spaces" # keep me',
  '',
  'NEW_KEY="needs \\"quotes\\""',
].join('\n') + '\n', 'comments, blank lines, order and the inline comment survive')
const reread = await request('POST', '/secrets-manager/file', { cwd: repo, path: join(repo, '.env') })
assert.deepEqual(reread.json.entries.map(entry => entry.key), ['SHARED_TOKEN', 'QUOTED', 'NEW_KEY'])
assert.equal(reread.json.entries[0].value, 'rotated-token')

// ---- the index follows a write ------------------------------------------
const afterWrite = contributor.resolve({ agent: { session: { header: { cwd: repo } } } })
assert.equal(afterWrite.DSH_ENV_KEYS.includes('NEW_KEY'), true, 'a new key is visible to the next shell call')
assert.equal(afterWrite.DSH_ENV_KEYS.includes('EXPORTED'), false, 'a removed key disappears')

// ---- the global layer through the same routes ---------------------------
const globalRead = await request('POST', '/secrets-manager/file', { cwd: repo, path: globalEnv })
assert.equal(globalRead.status, 200)
assert.equal(globalRead.json.global, true)
assert.deepEqual(globalRead.json.entries.map(entry => entry.key), ['GLOBAL_TOKEN', 'SHARED_TOKEN'])
const globalWritten = await request('POST', '/secrets-manager/write', {
  cwd: repo,
  path: globalEnv,
  changes: [{ key: 'GLOBAL_NEW', value: 'second' }],
})
assert.equal(globalWritten.status, 200)
assert.equal(globalWritten.json.global, true)
assert.match(await readFile(globalEnv, 'utf8'), /GLOBAL_NEW=second\n$/)
const globalFacts = contributor.resolve({ agent: { session: { header: { cwd: api } } } })
assert.equal(globalFacts.DSH_ENV_KEYS.includes('GLOBAL_NEW'), true, 'a global write reaches the next shell call')

// ---- refusals -----------------------------------------------------------
const outside = await request('POST', '/secrets-manager/write', { cwd: repo, path: '/etc/hosts', changes: [{ key: 'X', value: '1' }] })
assert.equal(outside.status, 400, 'paths outside the project are refused')
const sibling = await request('POST', '/secrets-manager/write', { cwd: repo, path: join(home, 'credentials.yaml'), changes: [{ key: 'X', value: '1' }] })
assert.equal(sibling.status, 400, 'the global directory only accepts env files')
const badKey = await request('POST', '/secrets-manager/write', { cwd: repo, path: join(repo, '.env'), changes: [{ key: 'not a key', value: '1' }] })
assert.equal(badKey.status, 400)
const unknown = await request('GET', '/secrets-manager/nope')
assert.equal(unknown.status, 404)

// ---- the model-facing tool ----------------------------------------------
const tool = registered.tools[0]
const exec = { agent: { session: { header: { cwd: repo } } } }
const listed = await tool.execute({ action: 'list' }, exec)
assert.equal(listed.projectRoot, repo)
assert.equal(listed.files.length, 3)
assert.equal(listed.global.path, globalEnv)
assert.equal(JSON.stringify(listed).includes('rotated-token'), false, 'list never returns values')
const setByTool = await tool.execute({ action: 'set', key: 'TOOL_KEY', value: 'tool-value', packageDir: 'packages/api' }, exec)
assert.equal(setByTool.path, join(api, '.env'))
const apiText = await readFile(join(api, '.env'), 'utf8')
assert.match(apiText, /^API_KEY=package-key\nSHARED_TOKEN=package-override\n\nTOOL_KEY=tool-value\n$/)
const removedByTool = await tool.execute({ action: 'remove', key: 'TOOL_KEY', packageDir: 'packages/api' }, exec)
assert.equal(removedByTool.ok, true)
assert.equal((await readFile(join(api, '.env'), 'utf8')).includes('TOOL_KEY'), false)

// ---- the same tool, aimed at the global layer ---------------------------
const globalSet = await tool.execute({ action: 'set', key: 'TOOL_GLOBAL', value: 'g-value', scope: 'global' }, exec)
assert.equal(globalSet.path, globalEnv, 'scope "global" targets the Harness-home file')
assert.equal(globalSet.global, true)
assert.match(await readFile(globalEnv, 'utf8'), /TOOL_GLOBAL=g-value\n$/)
const globalRemoved = await tool.execute({ action: 'remove', key: 'TOOL_GLOBAL', scope: 'global' }, exec)
assert.equal(globalRemoved.ok, true)
assert.equal((await readFile(globalEnv, 'utf8')).includes('TOOL_GLOBAL'), false)
// The global layer belongs to no project, so it stays reachable without one.
const noWorkspaceExec = { agent: { session: { header: {} } } }
const globalNoWorkspace = await tool.execute({ action: 'set', key: 'NO_WORKSPACE', value: 'x', scope: 'global' }, noWorkspaceExec)
assert.equal(globalNoWorkspace.path, globalEnv, 'a session without a workspace can still write the global file')
assert.equal((await tool.execute({ action: 'remove', key: 'NO_WORKSPACE', scope: 'global' }, noWorkspaceExec)).ok, true)
await assert.rejects(
  async () => await tool.execute({ action: 'set', key: 'X', value: '1', scope: 'global', path: globalEnv }, exec),
  /not both/u,
  'scope "global" and an explicit path are mutually exclusive',
)

// ---- a deleted file leaves no stale pointer ------------------------------
await rm(join(repo, '.env'), { force: true })
const afterDelete = contributor.resolve({ agent: { session: { header: { cwd: api } } } })
assert.equal(
  afterDelete.DSH_ENV_FILES,
  [globalEnv, join(api, '.env'), join(api, '.env.local')].join(':'),
  'the stale root entry is dropped while the global layer stays',
)
const rootAfterDelete = contributor.resolve({ agent: { session: { header: { cwd: repo } } } })
assert.equal(rootAfterDelete.DSH_ENV_FILES, globalEnv, 'a project with no env files still gets the global layer')
// ---- and with no global file either, nothing is claimed -----------------
await rm(globalEnv, { force: true })
assert.deepEqual(
  contributor.resolve({ agent: { session: { header: { cwd: repo } } } }),
  {},
  'no surviving file anywhere resolves to no facts',
)
const stateWithoutGlobal = await request('GET', `/secrets-manager/state?cwd=${encodeURIComponent(repo)}`)
assert.equal(stateWithoutGlobal.json.global.exists, false)
assert.deepEqual(stateWithoutGlobal.json.global.keys, [])
assert.deepEqual(
  stateWithoutGlobal.json.shell.DSH_ENV_FILES,
  '',
  'the repo root claims nothing once its own .env and the global file are both gone',
)
const packageState = await request('GET', `/secrets-manager/state?cwd=${encodeURIComponent(api)}`)
assert.equal(
  packageState.json.shell.DSH_ENV_FILES,
  [join(api, '.env'), join(api, '.env.local')].join(':'),
  'a package chain is its own files alone',
)

await rm(root, { recursive: true, force: true })
console.log('secrets-manager host checks: all passed')
