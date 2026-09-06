/**
 * The tab registry — the source of truth React renders a projection of.
 *
 * A tab is a live OS process, not a React object: it can crash, navigate on its
 * own, or be closed by the page. Everything that can happen to one is turned
 * into a patch and pushed to the renderer here.
 *
 * A tab with an empty `url` has NO WebContentsView at all — the shell draws the
 * start page in the content rect instead. That keeps a fresh window at one
 * process, and gives us the sleeping/crashed/start states for free.
 */

import { WebContentsView, type Session, type WebContents } from 'electron'
import type { GroupColor, GroupId, HistoryEntry, TabGroup, TabId, TabModel } from '@shared/types'
import { GROUP_COLORS } from '@shared/types'
import { contentWebPreferences, hardenWebContents } from './security'
import { captureTab, removeSnapshot } from './snapshots'
import { hostLabel, pickFavicon, toNavigableUrl } from './urls'
import { newId } from './store'

export interface TabHost {
  session: Session
  addView(view: WebContentsView): void
  removeView(view: WebContentsView): void
  patch(tabId: TabId, patch: Partial<TabModel>): void
  created(tab: TabModel, index: number): void
  removed(tabId: TabId): void
  orderChanged(): void
  visitRecorded(entry: HistoryEntry): void
  /** A main-frame navigation committed — SPAs wipe injected CSS here. */
  navigated(tabId: TabId, wc: WebContents): void
  linkHovered(url: string | null): void
  shortcut(combo: string): void
  relayout(): void
}

interface Entry {
  model: TabModel
  view: WebContentsView | null
  /** Wall clock at which this tab became active, for activeSeconds. */
  activeSince: number | null
  /** URL the visit currently being timed started at. */
  visitId: string | null
  visitStartedAt: number
}

/** Electron moved these onto navigationHistory; keep working either way. */
function navCanGoBack(wc: WebContents): boolean {
  const nav = (wc as unknown as { navigationHistory?: { canGoBack(): boolean } }).navigationHistory
  if (nav && typeof nav.canGoBack === 'function') return nav.canGoBack()
  const legacy = wc as unknown as { canGoBack?: () => boolean }
  return legacy.canGoBack?.() ?? false
}

function navCanGoForward(wc: WebContents): boolean {
  const nav = (wc as unknown as { navigationHistory?: { canGoForward(): boolean } })
    .navigationHistory
  if (nav && typeof nav.canGoForward === 'function') return nav.canGoForward()
  const legacy = wc as unknown as { canGoForward?: () => boolean }
  return legacy.canGoForward?.() ?? false
}

function navGoBack(wc: WebContents): void {
  const nav = (wc as unknown as { navigationHistory?: { goBack(): void } }).navigationHistory
  if (nav && typeof nav.goBack === 'function') return nav.goBack()
  ;(wc as unknown as { goBack?: () => void }).goBack?.()
}

function navGoForward(wc: WebContents): void {
  const nav = (wc as unknown as { navigationHistory?: { goForward(): void } }).navigationHistory
  if (nav && typeof nav.goForward === 'function') return nav.goForward()
  ;(wc as unknown as { goForward?: () => void }).goForward?.()
}

export class TabRegistry {
  private entries = new Map<TabId, Entry>()
  private order: TabId[] = []
  private groups: TabGroup[] = []
  private seq = 0

  activeTabId: TabId | null = null

  constructor(private host: TabHost) {}

  /* ---------------------------------------------------------------- */
  /* Reads                                                             */
  /* ---------------------------------------------------------------- */

  get(tabId: TabId): Entry | undefined {
    return this.entries.get(tabId)
  }

  model(tabId: TabId): TabModel | undefined {
    return this.entries.get(tabId)?.model
  }

  view(tabId: TabId): WebContentsView | null {
    return this.entries.get(tabId)?.view ?? null
  }

