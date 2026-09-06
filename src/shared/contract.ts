/**
 * The entire process boundary, in one typed file.
 *
 * `Commands` are renderer → main, request/response (ipcRenderer.invoke).
 * `Events`   are main → renderer, fire-and-forget (webContents.send).
 *
 * Both preloads and both renderers import these types, so a channel rename is
 * a compile error rather than a runtime mystery.
 */

import type {
  AppSettings,
  AskRequest,
  AskResult,
  BackendStatus,
  Locale,
  CompareResult,
  ExtractedPage,
  ExtractSchema,
  FindState,
  GroupColor,
  GroupId,
  HistoryEntry,
  LinkHover,
  Note,
  OrganizeSuggestion,
  OverlayPayload,
  Rect,
  ShellState,
  SummaryResult,
  SearchHit,
  TabGroup,
  TabId,
  TabModel,
  WindowMetrics,
  WorkspaceId,
  WorkspaceSnapshot
} from './types'

export interface AppSnapshot {
  tabs: TabModel[]
  order: TabId[]
  groups: TabGroup[]
  activeTabId: TabId | null
  shell: ShellState
  window: WindowMetrics
  backend: BackendStatus
  settings: AppSettings
}

export interface Commands {
  /* --- lifecycle ------------------------------------------------- */
  'app.snapshot': { req: void; res: AppSnapshot }
  'app.backendStatus': { req: void; res: BackendStatus }

  /* --- settings ---------------------------------------------------- */
  'settings.get': { req: void; res: AppSettings }
  /** Main owns the locale so its own toasts and mock answers match the UI. */
  'settings.setLocale': { req: { locale: Locale }; res: AppSettings }

  /* --- window ---------------------------------------------------- */
  'window.minimize': { req: void; res: void }
  'window.toggleMaximize': { req: void; res: void }
  'window.close': { req: void; res: void }

  /* --- tabs ------------------------------------------------------ */
  'tab.create': {
    req: { url?: string; groupId?: GroupId | null; background?: boolean; index?: number }
    res: { tabId: TabId }
  }
  'tab.close': { req: { tabId: TabId }; res: void }
  'tab.activate': { req: { tabId: TabId; pane?: number }; res: void }
  'tab.reorder': { req: { tabId: TabId; toIndex: number }; res: void }
  'tab.navigate': { req: { tabId: TabId; input: string }; res: void }
  'tab.goBack': { req: { tabId: TabId }; res: void }
  'tab.goForward': { req: { tabId: TabId }; res: void }
  'tab.reload': { req: { tabId: TabId; hard?: boolean }; res: void }
  'tab.stop': { req: { tabId: TabId }; res: void }
  'tab.setPinned': { req: { tabId: TabId; pinned: boolean }; res: void }
  'tab.setMuted': { req: { tabId: TabId; muted: boolean }; res: void }
  /** Destroy the OS process, keep the model + snapshot. */
  'tab.sleep': { req: { tabId: TabId }; res: void }
  'tab.wake': { req: { tabId: TabId }; res: void }
  'tab.duplicate': { req: { tabId: TabId }; res: { tabId: TabId } }
  'tab.setZoom': { req: { tabId: TabId; factor: number }; res: void }
  'tab.setGroup': { req: { tabId: TabId; groupId: GroupId | null }; res: void }

  /* --- groups ---------------------------------------------------- */
  'group.create': { req: { name: string; color?: GroupColor; tabIds?: TabId[] }; res: { groupId: GroupId } }
  'group.rename': { req: { groupId: GroupId; name: string }; res: void }
  'group.recolor': { req: { groupId: GroupId; color: GroupColor }; res: void }
  'group.setCollapsed': { req: { groupId: GroupId; collapsed: boolean }; res: void }
  'group.remove': { req: { groupId: GroupId; closeTabs?: boolean }; res: void }

  /* --- shell layout ---------------------------------------------- */
  /** The renderer pushes STATE, never pixels. Main recomputes the rect. */
  'shell.setState': { req: Partial<ShellState>; res: void }
  'shell.beginDrag': { req: void; res: void }
  'shell.endDrag': { req: { splitRatio?: number[] }; res: void }

  /* --- split ----------------------------------------------------- */
  'split.set': { req: { paneTabIds: (TabId | null)[]; splitRatio?: number[] }; res: void }
  'split.close': { req: { pane: number }; res: void }

