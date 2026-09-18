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
    const { Button, Input, Tag, Pill, IconShieldOutline16 } = require('@deepseek-ai/dsh-client-ui-primitives')
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
.secm-group-head { margin: 0; font-size: 12px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--dsw-alias-label-tertiary); }
.secm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(224px, 1fr)); grid-auto-rows: 1fr; gap: 12px; margin: 0; padding: 0; list-style: none; }
.secm-card { display: flex; flex-direction: column; background: transparent; border: 0.5px solid var(--dsw-alias-border-l4); border-radius: 20px; transition: border-color .16s, background .16s; }
.secm-card:hover:not(.secm-card-active) { background: var(--dsw-alias-interactive-bg-hover); }
.secm-card-active { background: var(--dsw-alias-bg-module-platform); border-color: var(--dsw-static-neutral-bluish-400); }
.secm-card-main { flex: 1; display: flex; flex-direction: column; gap: 8px; padding: 14px 16px 12px; appearance: none; border: 0; border-radius: 12px 12px 0 0; background: none; font: inherit; color: inherit; text-align: left; cursor: pointer; }
.secm-card-main:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
.secm-card-head { display: flex; align-items: center; gap: 6px; min-width: 0; }
.secm-card-name { min-width: 0; overflow: hidden; font-size: 14px; font-weight: 600; line-height: 1.4; text-overflow: ellipsis; white-space: nowrap; }
.secm-card-desc { font-size: 12px; line-height: 1.55; color: var(--dsw-alias-label-secondary); overflow-wrap: anywhere; }
.secm-card-id { margin-top: auto; font-family: var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 11px; line-height: 17px; color: var(--dsw-alias-label-tertiary); overflow-wrap: anywhere; }
.secm-rows { display: flex; flex-direction: column; gap: 2px; margin: 0; padding: 0; list-style: none; }
.secm-row { display: flex; align-items: center; gap: 10px; min-width: 0; padding: 7px 10px; border-radius: 8px; }
.secm-row:hover { background: var(--dsw-alias-bg-layer-1); }
.secm-key { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 12px; }
.secm-value { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 12px; color: var(--dsw-alias-label-secondary); }
.secm-row-actions { flex: none; display: flex; align-items: center; gap: 2px; }
.secm-add { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; width: 100%; height: 100%; min-height: 120px; padding: 16px; box-sizing: border-box; appearance: none; cursor: pointer; font: inherit; text-align: center; color: var(--dsw-alias-label-tertiary); background: transparent; border: 0.5px dashed var(--dsw-alias-border-l2); border-radius: 20px; transition: border-color .16s, background .16s, color .16s; }
.secm-add:hover { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-brand-primary); background: var(--dsw-alias-interactive-bg-hover); }
.secm-add:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
.secm-add-plus { font-size: 22px; line-height: 1; }
.secm-add-label { font-size: 14px; font-weight: 600; color: currentColor; }
.secm-add-hint { font-size: 12px; line-height: 1.5; }
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
.secm-empty { padding: 20px; font-size: 13px; color: var(--dsw-alias-label-tertiary); text-align: center; border: 0.5px dashed var(--dsw-alias-border-l4); border-radius: 20px; }
.secm-loading { font-size: 13px; color: var(--dsw-alias-label-tertiary); }

