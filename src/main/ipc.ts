/**
 * Every channel in shared/contract.ts is implemented here, once.
 *
 * Handlers stay thin: they translate a renderer command into a call on the
 * registry, the injection manager, a store, or the backend client. No layout
 * maths and no business rules live in this file.
 */

import { ipcMain, type IpcMainInvokeEvent, type WebContents } from 'electron'
import { CONTENT_CHANNELS, type CommandName, type CommandReq, type CommandRes } from '@shared/contract'
import type {
  AskRequest,
  ExtractedPage,
  ExtractSchema,
  HistoryEntry,
  Note,
  OrganizeSuggestion,
  TabGroup,
  TabId,
  WorkspaceSnapshot
} from '@shared/types'
import type { AppWindow } from './AppWindow'
import { JsonStore, newId } from './store'
import { backend, backendStatus, recheckBackend } from './api'
import { hostLabel } from './urls'

const HISTORY_CAP = 8000

function handle<K extends CommandName>(
  channel: K,
  fn: (payload: CommandReq<K>, event: IpcMainInvokeEvent) => CommandRes<K> | Promise<CommandRes<K>>
): void {
  ipcMain.handle(channel, (event, payload: unknown) => fn(payload as CommandReq<K>, event))
}

/* ------------------------------------------------------------------ */
/* Content-preload request/response plumbing                           */
/* ------------------------------------------------------------------ */

type Pending<T> = { resolve: (v: T) => void; timer: NodeJS.Timeout }

type ExtractPayload = Record<string, unknown> | null
type SelectionPayload = { text: string; anchor: string | null } | null

const pendingExtract = new Map<string, Pending<ExtractPayload>>()
const pendingSelection = new Map<string, Pending<SelectionPayload>>()

ipcMain.on(CONTENT_CHANNELS.extractResult, (_e, payload: { requestId: string; data: unknown }) => {
  const p = pendingExtract.get(payload.requestId)
  if (!p) return
  clearTimeout(p.timer)
  pendingExtract.delete(payload.requestId)
  p.resolve((payload.data as Record<string, unknown> | null) ?? null)
})

ipcMain.on(CONTENT_CHANNELS.selectionResult, (_e, payload: { requestId: string; data: unknown }) => {
  const p = pendingSelection.get(payload.requestId)
  if (!p) return
  clearTimeout(p.timer)
  pendingSelection.delete(payload.requestId)
  p.resolve((payload.data as { text: string; anchor: string | null } | null) ?? null)
})

function askContent<T>(
  wc: WebContents,
  channel: string,
  map: Map<string, Pending<T>>,
  payload: Record<string, unknown>,
  fallback: T,
  timeoutMs = 6000
): Promise<T> {
  return new Promise<T>((resolve) => {
    const requestId = newId('r')
    const timer = setTimeout(() => {
      map.delete(requestId)
      resolve(fallback)
    }, timeoutMs)
    map.set(requestId, { resolve, timer })
    try {
      wc.send(channel, { requestId, ...payload })
    } catch {
      clearTimeout(timer)
      map.delete(requestId)
      resolve(fallback)
    }
  })
}

/* ------------------------------------------------------------------ */

