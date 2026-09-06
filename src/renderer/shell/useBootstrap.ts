import { useEffect } from 'react'
import { api, send } from '../shared/api'
import { useTabs } from '../shared/store/tabs'
import { useShell } from '../shared/store/shell'
import { useAi } from '../shared/store/ai'
import { useLibrary } from '../shared/store/library'
import { useUi } from '../shared/store/ui'
import { emit } from '../shared/bus'

/**
 * Subscribes the React projection to main's events, once.
 *
 * Note what is NOT here: no polling, and no state that main also holds. Every
 * update arrives as a patch on the channel that caused it.
 */
export function useBootstrap(): void {
  useEffect(() => {
    const tabs = useTabs.getState()
    const shell = useShell.getState()
    const ai = useAi.getState()
    const library = useLibrary.getState()
    const ui = useUi.getState()

    const offs: (() => void)[] = [
      api.on('app:snapshot', (s) => {
        tabs.hydrate(s)
        shell.setShell(s.shell)
        shell.setMetrics(s.window)
        ui.setBackend(s.backend)
      }),
      api.on('tab:patch', ({ tabId, patch }) => tabs.applyPatch(tabId, patch)),
      api.on('tab:created', ({ tab, index }) => tabs.addTab(tab, index)),
      api.on('tab:removed', ({ tabId }) => tabs.removeTab(tabId)),
      api.on('tab:order', ({ order, activeTabId }) => tabs.setOrder(order, activeTabId)),
      api.on('group:changed', ({ groups }) => tabs.setGroups(groups)),
      api.on('shell:state', (s) => shell.setShell(s)),
      api.on('window:metrics', (m) => shell.setMetrics(m)),
      api.on('window:contentRect', (g) => shell.setGeometry(g)),
      api.on('ai:chunk', ({ streamId, delta }) => ai.appendDelta(streamId, delta)),
      api.on('ai:done', ({ streamId, text, citations }) => {
        ai.finish(streamId, text, citations)
        emit('scroll-ai-bottom')
      }),
      api.on('ai:error', ({ streamId, message }) => ai.fail(streamId, message)),
      api.on('history:added', (entry) => library.prependHistory(entry)),
      api.on('notes:changed', (notes) => library.setNotes(notes)),
      api.on('link:hover', ({ url }) => ui.setHoverUrl(url)),
      api.on('find:state', (state) => ui.setFind(state)),
      api.on('backend:status', (status) => ui.setBackend(status)),
      api.on('toast', ({ kind, message }) => ui.pushToast(kind, message)),
      api.on('shell:shortcut', ({ combo }) => runShortcut(combo))
    ]

    void api.invoke('app.snapshot').then((s) => {
      tabs.hydrate(s)
      shell.setShell(s.shell)
      shell.setMetrics(s.window)
      ui.setBackend(s.backend)
    })
    void library.loadAll()

    const onKey = (event: KeyboardEvent): void => {
      // Never steal a key while an IME conversion is in flight.
      if (event.isComposing || event.keyCode === 229) return
      const combo = comboOf(event)
      if (!combo) return
      event.preventDefault()
      runShortcut(combo)
    }
    window.addEventListener('keydown', onKey)

    // Window control overlay: reserve exactly the space Windows actually uses
    // rather than hardcoding a width.
    const wco = (
      navigator as Navigator & {
        windowControlsOverlay?: {
          getTitlebarAreaRect(): DOMRect
          addEventListener(t: string, l: () => void): void
        }
      }
    ).windowControlsOverlay
    const syncWco = (): void => {
      try {
        const rect = wco?.getTitlebarAreaRect()
        if (!rect) return
        const right = Math.max(0, window.innerWidth - (rect.x + rect.width))
        document.documentElement.style.setProperty('--wco-right', `${right + 8}px`)
      } catch {
        /* not supported */
      }
    }
    syncWco()
    wco?.addEventListener('geometrychange', syncWco)
    window.addEventListener('resize', syncWco)

    return () => {
      offs.forEach((off) => off())
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', syncWco)
    }
  }, [])
}

function comboOf(e: KeyboardEvent): string | null {
  const key = e.key.length === 1 ? e.key.toUpperCase() : e.key
  const ctrl = e.ctrlKey || e.metaKey

  if (ctrl && !e.altKey) {
    if (e.shiftKey && (key === 'K' || key === 'P')) return 'Ctrl+Shift+K'
    if (!e.shiftKey && ['K', 'T', 'W', 'L', 'F', 'N'].includes(key)) return `Ctrl+${key}`
    if (key === 'Tab') return e.shiftKey ? 'Ctrl+Shift+Tab' : 'Ctrl+Tab'
    if (!e.shiftKey && /^[1-9]$/.test(key)) return `Ctrl+${key}`
  }
  if (key === 'F3') return 'F3'
  if (e.altKey && key === 'ArrowLeft') return 'Alt+Left'
  if (e.altKey && key === 'ArrowRight') return 'Alt+Right'
  if (key === 'Escape') return 'Escape'
  return null
}

/** One implementation, whether the key was pressed in the chrome or in a page. */
export function runShortcut(combo: string): void {
  const { activeTabId, order } = useTabs.getState()
  const shell = useShell.getState()

  switch (combo) {
    case 'Ctrl+T':
    case 'Ctrl+N':
      send('tab.create', {})
      return
    case 'Ctrl+W':
      if (activeTabId) send('tab.close', { tabId: activeTabId })
      return
    case 'Ctrl+L':
      emit('focus-omnibox')
      return
    case 'Ctrl+K':
      void api.invoke('overlay.open', { mode: 'palette', anchor: null, query: '' })
      return
    case 'Ctrl+Shift+K':
      shell.patchShell({ aiOpen: !shell.shell.aiOpen })
      return
    case 'Ctrl+F':
    case 'F3':
      emit('open-find')
      return
    case 'Alt+Left':
      if (activeTabId) send('tab.goBack', { tabId: activeTabId })
      return
    case 'Alt+Right':
      if (activeTabId) send('tab.goForward', { tabId: activeTabId })
      return
    case 'Escape':
      void api.invoke('overlay.close')
      if (activeTabId) send('tab.stop', { tabId: activeTabId })
      return
    case 'Ctrl+Tab':
    case 'Ctrl+Shift+Tab': {
      if (order.length < 2 || !activeTabId) return
      const i = order.indexOf(activeTabId)
      const delta = combo === 'Ctrl+Tab' ? 1 : -1
      const next = order[(i + delta + order.length) % order.length]
      if (next) send('tab.activate', { tabId: next })
      return
    }
    default: {
      const m = /^Ctrl\+([1-9])$/.exec(combo)
      if (!m) return
      const n = Number(m[1])
      const target = n === 9 ? order[order.length - 1] : order[n - 1]
      if (target) send('tab.activate', { tabId: target })
    }
  }
}