.secm-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.secm-spacer { flex: 1 1 0; }
.secm-note { margin: 0; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-tertiary); overflow-wrap: anywhere; }
.secm-error { margin: 0; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-state-error-primary); overflow-wrap: anywhere; }
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

    /* -------------------- layout self-check (read-only) -------------------- */

    const captured = []

    function recordReport(report) {
      const signature = [
        report.section.width, report.section.height,
        report.fileCount, report.keyCount, report.formOpen, report.offenderCount,
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
        addTileVisible: section.querySelector('.secm-add') !== null,
        offenderCount: offenders.length,
        offenders: offenders.slice(0, 10),
      }
    }

    /* ------------------------------- page ------------------------------- */

    function Page() {
      const rootRef = React.useRef(null)
      const formRef = React.useRef(null)
      const [state, setState] = React.useState({ loading: true, error: null, data: null })
      const [cwd, setCwd] = React.useState(null)
      const [selected, setSelected] = React.useState(null)
      const [entries, setEntries] = React.useState([])
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

      const files = (state.data?.packages ?? []).flatMap(pkg => pkg.files.map(file => ({ ...file, packageRelative: pkg.relative })))

      const loadFile = React.useCallback(async (target) => {
        if (target === null) {
          setEntries([])
          return
        }
        try {
          const file = await post('/file', { cwd, path: target })
          setEntries(file.entries)
        } catch (error) {
          setEntries([])
          setNotice({ kind: 'error', text: String(error.message ?? error) })
        }
      }, [cwd])

      const [showAllRemote, setShowAllRemote] = React.useState(false)
      const loadRemote = React.useCallback(async () => {
        try {
          const params = []
          if (cwd !== null && cwd !== undefined && cwd !== '') params.push(`cwd=${encodeURIComponent(cwd)}`)
          if (showAllRemote) params.push('all=1')
          setRemote({ data: await call(`/remote${params.length === 0 ? '' : `?${params.join('&')}`}`), error: null })
        } catch (error) {
          setRemote({ data: null, error: String(error.message ?? error) })
        }
      }, [cwd, showAllRemote])

      const load = React.useCallback(async (target) => {
        setState(previous => ({ ...previous, loading: true, error: null }))
        try {
          const query = target ? `?cwd=${encodeURIComponent(target)}` : ''
          const data = await call(`/state${query}`)
          setState({ loading: false, error: null, data })
          const all = (data.packages ?? []).flatMap(pkg => pkg.files.map(file => file.path))
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

      React.useEffect(() => { void loadRemote() }, [loadRemote])

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

      const write = React.useCallback(async (changes, note) => {
        if (selected === null) return
        setBusy(true)
        setNotice(null)
        try {
          await post('/write', { cwd, path: selected, changes })
          if (note !== undefined) setNotice({ kind: 'ok', text: note })
          setDraft(null)
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
          h('label', { className: 'secm-field-label' }, '名称'),
          h(Input, {
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
          h('label', { className: 'secm-field-label' }, '值' ),
          h(Input, {
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
        keyRows.push(h('li', { key: entry.key, className: 'secm-row' },
          h('span', { className: 'secm-key' }, entry.key),
          // The page never paints a value: it can be copied, and edit writes a
          // new one.
          h('span', { className: 'secm-value' }, '••••••'),
          h('span', { className: 'secm-row-actions' },
            h(Button, {
              size: 'sm', variant: 'ghost',
              onClick: async () => {
                const ok = await copyText(entry.value ?? '')
                setNotice(ok ? { kind: 'ok', text: `已复制 ${entry.key} 的值` } : { kind: 'error', text: `复制 ${entry.key} 失败：浏览器没有剪贴板权限` })
              },
            }, '复制值'),
            h(Button, {
              size: 'sm', variant: 'ghost',
              onClick: () => { setNotice(null); setDraft({ mode: 'edit', key: entry.key, value: entry.value }) },
            }, '编辑'),
          ),
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

      const cells = files.map(file => h('li', {
        key: file.path,
        className: `secm-card${file.path === selected ? ' secm-card-active' : ''}`,
      },
      h('button', {
        type: 'button',
        className: 'secm-card-main',
        onClick: () => { setNotice(null); setSelected(file.path); void loadFile(file.path) },
      },
        h('span', { className: 'secm-card-head' },
          h('span', { className: 'secm-card-name' }, file.relative),
          h(Tag, { tone: file.packageRelative === '.' ? 'info' : 'neutral' }, file.packageRelative === '.' ? '根目录' : file.packageRelative),
        ),
        h('span', { className: 'secm-card-desc' }, `${String(file.keys.length)} 个键`),
        h('span', { className: 'secm-card-id' }, file.keys.join(', ') || '(空)'),
      )))

      return h('div', { className: 'secm-section', ref: rootRef },
        h('style', null, CSS),
        h('h2', { className: 'secm-title' }, '项目密钥'),
        h('p', { className: 'secm-intro' }, '这里发现并编辑 monorepo 里所有 .env 文件（仓库根目录 + 各个 workspace 包）。值默认打码；模型侧通过托管变量 DSH_ENV_FILES 加载，不需要把值读进对话。'),
        h('div', { className: 'secm-toolbar' },
          h('select', {
            className: 'secm-select',
            value: cwd ?? '',
            title: '要扫描的工作区',
            onChange: event => { setCwd(event.target.value); setSelected(null); setDraft(null) },
          }, h('option', { value: '' }, '（不指定项目）'), options),
          h(Button, { size: 'sm', variant: 'outline', disabled: busy, onClick: () => { void load(cwd) } }, '刷新'),
          h(Button, {
            size: 'sm', variant: 'outline', disabled: busy || selected === null,
            onClick: () => { setNotice(null); setDraft({ mode: 'add', key: '', value: '' }) },
          }, '新增密钥'),
        ),
        state.error !== null ? h('p', { className: 'secm-error' }, state.error) : null,
        notice !== null ? h('p', { className: notice.kind === 'ok' ? 'secm-ok' : 'secm-error' }, notice.text) : null,
        data !== null && data.projectRoot !== null
          ? h('div', { className: 'secm-facts' },
              h('span', { className: 'secm-group-head' }, '模型在 shell 里看到的'),
              h('span', { className: 'secm-mono' }, `DSH_ENV_FILE=${data.shell.DSH_ENV_FILE || '(无)'}`),
              h('span', { className: 'secm-mono' }, `DSH_ENV_FILES=${data.shell.DSH_ENV_FILES || '(无)'}`),
              h('span', { className: 'secm-mono' }, `DSH_ENV_KEYS=${data.shell.DSH_ENV_KEYS || '(无)'}`),
              h('span', { className: 'secm-note' }, '需要密钥的命令先执行：set -a; for f in ${DSH_ENV_FILES//:/ }; do . "$f"; done; set +a'),
            )
          : null,
        data !== null && files.length === 0 && !state.loading
          ? h('div', { className: 'secm-empty' },
              h('p', { className: 'secm-note' }, data.projectRoot === null ? '请选择工作区。' : '这个仓库里还没有 .env 文件。'),
              data.projectRoot === null
                ? null
                : h(Button, {
                    size: 'sm', variant: 'primary', disabled: busy,
                    onClick: () => {
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
                    },
                  }, '在仓库根目录创建 .env'),
            )
          : null,
        h('div', { className: 'secm-group' },
          h('h3', { className: 'secm-group-head' }, `变量文件 · ${String(files.length)}`),
          state.loading && files.length === 0
            ? h('span', { className: 'secm-loading' }, '正在扫描…')
            : h('ul', { className: 'secm-grid' }, cells),
        ),
        selected !== null
          ? h('div', { className: 'secm-group' },
              h('h3', { className: 'secm-group-head' }, `键 · ${String(entries.length)}　${selected}`),
              h('ul', { className: 'secm-rows' }, keyRows),
            )
          : null,
        h('div', { className: 'secm-group' },
          h('h3', { className: 'secm-group-head' }, '远端节点（DevSpace）'),
          remote.data != null && remote.data.scoped != null
            ? h('p', { className: 'secm-note' }, `${showAllRemote ? '现在显示全部节点' : '只看当前工作区镜像的节点'}：${remote.data.scoped.label.length > 0 ? remote.data.scoped.label : remote.data.scoped.node}（${remote.data.scoped.node}）· 远端 ${remote.data.scoped.remotePath} · 本地 ${remote.data.scoped.localPath}`)
            : null,
          h('div', { className: 'secm-toolbar' },
            h('span', { className: 'secm-note' }, '每个节点当前 .env 文件里的键名：扫描节点允许根 + 一级子目录，**只读键名，不读值**。'),
            h('span', { className: 'secm-spacer' }),
            (remote.data?.total ?? 0) > 1
              ? h(Button, {
                  size: 'sm', variant: 'ghost', disabled: busy,
                  onClick: () => setShowAllRemote(current => !current),
                }, showAllRemote ? '只看当前节点' : '显示全部节点')
              : null,
            h(Button, { size: 'sm', variant: 'outline', disabled: busy, onClick: () => { void loadRemote() } }, '刷新远端'),
          ),
          remote.error !== null ? h('p', { className: 'secm-error' }, remote.error) : null,
          remote.data === null
            ? h('span', { className: 'secm-loading' }, '读取中…')
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
                          h('span', { className: 'secm-remote-path' }, file.nodePath ?? file.path),
                          h('span', { className: 'secm-remote-keys' }, file.keys.length === 0
                            ? (file.readable ? '（没有键）' : '读不到内容')
                            : file.keys.join('、')),
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
.secm-insp-dot { position: absolute; top: 3px; right: 3px; width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-state-error-primary); }
.secm-insp-panel { position: fixed; z-index: 60; display: flex; flex-direction: column; gap: 8px; width: 430px; max-width: calc(100vw - 24px); max-height: 62vh; overflow: auto; padding: 12px 14px; box-sizing: border-box; border: 0.5px solid var(--dsw-alias-border-l4); border-radius: 14px; background: var(--dsw-alias-bg-overlay); box-shadow: var(--dsw-elevation-prominent); color: var(--dsw-alias-label-primary); }
.secm-insp-head-row { display: flex; align-items: center; gap: 8px; }
.secm-insp-title { font-size: 13px; font-weight: 600; }
.secm-insp-rows { display: flex; flex-direction: column; gap: 2px; margin: 0; padding: 0; list-style: none; }
.secm-insp-row { display: flex; align-items: center; gap: 8px; min-width: 0; padding: 5px 6px; border-radius: 6px; }
.secm-insp-row:hover { background: var(--dsw-alias-bg-layer-1); }
.secm-insp-name { flex: none; max-width: 190px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 500; }
.secm-insp-desc { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: var(--dsw-alias-label-tertiary); }
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
.secm-insp-alltitle { font-size: 11px; font-weight: 600; color: var(--dsw-alias-label-secondary); overflow-wrap: anywhere; }
.secm-insp-file { display: flex; flex-direction: column; gap: 2px; }
.secm-insp-keys { display: flex; flex-wrap: wrap; gap: 4px 10px; margin: 0; padding: 0; list-style: none; }
.secm-insp-key { font-family: var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 12px; color: var(--dsw-alias-label-primary); }
.secm-insp-grow { flex: 1 1 60px; min-width: 60px; }
.secm-insp-key { flex: 0 1 120px; min-width: 80px; text-transform: uppercase; }
.secm-insp-pre { margin: 0; padding: 8px 10px; max-height: 180px; overflow: auto; border: 0.5px solid var(--dsw-alias-border-l4); border-radius: 10px; background: var(--dsw-alias-bg-base); font-family: var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace); font-size: 11px; line-height: 16px; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--dsw-alias-label-secondary); }
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
      const [shown, setShown] = React.useState(() => new Set())
      const [values, setValues] = React.useState({})
      /** `{ key, value }` while one row is being re-valued. */
      const [editing, setEditing] = React.useState(null)
      /** `{ key, value }` while the add row is being filled in. */
      const [adding, setAdding] = React.useState(null)
      /** The key awaiting a delete confirmation. */
      const [confirming, setConfirming] = React.useState(null)
      const [busy, setBusy] = React.useState(false)
      const [remote, setRemote] = React.useState(null)
      const [expandedRemote, setExpandedRemote] = React.useState(null)

      const [showAllRemote, setShowAllRemote] = React.useState(false)
      React.useEffect(() => {
        void (async () => {
          try {
            const params = []
            if (cwd !== null && cwd !== undefined && cwd !== '') params.push(`cwd=${encodeURIComponent(cwd)}`)
            if (showAllRemote) params.push('all=1')
            setRemote(await call(`/remote${params.length === 0 ? '' : `?${params.join('&')}`}`))
          } catch {
            setRemote({ available: false, nodes: [], hint: '远端节点读取失败' })
          }
        })()
      }, [cwd, showAllRemote])

      const load = React.useCallback(async () => {
        try {
          const answer = await call(`/state${cwd === null ? '' : `?cwd=${encodeURIComponent(cwd)}`}`)
          const list = (answer.packages ?? []).flatMap(pkg => (pkg.files ?? []).map(file => ({ ...file, owner: pkg.relative })))
          setFiles(list)
          setProjectRoot(answer.projectRoot ?? null)
          setPicked(current => (current !== null && list.some(file => file.path === current) ? current : (list[0]?.path ?? null)))
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
      const valueInput = (state, setState, placeholder) => h('input', {
        className: 'secm-insp-input secm-insp-grow',
        type: 'password',
        autoComplete: 'new-password',
        placeholder,
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
          onClick: toggle,
        }, h(IconShieldOutline16, { size: 16 })),
        open && anchor !== null
          ? h('div', {
              className: 'secm-insp-panel',
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
              error !== null ? h('p', { className: 'secm-insp-err' }, error) : null,
              notice !== null ? h('p', { className: 'secm-insp-note' }, notice) : null,
              files === null
                ? h('p', { className: 'secm-insp-note' }, '读取中…')
                : h(React.Fragment, null,
                    files.length === 0
                      ? h('p', { className: 'secm-insp-note' }, '这个仓库里还没有 .env 文件。')
                      : h('div', { className: 'secm-insp-strip' }, files.map(file => h('button', {
                          key: file.path,
                          type: 'button',
                          className: `secm-insp-chip${file.path === picked ? ' secm-insp-chip-active' : ''}`,
                          title: file.path,
                          onClick: () => { setPicked(file.path); setEditing(null); setAdding(null); setConfirming(null) },
                        }, `${file.relative}（${String((file.keys ?? []).length)}）`))),
                    // In-place CRUD: the picked file's keys, each row able to
                    // reveal, re-value and delete without leaving the panel.
                    keys.length === 0
                      ? h('p', { className: 'secm-insp-note' }, picked === null
                          ? '先选一个变量文件。'
                          : '这个文件还没有键，用下面的输入框加一个。')
                      : h('ul', { className: 'secm-insp-rows' }, keys.map(key => {
                          const id = `${String(picked)}:${key}`
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
                                    h('span', { className: 'secm-insp-desc' }, '••••••'),
                                    h('span', { className: 'secm-insp-actions' },
                                      h(Button, {
                                        size: 'sm', variant: 'ghost', disabled: busy,
                                        'data-secm-copy': key,
                                        onClick: () => { void copyValue(picked, key) },
                                      }, '复制值'),
                                      h(Button, { size: 'sm', variant: 'ghost', disabled: busy, onClick: () => { setConfirming(null); setEditing({ key, value: '' }) } }, '改'),
                                      h(Button, { size: 'sm', variant: 'ghost', disabled: busy, onClick: () => { setEditing(null); setConfirming(key) } }, '删'),
                                    ),
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
                                  className: 'secm-insp-input secm-insp-key',
                                  placeholder: 'KEY_NAME',
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
                    files.length === 0 && projectRoot !== null
                      ? h(Button, { size: 'sm', variant: 'outline', disabled: busy, onClick: () => { void createFile() } }, '在仓库根创建 .env')
                      : null,
                  ),
              h('div', { className: 'secm-insp-sep' }),
              remote === null
                ? h('p', { className: 'secm-insp-note' }, '远端读取中…（每个节点要跑若干次远端命令，通常几秒）')
                : null,
              remote !== null && remote.available !== false && (remote.nodes ?? []).length > 0
                ? h('div', null,
                    h('div', { className: 'secm-insp-head-row' },
                      h('span', { className: 'secm-insp-sect' }, `远端节点 · ${String((remote.nodes ?? []).length)}${(remote.total ?? 0) > 1 && remote.scoped !== null ? `/${String(remote.total)}` : ''}${remote.durationMs === undefined ? '' : ` · 读取 ${(remote.durationMs / 1000).toFixed(1)}s`}`),
                      h('span', { style: { flex: '1' } }),
                      (remote.total ?? 0) > 1
                        ? h(Button, {
                            size: 'sm', variant: 'ghost',
                            onClick: () => setShowAllRemote(current => !current),
                          }, showAllRemote ? '只看当前节点' : '显示全部节点')
                        : null,
                    ),
                    remote.scoped != null && !showAllRemote
                      ? h('p', { className: 'mcpm-insp-note' }, `当前工作区镜像的是 ${remote.scoped.label.length > 0 ? remote.scoped.label : remote.scoped.node}（${remote.scoped.node}）· 远端 ${remote.scoped.remotePath}`)
                      : null,
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
                                  onClick: () => setExpandedRemote(current => (current === node.node ? null : node.node)),
                                }, expandedRemote === node.node ? '收起' : '展开')
                              : null,
                          ),
                        ),
                        expandedRemote === node.node && (node.files ?? []).length > 0
                          ? h('div', { className: 'secm-insp-remote' }, (node.files ?? []).map(file => h('div', { key: file.path, className: 'secm-insp-file' },
                              h('div', { className: 'secm-insp-alltitle' }, `${file.nodePath ?? file.path}　${String(file.keys.length)} 个键`),
                              file.keys.length === 0
                                ? h('p', { className: 'secm-insp-note' }, file.readable ? '（没有键）' : '读不到内容')
                                : h('ul', { className: 'secm-insp-keys' }, file.keys.map(key => h('li', { key, className: 'secm-insp-key' }, key))),
                            )))
                          : null,
                      ))),
                  )
                : null,
              h('p', { className: 'secm-insp-note' }, '值不显示，只能整段复制到剪贴板；写入保留注释与顺序，值也不会进模型上下文。'),

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