export function registerIpc(win: AppWindow): void {
  const history = new JsonStore<HistoryEntry[]>('history', [])
  const notes = new JsonStore<Note[]>('notes', [])
  const workspaces = new JsonStore<WorkspaceSnapshot[]>('workspaces', [])

  const activeStreams = new Map<string, () => void>()
  let focusGoal: string | null = null

  win.setHistorySink((entry) => {
    const list = history.get()
    // Close out the previous visit on this tab with a dwell time.
    for (let i = list.length - 1; i >= 0; i--) {
      const prev = list[i]
      if (prev && prev.tabId === entry.tabId && prev.dwellSeconds === 0) {
        prev.dwellSeconds = Math.max(0, Math.round((entry.visitedAt - prev.visitedAt) / 1000))
        break
      }
    }
    list.push(entry)
    if (list.length > HISTORY_CAP) list.splice(0, list.length - HISTORY_CAP)
    history.set(list)
  })

  /* -------------------------------------------------------------- */
  /* Extraction                                                      */
  /* -------------------------------------------------------------- */

  async function extractPage(tabId: TabId, schema: ExtractSchema = 'article'): Promise<ExtractedPage | null> {
    const view = win.tabs.view(tabId)
    const model = win.tabs.model(tabId)
    if (!view || !model || view.webContents.isDestroyed()) return null

    const raw = await askContent<ExtractPayload>(
      view.webContents,
      CONTENT_CHANNELS.extractRequest,
      pendingExtract,
      { schema },
      null
    )
    if (!raw) return null

    return {
      tabId,
      url: (raw['url'] as string) ?? model.url,
      title: (raw['title'] as string) ?? model.title,
      text: (raw['text'] as string) ?? '',
      excerpt: (raw['excerpt'] as string) ?? '',
      headings: (raw['headings'] as ExtractedPage['headings']) ?? [],
      links: (raw['links'] as ExtractedPage['links']) ?? [],
      images: (raw['images'] as string[]) ?? [],
      lang: (raw['lang'] as string | null) ?? null,
      product: (raw['product'] as ExtractedPage['product']) ?? null,
      sections: (raw['sections'] as ExtractedPage['sections']) ?? [],
      extractedAt: (raw['extractedAt'] as number) ?? Date.now(),
      wordCount: (raw['wordCount'] as number) ?? 0
    }
  }

  async function extractMany(tabIds: TabId[], schema: ExtractSchema = 'article'): Promise<ExtractedPage[]> {
    const results = await Promise.all(tabIds.map((id) => extractPage(id, schema)))
    return results.filter((p): p is ExtractedPage => p !== null)
  }

  function resolveScope(req: AskRequest): TabId[] {
    if (req.tabIds.length > 0) return req.tabIds
    if (req.scope === 'tabs') {
      return win.tabs.models().filter((m) => !m.asleep && m.url).map((m) => m.id)
    }
    return win.tabs.activeTabId ? [win.tabs.activeTabId] : []
  }

  /* -------------------------------------------------------------- */
  /* App / window                                                    */
  /* -------------------------------------------------------------- */

  handle('app.snapshot', () => ({
    tabs: win.tabs.models(),
    order: win.tabs.getOrder(),
    groups: win.tabs.getGroups(),
    activeTabId: win.tabs.activeTabId,
    shell: win.shell,
    window: win.metrics,
    backend: backendStatus()
  }))

  handle('app.backendStatus', () => recheckBackend())

  handle('window.minimize', () => {
    win.win.minimize()
  })
  handle('window.toggleMaximize', () => {
    win.win.isMaximized() ? win.win.unmaximize() : win.win.maximize()
  })
  handle('window.close', () => {
    win.win.close()
  })

  /* -------------------------------------------------------------- */
  /* Tabs                                                            */
  /* -------------------------------------------------------------- */

  handle('tab.create', (p) => ({ tabId: win.tabs.create(p ?? {}) }))
  handle('tab.close', (p) => win.tabs.close(p.tabId))
  handle('tab.activate', (p) => {
    if (p.pane !== undefined && p.pane > 0) {
      const panes = [...win.shell.paneTabIds]
      panes[p.pane] = p.tabId
      win.setShellState({ paneTabIds: panes })
      return
    }
    win.tabs.activate(p.tabId)
  })
  handle('tab.reorder', (p) => win.tabs.reorder(p.tabId, p.toIndex))
  handle('tab.navigate', (p) => win.tabs.navigate(p.tabId, p.input))
  handle('tab.goBack', (p) => win.tabs.goBack(p.tabId))
  handle('tab.goForward', (p) => win.tabs.goForward(p.tabId))
  handle('tab.reload', (p) => win.tabs.reload(p.tabId, p.hard))
  handle('tab.stop', (p) => win.tabs.stop(p.tabId))
  handle('tab.setPinned', (p) => win.tabs.setPinned(p.tabId, p.pinned))
  handle('tab.setMuted', (p) => win.tabs.setMuted(p.tabId, p.muted))
  handle('tab.sleep', (p) => win.tabs.sleep(p.tabId))
  handle('tab.wake', (p) => win.tabs.wake(p.tabId))
  handle('tab.duplicate', (p) => ({ tabId: win.tabs.duplicate(p.tabId) ?? p.tabId }))
  handle('tab.setZoom', (p) => win.tabs.setZoom(p.tabId, p.factor))
  handle('tab.setGroup', (p) => win.tabs.setGroup(p.tabId, p.groupId))

  /* -------------------------------------------------------------- */
  /* Groups                                                          */
  /* -------------------------------------------------------------- */

  handle('group.create', (p) => ({ groupId: win.tabs.createGroup(p.name, p.color, p.tabIds ?? []) }))
  handle('group.rename', (p) => win.tabs.updateGroup(p.groupId, { name: p.name }))
  handle('group.recolor', (p) => win.tabs.updateGroup(p.groupId, { color: p.color }))
  handle('group.setCollapsed', (p) => win.tabs.updateGroup(p.groupId, { collapsed: p.collapsed }))
  handle('group.remove', (p) => win.tabs.removeGroup(p.groupId, p.closeTabs ?? false))

  /* -------------------------------------------------------------- */
  /* Shell layout + split                                            */
  /* -------------------------------------------------------------- */

  handle('shell.setState', (p) => win.setShellState(p ?? {}))
  handle('shell.beginDrag', () => win.setShellState({ dragging: true }))
  handle('shell.endDrag', (p) =>
    win.setShellState({ dragging: false, ...(p?.splitRatio ? { splitRatio: p.splitRatio } : {}) })
  )

  handle('split.set', (p) => {
    const count = Math.max(1, p.paneTabIds.length)
    const ratio = p.splitRatio ?? new Array<number>(count).fill(1 / count)
    win.setShellState({ paneTabIds: p.paneTabIds, splitRatio: ratio })
  })

  handle('split.close', (p) => {
    const panes = win.shell.paneTabIds.filter((_, i) => i !== p.pane)
    const ratios = win.shell.splitRatio.filter((_, i) => i !== p.pane)
    const count = Math.max(1, ratios.length)
    win.setShellState({
      paneTabIds: panes.length > 0 ? panes : [null],
      splitRatio: ratios.length > 0 ? ratios : [1],
      ...(count === 1 ? {} : {})
    })
  })

  /* -------------------------------------------------------------- */
  /* Overlay + find                                                  */
  /* -------------------------------------------------------------- */

  handle('overlay.open', (p) => win.openOverlay(p))
  handle('overlay.close', () => win.closeOverlay())
  handle('overlay.resultRect', (p) => win.setOverlayHeight(p.height))

  handle('overlay.runCommand', (p) => {
    win.closeOverlay()
    win.sendShell('overlay:commandRun', { commandId: p.commandId, ...(p.arg ? { arg: p.arg } : {}) })
  })

  const findWired = new Set<number>()

  handle('find.start', (p) => {
    const id = win.tabs.activeTabId
    const view = id ? win.tabs.view(id) : null
    if (!view) return
    const wc = view.webContents
    if (!findWired.has(wc.id)) {
      findWired.add(wc.id)
      wc.on('found-in-page', (_e, result) => {
        win.sendShell('find:state', {
          query: p.query,
          matches: result.matches ?? 0,
          activeMatch: result.activeMatchOrdinal ?? 0
        })
        win.sendOverlay('find:state', {
          query: p.query,
          matches: result.matches ?? 0,
          activeMatch: result.activeMatchOrdinal ?? 0
        })
      })
    }
    if (!p.query) {
      wc.stopFindInPage('clearSelection')
      return
    }
    wc.findInPage(p.query, { forward: p.forward ?? true, findNext: false })
  })

  handle('find.stop', () => {
    const id = win.tabs.activeTabId
    win.tabs.view(id ?? '')?.webContents.stopFindInPage('clearSelection')
  })

  /* -------------------------------------------------------------- */
  /* Focus mode                                                      */
  /* -------------------------------------------------------------- */

  handle('focus.set', async (p) => {
    const view = win.tabs.view(p.tabId)
    if (!view) return
    if (p.enabled) await win.injection.enable(p.tabId, view.webContents)
    else await win.injection.disable(p.tabId, view.webContents)
    win.tabs.setFocusMode(p.tabId, p.enabled)
    const hidden = win.injection.report(p.tabId).length
    win.toast('info', p.enabled ? `集中モード: ${hidden} 種類の要素を非表示` : '集中モードを解除')
  })

  handle('focus.setGoal', (p) => {
    focusGoal = p.goal
    win.toast('info', focusGoal ? `目的を設定: ${focusGoal}` : '目的をクリア')
  })

  /* -------------------------------------------------------------- */
  /* Page + AI                                                       */
  /* -------------------------------------------------------------- */

  handle('page.extract', (p) => extractPage(p.tabId, p.schema ?? 'article'))

  handle('page.selection', (p) => {
    const view = win.tabs.view(p.tabId)
    if (!view) return Promise.resolve(null)
    return askContent<SelectionPayload>(
      view.webContents,
      CONTENT_CHANNELS.selectionRequest,
      pendingSelection,
      {},
      null,
      2000
    )
  })

  handle('ai.ask', async (req) => {
    const tabIds = resolveScope(req)
    const streamId = newId('s')

    let question = req.question
    const activeView = win.tabs.activeTabId ? win.tabs.view(win.tabs.activeTabId) : null
    if (req.scope === 'selection' && activeView) {
      const sel = await askContent<SelectionPayload>(
        activeView.webContents,
        CONTENT_CHANNELS.selectionRequest,
        pendingSelection,
        {},
        null,
        2000
      )
      if (sel?.text) question = `${question}\n\n---\n選択範囲:\n${sel.text}`
    }

    const pages = await extractMany(tabIds, 'article')

    const cancel = backend().ask(
      { ...req, question, tabIds, pages },
      {
        onDelta: (delta) => win.sendShell('ai:chunk', { streamId, delta }),
        onDone: (result) => {
          activeStreams.delete(streamId)
          win.sendShell('ai:done', { streamId, text: result.text, citations: result.citations })
        },
        onError: (message) => {
          activeStreams.delete(streamId)
          win.sendShell('ai:error', { streamId, message })
        }
      }
    )
    activeStreams.set(streamId, cancel)
    return { streamId }
  })

  handle('ai.cancel', (p) => {
    activeStreams.get(p.streamId)?.()
    activeStreams.delete(p.streamId)
  })

  handle('ai.organizeTabs', async (p) => {
    const ids = p.tabIds.length > 0 ? p.tabIds : win.tabs.models().filter((m) => m.url).map((m) => m.id)
    const pages = await extractMany(ids, 'article')
    return backend().organize(pages)
  })

  handle('ai.applyOrganize', (p: { suggestions: OrganizeSuggestion[] }) => {
    for (const s of p.suggestions) {
      if (s.tabIds.length === 0) continue
      const existing = win.tabs.getGroups().find((g: TabGroup) => g.name === s.groupName)
      const groupId = existing?.id ?? win.tabs.createGroup(s.groupName, s.color)
      for (const tabId of s.tabIds) win.tabs.setGroup(tabId, groupId)
    }
    win.toast('success', `${p.suggestions.length} グループに整理しました`)
  })

  handle('ai.summarize', async (p) => {
    const ids = p.tabIds.length > 0 ? p.tabIds : win.tabs.models().filter((m) => m.url).map((m) => m.id)
    return backend().summarize(await extractMany(ids, 'article'))
  })

  handle('ai.compare', async (p) => {
    const pages = await extractMany(p.tabIds, 'product')
    return backend().compare(pages)
  })

  handle('ai.search', async (p) => {
    const corpus = history.get().slice(-1500).map((h) => ({
      url: h.url,
      title: h.title,
      text: `${h.title} ${hostLabel(h.url)}`,
      visitedAt: h.visitedAt,
      tabId: h.tabId
    }))
    // Open tabs contribute their live text, which is what makes queries like
    // "the red bag page I saw" work before the backend index exists.
    for (const model of win.tabs.models()) {
      if (!model.url || model.asleep) continue
      const page = await extractPage(model.id, 'article')
      if (page) {
        corpus.push({
          url: page.url,
          title: page.title,
          text: page.text.slice(0, 6000),
          visitedAt: model.lastActiveAt,
          tabId: model.id
        })
      }
    }
    return backend().search(p.query, corpus)
  })

  /* -------------------------------------------------------------- */
  /* Workspaces                                                      */
  /* -------------------------------------------------------------- */

  handle('workspace.list', () => workspaces.get())

  handle('workspace.save', (p) => {
    const id = newId('w')
    const snapshot: WorkspaceSnapshot = {
      id,
      name: p.name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tabs: win.tabs.models().map((m) => ({
        url: m.url || m.pendingUrl || '',
        title: m.title,
        faviconUrl: m.faviconUrl,
        groupId: m.groupId,
        pinned: m.pinned
      })),
      groups: win.tabs.getGroups(),
      activeTabId: win.tabs.activeTabId,
      shell: {
        tabMode: win.shell.tabMode,
        splitRatio: win.shell.splitRatio,
        aiOpen: win.shell.aiOpen,
        aiWidth: win.shell.aiWidth
      }
    }
    workspaces.set([...workspaces.get(), snapshot])
    win.toast('success', `ワークスペース「${p.name}」を保存しました`)
    return { id }
  })

  handle('workspace.restore', (p) => {
    const ws = workspaces.get().find((w) => w.id === p.id)
    if (!ws) return
    if (p.replace) win.tabs.closeAll()

    win.tabs.setGroups(ws.groups)
    let first: TabId | null = null
    for (const t of ws.tabs) {
      if (!t.url) continue
      const id = win.tabs.create({ url: t.url, groupId: t.groupId, background: true })
      if (t.pinned) win.tabs.setPinned(id, true)
      first ??= id
    }
    if (first) win.tabs.activate(first)
    win.setShellState(ws.shell)
    win.toast('success', `「${ws.name}」を復元しました（${ws.tabs.length} タブ）`)
  })

  handle('workspace.remove', (p) => {
    workspaces.set(workspaces.get().filter((w) => w.id !== p.id))
  })

  handle('workspace.rename', (p) => {
    workspaces.set(
      workspaces.get().map((w) => (w.id === p.id ? { ...w, name: p.name, updatedAt: Date.now() } : w))
    )
  })

  /* -------------------------------------------------------------- */
  /* History                                                         */
  /* -------------------------------------------------------------- */

  handle('history.list', (p) => {
    const since = p?.since ?? 0
    const limit = p?.limit ?? 500
    return history
      .get()
      .filter((h) => h.visitedAt >= since)
      .slice(-limit)
      .reverse()
  })

  handle('history.search', (p) => {
    const q = p.query.toLowerCase().trim()
    if (!q) return []
    return history
      .get()
      .filter((h) => h.title.toLowerCase().includes(q) || h.url.toLowerCase().includes(q))
      .slice(-(p.limit ?? 200))
      .reverse()
  })

  handle('history.clear', () => {
    history.set([])
  })

  /* -------------------------------------------------------------- */
  /* Notes and highlights                                            */
  /* -------------------------------------------------------------- */

  const pushNotes = (): void => win.sendShell('notes:changed', notes.get())

  handle('notes.list', () => notes.get())

  handle('notes.add', (p) => {
    const note: Note = { ...p, id: newId('n'), createdAt: Date.now() }
    notes.set([...notes.get(), note])
    pushNotes()
    return note
  })

  handle('notes.update', (p) => {
    notes.set(notes.get().map((n) => (n.id === p.id ? { ...n, ...p.patch } : n)))
    pushNotes()
  })

  handle('notes.remove', (p) => {
    notes.set(notes.get().filter((n) => n.id !== p.id))
    pushNotes()
  })

  handle('notes.captureHighlight', async (p) => {
    const view = win.tabs.view(p.tabId)
    const model = win.tabs.model(p.tabId)
    if (!view || !model) return null

    const sel = await askContent<SelectionPayload>(
      view.webContents,
      CONTENT_CHANNELS.selectionRequest,
      pendingSelection,
      {},
      null,
      2000
    )
    if (!sel?.text) {
      win.toast('info', 'ページ上でテキストを選択してから実行してください')
      return null
    }

    const note: Note = {
      id: newId('n'),
      kind: 'highlight',
      text: sel.text,
      comment: null,
      url: model.url,
      title: model.title,
      anchor: sel.anchor,
      tags: [],
      createdAt: Date.now()
    }
    notes.set([...notes.get(), note])
    pushNotes()
    view.webContents.send(CONTENT_CHANNELS.highlightApply, {})
    win.toast('success', 'ハイライトを保存しました')
    return note
  })
}
