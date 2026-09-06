/**
 * Domain types shared by main, preload and both renderer entry points.
 * Keep this file pure — no imports from electron, no DOM types.
 */

import type { MessageKey } from './i18n'

export type Locale = 'ja' | 'en'

/** Persisted in main, mirrored into both renderers. */
export interface AppSettings {
  locale: Locale
}

export type TabId = string
export type GroupId = string
export type WorkspaceId = string
export type NoteId = string
export type StreamId = string

export type TabStatus = 'idle' | 'loading' | 'error' | 'crashed'

/** The read model React renders. Main owns the truth; this is a projection. */
export interface TabModel {
  id: TabId
  /** Committed URL. While navigating, `pendingUrl` holds the target. */
  url: string
  pendingUrl: string | null
  title: string
  faviconUrl: string | null
  status: TabStatus
  errorText: string | null
  canGoBack: boolean
  canGoForward: boolean
  groupId: GroupId | null
  pinned: boolean
  /** Asleep = the OS process was destroyed; only the model + snapshot remain. */
  asleep: boolean
  audible: boolean
  muted: boolean
  focusMode: boolean
  createdAt: number
  lastActiveAt: number
  /** Seconds this tab has been the active tab. Feeds the importance score. */
  activeSeconds: number
  visits: number
  /** Bumped whenever a new snapshot is written, so <img> cache-busts. */
  snapshotVersion: number
}

export interface TabGroup {
  id: GroupId
  name: string
  color: GroupColor
  collapsed: boolean
  createdAt: number
}

export type GroupColor = 'indigo' | 'teal' | 'amber' | 'rose' | 'violet' | 'slate'

export const GROUP_COLORS: GroupColor[] = ['indigo', 'teal', 'amber', 'rose', 'violet', 'slate']

/** Layout state the shell owns and main mirrors. See shared/layout.ts. */
export interface ShellState {
  tabMode: 'horizontal' | 'vertical'
  railExpanded: boolean
  railPanel: RailPanel | null
  aiOpen: boolean
  aiWidth: number
  askBarOpen: boolean
  /** One entry per split pane. Sums to 1. Length 1 = no split. */
  splitRatio: number[]
  /** Which tab is shown in each pane. Index 0 is the primary pane. */
  paneTabIds: (TabId | null)[]
  /** True while a splitter or window edge is being dragged. */
  dragging: boolean
}

export type RailPanel = 'ai' | 'notes' | 'history' | 'workspaces' | 'search'

export interface WindowMetrics {
  width: number
  height: number
  maximized: boolean
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/* ------------------------------------------------------------------ */
/* Workspaces                                                          */
/* ------------------------------------------------------------------ */

export interface WorkspaceSnapshot {
  id: WorkspaceId
  name: string
  createdAt: number
  updatedAt: number
  /** Order matters — it is restored verbatim. */
  tabs: WorkspaceTab[]
  groups: TabGroup[]
  activeTabId: TabId | null
  shell: Pick<ShellState, 'tabMode' | 'splitRatio' | 'aiOpen' | 'aiWidth'>
}

export interface WorkspaceTab {
  url: string
  title: string
  faviconUrl: string | null
  groupId: GroupId | null
  pinned: boolean
}

/* ------------------------------------------------------------------ */
/* History, notes, highlights                                          */
/* ------------------------------------------------------------------ */

export interface HistoryEntry {
  id: string
  tabId: TabId
  url: string
  title: string
  faviconUrl: string | null
  visitedAt: number
  /** Where the user came from, for the browsing timeline. */
  fromUrl: string | null
  dwellSeconds: number
}

export interface Note {
  id: NoteId
  kind: 'note' | 'highlight'
  text: string
  comment: string | null
  url: string
  title: string
  /** CSS-ish anchor captured at selection time; best-effort re-locate. */
  anchor: string | null
  tags: string[]
  createdAt: number
}

/* ------------------------------------------------------------------ */
/* Page extraction (input for every AI feature)                        */
/* ------------------------------------------------------------------ */

export type ExtractSchema = 'article' | 'product'

export interface ExtractedPage {
  tabId: TabId
  url: string
  title: string
  /** Readable main text, already stripped of nav/ads/footers. */
  text: string
  excerpt: string
  headings: { level: number; text: string }[]
  links: { href: string; text: string }[]
  images: string[]
  lang: string | null
  /** Only present for schema 'product'. */
  product: ProductFields | null
  /** Character offsets into `text`, so the UI can scroll to a citation. */
  sections: { start: number; end: number; heading: string | null }[]
  extractedAt: number
  wordCount: number
}

export interface ProductFields {
  name: string | null
  price: string | null
  priceValue: number | null
  currency: string | null
  availability: string | null
  rating: string | null
  reviewCount: string | null
  seller: string | null
  specs: { label: string; value: string }[]
}

/* ------------------------------------------------------------------ */
/* AI                                                                  */
/* ------------------------------------------------------------------ */

export type AskScope = 'page' | 'tabs' | 'selection'

export interface AskRequest {
  question: string
  scope: AskScope
  tabIds: TabId[]
  conversationId: string
}

export interface Citation {
  tabId: TabId
  url: string
  title: string
  quote: string
  /** Character offset into that page's extracted text. */
  offset: number | null
}

export interface AskResult {
  streamId: StreamId
  text: string
  citations: Citation[]
}

export interface OrganizeSuggestion {
  groupName: string
  color: GroupColor
  tabIds: TabId[]
  reason: string
}

export interface CompareRow {
  label: string
  /** One cell per compared tab, in the order tabIds was given. */
  values: (string | null)[]
  /** Index of the winning cell, when the row has an obvious best. */
  bestIndex: number | null
}

export interface CompareResult {
  tabIds: TabId[]
  columns: { tabId: TabId; title: string; url: string }[]
  rows: CompareRow[]
  verdict: string
}

export interface SummaryResult {
  tabId: TabId
  title: string
  url: string
  bullets: string[]
  readingMinutes: number
}

export interface SearchHit {
  url: string
  title: string
  snippet: string
  score: number
  visitedAt: number | null
  tabId: TabId | null
}

/* ------------------------------------------------------------------ */
/* Overlay                                                             */
/* ------------------------------------------------------------------ */

export type OverlayMode = 'palette' | 'find' | 'urlsuggest' | null

export interface OverlayPayload {
  mode: OverlayMode
  /** Anchor rect in window CSS px, for popups tied to a control. */
  anchor: Rect | null
  query: string
}

export interface PaletteCommand {
  id: string
  /** Message keys, not text — the palette renders in the viewer's language. */
  titleKey: MessageKey
  hintKey: MessageKey | null
  shortcut: string | null
  groupKey: MessageKey
}

export interface FindState {
  query: string
  matches: number
  activeMatch: number
}

export interface LinkHover {
  url: string | null
}

/** Connection state of the (not yet written) backend. */
export interface BackendStatus {
  mode: 'mock' | 'http'
  baseUrl: string | null
  reachable: boolean
  lastError: string | null
}