  models(): TabModel[] {
    return this.order.map((id) => this.entries.get(id)?.model).filter((m): m is TabModel => !!m)
  }

  getOrder(): TabId[] {
    return [...this.order]
  }

  getGroups(): TabGroup[] {
    return this.groups.map((g) => ({ ...g }))
  }

  liveViews(): WebContentsView[] {
    return [...this.entries.values()].map((e) => e.view).filter((v): v is WebContentsView => !!v)
  }

  /* ---------------------------------------------------------------- */
  /* Lifecycle                                                         */
  /* ---------------------------------------------------------------- */

  create(opts: { url?: string; groupId?: GroupId | null; background?: boolean; index?: number }): TabId {
    const id = `t${++this.seq}${Math.random().toString(36).slice(2, 5)}` as TabId
    const now = Date.now()
    const url = opts.url ? toNavigableUrl(opts.url) : ''

    const model: TabModel = {
      id,
      url: '',
      pendingUrl: url || null,
      title: url ? hostLabel(url) : 'New Tab',
      faviconUrl: null,
      status: 'idle',
      errorText: null,
      canGoBack: false,
      canGoForward: false,
      groupId: opts.groupId ?? null,
      pinned: false,
      asleep: false,
      audible: false,
      muted: false,
      focusMode: false,
      createdAt: now,
      lastActiveAt: now,
      activeSeconds: 0,
      visits: 0,
      snapshotVersion: 0
    }

    const entry: Entry = { model, view: null, activeSince: null, visitId: null, visitStartedAt: 0 }
    this.entries.set(id, entry)

    const at = opts.index === undefined ? this.order.length : Math.max(0, Math.min(opts.index, this.order.length))
    this.order.splice(at, 0, id)

    this.host.created({ ...model }, at)

    if (url) this.navigate(id, url)
    if (!opts.background) this.activate(id)
    else this.host.orderChanged()

    return id
  }

  close(tabId: TabId): void {
    const entry = this.entries.get(tabId)
    if (!entry) return

    this.endVisit(entry)
    this.destroyView(entry)
    removeSnapshot(tabId)

    const idx = this.order.indexOf(tabId)
    this.order = this.order.filter((id) => id !== tabId)
    this.entries.delete(tabId)
    this.host.removed(tabId)

    if (this.activeTabId === tabId) {
      const next = this.order[Math.min(idx, this.order.length - 1)] ?? null
      this.activeTabId = null
      if (next) this.activate(next)
      else {
        this.host.orderChanged()
        this.host.relayout()
      }
    } else {
      this.host.orderChanged()
    }
  }

  activate(tabId: TabId): void {
    const entry = this.entries.get(tabId)
    if (!entry) return
    if (this.activeTabId === tabId) return

    const prev = this.activeTabId ? this.entries.get(this.activeTabId) : undefined
    if (prev) {
      this.accrueActiveTime(prev)
      // Capture on the way out — this is what the tab strip and the sleeping
      // placeholder show later.
      if (prev.view) void this.snapshot(prev)
    }

    this.activeTabId = tabId
    entry.activeSince = Date.now()
    this.patch(tabId, { lastActiveAt: Date.now() })

    if (entry.model.asleep) this.wake(tabId)

    this.host.orderChanged()
    this.host.relayout()
    entry.view?.webContents.focus()
  }

  reorder(tabId: TabId, toIndex: number): void {
    const from = this.order.indexOf(tabId)
    if (from < 0) return
    this.order.splice(from, 1)
    this.order.splice(Math.max(0, Math.min(toIndex, this.order.length)), 0, tabId)
    this.host.orderChanged()
  }

  duplicate(tabId: TabId): TabId | null {
    const entry = this.entries.get(tabId)
    if (!entry) return null
    return this.create({
      url: entry.model.url || entry.model.pendingUrl || '',
      groupId: entry.model.groupId,
      index: this.order.indexOf(tabId) + 1
    })
  }

