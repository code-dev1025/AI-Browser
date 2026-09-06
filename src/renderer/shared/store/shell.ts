import { create } from 'zustand'
import {
  CHROME,
  aiPanelWidth,
  bottomChromeHeight,
  contentRect,
  defaultShellState,
  densityFor,
  leftChromeWidth,
  type Density
} from '@shared/layout'
import type { Rect, ShellState, WindowMetrics } from '@shared/types'
import { api } from '../api'

interface ShellStore {
  shell: ShellState
  metrics: WindowMetrics
  /** Where main actually put the page views. Mirrors, never drives. */
  rect: Rect
  panes: Rect[]
  gutters: Rect[]

  setShell: (shell: ShellState) => void
  setMetrics: (metrics: WindowMetrics) => void
  setGeometry: (g: { rect: Rect; panes: Rect[]; gutters: Rect[] }) => void
  /** Optimistic local update + push to main, which owns the final word. */
  patchShell: (patch: Partial<ShellState>) => void
}

const empty: Rect = { x: 0, y: 0, width: 0, height: 0 }

export const useShell = create<ShellStore>((set, get) => ({
  shell: defaultShellState(),
  metrics: { width: 1440, height: 900, maximized: false },
  rect: empty,
  panes: [empty],
  gutters: [],

  setShell: (shell) => {
    set({ shell })
    applyCssVars(shell, get().metrics)
  },
  setMetrics: (metrics) => {
    set({ metrics })
    applyCssVars(get().shell, metrics)
  },
  setGeometry: (g) => set(g),

  patchShell: (patch) => {
    const next = { ...get().shell, ...patch }
    set({ shell: next })
    applyCssVars(next, get().metrics)
    void api.invoke('shell.setState', patch)
  }
}))

/**
 * The CSS grid and main's contentRect() must agree to the pixel. Both are
 * derived from shared/layout.ts here, so they cannot drift.
 */
export function applyCssVars(shell: ShellState, metrics: WindowMetrics): void {
  const root = document.documentElement.style
  root.setProperty('--h-title', `${CHROME.titleBar}px`)
  root.setProperty('--h-toolbar', `${CHROME.toolbar}px`)
  root.setProperty('--h-tabs', shell.tabMode === 'horizontal' ? `${CHROME.tabStrip}px` : '0px')
  root.setProperty('--h-status', `${CHROME.statusBar}px`)
  root.setProperty(
    '--h-ask',
    `${bottomChromeHeight(metrics, shell) - CHROME.statusBar}px`
  )
  root.setProperty('--w-left', `${leftChromeWidth(metrics, shell)}px`)
  root.setProperty('--w-ai', `${aiPanelWidth(metrics, shell)}px`)
  root.setProperty('--w-gutter', `${CHROME.splitGutter}px`)
  root.setProperty(
    '--rail-bar',
    shell.tabMode === 'vertical' ? `${CHROME.sidebarCollapsed}px` : `${CHROME.railCollapsed}px`
  )
}

export const useDensity = (): Density => useShell((s) => densityFor(s.metrics.width))

export const useContentRect = (): Rect =>
  useShell((s) => contentRect(s.metrics, s.shell))
