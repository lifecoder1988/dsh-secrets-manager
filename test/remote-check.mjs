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
  }
  const files = {
    '': [{ name: '.env', hidden: true, bytes: 40 }],
    src: [{ name: '.env.local', hidden: true, bytes: 20 }],
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
  }
  return {
    version: 1,
    nodes: async () => [{ name: 'node-a', label: '节点 A', root: '/srv/project', notes: '', platform: '', dialect: 'posix', state: 'ready', error: null, toolCount: 2 }],
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
check('the per-node key count adds up', node?.keyCount === 3, node?.keyCount)
check('no value ever appears', !JSON.stringify(answer.json).includes('super-secret') && !JSON.stringify(answer.json).includes('also-secret'), null)
const absent = makeContext(undefined)
apply(absent.ctx, { dshHome: '/tmp/secrets-home' })
const degraded = await hit(absent.routes, '/secrets-manager/remote')
check('a harness without devspace degrades to available:false', degraded.json?.available === false, degraded.json)

report()
process.exit(checks.every(item => item.ok) ? 0 : 1)
