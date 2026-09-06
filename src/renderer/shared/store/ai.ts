import { create } from 'zustand'
import type {
  AskScope,
  Citation,
  CompareResult,
  OrganizeSuggestion,
  SummaryResult,
  TabId
} from '@shared/types'
import { api } from '../api'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
  citations: Citation[]
  streaming: boolean
  error: string | null
}

interface AiStore {
  messages: Message[]
  scope: AskScope
  streamId: string | null
  busy: boolean

  compare: CompareResult | null
  summaries: SummaryResult[]
  organize: OrganizeSuggestion[]
  working: string | null

  setScope: (scope: AskScope) => void
  ask: (question: string, tabIds: TabId[]) => Promise<void>
  appendDelta: (streamId: string, delta: string) => void
  finish: (streamId: string, text: string, citations: Citation[]) => void
  fail: (streamId: string, message: string) => void
  cancel: () => void
  clear: () => void

  runOrganize: (tabIds: TabId[]) => Promise<void>
  applyOrganize: () => Promise<void>
  runSummaries: (tabIds: TabId[]) => Promise<void>
  runCompare: (tabIds: TabId[]) => Promise<void>
  dismiss: (what: 'compare' | 'summaries' | 'organize') => void
}

let seq = 0
const nextId = (): string => `m${++seq}`

export const useAi = create<AiStore>((set, get) => ({
  messages: [],
  scope: 'page',
  streamId: null,
  busy: false,
  compare: null,
  summaries: [],
  organize: [],
  working: null,

  setScope: (scope) => set({ scope }),

  ask: async (question, tabIds) => {
    if (!question.trim() || get().busy) return
    const assistantId = nextId()

    set((s) => ({
      busy: true,
      messages: [
        ...s.messages,
        { id: nextId(), role: 'user', text: question, citations: [], streaming: false, error: null },
        { id: assistantId, role: 'assistant', text: '', citations: [], streaming: true, error: null }
      ]
    }))

    try {
      const { streamId } = await api.invoke('ai.ask', {
        question,
        scope: get().scope,
        tabIds,
        conversationId: 'default'
      })
      set({ streamId })
    } catch (err) {
      set((s) => ({
        busy: false,
        messages: s.messages.map((m) =>
          m.id === assistantId
            ? { ...m, streaming: false, error: err instanceof Error ? err.message : String(err) }
            : m
        )
      }))
    }
  },

  appendDelta: (streamId, delta) =>
    set((s) => {
      if (s.streamId !== streamId) return s
      const last = s.messages[s.messages.length - 1]
      if (!last || last.role !== 'assistant') return s
      return {
        messages: [...s.messages.slice(0, -1), { ...last, text: last.text + delta }]
      }
    }),

  finish: (streamId, text, citations) =>
    set((s) => {
      if (s.streamId !== streamId) return s
      const last = s.messages[s.messages.length - 1]
      if (!last) return { busy: false, streamId: null }
      return {
        busy: false,
        streamId: null,
        messages: [...s.messages.slice(0, -1), { ...last, text, citations, streaming: false }]
      }
    }),

  fail: (streamId, message) =>
    set((s) => {
      if (s.streamId !== streamId) return s
      const last = s.messages[s.messages.length - 1]
      if (!last) return { busy: false, streamId: null }
      return {
        busy: false,
        streamId: null,
        messages: [...s.messages.slice(0, -1), { ...last, streaming: false, error: message }]
      }
    }),

  cancel: () => {
    const id = get().streamId
    if (id) void api.invoke('ai.cancel', { streamId: id })
    set({ busy: false, streamId: null })
  },

  clear: () => set({ messages: [], compare: null, summaries: [], organize: [] }),

  runOrganize: async (tabIds) => {
    set({ working: 'organize' })
    try {
      set({ organize: await api.invoke('ai.organizeTabs', { tabIds }) })
    } finally {
      set({ working: null })
    }
  },

  applyOrganize: async () => {
    const suggestions = get().organize
    if (suggestions.length === 0) return
    await api.invoke('ai.applyOrganize', { suggestions })
    set({ organize: [] })
  },

  runSummaries: async (tabIds) => {
    set({ working: 'summaries' })
    try {
      set({ summaries: await api.invoke('ai.summarize', { tabIds }) })
    } finally {
      set({ working: null })
    }
  },

  runCompare: async (tabIds) => {
    set({ working: 'compare' })
    try {
      set({ compare: await api.invoke('ai.compare', { tabIds }) })
    } finally {
      set({ working: null })
    }
  },

  dismiss: (what) =>
    set(what === 'compare' ? { compare: null } : what === 'summaries' ? { summaries: [] } : { organize: [] })
}))
