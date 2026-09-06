/**
 * The window: one BaseWindow holding three kinds of view, in paint order.
 *
 *   0  shellView    — our React chrome, full window, painted underneath
 *   1  page views   — one WebContentsView per visible tab / split pane
 *   2  overlayView  — transparent, for popups that must sit over the page
 *
 * Layout is computed here, in main, inside the resize handler — the renderer
 * never sends pixels (blueprint L2). That is what keeps resizing seam-free.
 */

import { BaseWindow, WebContentsView, type Session, type WebContents } from 'electron'
import { join } from 'node:path'
import {
  CHROME,
  contentRect,
  defaultShellState,
  gutterRects,
  normaliseRatios,
  paneRects
} from '@shared/layout'
import type { Events } from '@shared/contract'
import type {
  HistoryEntry,
  OverlayPayload,
  Rect,
  ShellState,
  TabId,
  TabModel,
  WindowMetrics
} from '@shared/types'
import { TabRegistry, type TabHost } from './tabs'
import { shellWebPreferences } from './security'
import { InjectionManager } from './injection'

const isDev = !!process.env['ELECTRON_RENDERER_URL']

function rendererUrl(entry: 'shell' | 'overlay'): { url?: string; file?: string } {
  const dev = process.env['ELECTRON_RENDERER_URL']
  if (dev) return { url: `${dev}/${entry}/index.html` }
  return { file: join(__dirname, `../renderer/${entry}/index.html`) }
}

export class AppWindow implements TabHost {
  readonly win: BaseWindow
  readonly shellView: WebContentsView
  readonly overlayView: WebContentsView
  readonly tabs: TabRegistry
  readonly injection = new InjectionManager()
  readonly session: Session

  shell: ShellState = defaultShellState()
  metrics: WindowMetrics = { width: 1280, height: 800, maximized: false }

  private overlay: OverlayPayload = { mode: null, anchor: null, query: '' }
  private overlayHeight = 320
  private destroyed = false
  private onHistory: (entry: HistoryEntry) => void = () => {}

  constructor(session: Session) {
    this.session = session

    // Fully frameless, not titleBarStyle:'hidden'.
    //
    // With a hidden title bar Windows keeps its 8px resize border, so Electron
    // reports a content width 17px wider than the client area actually painted:
    // everything anchored to the right edge — toolbar buttons, panel close,
    // send — is laid out off-screen. Frameless makes window bounds and client
    // area the same rectangle, at the cost of drawing our own window buttons.
    this.win = new BaseWindow({
      width: 1440,
      height: 900,
      minWidth: 900,
      minHeight: 560,
      show: false,
      frame: false,
      backgroundColor: '#12151c',
      title: 'AI Browser'
    })

    this.shellView = new WebContentsView({
      webPreferences: shellWebPreferences(join(__dirname, '../preload/shell.js'))
    })
    this.shellView.setBackgroundColor('#12151c')
    this.win.contentView.addChildView(this.shellView)
    void load(this.shellView, 'shell')

    this.overlayView = new WebContentsView({
      webPreferences: shellWebPreferences(join(__dirname, '../preload/shell.js'))
    })
    this.overlayView.setBackgroundColor('#00000000')
    this.overlayView.setVisible(false)
    this.win.contentView.addChildView(this.overlayView)
    void load(this.overlayView, 'overlay')

    this.tabs = new TabRegistry(this)

    this.win.on('resize', () => this.applyLayout())
    this.win.on('maximize', () => this.applyLayout())
    this.win.on('unmaximize', () => this.applyLayout())
    this.win.on('enter-full-screen', () => this.applyLayout())
    this.win.on('leave-full-screen', () => this.applyLayout())
    this.win.on('closed', () => {
      this.destroyed = true
    })

    const reveal = (): void => {
      if (this.destroyed || this.win.isDestroyed() || this.win.isVisible()) return
      this.win.show()
      this.applyLayout()
    }
    this.shellView.webContents.once('did-finish-load', reveal)
    // Never leave the user with no window because a load failed.
    setTimeout(reveal, 6000)

    if (isDev) {
      // Surface renderer errors in the terminal instead of hiding them behind
      // a devtools window nobody opened.
      for (const view of [this.shellView, this.overlayView]) {
        view.webContents.on('console-message', (event) => {
          if (event.level === 'error' || event.level === 'warning') {
            console.log(`[renderer:${event.level}] ${event.message}`)
          }
        })
      }

      this.shellView.webContents.on('before-input-event', (event, input) => {
        if (input.type === 'keyDown' && input.key === 'F12') {
          event.preventDefault()
          this.shellView.webContents.toggleDevTools()
        }
      })
    }
  }