  /* ---------------------------------------------------------------- */
  /* Navigation                                                        */
  /* ---------------------------------------------------------------- */

  navigate(tabId: TabId, input: string): void {
    const entry = this.entries.get(tabId)
    if (!entry) return
    const url = toNavigableUrl(input)
    if (!url) return

    this.endVisit(entry)

    if (!entry.view) this.createView(entry)
    this.patch(tabId, { pendingUrl: url, status: 'loading', errorText: null, asleep: false })
    void entry.view?.webContents.loadURL(url).catch(() => {
      /* did-fail-load reports it */
    })
  }

  goBack(tabId: TabId): void {
    const wc = this.entries.get(tabId)?.view?.webContents
    if (wc && navCanGoBack(wc)) navGoBack(wc)
  }

  goForward(tabId: TabId): void {
    const wc = this.entries.get(tabId)?.view?.webContents
    if (wc && navCanGoForward(wc)) navGoForward(wc)
  }

  reload(tabId: TabId, hard = false): void {
    const entry = this.entries.get(tabId)
    if (!entry) return
    if (entry.model.asleep) return this.wake(tabId)
    const wc = entry.view?.webContents
    if (!wc) return
    hard ? wc.reloadIgnoringCache() : wc.reload()
  }

  stop(tabId: TabId): void {
    this.entries.get(tabId)?.view?.webContents.stop()
  }

  setZoom(tabId: TabId, factor: number): void {
    const wc = this.entries.get(tabId)?.view?.webContents
    if (wc) wc.setZoomFactor(Math.max(0.25, Math.min(5, factor)))
  }

  setMuted(tabId: TabId, muted: boolean): void {
    const wc = this.entries.get(tabId)?.view?.webContents
    wc?.setAudioMuted(muted)
    this.patch(tabId, { muted })
  }

  setPinned(tabId: TabId, pinned: boolean): void {
    this.patch(tabId, { pinned })
  }

  /* ---------------------------------------------------------------- */
  /* Sleep — the whole point of the snapshot machinery                 */
  /* ---------------------------------------------------------------- */

  async sleep(tabId: TabId): Promise<void> {
    const entry = this.entries.get(tabId)
    if (!entry || entry.model.asleep || !entry.view) return
    if (this.activeTabId === tabId) return // never sleep what the user is looking at

    await this.snapshot(entry)
    this.endVisit(entry)
    this.destroyView(entry)
    this.patch(tabId, { asleep: true, status: 'idle', canGoBack: false, canGoForward: false })
    this.host.relayout()
  }

  wake(tabId: TabId): void {
    const entry = this.entries.get(tabId)
    if (!entry || !entry.model.asleep) return
    const url = entry.model.url || entry.model.pendingUrl
    this.patch(tabId, { asleep: false })
    if (url) this.navigate(tabId, url)
    this.host.relayout()
  }

  /** Sleep anything untouched for `idleMinutes`, keeping `keep` most recent. */
  sweepIdle(idleMinutes: number, keep: number): void {
    const cutoff = Date.now() - idleMinutes * 60_000
    const candidates = [...this.entries.values()]
      .filter((e) => e.view && !e.model.pinned && e.model.id !== this.activeTabId)
      .sort((a, b) => b.model.lastActiveAt - a.model.lastActiveAt)
      .slice(keep)
      .filter((e) => e.model.lastActiveAt < cutoff)

    for (const e of candidates) void this.sleep(e.model.id)
  }

  /* ---------------------------------------------------------------- */
  /* Groups                                                            */
  /* ---------------------------------------------------------------- */

  createGroup(name: string, color?: GroupColor, tabIds: TabId[] = []): GroupId {
    const id = newId('g') as GroupId
    const used = new Set(this.groups.map((g) => g.color))
    const nextColor = color ?? GROUP_COLORS.find((c) => !used.has(c)) ?? 'slate'
    this.groups.push({ id, name, color: nextColor, collapsed: false, createdAt: Date.now() })
    for (const tabId of tabIds) this.setGroup(tabId, id)
    this.host.orderChanged()
    return id
  }

