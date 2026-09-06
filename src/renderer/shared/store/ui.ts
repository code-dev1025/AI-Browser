import { create } from 'zustand'
import type { BackendStatus, FindState } from '@shared/types'

export interface Toast {
  id: number
  kind: 'info' | 'success' | 'error'
  message: string
}

interface UiStore {
  toasts: Toast[]
  hoverUrl: string | null
  find: FindState
  backend: BackendStatus
  /** Tabs the user ticked for a multi-tab action (compare, summarise, ask). */
  selection: string[]

  pushToast: (kind: Toast['kind'], message: string) => void
  dropToast: (id: number) => void
  setHoverUrl: (url: string | null) => void
  setFind: (find: FindState) => void
  setBackend: (backend: BackendStatus) => void
  toggleSelected: (tabId: string) => void
  clearSelection: () => void
  setSelection: (ids: string[]) => void
}

let toastSeq = 0

export const useUi = create<UiStore>((set) => ({
  toasts: [],
  hoverUrl: null,
  find: { query: '', matches: 0, activeMatch: 0 },
  backend: { mode: 'mock', baseUrl: null, reachable: true, lastError: null },
  selection: [],

  pushToast: (kind, message) => {
    const id = ++toastSeq
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4200)
  },

  dropToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setHoverUrl: (hoverUrl) => set({ hoverUrl }),
  setFind: (find) => set({ find }),
  setBackend: (backend) => set({ backend }),

  toggleSelected: (tabId) =>
    set((s) => ({
      selection: s.selection.includes(tabId)
        ? s.selection.filter((id) => id !== tabId)
        : [...s.selection, tabId]
    })),

  clearSelection: () => set({ selection: [] }),
  setSelection: (ids) => set({ selection: ids })
}))