  setHistorySink(fn: (entry: HistoryEntry) => void): void {
    this.onHistory = fn
  }

  /* ---------------------------------------------------------------- */
  /* Layout — the only place bounds are decided                        */
  /* ---------------------------------------------------------------- */

  applyLayout(): void {
    if (this.destroyed || this.win.isDestroyed()) return

    const bounds = this.win.getContentBounds()
    const width = bounds.width
    const height = bounds.height
    this.metrics = { width, height, maximized: this.win.isMaximized() }

    this.shellView.setBounds({ x: 0, y: 0, width, height })

    const rect = contentRect(this.metrics, this.shell)
    const ratios = this.shell.splitRatio.length > 0 ? this.shell.splitRatio : [1]
    const panes = paneRects(rect, ratios)
    const gutters = gutterRects(rect, ratios)
    const visible = this.visibleTabIds()

    for (const model of this.tabs.models()) {
      const view = this.tabs.view(model.id)
      if (!view) continue
      const idx = visible.indexOf(model.id)
      const pane = idx >= 0 ? panes[idx] : undefined
      if (pane && !this.shell.dragging) {
        view.setBounds(pane)
        view.setVisible(true)
      } else {
        view.setVisible(false)
      }
    }

    const ob = this.overlayBounds()
    this.overlayView.setBounds(ob)
    this.overlayView.setVisible(ob.width > 0 && ob.height > 0)

    this.send('window:metrics', this.metrics)
    this.send('window:contentRect', { rect, panes, gutters })
  }

  private visibleTabIds(): (TabId | null)[] {
    const n = Math.max(1, this.shell.splitRatio.length)
    const out: (TabId | null)[] = []
    for (let i = 0; i < n; i++) {
      out.push(i === 0 ? this.tabs.activeTabId : (this.shell.paneTabIds[i] ?? null))
    }
    return out
  }

  private overlayBounds(): Rect {
    const { width, height } = this.metrics
    const zero = { x: 0, y: 0, width: 0, height: 0 }
    if (!this.overlay.mode) return zero

    // The palette is modal: it owns the window and takes focus.
    if (this.overlay.mode === 'palette') return { x: 0, y: 0, width, height }

    const anchor = this.overlay.anchor
    if (!anchor) return { x: 0, y: 0, width, height }

    // Anchored popups (URL suggestions, find bar) are sized to their content so
    // the shell keeps keyboard focus and the toolbar stays usable.
    const w = Math.max(280, Math.min(Math.round(anchor.width), width))
    const x = Math.max(0, Math.min(Math.round(anchor.x), width - w))
    const y = Math.min(Math.round(anchor.y + anchor.height), Math.max(0, height - 60))
    const h = Math.max(48, Math.min(this.overlayHeight, height - y - 8))
    return { x, y, width: w, height: h }
  }

  setShellState(patch: Partial<ShellState>): void {
    const next: ShellState = { ...this.shell, ...patch }

    // Ratios and pane assignments must stay consistent with each other.
    if (patch.splitRatio) {
      const rect = contentRect(this.metrics, next)
      next.splitRatio = normaliseRatios(rect, patch.splitRatio)
    }
    while (next.paneTabIds.length < next.splitRatio.length) next.paneTabIds.push(null)
    next.paneTabIds = next.paneTabIds.slice(0, next.splitRatio.length)
    next.aiWidth = Math.round(Math.min(CHROME.aiMax, Math.max(CHROME.aiMin, next.aiWidth)))

    this.shell = next
    this.send('shell:state', this.shell)
    this.applyLayout()
  }

  /* ---------------------------------------------------------------- */
  /* Overlay                                                           */
  /* ---------------------------------------------------------------- */

  openOverlay(payload: OverlayPayload): void {
    this.overlay = payload
    if (payload.mode === 'palette') this.overlayHeight = 420
    this.sendOverlay('overlay:payload', payload)
    this.applyLayout()
    if (payload.mode === 'palette') this.overlayView.webContents.focus()
  }

