/**
 * Secrets Manager — browser half.
 *
 * One Settings page (`settings.section`) listing every `.env` file a monorepo
 * exposes, with masked key editing and the exact `DSH_ENV_*` facts the shell
 * tool hands the model. Data comes from this package's host half over its
 * `/secrets-manager/*` JSON routes, so the page needs no Remote codegen.
 *
 * Interaction and presentation follow the Skill Manager page: in-place forms,
 * a permanent tile for the primary action, and a single-column layout inside
 * the Settings panel's already-scrolling ~564px column.
 */

window.__ModuleLoader__.load({
  id: '@local/dsh-secrets-manager',
  factory(require) {
    const React = require('react')
    const { Button, Input, Tag, Pill, IconShieldOutline16, IconChevronRightOutline14 } = require('@deepseek-ai/dsh-client-ui-primitives')
    const h = React.createElement
    const API = '/secrets-manager'

    /** Dotenv key grammar, identical to the host's. */
    const ENV_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/

    const CSS = `
.secm-section { display: flex; flex-direction: column; gap: 12px; max-width: 720px; color: var(--dsw-alias-label-primary); }
.secm-title { margin: 0; font-size: 18px; font-weight: 600; }
.secm-intro { margin: 0; font-size: 13px; line-height: 1.55; color: var(--dsw-alias-label-tertiary); }
.secm-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.secm-select { flex: 1 1 220px; min-width: 0; height: 32px; padding: 0 8px; box-sizing: border-box; border: 0.5px solid var(--dsw-alias-border-l4); border-radius: 8px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); font-family: inherit; font-size: 13px; }
.secm-select:focus-visible { outline: none; border-color: var(--dsw-alias-brand-primary); }
/* The Input primitive is content-box with 8px side padding, so it must stretch by alignment. */
.secm-grow { display: flex; align-self: stretch; box-sizing: border-box; }
.secm-facts { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border: 0.5px solid var(--dsw-alias-border-l4); border-radius: 12px; background: var(--dsw-alias-bg-layer-1); }
.secm-mono { font-family: var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 11px; line-height: 17px; color: var(--dsw-alias-label-tertiary); overflow-wrap: anywhere; }
.secm-group { display: flex; flex-direction: column; gap: 10px; }
.secm-group-head { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.secm-group-title { flex: none; margin: 0; font-size: 12px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--dsw-alias-label-tertiary); }
.secm-group-count { flex: none; font-size: 12px; color: var(--dsw-alias-label-tertiary); }
/* A file path is not a label: it stays cased and ellipsizes instead of wrapping. */
.secm-group-path { flex: 1 1 auto; min-width: 0; overflow: hidden; font-family: var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 11px; line-height: 17px; color: var(--dsw-alias-label-tertiary); text-overflow: ellipsis; white-space: nowrap; }
.secm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(224px, 1fr)); grid-auto-rows: 1fr; gap: 12px; margin: 0; padding: 0; list-style: none; }
.secm-card { display: flex; flex-direction: column; background: transparent; border: 0.5px solid var(--dsw-alias-border-l4); border-radius: 20px; transition: border-color .16s, background .16s; }
.secm-card:hover:not(.secm-card-active) { background: var(--dsw-alias-interactive-bg-hover); }
.secm-card-active { background: var(--dsw-alias-bg-module-platform); border-color: var(--dsw-static-neutral-bluish-400); }
.secm-card-main { flex: 1; display: flex; flex-direction: column; gap: 8px; padding: 14px 16px 12px; appearance: none; border: 0; border-radius: 12px 12px 0 0; background: none; font: inherit; color: inherit; text-align: left; cursor: pointer; }
.secm-card-main:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
.secm-card-head { display: flex; align-items: center; gap: 6px; min-width: 0; }
.secm-card-name { min-width: 0; overflow: hidden; font-size: 14px; font-weight: 600; line-height: 1.4; text-overflow: ellipsis; white-space: nowrap; }
.secm-card-desc { font-size: 12px; line-height: 1.55; color: var(--dsw-alias-label-secondary); overflow-wrap: anywhere; }
.secm-card-owner { font-family: var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 11px; line-height: 17px; color: var(--dsw-alias-label-tertiary); overflow-wrap: anywhere; }
.secm-card-id { margin-top: auto; font-family: var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 11px; line-height: 17px; color: var(--dsw-alias-label-tertiary); overflow-wrap: anywhere; }
.secm-rows { display: flex; flex-direction: column; gap: 2px; margin: 0; padding: 0; list-style: none; }
.secm-row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; min-width: 0; padding: 7px 10px; border-radius: 8px; }
.secm-row:hover { background: var(--dsw-alias-bg-layer-1); }
/* A revealed value owns the row's second line: it must not squeeze the key or
   the actions, and a long secret has to wrap rather than scroll away. */
.secm-row-value { order: 9; flex: 1 0 100%; margin-top: 2px; padding: 6px 8px; box-sizing: border-box; border: 0.5px solid var(--dsw-alias-border-l4); border-radius: 8px; background: var(--dsw-alias-bg-base); font-family: var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 12px; line-height: 17px; color: var(--dsw-alias-label-primary); white-space: pre-wrap; overflow-wrap: anywhere; user-select: text; }
.secm-iconbtn { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; }
.secm-iconbtn:hover:not(:disabled) { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-interactive-bg-hover); }
.secm-iconbtn:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -1px; }
.secm-iconbtn:disabled { opacity: .4; cursor: default; }
.secm-iconbtn-on { color: var(--dsw-alias-brand-primary); }
.secm-key { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 12px; }
.secm-value { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 12px; color: var(--dsw-alias-label-secondary); }
.secm-row-actions { flex: none; display: flex; align-items: center; gap: 2px; }
.secm-form-item { grid-column: 1 / -1; min-width: 0; list-style: none; }
.secm-add-row { display: flex; align-items: center; gap: 8px; width: 100%; box-sizing: border-box; padding: 8px 10px; border: 0.5px dashed var(--dsw-alias-border-l2); border-radius: 8px; background: transparent; color: var(--dsw-alias-label-tertiary); cursor: pointer; font: inherit; font-size: 12px; text-align: left; }
.secm-add-row:hover { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-brand-primary); background: var(--dsw-alias-interactive-bg-hover); }
.secm-add-row:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
.secm-editor { display: flex; flex-direction: column; gap: 12px; padding: 16px; box-sizing: border-box; border: 0.5px solid var(--dsw-alias-border-l4); border-radius: 20px; background: var(--dsw-alias-bg-module-platform); }
.secm-editor-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
.secm-editor-title { min-width: 0; overflow: hidden; font-size: 15px; font-weight: 600; line-height: 1.4; text-overflow: ellipsis; white-space: nowrap; }
.secm-spacer { flex: 1; }
.secm-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.secm-field-label { font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--dsw-alias-label-tertiary); }
.secm-field-hint { font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-tertiary); }
.secm-field-error { font-size: 12px; line-height: 1.5; color: var(--dsw-alias-state-error-primary); }
.secm-pills { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.secm-actions { display: flex; align-items: center; gap: 8px; }
.secm-danger { color: var(--dsw-alias-state-error-primary); }
.secm-note { margin: 0; font-size: 12px; line-height: 1.55; color: var(--dsw-alias-label-tertiary); overflow-wrap: anywhere; }
.secm-error { margin: 0; font-size: 12px; line-height: 1.55; color: var(--dsw-alias-state-error-primary); white-space: pre-wrap; overflow-wrap: anywhere; }
.secm-ok { margin: 0; font-size: 12px; line-height: 1.55; color: var(--dsw-alias-state-success-primary); overflow-wrap: anywhere; }
.secm-empty { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 16px 18px; border: 0.5px dashed var(--dsw-alias-border-l2); border-radius: 16px; background: var(--dsw-alias-bg-layer-1); }
.secm-empty-title { margin: 0; font-size: 14px; font-weight: 600; }
.secm-empty-hint { margin: 0; font-size: 12px; line-height: 1.55; color: var(--dsw-alias-label-tertiary); overflow-wrap: anywhere; }
.secm-loading { font-size: 13px; color: var(--dsw-alias-label-tertiary); }

.secm-remote { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none; }
.secm-remote-node { display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; box-sizing: border-box; border: 0.5px solid var(--dsw-alias-border-l4); border-radius: 16px; }
.secm-remote-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 0; }
.secm-remote-files { display: flex; flex-direction: column; gap: 2px; margin: 0; padding: 0; list-style: none; }
.secm-remote-file { display: flex; align-items: baseline; gap: 8px; min-width: 0; padding: 3px 4px; border-radius: 6px; }
.secm-remote-file:hover { background: var(--dsw-alias-bg-layer-1); }
.secm-remote-path { flex: none; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 12px; color: var(--dsw-alias-label-primary); }
.secm-remote-keys { flex: 1 1 auto; min-width: 0; font-size: 12px; color: var(--dsw-alias-label-tertiary); overflow-wrap: anywhere; }
`
    /**
     * Copy text without rendering it. The panel is served over plain http on a
     * LAN address, where `navigator.clipboard` is typically unavailable, so the
     * textarea + execCommand fallback carries the copy.
     */
    async function copyText(text) {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard !== undefined
          && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(text)
          return true
        }
      } catch {
        // Fall through to the legacy path.
      }
      try {
        const area = document.createElement('textarea')
        area.value = text
        area.setAttribute('readonly', '')
        area.style.position = 'fixed'
        area.style.top = '-1000px'
        area.style.opacity = '0'
        document.body.appendChild(area)
        area.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(area)
        return ok
      } catch {
        return false
      }
    }

    async function call(path, init) {
      const response = await fetch(new URL(API + path, location.origin), init)
      const text = await response.text()
      let payload
      try {
        payload = text.length === 0 ? {} : JSON.parse(text)
      } catch {
        payload = { message: text }
      }
      if (!response.ok) throw new Error(payload?.message ?? `HTTP ${response.status}`)
      return payload
    }

    const post = (path, body) => call(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

    const mask = value => (value.length === 0 ? '(空)' : '•'.repeat(Math.min(12, Math.max(6, value.length))))

    /**
     * A remote scan runs several commands per node and takes seconds, so a
     * recent answer is reused rather than re-scanned on every visit.
     */
    const REMOTE_TTL_MS = 60_000
    const remoteCache = new Map()

    /**
     * Key names inline on a card: a file with 40 keys must not push every other
     * card out of sight, so the tail collapses into a count.
     */
    function summarizeKeys(keys, limit = 6) {
      if (keys.length === 0) return '(空)'
      return keys.length <= limit
        ? keys.join(', ')
        : `${keys.slice(0, limit).join(', ')} 等 ${String(keys.length)} 个`
    }

    /**
     * The reveal ("eye") glyph. ui-primitives ships no eye icon, and this plugin
     * lives outside the harness repo, so the glyph is local instead of a library
     * import that would need `build:lib:client` + `build:web` to appear.
     */
    function EyeGlyph({ off = false, size = 14 }) {
      return h('svg', {
        width: size, height: size, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true', focusable: 'false',
      },
        h('path', {
          d: 'M1.7 8s2.5-4.3 6.3-4.3S14.3 8 14.3 8s-2.5 4.3-6.3 4.3S1.7 8 1.7 8Z',
          stroke: 'currentColor', strokeWidth: 1.3, strokeLinejoin: 'round',
        }),
        h('circle', { cx: 8, cy: 8, r: 1.85, stroke: 'currentColor', strokeWidth: 1.3 }),
        off ? h('path', { d: 'M3.1 13.1 12.9 2.9', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' }) : null,
      )
    }

    /* -------------------- layout self-check (read-only) -------------------- */

    const captured = []

    function recordReport(report) {
      const signature = [
        report.section.width, report.section.height,
        report.fileCount, report.keyCount, report.formOpen, report.offenders.length,
        report.sectionChildren.length, report.container?.horizontalOverflow,
      ].join(':')
      if (captured[0]?.signature === signature) return
      captured.unshift({ signature, capturedAt: new Date().toISOString(), ...report })
      if (captured.length > 8) captured.length = 8
    }

    function measureElement(section) {
      const round = value => Math.round(value * 10) / 10
      const rectOf = (element) => {
        const rect = element.getBoundingClientRect()
        return { x: round(rect.x), y: round(rect.y), width: round(rect.width), height: round(rect.height), right: round(rect.right) }
      }
      const label = (element) => {
        const cls = typeof element.className === 'string' && element.className.length > 0
          ? `.${element.className.trim().split(/\s+/).slice(0, 3).join('.')}`
          : ''
        const text = (element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)
        return `${element.tagName.toLowerCase()}${cls}${text.length > 0 ? ` "${text}"` : ''}`
      }
      const doc = document.documentElement
      let container = section.parentElement
      while (container !== null && container !== document.body) {
        const overflowY = getComputedStyle(container).overflowY
        if (overflowY === 'auto' || overflowY === 'scroll') break
        container = container.parentElement
      }
      const sectionRect = section.getBoundingClientRect()
      const offenders = []
      for (const element of section.querySelectorAll('*')) {
        const rect = element.getBoundingClientRect()
        if (rect.width === 0 && rect.height === 0) continue
        const parent = element.parentElement
        const parentRect = parent === null ? sectionRect : parent.getBoundingClientRect()
        const overflowRight = round(rect.right - parentRect.right)
        const scrollOverflow = element.scrollWidth - element.clientWidth
        if (overflowRight > 1 || scrollOverflow > 1) {
          offenders.push({ element: label(element), width: round(rect.width), parentWidth: round(parentRect.width), overflowRight, scrollOverflow })
        }
      }
      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        documentScrollWidth: doc.scrollWidth,
        documentClientWidth: doc.clientWidth,
        horizontalDocumentOverflow: doc.scrollWidth > doc.clientWidth + 1,
        activeSettingsSection: (document.querySelector('[aria-current="true"]')?.textContent ?? '').trim() || null,
        section: rectOf(section),
        container: container === null ? null : { ...rectOf(container), clientWidth: container.clientWidth, scrollWidth: container.scrollWidth, clientHeight: container.clientHeight, scrollHeight: container.scrollHeight, horizontalOverflow: container.scrollWidth > container.clientWidth + 1 },
        sectionChildren: [...section.children].map(child => ({ element: label(child), ...rectOf(child) })),
        fileCount: section.querySelectorAll('.secm-card').length,
        keyCount: section.querySelectorAll('.secm-row').length,
        formOpen: section.querySelector('.secm-editor') !== null,
        emptyState: section.querySelector('.secm-empty') !== null,
        offenders: offenders.slice(0, 10),
      }
    }

    /* ------------------------------- page ------------------------------- */

    function Page() {
      const rootRef = React.useRef(null)
      const formRef = React.useRef(null)
      const keysRef = React.useRef(null)
      const [state, setState] = React.useState({ loading: true, error: null, data: null })
      const [cwd, setCwd] = React.useState(null)
      const [selected, setSelected] = React.useState(null)
      const [entries, setEntries] = React.useState([])
      /** Key names whose value the operator asked to see. Never persisted. */
      const [revealed, setRevealed] = React.useState(() => new Set())
      const [draft, setDraft] = React.useState(null)
      const [busy, setBusy] = React.useState(false)
      const [remote, setRemote] = React.useState({ data: null, error: null })
      const [notice, setNotice] = React.useState(null)

      React.useLayoutEffect(() => {
        if (rootRef.current !== null) recordReport(measureElement(rootRef.current))
      })
      React.useEffect(() => {
        const node = rootRef.current
        if (node === null || typeof ResizeObserver === 'undefined') return undefined
        const observer = new ResizeObserver(() => { recordReport(measureElement(node)) })
        observer.observe(node)
        return () => { observer.disconnect() }
      }, [])

      // The global layer leads: it is the one file every project sources first.
      const globalFiles = state.data?.global == null
        ? []
        : [{
            path: state.data.global.path,
            name: '.env',
            relative: '.env',
            packageRelative: '全局 $DSH_HOME',
            keys: state.data.global.keys ?? [],
            global: true,
            missing: state.data.global.exists !== true,
          }]
      const projectFiles = (state.data?.packages ?? []).flatMap(pkg => pkg.files.map(file => ({ ...file, packageRelative: pkg.relative })))
      const files = [...globalFiles, ...projectFiles]

      const loadFile = React.useCallback(async (target) => {
        if (target === null) {
          setEntries([])
          setRevealed(new Set())
          return
        }
        try {
          const file = await post('/file', { cwd, path: target })
          setEntries(file.entries)
          // Reveals belong to the file that was on screen, not to the key name.
          setRevealed(new Set())
        } catch (error) {
          setEntries([])
          setRevealed(new Set())
          setNotice({ kind: 'error', text: String(error.message ?? error) })
        }
      }, [cwd])

      /** Remote discovery follows the selected workspace: only a mirror has one. */
      const [remoteBusy, setRemoteBusy] = React.useState(false)
      /** Identifies the newest remote request: a slow answer for a workspace you
       *  already left must not land on the one you are looking at. */
      const remoteSeq = React.useRef(0)
      const loadRemote = React.useCallback(async () => {
        const seq = remoteSeq.current + 1
        remoteSeq.current = seq
        const key = `${cwd ?? ''}|scoped`
        const cached = remoteCache.get(key)
        if (cached !== undefined && Date.now() - cached.at < REMOTE_TTL_MS) {
          setRemote({ data: cached.data, error: null })
          return
        }
        setRemoteBusy(true)
        try {
          const params = []
          if (cwd !== null && cwd !== undefined && cwd !== '') params.push(`cwd=${encodeURIComponent(cwd)}`)
          const data = await call(`/remote${params.length === 0 ? '' : `?${params.join('&')}`}`)
          remoteCache.set(key, { at: Date.now(), data })
          if (seq !== remoteSeq.current) return
          setRemote({ data, error: null })
        } catch (error) {
          if (seq !== remoteSeq.current) return
          setRemote({ data: null, error: String(error.message ?? error) })
        } finally {
          if (seq === remoteSeq.current) setRemoteBusy(false)
        }
      }, [cwd])
      // A local workspace answers instantly (the Host skips the node scan); a
      // mirror pays for the one node it is about.
      React.useEffect(() => { void loadRemote() }, [loadRemote])

      const load = React.useCallback(async (target) => {
        setState(previous => ({ ...previous, loading: true, error: null }))
        try {
          const query = target ? `?cwd=${encodeURIComponent(target)}` : ''
          const data = await call(`/state${query}`)
          setState({ loading: false, error: null, data })
          // Read from the fetched payload, not the render-scope list: this
          // callback closes over the previous render's state otherwise.
          const projectPaths = (data.packages ?? []).flatMap(pkg => pkg.files.map(file => file.path))
          const globalPath = typeof data.global?.path === 'string' ? data.global.path : null
          const all = globalPath === null ? projectPaths : [...projectPaths, globalPath]
          const preferred = data.shell.DSH_ENV_FILE !== '' && all.includes(data.shell.DSH_ENV_FILE)
            ? data.shell.DSH_ENV_FILE
            : all[0] ?? null
          setSelected(preferred)
          await loadFile(preferred)
          return data
        } catch (error) {
          setState({ loading: false, error: String(error.message ?? error), data: null })
          return null
        }
      }, [loadFile])

      React.useEffect(() => {
        void (async () => {
          const first = await load(cwd)
          if (first !== null && cwd === null) {
            const preferred = first.activeCwd ?? first.workspaces?.[0]?.path ?? first.projectRoot
            if (preferred !== null && preferred !== undefined) setCwd(preferred)
          }
        })()
      }, [cwd, load])

      const formKey = draft === null ? null : `${draft.mode}:${draft.key}`
      React.useEffect(() => {
        const node = formRef.current
        if (formKey === null || node === null) return
        node.scrollIntoView({ block: 'nearest' })
        const field = node.querySelector('input, textarea')
        if (field !== null) field.focus()
      }, [formKey])

      // Success notices are confirmations, not state: they fade on their own.
      // Errors stay until the next action, because the user has to read them.
      React.useEffect(() => {
        if (notice === null || notice.kind !== 'ok') return undefined
        const timer = window.setTimeout(() => { setNotice(null) }, 5000)
        return () => { window.clearTimeout(timer) }
      }, [notice])

      // The key list sits below the file grid, so picking a card has to bring it
      // into view. `nearest` leaves an already-visible list where it is, and the
      // flag keeps this from firing on the initial auto-selection.
      const revealKeys = React.useRef(false)
      React.useEffect(() => {
        if (!revealKeys.current) return
        revealKeys.current = false
        const node = keysRef.current
        if (node !== null) node.scrollIntoView({ block: 'nearest' })
      }, [selected, entries])

      const write = React.useCallback(async (changes, note) => {
        if (selected === null) return
        setBusy(true)
        setNotice(null)
        try {
          await post('/write', { cwd, path: selected, changes })
          if (note !== undefined) setNotice({ kind: 'ok', text: note })
          setDraft(null)
          // A rewritten file re-renders every row: hidden again by default.
          setRevealed(new Set())
          await load(cwd)
        } catch (error) {
          setNotice({ kind: 'error', text: String(error.message ?? error) })
        } finally {
          setBusy(false)
        }
      }, [cwd, load, selected])

      const setField = (key, value) => setDraft(previous => (previous === null ? previous : { ...previous, [key]: value }))

      const toggleReveal = (key) => setRevealed((previous) => {
        const next = new Set(previous)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next
      })

      const data = state.data
      const keyValid = ENV_KEY.test(draft?.key ?? '')
      const canSubmit = draft !== null && keyValid && !busy
      const options = []
      for (const workspace of data?.workspaces ?? []) {
        options.push(h('option', { key: workspace.id, value: workspace.path }, `${workspace.title} — ${workspace.path}`))
      }
      if (cwd !== null && !options.some(option => option.props.value === cwd)) {
        options.unshift(h('option', { key: cwd, value: cwd }, cwd))
      }

      const renderForm = () => h('div', { className: 'secm-editor' },
        h('div', { className: 'secm-editor-head' },
          h('span', { className: 'secm-editor-title' }, draft.mode === 'edit' ? `编辑 ${draft.key}` : '新增密钥'),
          h('span', { className: 'secm-spacer' }),
          h(Button, { size: 'sm', variant: 'ghost', onClick: () => setDraft(null) }, '取消'),
        ),
        h('div', { className: 'secm-field' },
          h('label', { className: 'secm-field-label' }, '写入文件'),
          h('div', { className: 'secm-pills' }, files.map(file => h(Pill, {
            key: file.path,
            active: file.path === selected,
            disabled: draft.mode === 'edit',
            title: file.path,
            onClick: () => { setSelected(file.path); void loadFile(file.path) },
          }, file.relative))),
          h('span', { className: 'secm-mono' }, selected ?? ''),
        ),
        h('div', { className: 'secm-field' },
          h('label', { className: 'secm-field-label', htmlFor: 'secm-editor-key' }, '名称'),
          h(Input, {
            id: 'secm-editor-key',
            className: 'secm-grow',
            value: draft.key,
            placeholder: 'MY_API_KEY',
            disabled: draft.mode === 'edit',
            onChange: event => setField('key', event.target.value),
          }),
          draft.key.length > 0 && !keyValid
            ? h('span', { className: 'secm-field-error' }, '只能用字母、数字和下划线，且不能以数字开头')
            : h('span', { className: 'secm-field-hint' }, '写进 .env 的键名，例如 STRIPE_SECRET_KEY。'),
        ),
        h('div', { className: 'secm-field' },
          h('label', { className: 'secm-field-label', htmlFor: 'secm-editor-value' }, '值' ),
          h(Input, {
            id: 'secm-editor-value',
            className: 'secm-grow',
            value: draft.value,
            placeholder: '粘贴密钥值',
            onChange: event => setField('value', event.target.value),
          }),
          h('span', { className: 'secm-field-hint' }, '值只写入本地文件；模型侧只能通过 DSH_ENV_FILES 加载，不会进入对话。'),
        ),
        h('div', { className: 'secm-actions' },
          h(Button, {
            size: 'sm',
            variant: 'primary',
            disabled: !canSubmit,
            onClick: () => { void write([{ key: draft.key, value: draft.value }], `已写入 ${draft.key}`) },
          }, draft.mode === 'edit' ? '保存' : '添加'),
          h('span', { className: 'secm-spacer' }),
          draft.mode === 'edit'
            ? h(Button, {
                size: 'sm', variant: 'ghost', className: 'secm-danger', disabled: busy,
                onClick: () => { void write([{ key: draft.key, remove: true }], `已删除 ${draft.key}`) },
              }, '删除')
            : null,
        ),
      )

      const keyRows = []
      for (const entry of entries) {
        if (draft !== null && draft.mode === 'edit' && draft.key === entry.key) {
          keyRows.push(h('li', { key: `${entry.key}:form`, className: 'secm-form-item', ref: formRef }, renderForm()))
          continue
        }
        const value = entry.value ?? ''
        const shown = revealed.has(entry.key)
        keyRows.push(h('li', { key: entry.key, className: 'secm-row' },
          h('span', { className: 'secm-key', title: entry.key }, entry.key),
          // The value is masked at its real length until the eye is pressed; the
          // page can copy it whole without ever painting it.
          shown ? null : h('span', { className: 'secm-value', title: '值已隐藏' }, mask(value)),
          h('span', { className: 'secm-spacer' }),
          h('span', { className: 'secm-row-actions' },
            h('button', {
              type: 'button',
              className: `secm-iconbtn${shown ? ' secm-iconbtn-on' : ''}`,
              title: shown ? `隐藏 ${entry.key} 的值` : `查看 ${entry.key} 的值`,
              'aria-label': shown ? `隐藏 ${entry.key} 的值` : `查看 ${entry.key} 的值`,
              'aria-pressed': shown,
              disabled: value.length === 0,
              onClick: () => toggleReveal(entry.key),
            }, h(EyeGlyph, { off: shown })),
            h(Button, {
              size: 'sm', variant: 'ghost',
              onClick: async () => {
                const ok = await copyText(value)
                setNotice(ok ? { kind: 'ok', text: `已复制 ${entry.key} 的值` } : { kind: 'error', text: `复制 ${entry.key} 失败：浏览器没有剪贴板权限` })
              },
            }, '复制值'),
            h(Button, {
              size: 'sm', variant: 'ghost',
              onClick: () => { setNotice(null); setDraft({ mode: 'edit', key: entry.key, value: entry.value }) },
            }, '编辑'),
          ),
          shown ? h('div', { className: 'secm-row-value' }, value) : null,
        ))
      }
      keyRows.push(draft !== null && draft.mode === 'add'
        ? h('li', { key: '__add', className: 'secm-form-item', ref: formRef }, renderForm())
        : h('li', { key: '__addRow' },
            h('button', {
              type: 'button',
              className: 'secm-add-row',
              disabled: selected === null,
              onClick: () => { setNotice(null); setDraft({ mode: 'add', key: '', value: '' }) },
            }, '＋ 新增密钥')))

      const selectedFile = files.find(file => file.path === selected) ?? null
      const fileLabel = file => (file.global === true ? `全局 $DSH_HOME/${file.name}` : file.relative)
      /**
       * The card leads with the file name: a full relative path ellipsizes its
       * tail, which is exactly the part that says which file this is.
       */
      const fileOwner = file => (file.global === true
        ? '全局 $DSH_HOME'
        : file.packageRelative === '.' || file.packageRelative === undefined ? '仓库根目录' : file.packageRelative)
      const cells = files.map(file => h('li', {
        key: file.path,
        className: `secm-card${file.path === selected ? ' secm-card-active' : ''}`,
      },
      h('button', {
        type: 'button',
        className: 'secm-card-main',
        'aria-pressed': file.path === selected,
        title: file.path,
        onClick: () => {
          setNotice(null)
          revealKeys.current = true
          setSelected(file.path)
          void loadFile(file.path)
        },
      },
        h('span', { className: 'secm-card-head' },
          h('span', { className: 'secm-card-name' }, file.name),
          file.global === true || file.packageRelative === '.'
            ? h(Tag, { tone: 'info' }, file.global === true ? '全局' : '根目录')
            : null,
        ),
        h('span', { className: 'secm-card-desc' }, `${String(file.keys.length)} 个键${file.missing === true ? ' · 未创建' : ''}`),
        h('span', { className: 'secm-card-owner', title: file.path }, fileOwner(file)),
        h('span', { className: 'secm-card-id', title: file.keys.join(', ') }, summarizeKeys(file.keys, 4)),
      )))

      const createRootEnv = () => {
        void (async () => {
          setBusy(true)
          setNotice(null)
          try {
            await post('/write', { cwd, path: `${data.projectRoot}/.env`, changes: [] })
            setNotice({ kind: 'ok', text: `已创建 ${data.projectRoot}/.env` })
            await load(cwd)
          } catch (error) {
            setNotice({ kind: 'error', text: String(error.message ?? error) })
          } finally {
            setBusy(false)
          }
        })()
      }

      // One empty state per reason: never a heading with zero rows under it.
      const emptyCard = () => h('div', { className: 'secm-empty' },
        h('p', { className: 'secm-empty-title' }, data.projectRoot === null ? '先选择一个工作区' : '这个仓库里还没有 .env 文件'),
        h('p', { className: 'secm-empty-hint' }, data.projectRoot === null
          ? '用上面的下拉框挑一个项目，插件会扫描它的仓库根和每个 workspace 包（以及全局 $DSH_HOME/.env）。'
          : '密钥留在 .env 里，shell 调用通过 DSH_ENV_FILES 现读现用，值不会被读进对话。'),
        data.projectRoot === null
          ? null
          : h(Button, { size: 'sm', variant: 'primary', disabled: busy, onClick: createRootEnv }, '在仓库根目录创建 .env'),
      )

      // The remote section speaks about the one node this workspace mirrors; a
      // local workspace has no remote side, and the Host skips the node scan.
      const remoteShown = remote.error !== null || remote.data === null
        || remote.data.scoped != null || remote.data.available === false

      return h('div', { className: 'secm-section', ref: rootRef },
        h('style', null, CSS),
        h('h2', { className: 'secm-title' }, '项目密钥'),
        h('p', { className: 'secm-intro' }, '这里发现并编辑 monorepo 里所有 .env 文件（仓库根目录 + 各个 workspace 包）。值默认打码；模型侧通过托管变量 DSH_ENV_FILES 加载，不需要把值读进对话。'),
        h('div', { className: 'secm-toolbar' },
          h('select', {
            className: 'secm-select',
            value: cwd ?? '',
            'aria-label': '要扫描的工作区',
            title: '要扫描的工作区',
            onChange: event => {
              setCwd(event.target.value)
              setSelected(null)
              setDraft(null)
              setRemote({ data: null, error: null })
            },
          }, h('option', { value: '' }, '（不指定项目）'), options),
          h(Button, { size: 'sm', variant: 'outline', disabled: busy, onClick: () => { void load(cwd) } }, '刷新'),
          h(Button, {
            size: 'sm', variant: 'outline', disabled: busy || selected === null,
            onClick: () => { setNotice(null); setDraft({ mode: 'add', key: '', value: '' }) },
          }, '新增密钥'),
        ),
        state.error !== null ? h('p', { className: 'secm-error', role: 'alert' }, state.error) : null,
        notice !== null ? h('p', { className: notice.kind === 'ok' ? 'secm-ok' : 'secm-error', role: 'status' }, notice.text) : null,
        data !== null && data.projectRoot !== null
          ? h('div', { className: 'secm-facts' },
              h('span', { className: 'secm-group-head' }, h('span', { className: 'secm-group-title' }, '模型在 shell 里看到的')),
              h('span', { className: 'secm-mono' }, `DSH_ENV_FILE=${data.shell.DSH_ENV_FILE || '(无)'}`),
              h('span', { className: 'secm-mono' }, `DSH_ENV_FILES=${data.shell.DSH_ENV_FILES || '(无)'}`),
              h('span', { className: 'secm-mono' }, `DSH_ENV_KEYS=${data.shell.DSH_ENV_KEYS || '(无)'}`),
              h('span', { className: 'secm-note' }, '需要密钥的命令先执行：set -a; for f in ${DSH_ENV_FILES//:/ }; do . "$f"; done; set +a'),
            )
          : null,
        h('div', { className: 'secm-group' },
          h('div', { className: 'secm-group-head' },
            h('h3', { className: 'secm-group-title' }, '变量文件'),
            h('span', { className: 'secm-group-count' }, String(files.length)),
          ),
          projectFiles.length === 0 && files.length > 0
            ? h('p', { className: 'secm-note' }, '这个仓库里还没有 .env；上面那张是全局层，对所有项目生效。')
            : null,
          state.loading && files.length === 0
            ? h('span', { className: 'secm-loading' }, '正在扫描…')
            : files.length > 0
              ? h('ul', { className: 'secm-grid' }, cells)
              : data === null ? null : emptyCard(),
        ),
        selected !== null
          ? h('div', { className: 'secm-group', ref: keysRef },
              h('div', { className: 'secm-group-head' },
                h('h3', { className: 'secm-group-title' }, `键 · ${String(entries.length)}`),
                selectedFile === null ? null : h('span', { className: 'secm-group-path', title: selectedFile.path }, fileLabel(selectedFile)),
              ),
              selectedFile?.global === true
                ? h('p', { className: 'secm-note' }, '全局层对所有项目生效，排在 DSH_ENV_FILES 最前（项目文件覆盖同名键）。DSH 进程自己也在启动时读它，所以进程配置（比如 NEW_API_KEY）改完要重启 dsh web；给 shell 用的值改完立刻生效。')
                : null,
              selectedFile?.missing === true
                ? h('div', { className: 'secm-empty' },
                    h('p', { className: 'secm-empty-title' }, '这个文件还没创建'),
                    h('p', { className: 'secm-empty-hint' }, '保存第一个键时会一并创建；也可以先建一个空文件占位。'),
                    h(Button, {
                      size: 'sm', variant: 'primary', disabled: busy,
                      onClick: () => { void write([], `已创建 ${selectedFile.path}`) },
                    }, '创建空文件'),
                  )
                : null,
              h('ul', { className: 'secm-rows' }, keyRows),
            )
          : null,
        remoteShown && h('div', { className: 'secm-group' },
          h('div', { className: 'secm-group-head' },
            h('h3', { className: 'secm-group-title' }, '远端节点（DevSpace）'),
            remote.data === null ? null : h('span', { className: 'secm-group-count' }, `${String((remote.data.nodes ?? []).length)} 个节点`),
          ),
          h('div', { className: 'secm-toolbar' },
            h('span', { className: 'secm-note' }, '键名来自该节点的允许根与一级子目录；值只在复制时单独读取。'),
            h('span', { className: 'secm-spacer' }),
            h(Button, { size: 'sm', variant: 'outline', disabled: remoteBusy, onClick: () => { void loadRemote() } },
              remoteBusy ? '扫描中…' : remote.data === null ? '扫描远端节点' : '重新扫描'),
          ),
          remote.data !== null && remote.data.scoped != null
            ? h('p', { className: 'secm-note' }, `当前工作区镜像的是 ${remote.data.scoped.label.length > 0 ? remote.data.scoped.label : remote.data.scoped.node}（${remote.data.scoped.node}）· 远端 ${remote.data.scoped.remotePath} · 本地 ${remote.data.scoped.localPath}`)
            : null,
          remote.error !== null ? h('p', { className: 'secm-error', role: 'alert' }, remote.error) : null,
          remoteBusy && remote.data === null
            ? h('span', { className: 'secm-loading' }, '正在扫描远端节点…（每个节点要跑若干次远端命令，通常几秒）')
            : remote.data === null
              ? null
              : remote.data.available === false
                ? h('p', { className: 'secm-note' }, remote.data.hint ?? '没有可用的远端节点。')
                : (remote.data.nodes ?? []).length === 0
                  ? h('p', { className: 'secm-note' }, '没有启用的远端节点。')
                  : h('ul', { className: 'secm-remote' }, (remote.data.nodes ?? []).map(node => h('li', { key: node.node, className: 'secm-remote-node' },
                      h('div', { className: 'secm-remote-head' },
                        h(Tag, { tone: 'outline' }, node.label.length > 0 ? node.label : node.node),
                        h('span', { className: 'secm-note' }, `${node.node} · ${node.root} · ${node.state === 'ready' ? '在线' : String(node.state)} · ${node.dialect === 'posix' ? 'bash' : 'PowerShell'}`),
                        h('span', { className: 'secm-spacer' }),
                        h('span', { className: 'secm-note' }, `${String((node.files ?? []).length)} 个文件 / ${String(node.keyCount)} 个键`),
                      ),
                      (node.errors ?? []).length > 0 ? h('p', { className: 'secm-error' }, node.errors.join('；')) : null,
                      (node.files ?? []).length === 0
                        ? h('p', { className: 'secm-note' }, '这个节点的允许根（含一级子目录）里没有 .env。')
                        : h('ul', { className: 'secm-remote-files' }, (node.files ?? []).map(file => h('li', { key: file.path, className: 'secm-remote-file' },
                            h('span', { className: 'secm-remote-path', title: file.nodePath ?? file.path }, file.nodePath ?? file.path),
                            h('span', { className: 'secm-remote-keys', title: file.keys.join('、') }, file.keys.length === 0
                              ? (file.readable ? '（没有键）' : '读不到内容')
                              : summarizeKeys(file.keys, 8)),
                          ))),
                    ))),
        ),
      )
    }


    /* ---- session-header inspector: 项目密钥 ---- */

    const secm_INSPECTOR_CSS = `
.secm-insp-head { position: relative; display: inline-flex; align-items: center; }
.secm-insp-btn { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; padding: 0; border: none; border-radius: 8px; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; }
.secm-insp-btn:hover { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-interactive-bg-hover); }
.secm-insp-btn:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -1px; }
.secm-insp-panel { position: fixed; z-index: 60; display: flex; flex-direction: column; gap: 8px; width: 430px; max-width: calc(100vw - 24px); max-height: 62vh; overflow: auto; padding: 12px 14px; box-sizing: border-box; border: 0.5px solid var(--dsw-alias-border-l4); border-radius: 14px; background: var(--dsw-alias-bg-overlay); box-shadow: var(--dsw-elevation-prominent); color: var(--dsw-alias-label-primary); }
.secm-insp-head-row { display: flex; align-items: center; gap: 8px; }
.secm-insp-title { font-size: 13px; font-weight: 600; }
.secm-insp-rows { display: flex; flex-direction: column; gap: 2px; margin: 0; padding: 0; list-style: none; }
.secm-insp-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-width: 0; padding: 5px 6px; border-radius: 6px; }
.secm-insp-row:hover { background: var(--dsw-alias-bg-layer-1); }
.secm-insp-name { flex: none; max-width: 190px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 500; }
.secm-insp-desc { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: var(--dsw-alias-label-tertiary); }
/* Same contract as the Settings page: a revealed value gets its own full line. */
.secm-insp-value { order: 9; flex: 1 0 100%; margin-top: 2px; padding: 5px 7px; box-sizing: border-box; border: 0.5px solid var(--dsw-alias-border-l4); border-radius: 8px; background: var(--dsw-alias-bg-base); font-family: var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 12px; line-height: 17px; color: var(--dsw-alias-label-primary); white-space: pre-wrap; overflow-wrap: anywhere; user-select: text; }
.secm-iconbtn { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; }
.secm-iconbtn:hover:not(:disabled) { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-interactive-bg-hover); }
.secm-iconbtn:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -1px; }
.secm-iconbtn:disabled { opacity: .4; cursor: default; }
.secm-iconbtn-on { color: var(--dsw-alias-brand-primary); }
.secm-insp-actions { flex: none; display: flex; align-items: center; gap: 2px; }
.secm-insp-note { margin: 0; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-tertiary); overflow-wrap: anywhere; }
.secm-insp-err { margin: 0; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-state-error-primary); overflow-wrap: anywhere; }
.secm-insp-strip { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.secm-insp-chip { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 9px; box-sizing: border-box; border: 0.5px solid var(--dsw-alias-border-l2); border-radius: 999px; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px; cursor: pointer; }
.secm-insp-chip:hover { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-interactive-bg-hover); }
.secm-insp-chip-active { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-brand-primary); background: var(--dsw-alias-bg-layer-1); }
.secm-insp-input { height: 28px; padding: 0 8px; box-sizing: border-box; border: 0.5px solid var(--dsw-alias-border-l4); border-radius: 8px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); font: inherit; font-size: 12px; }
.secm-insp-status { flex: none; font-size: 12px; color: var(--dsw-alias-label-tertiary); }
.secm-insp-sect { margin-top: 2px; font-size: 12px; font-weight: 600; letter-spacing: .04em; color: var(--dsw-alias-label-secondary); }
.secm-insp-sep { height: 0.5px; margin: 2px 0; background: var(--dsw-alias-border-l2); }
.secm-insp-sect-row { display: flex; align-items: center; gap: 8px; }
.secm-insp-count { flex: none; margin-left: auto; font-size: 12px; font-weight: 400; color: var(--dsw-alias-label-tertiary); }
.secm-insp-rowwrap { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.secm-insp-actions { flex: none; display: flex; align-items: center; gap: 2px; }
.secm-insp-remote { display: flex; flex-direction: column; gap: 6px; padding: 6px 6px 8px; max-height: 280px; overflow: auto; border: 0.5px solid var(--dsw-alias-border-l4); border-radius: 10px; background: var(--dsw-alias-bg-base); }
.secm-insp-file { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.secm-insp-filerow { display: flex; align-items: center; gap: 6px; width: 100%; min-width: 0; padding: 3px 4px; box-sizing: border-box; border: none; border-radius: 6px; background: transparent; color: var(--dsw-alias-label-secondary); font-family: inherit; font-size: 12px; text-align: left; cursor: pointer; }
.secm-insp-filerow:hover { background: var(--dsw-alias-bg-layer-1); }
.secm-insp-caret { flex: none; color: var(--dsw-alias-label-tertiary); transition: transform .12s; }
.secm-insp-filename { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace); color: var(--dsw-alias-label-primary); }
.secm-insp-filecount { flex: none; color: var(--dsw-alias-label-tertiary); }
/* Chips, not a wrapped text run: a long key can never overlap its neighbour. */
.secm-insp-keys { display: flex; flex-wrap: wrap; gap: 4px 6px; margin: 0; padding: 0 4px; list-style: none; }
.secm-insp-key { max-width: 100%; padding: 2px 7px; box-sizing: border-box; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border: 0.5px solid var(--dsw-border-subtle, var(--dsw-alias-border-l2)); border-radius: 999px; background: var(--dsw-alias-bg-layer-1); font-family: var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-primary); cursor: pointer; }
.secm-insp-key:hover { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-label-primary); background: var(--dsw-alias-interactive-bg-hover); }
.secm-insp-key:disabled { opacity: .5; cursor: default; }
.secm-insp-grow { flex: 1 1 60px; min-width: 60px; }
/* The key-name field of the add row: its own class, so the chip rule above
   cannot turn an input into a pill. */
.secm-insp-keyinput { flex: 0 1 120px; min-width: 80px; text-transform: uppercase; }
`

    /** Workspace directory this Session works in. */
    function secmInspectorCwd(sessionId, sessions, workspaces) {
      const pick = (entry) => {
        const direct = entry?.cwd ?? entry?.header?.cwd ?? entry?.workspacePath
        return typeof direct === 'string' && direct.length > 0 ? direct : null
      }
      const items = workspaces?.items ?? []
      const summary = sessionId === undefined ? undefined : sessions?.byId?.[sessionId]
      const own = pick(summary)
      if (own !== null) return own
      const owner = items.find(workspace => Array.isArray(workspace.sessionIds) && workspace.sessionIds.includes(sessionId))
      if (owner !== undefined) return owner.path
      // The Session under the conversation is the honest default; guessing the
      // first workspace listed pointed the panel at another project's secrets.
      const main = Object.values(sessions?.byId ?? {}).find(entry => (entry?.retainedBy?.mainView ?? 0) > 0)
      const mainOwn = pick(main)
      if (mainOwn !== null) return mainOwn
      const mainOwner = main === undefined
        ? undefined
        : items.find(workspace => Array.isArray(workspace.sessionIds) && workspace.sessionIds.includes(main.id))
      return mainOwner?.path ?? null
    }

    /** What the header entry last fetched, for the inspect probe below. */
    let secmInspectorFacts = { at: null, cwd: null, projectRoot: null, files: null, keys: null, error: null }

    const SECM_SECTION_LABEL = '项目密钥'
    const SECM_SETTINGS_TRIGGER = 'button[aria-haspopup="dialog"]'

    /**
     * Open this plugin's Settings page. The shell owns that navigation and
     * publishes no opener, so this presses the chrome it renders: the sidebar
     * trigger, then the nav row carrying this section's label.
     * @returns whether a trigger was found at all.
     */
    function secmOpenSettings() {
      const trigger = document.querySelector(SECM_SETTINGS_TRIGGER)
      if (trigger === null || typeof trigger.click !== 'function') return false
      trigger.click()
      let tries = 0
      const pick = () => {
        const panel = document.querySelector('div[role="dialog"][aria-labelledby]')
        if (panel !== null) {
          const row = [...panel.querySelectorAll('button')].find(button => (button.textContent ?? '').trim() === SECM_SECTION_LABEL)
          if (row !== undefined) { row.click(); return }
        }
        tries += 1
        if (tries < 25) window.setTimeout(pick, 40)
      }
      window.setTimeout(pick, 40)
      return true
    }

    /**
     * 项目密钥 inspector: one glyph in the Session header that opens its own
     * panel anchored to that button, so this information is one deliberate click
     * away and never occupies the conversation.
     */
    function SecretsInspector(props) {
      const sessions = props.useSessions(state => state)
      const workspaces = props.useWorkspaces(state => state)
      const cwd = secmInspectorCwd(props.sessionId, sessions, workspaces)
      const [open, setOpen] = React.useState(false)
      const [anchor, setAnchor] = React.useState(null)
      const [error, setError] = React.useState(null)
      const [notice, setNotice] = React.useState(null)
      const holder = React.useRef(null)
      const [files, setFiles] = React.useState(null)
      const [projectRoot, setProjectRoot] = React.useState(null)
      const [picked, setPicked] = React.useState(null)
      /** `{ key, value }` while one row is being re-valued. */
      const [editing, setEditing] = React.useState(null)
      /** `{ key, value }` while the add row is being filled in. */
      const [adding, setAdding] = React.useState(null)
      /** The key awaiting a delete confirmation. */
      const [confirming, setConfirming] = React.useState(null)
      const [busy, setBusy] = React.useState(false)
      /** Key names whose value the operator asked to see, and those values. */
      const [shown, setShown] = React.useState(() => new Set())
      const [values, setValues] = React.useState({})
      const [remote, setRemote] = React.useState(null)
      const [expandedRemote, setExpandedRemote] = React.useState(null)
      const [openRemoteFile, setOpenRemoteFile] = React.useState(null)
      // A workspace that mirrors nothing has no remote side: the section is absent
      // rather than listing every mounted node.
      const remoteShown = remote === null || remote.available === false || remote.scoped != null

      /** The remote listing belongs to the workspace's mirror, so it follows cwd. */
      const [remoteBusy, setRemoteBusy] = React.useState(false)
      const remoteSeq = React.useRef(0)
      const scanRemote = React.useCallback(async () => {
        const seq = remoteSeq.current + 1
        remoteSeq.current = seq
        const key = `${cwd ?? ''}|scoped`
        const cached = remoteCache.get(key)
        if (cached !== undefined && Date.now() - cached.at < REMOTE_TTL_MS) {
          setRemote(cached.data)
          return
        }
        setRemoteBusy(true)
        try {
          const params = []
          if (cwd !== null && cwd !== undefined && cwd !== '') params.push(`cwd=${encodeURIComponent(cwd)}`)
          const data = await call(`/remote${params.length === 0 ? '' : `?${params.join('&')}`}`)
          remoteCache.set(key, { at: Date.now(), data })
          if (seq !== remoteSeq.current) return
          setRemote(data)
        } catch (failure) {
          if (seq !== remoteSeq.current) return
          setRemote({ available: false, nodes: [], hint: `远端节点读取失败：${String(failure.message ?? failure)}` })
        } finally {
          if (seq === remoteSeq.current) setRemoteBusy(false)
        }
      }, [cwd])

      // A scan belongs to one workspace: switching Sessions re-resolves it.
      React.useEffect(() => { setRemote(null); void scanRemote() }, [scanRemote])

      const load = React.useCallback(async () => {
        try {
          const answer = await call(`/state${cwd === null ? '' : `?cwd=${encodeURIComponent(cwd)}`}`)
          // The global layer leads the chips: it is what every project sources first.
          const globalEntry = typeof answer.global?.path === 'string'
            ? [{
                path: answer.global.path,
                name: '.env',
                relative: '.env',
                keys: answer.global.keys ?? [],
                owner: '全局 $DSH_HOME',
                global: true,
                missing: answer.global.exists !== true,
              }]
            : []
          const list = [...globalEntry, ...(answer.packages ?? []).flatMap(pkg => (pkg.files ?? []).map(file => ({ ...file, owner: pkg.relative })))]
          setFiles(list)
          setProjectRoot(answer.projectRoot ?? null)
          // Default to the file a shell call would source (the project's nearest
          // one), falling back to the first chip — the global file with no project.
          const nearest = answer.shell?.DSH_ENV_FILE ?? ''
          const fallback = list.find(file => file.path === nearest)?.path ?? list[0]?.path ?? null
          setPicked(current => (current !== null && list.some(file => file.path === current) ? current : fallback))
          setError(null)
          secmInspectorFacts = {
            at: Date.now(),
            cwd: answer.cwd ?? cwd,
            projectRoot: answer.projectRoot ?? null,
            files: list.map(file => file.relative),
            keys: list.reduce((total, file) => total + (file.keys ?? []).length, 0),
            error: null,
          }
        } catch (failure) {
          setError(String(failure.message ?? failure))
          secmInspectorFacts = { ...secmInspectorFacts, at: Date.now(), cwd, error: String(failure.message ?? failure) }
        }
      }, [cwd])
      // Read on mount as well as on open, so the panel is ready when anchored.
      React.useEffect(() => { void load() }, [load])

      /**
       * Toggle one value's visibility. Revealing reads it once, on demand, and
       * hides it again by dropping it: a hidden value is not kept in memory.
       */
      const toggleShown = async (path, key) => {
        if (shown.has(key)) {
          setShown((previous) => { const next = new Set(previous); next.delete(key); return next })
          setValues((previous) => { const next = { ...previous }; delete next[key]; return next })
          return
        }
        setBusy(true)
        try {
          const answer = await post('/file', { cwd, path })
          const entry = (answer.entries ?? []).find(item => item.key === key)
          if (entry === undefined) throw new Error(`没有 ${key} 这个键`)
          setValues(previous => ({ ...previous, [key]: entry.value ?? '' }))
          setShown(previous => new Set(previous).add(key))
          setError(null)
        } catch (failure) {
          setError(String(failure.message ?? failure))
        } finally {
          setBusy(false)
        }
      }

      /**
       * Read one value and put it on the clipboard without ever rendering it:
       * the value exists only inside this function's stack.
       */
      const copyValue = async (path, key) => {
        setBusy(true)
        try {
          const answer = await post('/file', { cwd, path })
          const entry = (answer.entries ?? []).find(item => item.key === key)
          if (entry === undefined) throw new Error(`没有 ${key} 这个键`)
          const ok = await copyText(entry.value ?? '')
          setNotice(ok ? `已复制 ${key} 的值` : `复制 ${key} 失败：浏览器没有剪贴板权限`)
          setError(null)
        } catch (failure) {
          setError(String(failure.message ?? failure))
        } finally {
          setBusy(false)
        }
      }

      /** The same, for a key that lives on a node: read on demand, copy, forget. */
      const copyRemoteValue = async (node, path, key) => {
        setBusy(true)
        try {
          const answer = await post('/remote-value', { node, path, key })
          const ok = await copyText(answer.value ?? '')
          setNotice(ok ? `已复制 ${key} 的值` : `复制 ${key} 失败：浏览器没有剪贴板权限`)
          setError(null)
        } catch (failure) {
          setError(String(failure.message ?? failure))
        } finally {
          setBusy(false)
        }
      }

      /** One write against the picked file, then a fresh read of the index. */
      const write = async (changes, message) => {
        if (picked === null) {
          setError('先选一个变量文件')
          return
        }
        setBusy(true)
        setError(null)
        try {
          await post('/write', { cwd, path: picked, changes })
          setEditing(null)
          setAdding(null)
          setConfirming(null)
          // The file changed under the reveals: hide everything again.
          setShown(new Set())
          setValues({})
          setNotice(message ?? null)
          await load()
        } catch (failure) {
          setError(String(failure.message ?? failure))
        } finally {
          setBusy(false)
        }
      }

      /** Create the repository-root .env when the project has none yet. */
      const createFile = async () => {
        if (projectRoot === null) return
        setBusy(true)
        setError(null)
        try {
          await post('/write', { cwd, path: `${projectRoot}/.env`, changes: [] })
          setNotice('已创建 .env')
          await load()
        } catch (failure) {
          setError(String(failure.message ?? failure))
        } finally {
          setBusy(false)
        }
      }

      React.useEffect(() => {
        if (!open) return undefined
        const onKey = event => { if (event.key === 'Escape') setOpen(false) }
        const onPointer = event => { if (holder.current !== null && !holder.current.contains(event.target)) setOpen(false) }
        document.addEventListener('keydown', onKey)
        document.addEventListener('mousedown', onPointer)
        return () => {
          document.removeEventListener('keydown', onKey)
          document.removeEventListener('mousedown', onPointer)
        }
      }, [open])
      const toggle = (event) => {
        const box = event.currentTarget.getBoundingClientRect()
        setAnchor({ top: box.bottom + 6, right: Math.max(8, window.innerWidth - box.right) })
        setError(null)
        setNotice(null)
        setOpen(current => !current)
      }

      const keyName = value => /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(value ?? '').trim())
      const current = files === null ? null : (files.find(file => file.path === picked) ?? null)
      const keys = current?.keys ?? []
      // The global file is always listed, so "this project has no .env" is a
      // question about the project files alone.
      const projectFileCount = files === null ? 0 : files.filter(file => file.global !== true).length
      const valueInput = (state, setState, placeholder) => h('input', {
        className: 'secm-insp-input secm-insp-grow',
        type: 'password',
        autoComplete: 'new-password',
        placeholder,
        'aria-label': placeholder,
        value: state.value,
        disabled: busy,
        onChange: event => setState({ ...state, value: event.target.value }),
      })

      return h('span', { className: 'secm-insp-head', ref: holder },
        h('style', null, secm_INSPECTOR_CSS),
        h('button', {
          type: 'button',
          className: 'secm-insp-btn',
          title: '项目密钥',
          'aria-label': '项目密钥',
          'aria-haspopup': 'dialog',
          'aria-expanded': open,
          onClick: toggle,
        }, h(IconShieldOutline16, { size: 16 })),
        open && anchor !== null
          ? h('div', {
              className: 'secm-insp-panel',
              role: 'dialog',
              'aria-label': '项目密钥',
              style: { top: `${String(anchor.top)}px`, right: `${String(anchor.right)}px` },
            },
              h('div', { className: 'secm-insp-head-row' },
                h('span', { className: 'secm-insp-title' }, '项目密钥'),
                h('span', { className: 'secm-insp-status' }, files === null ? '读取中…' : `${String(keys.length)} 个键`),
                h('span', { style: { flex: '1' } }),
                h(Button, { size: 'sm', variant: 'outline', onClick: () => secmOpenSettings() }, '打开管理页'),
                h(Button, { size: 'sm', variant: 'ghost', onClick: () => setOpen(false) }, '关闭'),
              ),
              h('div', { className: 'secm-insp-sect-row' },
                h('span', { className: 'secm-insp-sect' }, '本地'),
                h('span', { className: 'secm-insp-count' }, `${projectRoot ?? cwd ?? '（未识别）'}`),
              ),
              error !== null ? h('p', { className: 'secm-insp-err', role: 'alert' }, error) : null,
              notice !== null ? h('p', { className: 'secm-insp-note', role: 'status' }, notice) : null,
              files !== null && files.length > 0 && projectFileCount === 0
                ? h('p', { className: 'secm-insp-note' }, '这个仓库里还没有 .env，下面那张是全局层，对所有项目生效。')
                : null,
              files === null
                ? h('p', { className: 'secm-insp-note', role: 'status' }, '正在读取本地 .env…')
                : h(React.Fragment, null,
                    files.length === 0
                      ? h('p', { className: 'secm-insp-note' }, '本地这个仓库里还没有 .env。')
                      : h('div', { className: 'secm-insp-strip' }, files.map(file => h('button', {
                          key: file.path,
                          type: 'button',
                          className: `secm-insp-chip${file.path === picked ? ' secm-insp-chip-active' : ''}`,
                          'aria-pressed': file.path === picked,
                          title: file.path,
                          onClick: () => {
                            setPicked(file.path)
                            setEditing(null)
                            setAdding(null)
                            setConfirming(null)
                            // Reveals belong to the file that was on screen.
                            setShown(new Set())
                            setValues({})
                          },
                        }, `${file.global === true ? '全局 .env' : file.relative}（${String((file.keys ?? []).length)}）`))),
                    current?.global === true
                      ? h('p', { className: 'secm-insp-note' }, '全局层对所有项目生效；DSH 进程配置（如 NEW_API_KEY）改完要重启 dsh web。')
                      : null,
                    // In-place CRUD: the picked file's keys, each row able to
                    // re-value and delete without leaving the panel.
                    keys.length === 0
                      ? (files.length === 0
                          ? null
                          : h('p', { className: 'secm-insp-note' }, picked === null
                              ? '先选一个变量文件。'
                              : current?.missing === true
                                ? '这个文件还没创建，保存第一个键时就会建。'
                                : '这个文件还没有键，用下面的输入框加一个。'))
                      : h('ul', { className: 'secm-insp-rows' }, keys.map(key => {
                          return h('li', { key, className: 'secm-insp-row' },
                            h('span', { className: 'secm-insp-name' }, key),
                            editing !== null && editing.key === key
                              ? h(React.Fragment, null,
                                  valueInput(editing, setEditing, '新值'),
                                  h(Button, {
                                    size: 'sm', variant: 'primary',
                                    disabled: busy || editing.value.length === 0,
                                    onClick: () => { void write([{ key, value: editing.value }], `已更新 ${key}`) },
                                  }, '保存'),
                                  h(Button, { size: 'sm', variant: 'ghost', disabled: busy, onClick: () => setEditing(null) }, '取消'),
                                )
                              : confirming === key
                                ? h(React.Fragment, null,
                                    h('span', { className: 'secm-insp-desc' }, `删除 ${key}？`),
                                    h(Button, { size: 'sm', variant: 'ghost', disabled: busy, onClick: () => { void write([{ key, remove: true }], `已删除 ${key}`) } }, '删除'),
                                    h(Button, { size: 'sm', variant: 'ghost', disabled: busy, onClick: () => setConfirming(null) }, '取消'),
                                  )
                                : h(React.Fragment, null,
                                    shown.has(key) ? null : h('span', { className: 'secm-insp-desc' }, '••••••'),
                                    h('span', { className: 'secm-insp-actions' },
                                      h('button', {
                                        type: 'button',
                                        className: `secm-iconbtn${shown.has(key) ? ' secm-iconbtn-on' : ''}`,
                                        title: shown.has(key) ? `隐藏 ${key} 的值` : `查看 ${key} 的值`,
                                        'aria-label': shown.has(key) ? `隐藏 ${key} 的值` : `查看 ${key} 的值`,
                                        'aria-pressed': shown.has(key),
                                        'data-secm-reveal': key,
                                        disabled: busy,
                                        onClick: () => { void toggleShown(picked, key) },
                                      }, h(EyeGlyph, { off: shown.has(key) })),
                                      h(Button, {
                                        size: 'sm', variant: 'ghost', disabled: busy,
                                        'data-secm-copy': key,
                                        onClick: () => { void copyValue(picked, key) },
                                      }, '复制值'),
                                      h(Button, { size: 'sm', variant: 'ghost', disabled: busy, onClick: () => { setConfirming(null); setEditing({ key, value: '' }) } }, '改'),
                                      h(Button, { size: 'sm', variant: 'ghost', disabled: busy, onClick: () => { setEditing(null); setConfirming(key) } }, '删'),
                                    ),
                                    shown.has(key) ? h('div', { className: 'secm-insp-value' }, values[key] ?? '') : null,
                                  ),
                          )
                        })),
                    picked === null
                      ? null
                      : h('div', { className: 'secm-insp-strip' },
                          adding === null
                            ? h(Button, {
                                size: 'sm', variant: 'outline', disabled: busy,
                                onClick: () => { setNotice(null); setAdding({ key: '', value: '' }) },
                              }, '新增键')
                            : h(React.Fragment, null,
                                h('input', {
                                  className: 'secm-insp-input secm-insp-keyinput',
                                  placeholder: 'KEY_NAME',
                                  'aria-label': '新增键名',
                                  value: adding.key,
                                  disabled: busy,
                                  onChange: event => setAdding({ ...adding, key: event.target.value }),
                                }),
                                valueInput(adding, setAdding, '值'),
                                h(Button, {
                                  size: 'sm', variant: 'primary',
                                  disabled: busy || !keyName(adding.key) || adding.value.length === 0,
                                  onClick: () => { void write([{ key: adding.key.trim(), value: adding.value }], `已写入 ${adding.key.trim()}`) },
                                }, '保存'),
                                h(Button, { size: 'sm', variant: 'ghost', disabled: busy, onClick: () => setAdding(null) }, '取消'),
                              )),
                    projectFileCount === 0 && projectRoot !== null
                      ? h(Button, { size: 'sm', variant: 'outline', disabled: busy, onClick: () => { void createFile() } }, '在仓库根创建 .env')
                      : null,
                  ),
              remoteShown && h('div', { className: 'secm-insp-sep' }),
              remoteShown && h('div', { className: 'secm-insp-head-row' },
                h('span', { className: 'secm-insp-sect' }, remote === null
                  ? '远端节点'
                  : `远端节点 · ${String((remote.nodes ?? []).length)}${remote.durationMs === undefined ? '' : ` · 读取 ${(remote.durationMs / 1000).toFixed(1)}s`}`),
                h('span', { style: { flex: '1' } }),
                h(Button, {
                  size: 'sm', variant: remote === null ? 'outline' : 'ghost', disabled: remoteBusy,
                  onClick: () => { void scanRemote() },
                }, remoteBusy ? '扫描中…' : remote === null ? '扫描' : '重扫'),
              ),
              remote !== null && remote.available === false
                ? h('p', { className: 'secm-insp-note' }, remote.hint ?? '没有可用的远端节点。')
                : remote === null || remote.scoped == null || (remote.nodes ?? []).length === 0
                  ? null
                  : h(React.Fragment, null,
                          h('p', { className: 'secm-insp-note' }, `当前工作区镜像的是 ${remote.scoped.label.length > 0 ? remote.scoped.label : remote.scoped.node}（${remote.scoped.node}）· 远端 ${remote.scoped.remotePath}`),
                          h('ul', { className: 'secm-insp-rows' }, (remote.nodes ?? []).map(node => h('li', { key: node.node, className: 'secm-insp-rowwrap' },
                              h('div', { className: 'secm-insp-row' },
                                h('span', { className: 'secm-insp-name' }, node.label.length > 0 ? node.label : node.node),
                                h('span', { className: 'secm-insp-desc' }, (node.files ?? []).length === 0
                                  ? `${node.node} · 没有 .env`
                                  : `${String((node.files ?? []).length)} 个 .env / ${String(node.keyCount)} 个键 · ${node.node}`),
                                h('span', { className: 'secm-insp-actions' },
                                  (node.files ?? []).length > 0
                                    ? h(Button, {
                                        size: 'sm', variant: 'ghost',
                                        'data-secm-expand': node.node,
                                        'aria-expanded': expandedRemote === node.node,
                                        onClick: () => setExpandedRemote(current => (current === node.node ? null : node.node)),
                                      }, expandedRemote === node.node ? '收起' : '展开')
                                    : null,
                                ),
                              ),
                              expandedRemote === node.node && (node.files ?? []).length > 0
                                ? h('div', { className: 'secm-insp-remote' }, (node.files ?? []).map((file) => {
                                    const fileOpen = openRemoteFile === file.path
                                    return h('div', { key: file.path, className: 'secm-insp-file' },
                                      h('button', {
                                        type: 'button',
                                        className: 'secm-insp-filerow',
                                        'data-secm-file': file.path,
                                        'aria-expanded': fileOpen,
                                        title: file.nodePath ?? file.path,
                                        onClick: () => setOpenRemoteFile(current => (current === file.path ? null : file.path)),
                                      },
                                        h(IconChevronRightOutline14, { size: 12, className: 'secm-insp-caret', style: { transform: fileOpen ? 'rotate(90deg)' : 'none' } }),
                                        h('span', { className: 'secm-insp-filename' }, file.nodePath ?? file.path),
                                        h('span', { className: 'secm-insp-filecount' }, `${String(file.keys.length)} 个键`),
                                      ),
                                      fileOpen
                                        ? (file.keys.length === 0
                                            ? h('p', { className: 'secm-insp-note' }, file.readable ? '（没有键）' : '读不到内容')
                                            : h(React.Fragment, null,
                                                h('p', { className: 'secm-insp-note' }, '点键名即复制它的值（值不会显示在这里）。'),
                                                h('ul', { className: 'secm-insp-keys' }, file.keys.map(key => h('li', { key },
                                                    h('button', {
                                                      type: 'button',
                                                      className: 'secm-insp-key',
                                                      'data-secm-copy-remote': `${file.path}:${key}`,
                                                      title: `复制 ${key} 的值`,
                                                      disabled: busy,
                                                      onClick: () => { void copyRemoteValue(node.node, file.path, key) },
                                                    }, key),
                                                  ))),
                                              ))
                                        : null,
                                    )
                                  }))
                                : null,
                            ))),
                        ),
              h('p', { className: 'secm-insp-note' }, '值不显示，只能整段复制；写入保留注释与顺序，值不会进模型上下文。'),

            )
          : null,
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'secrets-manager',
          order: 32,
          label: '项目密钥',
        }, Page))

        ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
          name: 'conversation.session.header.utilities',
          id: 'plugin-secrets',
          order: 53,
          label: '项目密钥',
        }, SecretsInspector))

        // Read-only self-check over the harness's own Cordis Inspect channel.
        // Reactive injection, not a one-shot `ctx.get`: this plugin's apply may
        // run before the inspect service exists (it did, so this manifest never
        // reached the host roster).
        ctx.inject(['cordisInspect'], (inspectCtx) => {
          try {
            ctx.effect(() => inspectCtx.cordisInspect.register({
              manifest: {
                id: 'SecretsManagerPage',
                description: 'Live geometry and content facts of the Secrets Manager settings page.',
                methods: [{
                  name: 'measure',
                  description: 'Return the current layout (when mounted) plus the history of layouts captured while the page was on screen.',
                  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
                  outputSchema: { description: 'Geometry and content report for the Secrets Manager page.' },
                }],
              },
              query: () => {
                const live = document.querySelector('.secm-section')
                return Promise.resolve({
                  mountedNow: live !== null,
                  // The header inspector is its own surface; report its real DOM.
                  inspector: (() => {
                    const head = document.querySelector('.secm-insp-head')
                    if (head === null) return { mounted: false }
                    const button = head.querySelector('button')
                    const box = button === null ? null : button.getBoundingClientRect()
                    return {
                      mounted: true,
                      textContent: (button === null ? '' : button.textContent).trim(),
                      svgCount: head.querySelectorAll('svg').length,
                      box: box === null ? null : { width: Math.round(box.width), height: Math.round(box.height) },
                    }
                  })(),

                  // What the header entry actually fetched, and what its panel
                  // renders when it is open.
                  inspectorFacts: secmInspectorFacts,
                  inspectorPanel: (() => {
                    const panel = document.querySelector('.secm-insp-panel')
                    if (panel === null) return { mounted: false }
                    const box = panel.getBoundingClientRect()
                    return {
                      mounted: true,
                      width: Math.round(box.width),
                      text: panel.textContent.replace(/\s+/g, ' ').trim().slice(0, 400),
                      rows: panel.querySelectorAll('.secm-insp-row').length,
                      remoteKeys: panel.querySelectorAll('.secm-insp-keys .secm-insp-key').length,
                      remoteCopyButtons: panel.querySelectorAll('[data-secm-copy-remote]').length,
                      remoteFiles: panel.querySelectorAll('.secm-insp-filerow').length,
                      inputs: panel.querySelectorAll('input').length,
                    }
                  })(),
                  live: live === null ? null : measureElement(live),
                  capturedCount: captured.length,
                  history: captured,
                  hint: captured.length === 0
                    ? 'No snapshot yet: open Settings -> 项目密钥 once; the page measures itself on every render.'
                    : null,
                })
              },
            }), 'secrets-manager: inspect provider')
          } catch (error) {
            console.warn('[secrets-manager] inspect provider registration failed:', error)
          }
        })
      },
    }
  },
})
