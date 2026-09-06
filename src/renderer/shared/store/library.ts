import { create } from 'zustand'
import type { HistoryEntry, Note, SearchHit, WorkspaceSnapshot } from '@shared/types'
import { api } from '../api'

/**
 * Everything the backend will eventually own: history, notes, workspaces and
 * search. Today these are served from local JSON files in main. The store does
 * not know or care which — that is the point of the seam.
 */
interface LibraryStore {
  history: HistoryEntry[]
  notes: Note[]
  workspaces: WorkspaceSnapshot[]
  searchHits: SearchHit[]
  searching: boolean

  loadAll: () => Promise<void>
  loadHistory: () => Promise<void>
  loadNotes: () => Promise<void>
  loadWorkspaces: () => Promise<void>
  setNotes: (notes: Note[]) => void
  prependHistory: (entry: HistoryEntry) => void

  search: (query: string) => Promise<void>
  clearSearch: () => void

  saveWorkspace: (name: string) => Promise<void>
  restoreWorkspace: (id: string, replace: boolean) => Promise<void>
  removeWorkspace: (id: string) => Promise<void>

  addNote: (note: Omit<Note, 'id' | 'createdAt'>) => Promise<void>
  removeNote: (id: string) => Promise<void>
}

export const useLibrary = create<LibraryStore>((set, get) => ({
  history: [],
  notes: [],
  workspaces: [],
  searchHits: [],
  searching: false,

  loadAll: async () => {
    await Promise.all([get().loadHistory(), get().loadNotes(), get().loadWorkspaces()])
  },

  loadHistory: async () => set({ history: await api.invoke('history.list', { limit: 800 }) }),
  loadNotes: async () => set({ notes: await api.invoke('notes.list') }),
  loadWorkspaces: async () => set({ workspaces: await api.invoke('workspace.list') }),

  setNotes: (notes) => set({ notes }),
  prependHistory: (entry) => set((s) => ({ history: [entry, ...s.history].slice(0, 800) })),

  search: async (query) => {
    if (!query.trim()) return set({ searchHits: [] })
    set({ searching: true })
    try {
      set({ searchHits: await api.invoke('ai.search', { query }) })
    } finally {
      set({ searching: false })
    }
  },

  clearSearch: () => set({ searchHits: [] }),

  saveWorkspace: async (name) => {
    await api.invoke('workspace.save', { name })
    await get().loadWorkspaces()
  },

  restoreWorkspace: async (id, replace) => {
    await api.invoke('workspace.restore', { id, replace })
  },

  removeWorkspace: async (id) => {
    await api.invoke('workspace.remove', { id })
    await get().loadWorkspaces()
  },

  addNote: async (note) => {
    await api.invoke('notes.add', note)
    await get().loadNotes()
  },

  removeNote: async (id) => {
    await api.invoke('notes.remove', { id })
    await get().loadNotes()
  }
}))
