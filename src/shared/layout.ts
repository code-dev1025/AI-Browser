/**
 * THE seam between processes.
 *
 * Imported by BOTH main and the renderers. Main uses it inside its own resize
 * handler so the page views move in the same frame as the window — the renderer
 * never sends pixels, only state (see the blueprint, L2).
 *
 * Everything here must stay pure and synchronous. No electron, no DOM.
 */

import type { Rect, ShellState, WindowMetrics } from './types'

/** All values are CSS px at 100% scale. Tuned for the 1920×1080 baseline. */
export const CHROME = {
  titleBar: 36,
  tabStrip: 34,
  toolbar: 40,
  statusBar: 22,
  askBar: 44,
  railCollapsed: 48,
  railExpanded: 260,
  /** Vertical-tab sidebar (tabMode 'vertical') replaces both rail and strip. */
  sidebar: 260,
  sidebarCollapsed: 52,
  aiMin: 360,
  aiDefault: 380,
  aiMax: 520,
  /** Below this, panes stop splitting. Decides max pane count per width. */
  paneMin: 480,
  splitGutter: 4,
  /** Content narrower than this forces the rail to collapse. */
  contentMin: 720
} as const

/** Window widths (CSS px) at which the shell changes shape. */
export const BREAKPOINTS = {
  compact: 1280,
  base: 1680,
  comfortable: 2200
} as const

export type Density = 'compact' | 'base' | 'comfortable' | 'wide'

export function densityFor(width: number): Density {
  if (width <= BREAKPOINTS.compact) return 'compact'
  if (width <= BREAKPOINTS.base) return 'base'
  if (width <= BREAKPOINTS.comfortable) return 'comfortable'
  return 'wide'
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/** How many split panes this window can hold before panes get unusable. */
export function maxPanes(win: WindowMetrics, s: ShellState): number {
  const avail = contentRect(win, { ...s, splitRatio: [1] }).width
  return Math.max(1, Math.floor((avail + CHROME.splitGutter) / (CHROME.paneMin + CHROME.splitGutter)))
}

/** Effective AI panel width, after clamping and compact-mode rules. */
export function aiPanelWidth(win: WindowMetrics, s: ShellState): number {
  if (!s.aiOpen) return 0
  // A native page view paints above our DOM, so the AI panel can never float
  // over the page — it always takes real width. On a narrow window it takes
  // the minimum rather than disappearing.
  if (densityFor(win.width) === 'compact') return CHROME.aiMin
  return Math.round(clamp(s.aiWidth, CHROME.aiMin, CHROME.aiMax))
}

/** Effective left-hand chrome width (icon rail, or the vertical tab sidebar). */
export function leftChromeWidth(win: WindowMetrics, s: ShellState): number {
  const compact = densityFor(win.width) === 'compact'
  if (s.tabMode === 'vertical') {
    return compact || !s.railExpanded ? CHROME.sidebarCollapsed : CHROME.sidebar
  }
  const expanded = s.railExpanded && s.railPanel !== null && !compact
  return expanded ? CHROME.railExpanded : CHROME.railCollapsed
}

/** Total height consumed above the page. */
export function topChromeHeight(s: ShellState): number {
  const strip = s.tabMode === 'horizontal' ? CHROME.tabStrip : 0
  return CHROME.titleBar + strip + CHROME.toolbar
}

/** Total height consumed below the page. */
export function bottomChromeHeight(win: WindowMetrics, s: ShellState): number {
  const ask = s.askBarOpen && s.tabMode === 'horizontal' && win.width > BREAKPOINTS.compact
  return (ask ? CHROME.askBar : 0) + CHROME.statusBar
}

/**
 * The rectangle the web page(s) occupy. This is the one function that decides
 * where Chromium paints — every layout mode is a different set of inputs to it.
 */
export function contentRect(win: WindowMetrics, s: ShellState): Rect {
  const top = topChromeHeight(s)
  const left = leftChromeWidth(win, s)
  const right = aiPanelWidth(win, s)
  const bottom = bottomChromeHeight(win, s)

  return {
    x: left,
    y: top,
    width: Math.max(0, Math.round(win.width - left - right)),
    height: Math.max(0, Math.round(win.height - top - bottom))
  }
}

/** Slice the content rect into N panes separated by gutters. */
export function paneRects(rect: Rect, ratios: number[]): Rect[] {
  const n = Math.max(1, ratios.length)
  if (n === 1) return [rect]

  const total = ratios.reduce((a, b) => a + b, 0) || 1
  const gutters = (n - 1) * CHROME.splitGutter
  const usable = Math.max(0, rect.width - gutters)

  const out: Rect[] = []
  let x = rect.x
  for (let i = 0; i < n; i++) {
    const isLast = i === n - 1
    const w = isLast
      ? Math.max(0, rect.x + rect.width - x)
      : Math.round((usable * (ratios[i] ?? 0)) / total)
    out.push({ x, y: rect.y, width: w, height: rect.height })
    x += w + CHROME.splitGutter
  }
  return out
}

/** Gutter rectangles, so the shell can draw draggable dividers in the gaps. */
export function gutterRects(rect: Rect, ratios: number[]): Rect[] {
  const panes = paneRects(rect, ratios)
  const out: Rect[] = []
  for (let i = 0; i < panes.length - 1; i++) {
    const p = panes[i]
    if (!p) continue
    out.push({ x: p.x + p.width, y: rect.y, width: CHROME.splitGutter, height: rect.height })
  }
  return out
}

/** Normalise a ratio array so it sums to 1 and no pane falls under paneMin. */
export function normaliseRatios(rect: Rect, ratios: number[]): number[] {
  const n = ratios.length
  if (n <= 1) return [1]
  const gutters = (n - 1) * CHROME.splitGutter
  const usable = Math.max(1, rect.width - gutters)
  const minRatio = CHROME.paneMin / usable

  let r = ratios.map((v) => (Number.isFinite(v) && v > 0 ? v : 0))
  const sum = r.reduce((a, b) => a + b, 0) || 1
  r = r.map((v) => v / sum)

  // Lift anything under the minimum, then take the difference off the largest.
  for (let i = 0; i < n; i++) {
    const cur = r[i] ?? 0
    if (cur < minRatio) {
      const deficit = minRatio - cur
      r[i] = minRatio
      let donorIdx = 0
      let donorVal = -1
      for (let j = 0; j < n; j++) {
        const v = r[j] ?? 0
        if (j !== i && v > donorVal) {
          donorVal = v
          donorIdx = j
        }
      }
      r[donorIdx] = Math.max(minRatio, (r[donorIdx] ?? 0) - deficit)
    }
  }
  const s2 = r.reduce((a, b) => a + b, 0) || 1
  return r.map((v) => v / s2)
}

export function defaultShellState(): ShellState {
  return {
    tabMode: 'horizontal',
    railExpanded: false,
    railPanel: null,
    aiOpen: true,
    aiWidth: CHROME.aiDefault,
    askBarOpen: true,
    splitRatio: [1],
    paneTabIds: [null],
    dragging: false
  }
}