  closeOverlay(): void {
    if (!this.overlay.mode) return
    this.overlay = { mode: null, anchor: null, query: '' }
    this.sendOverlay('overlay:payload', this.overlay)
    this.applyLayout()
    this.focusContent()
  }

  overlayMode(): OverlayPayload['mode'] {
    return this.overlay.mode
  }

  setOverlayHeight(height: number): void {
    this.overlayHeight = Math.max(48, Math.round(height))
    if (this.overlay.mode && this.overlay.mode !== 'palette') this.applyLayout()
  }

  focusContent(): void {
    const active = this.tabs.activeTabId
    const view = active ? this.tabs.view(active) : null
    if (view) view.webContents.focus()
    else this.shellView.webContents.focus()
  }

  focusShell(): void {
    this.shellView.webContents.focus()
  }

  /* ---------------------------------------------------------------- */
  /* Messaging                                                         */
  /* ---------------------------------------------------------------- */

  send<K extends keyof Events>(channel: K, payload: Events[K]): void {
    this.sendShell(channel, payload)
    this.sendOverlay(channel, payload)
  }

  sendShell<K extends keyof Events>(channel: K, payload: Events[K]): void {
    if (this.destroyed) return
    const wc = this.shellView.webContents
    if (!wc.isDestroyed()) wc.send(channel, payload)
  }

  sendOverlay<K extends keyof Events>(channel: K, payload: Events[K]): void {
    if (this.destroyed) return
    const wc = this.overlayView.webContents
    if (!wc.isDestroyed()) wc.send(channel, payload)
  }

  toast(kind: 'info' | 'success' | 'error', message: string): void {
    this.sendShell('toast', { kind, message })
  }

  /* ---------------------------------------------------------------- */
  /* TabHost                                                           */
  /* ---------------------------------------------------------------- */

  addView(view: WebContentsView): void {
    this.win.contentView.addChildView(view)
    // A newly added child paints above everything, including the overlay —
    // move the overlay back to the top.
    this.win.contentView.removeChildView(this.overlayView)
    this.win.contentView.addChildView(this.overlayView)
  }

  removeView(view: WebContentsView): void {
    try {
      this.win.contentView.removeChildView(view)
    } catch {
      /* already detached */
    }
  }

  patch(tabId: TabId, patch: Partial<TabModel>): void {
    this.sendShell('tab:patch', { tabId, patch })
  }

  created(tab: TabModel, index: number): void {
    this.sendShell('tab:created', { tab, index })
  }

  removed(tabId: TabId): void {
    this.injection.forget(tabId)
    this.sendShell('tab:removed', { tabId })
  }

  orderChanged(): void {
    this.sendShell('tab:order', { order: this.tabs.getOrder(), activeTabId: this.tabs.activeTabId })
    this.sendShell('group:changed', { groups: this.tabs.getGroups() })
  }

  visitRecorded(entry: HistoryEntry): void {
    this.onHistory(entry)
    this.sendShell('history:added', entry)
  }

  navigated(tabId: TabId, wc: WebContents): void {
    void this.injection.reapply(tabId, wc)
  }

  linkHovered(url: string | null): void {
    this.sendShell('link:hover', { url })
  }

  shortcut(combo: string): void {
    // Forwarded to React so shortcuts behave identically whether the page or
    // the chrome had focus.
    this.sendShell('shell:shortcut', { combo })
    this.focusShell()
  }

  relayout(): void {
    this.applyLayout()
  }
}

/** In dev the Vite server may still be binding when Electron starts. */
async function load(view: WebContentsView, entry: 'shell' | 'overlay'): Promise<void> {
  const target = rendererUrl(entry)
  const attempts = target.url ? 30 : 1

  for (let i = 0; i < attempts; i++) {
    if (view.webContents.isDestroyed()) return
    try {
      if (target.url) await view.webContents.loadURL(target.url)
      else if (target.file) await view.webContents.loadFile(target.file)
      return
    } catch (err) {
      if (i === attempts - 1) {
        console.error(`[renderer] failed to load ${entry}`, err)
        return
      }
      await new Promise((r) => setTimeout(r, 300))
    }
  }
}