  updateGroup(groupId: GroupId, patch: Partial<TabGroup>): void {
    const g = this.groups.find((x) => x.id === groupId)
    if (!g) return
    Object.assign(g, patch)
    this.host.orderChanged()
  }

  removeGroup(groupId: GroupId, closeTabs: boolean): void {
    const members = this.models().filter((m) => m.groupId === groupId)
    for (const m of members) {
      if (closeTabs) this.close(m.id)
      else this.setGroup(m.id, null)
    }
    this.groups = this.groups.filter((g) => g.id !== groupId)
    this.host.orderChanged()
  }

  setGroup(tabId: TabId, groupId: GroupId | null): void {
    this.patch(tabId, { groupId })
    // Keep group members contiguous, the way a tab strip has to render them.
    if (groupId) {
      const members = this.order.filter((id) => this.entries.get(id)?.model.groupId === groupId)
      const anchor = this.order.indexOf(members[0] ?? tabId)
      const rest = this.order.filter((id) => !members.includes(id))
      const head = rest.slice(0, anchor)
      const tail = rest.slice(anchor)
      this.order = [...head, ...members, ...tail]
    }
    this.host.orderChanged()
  }

  /** Replace the whole group list (used by workspace restore). */
  setGroups(groups: TabGroup[]): void {
    this.groups = groups.map((g) => ({ ...g }))
    this.host.orderChanged()
  }

  /* ---------------------------------------------------------------- */
  /* Focus mode flag (injection itself lives in injection.ts)          */
  /* ---------------------------------------------------------------- */

  setFocusMode(tabId: TabId, enabled: boolean): void {
    this.patch(tabId, { focusMode: enabled })
  }

  closeAll(): void {
    for (const id of [...this.order]) this.close(id)
  }

  /* ---------------------------------------------------------------- */
  /* Internals                                                         */
  /* ---------------------------------------------------------------- */

  private patch(tabId: TabId, patch: Partial<TabModel>): void {
    const entry = this.entries.get(tabId)
    if (!entry) return
    Object.assign(entry.model, patch)
    this.host.patch(tabId, patch)
  }

  private accrueActiveTime(entry: Entry): void {
    if (entry.activeSince === null) return
    const seconds = Math.round((Date.now() - entry.activeSince) / 1000)
    entry.activeSince = null
    if (seconds > 0) this.patch(entry.model.id, { activeSeconds: entry.model.activeSeconds + seconds })
  }

  private async snapshot(entry: Entry): Promise<void> {
    if (!entry.view) return
    const ok = await captureTab(entry.model.id, entry.view)
    if (ok) this.patch(entry.model.id, { snapshotVersion: entry.model.snapshotVersion + 1 })
  }

  private destroyView(entry: Entry): void {
    const view = entry.view
    if (!view) return
    entry.view = null
    try {
      this.host.removeView(view)
      if (!view.webContents.isDestroyed()) view.webContents.close()
    } catch {
      /* already gone */
    }
  }

  private createView(entry: Entry): WebContentsView {
    const view = new WebContentsView({
      webPreferences: { ...contentWebPreferences(), session: this.host.session }
    })
    entry.view = view
    view.setBackgroundColor('#ffffff')
    this.host.addView(view)
    this.wire(entry, view)
    return view
  }

