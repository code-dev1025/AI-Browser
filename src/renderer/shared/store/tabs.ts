import { create } from 'zustand'
import type { AppSnapshot } from '@shared/contract'
import type { TabGroup, TabId, TabModel } from '@shared/types'

/**
 * A projection of main's tab truth. Nothing here creates or destroys a tab —
 * commands go to main and come back as patches (blueprint L4).
 */
interface TabsState {
  tabs: Record<TabId, TabModel>
  order: TabId[]
  groups: TabGroup[]
  activeTabId: TabId | null

  hydrate: (snapshot: AppSnapshot) => void
  applyPatch: (tabId: TabId, patch: Partial<TabModel>) => void
  addTab: (tab: TabModel, index: number) => void
  removeTab: (tabId: TabId) => void
  setOrder: (order: TabId[], activeTabId: TabId | null) => void
  setGroups: (groups: TabGroup[]) => void
}

export const useTabs = create<TabsState>((set) => ({
  tabs: {},
  order: [],
  groups: [],
  activeTabId: null,

  hydrate: (snapshot) =>
    set({
      tabs: Object.fromEntries(snapshot.tabs.map((t) => [t.id, t])),
      order: snapshot.order,
      groups: snapshot.groups,
      activeTabId: snapshot.activeTabId
    }),

  applyPatch: (tabId, patch) =>
    set((s) => {
      const current = s.tabs[tabId]
      if (!current) return s
      return { tabs: { ...s.tabs, [tabId]: { ...current, ...patch } } }
    }),

  addTab: (tab, index) =>
    set((s) => {
      const order = [...s.order]
      if (!order.includes(tab.id)) order.splice(index, 0, tab.id)
      return { tabs: { ...s.tabs, [tab.id]: tab }, order }
    }),

  removeTab: (tabId) =>
    set((s) => {
      const tabs = { ...s.tabs }
      delete tabs[tabId]
      return { tabs, order: s.order.filter((id) => id !== tabId) }
    }),

  setOrder: (order, activeTabId) => set({ order, activeTabId }),
  setGroups: (groups) => set({ groups })
}))

/* --- selectors: subscribe to the smallest slice that can change ---- */

export const useTab = (tabId: TabId | null): TabModel | undefined =>
  useTabs((s) => (tabId ? s.tabs[tabId] : undefined))

export const useActiveTab = (): TabModel | undefined =>
  useTabs((s) => (s.activeTabId ? s.tabs[s.activeTabId] : undefined))

export function tabList(state: TabsState): TabModel[] {
  return state.order.map((id) => state.tabs[id]).filter((t): t is TabModel => !!t)
}

export function groupColorVar(color: TabGroup['color']): string {
  return `var(--g-${color})`
}
