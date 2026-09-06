/**
 * THE BACKEND SEAM.
 *
 * Everything AI-shaped goes through this interface. Today it is served by
 * MockBackend; the day the real API exists you implement HttpBackend against
 * the same signatures and flip one environment variable. No renderer code and
 * no React component changes when that happens — that is the whole point.
 *
 * See INTEGRATION.md for the HTTP contract these methods expect.
 */

import type {
  AskRequest,
  Citation,
  CompareResult,
  ExtractedPage,
  OrganizeSuggestion,
  SearchHit,
  SummaryResult
} from '@shared/types'

/** Context the main process assembles before calling the backend. */
export interface AskContext extends AskRequest {
  pages: ExtractedPage[]
}

export interface StreamHandlers {
  onDelta: (delta: string) => void
  onDone: (result: { text: string; citations: Citation[] }) => void
  onError: (message: string) => void
}

export interface BackendClient {
  readonly mode: 'mock' | 'http'
  readonly baseUrl: string | null

  /** True if the backend answered a health check. */
  health(): Promise<boolean>

  /** Streaming answer. Returns a cancel function. */
  ask(ctx: AskContext, handlers: StreamHandlers): () => void

  /** Suggest tab groups. Pages are already extracted. */
  organize(pages: ExtractedPage[]): Promise<OrganizeSuggestion[]>

  /** One summary per page. */
  summarize(pages: ExtractedPage[]): Promise<SummaryResult[]>

  /** Build a comparison table across pages. */
  compare(pages: ExtractedPage[]): Promise<CompareResult>

  /** Natural-language search over browsing history. */
  search(query: string, corpus: SearchCorpusEntry[]): Promise<SearchHit[]>
}

/** What we can offer the backend for search, until it owns the index itself. */
export interface SearchCorpusEntry {
  url: string
  title: string
  text: string
  visitedAt: number | null
  tabId: string | null
}