  private wire(entry: Entry, view: WebContentsView): void {
    const wc = view.webContents
    const id = entry.model.id

    hardenWebContents(wc, {
      openInNewTab: (url, background) => {
        this.create({ url, background, groupId: entry.model.groupId, index: this.order.indexOf(id) + 1 })
      }
    })

    wc.on('page-title-updated', (_e, title) => {
      this.patch(id, { title: title || hostLabel(entry.model.url) })
    })

    wc.on('page-favicon-updated', (_e, favicons) => {
      this.patch(id, { faviconUrl: pickFavicon(favicons) })
    })

    wc.on('did-start-loading', () => this.patch(id, { status: 'loading' }))

    wc.on('did-stop-loading', () => {
      this.patch(id, {
        status: entry.model.errorText ? 'error' : 'idle',
        pendingUrl: null,
        canGoBack: navCanGoBack(wc),
        canGoForward: navCanGoForward(wc)
      })
      // A first snapshot right after load makes tab switching feel instant.
      setTimeout(() => void this.snapshot(entry), 600)
    })

    const onNavigated = (url: string): void => {
      this.endVisit(entry)
      this.patch(id, {
        url,
        pendingUrl: null,
        errorText: null,
        title: entry.model.title || hostLabel(url),
        canGoBack: navCanGoBack(wc),
        canGoForward: navCanGoForward(wc),
        visits: entry.model.visits + 1
      })
      this.beginVisit(entry, url)
      this.host.navigated(id, wc)
    }

    wc.on('did-navigate', (_e, url) => onNavigated(url))
    wc.on('did-navigate-in-page', (_e, url, isMainFrame) => {
      if (isMainFrame) onNavigated(url)
    })

    wc.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
      if (!isMainFrame) return
      if (code === -3) return // aborted by a subsequent navigation
      this.patch(id, { status: 'error', errorText: `${desc} (${code})`, url: url || entry.model.url })
    })

    wc.on('render-process-gone', (_e, details) => {
      this.patch(id, { status: 'crashed', errorText: `Renderer ${details.reason}` })
      const e2 = this.entries.get(id)
      if (e2) this.destroyView(e2)
      this.host.relayout()
    })

    wc.on('media-started-playing', () => this.patch(id, { audible: true }))
    wc.on('media-paused', () => this.patch(id, { audible: false }))

    wc.on('update-target-url', (_e, url) => this.host.linkHovered(url || null))

    // Browser-level shortcuts must work while the page has focus.
    wc.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return
      const combo = comboOf(input)
      if (!combo) return
      event.preventDefault()
      this.host.shortcut(combo)
    })

    // The content preload reports selections and extraction results by IPC;
    // those are handled centrally in ipc.ts using wc.id as the routing key.
  }

  private beginVisit(entry: Entry, url: string): void {
    entry.visitId = newId('h')
    entry.visitStartedAt = Date.now()
    this.host.visitRecorded({
      id: entry.visitId,
      tabId: entry.model.id,
      url,
      title: entry.model.title,
      faviconUrl: entry.model.faviconUrl,
      visitedAt: entry.visitStartedAt,
      fromUrl: entry.model.url || null,
      dwellSeconds: 0
    })
  }

  private endVisit(entry: Entry): void {
    if (!entry.visitId) return
    entry.visitId = null
  }
}

interface InputLike {
  key: string
  control: boolean
  shift: boolean
  alt: boolean
  meta: boolean
}

/** Only the combos the shell actually owns — everything else reaches the page. */
function comboOf(input: InputLike): string | null {
  const key = input.key.length === 1 ? input.key.toUpperCase() : input.key
  const ctrl = input.control || input.meta

  if (ctrl && !input.alt) {
    if (input.shift && (key === 'P' || key === 'K')) return 'Ctrl+Shift+K'
    if (!input.shift && ['K', 'T', 'W', 'L', 'F', 'N'].includes(key)) return `Ctrl+${key}`
    if (!input.shift && key === 'Tab') return 'Ctrl+Tab'
    if (input.shift && key === 'Tab') return 'Ctrl+Shift+Tab'
    if (!input.shift && /^[1-9]$/.test(key)) return `Ctrl+${key}`
  }
  if (key === 'Escape') return 'Escape'
  if (key === 'F3') return 'F3'
  if (input.alt && key === 'ArrowLeft') return 'Alt+Left'
  if (input.alt && key === 'ArrowRight') return 'Alt+Right'
  return null
}