  /* --- overlay --------------------------------------------------- */
  'overlay.open': { req: OverlayPayload; res: void }
  'overlay.close': { req: void; res: void }
  'overlay.resultRect': { req: { height: number }; res: void }
  /**
   * The overlay stays dumb: it never runs a feature itself, it names one and
   * main relays it to the shell, which owns the stores.
   */
  'overlay.runCommand': { req: { commandId: string; arg?: string }; res: void }

  /* --- find in page ---------------------------------------------- */
  'find.start': { req: { query: string; forward?: boolean }; res: void }
  'find.stop': { req: void; res: void }

  /* --- focus mode ------------------------------------------------ */
  'focus.set': { req: { tabId: TabId; enabled: boolean }; res: void }
  'focus.setGoal': { req: { goal: string | null }; res: void }

  /* --- extraction + AI (all of these reach the backend) ---------- */
  'page.extract': { req: { tabId: TabId; schema?: ExtractSchema }; res: ExtractedPage | null }
  'page.selection': { req: { tabId: TabId }; res: { text: string; anchor: string | null } | null }
  'ai.ask': { req: AskRequest; res: { streamId: string } }
  'ai.cancel': { req: { streamId: string }; res: void }
  'ai.organizeTabs': { req: { tabIds: TabId[] }; res: OrganizeSuggestion[] }
  'ai.applyOrganize': { req: { suggestions: OrganizeSuggestion[] }; res: void }
  'ai.summarize': { req: { tabIds: TabId[] }; res: SummaryResult[] }
  'ai.compare': { req: { tabIds: TabId[] }; res: CompareResult }
  'ai.search': { req: { query: string }; res: SearchHit[] }

  /* --- workspaces ------------------------------------------------ */
  'workspace.list': { req: void; res: WorkspaceSnapshot[] }
  'workspace.save': { req: { name: string }; res: { id: WorkspaceId } }
  'workspace.restore': { req: { id: WorkspaceId; replace?: boolean }; res: void }
  'workspace.remove': { req: { id: WorkspaceId }; res: void }
  'workspace.rename': { req: { id: WorkspaceId; name: string }; res: void }

  /* --- history --------------------------------------------------- */
  'history.list': { req: { limit?: number; since?: number }; res: HistoryEntry[] }
  'history.search': { req: { query: string; limit?: number }; res: HistoryEntry[] }
  'history.clear': { req: void; res: void }

  /* --- notes and highlights -------------------------------------- */
  'notes.list': { req: void; res: Note[] }
  'notes.add': { req: Omit<Note, 'id' | 'createdAt'>; res: Note }
  'notes.update': { req: { id: string; patch: Partial<Note> }; res: void }
  'notes.remove': { req: { id: string }; res: void }
  'notes.captureHighlight': { req: { tabId: TabId }; res: Note | null }
}

export interface Events {
  'app:snapshot': AppSnapshot
  'tab:patch': { tabId: TabId; patch: Partial<TabModel> }
  'tab:created': { tab: TabModel; index: number }
  'tab:removed': { tabId: TabId }
  'tab:order': { order: TabId[]; activeTabId: TabId | null }
  'group:changed': { groups: TabGroup[] }
  'shell:state': ShellState
  /** A browser-level shortcut pressed while a *page* had focus. */
  'shell:shortcut': { combo: string }
  'window:metrics': WindowMetrics
  'window:contentRect': { rect: Rect; panes: Rect[]; gutters: Rect[] }
  'overlay:payload': OverlayPayload
  'overlay:commandRun': { commandId: string; arg?: string }
  'find:state': FindState
  'link:hover': LinkHover
  'ai:chunk': { streamId: string; delta: string }
  'ai:done': AskResult
  'ai:error': { streamId: string; message: string }
  'history:added': HistoryEntry
  'notes:changed': Note[]
  'backend:status': BackendStatus
  'settings:changed': AppSettings
  'toast': { kind: 'info' | 'success' | 'error'; message: string }
}

export type CommandName = keyof Commands
export type EventName = keyof Events

export type CommandReq<K extends CommandName> = Commands[K]['req']
export type CommandRes<K extends CommandName> = Commands[K]['res']

/** Channels the *content* preload may use. Deliberately tiny. */
export const CONTENT_CHANNELS = {
  extractRequest: 'content:extract-request',
  extractResult: 'content:extract-result',
  selectionRequest: 'content:selection-request',
  selectionResult: 'content:selection-result',
  linkHover: 'content:link-hover',
  shortcut: 'content:shortcut',
  highlightApply: 'content:highlight-apply'
} as const
