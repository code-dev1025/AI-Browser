/**
 * The real backend client. Written now, unused until AI_BACKEND_URL is set.
 *
 * It expects exactly the contract documented in INTEGRATION.md. If the backend
 * developer changes a field name, this file is the only place that changes —
 * nothing in the renderer knows the API exists.
 */

import { safeStorage } from 'electron'
import type {
  CompareResult,
  ExtractedPage,
  OrganizeSuggestion,
  SearchHit,
  SummaryResult
} from '@shared/types'
import type { AskContext, BackendClient, SearchCorpusEntry, StreamHandlers } from './types'
import { JsonStore } from '../store'

interface TokenBlob {
  encrypted: string | null
  plain: string | null
}

/**
 * Tokens are encrypted with the OS keystore (DPAPI on Windows) and never leave
 * the main process. No renderer ever sees a credential.
 */
class TokenVault {
  private store = new JsonStore<TokenBlob>('credentials', { encrypted: null, plain: null })

  get(): string | null {
    const blob = this.store.get()
    if (blob.encrypted && safeStorage.isEncryptionAvailable()) {
      try {
        return safeStorage.decryptString(Buffer.from(blob.encrypted, 'base64'))
      } catch {
        return null
      }
    }
    return blob.plain
  }

  set(token: string | null): void {
    if (token === null) return this.store.set({ encrypted: null, plain: null })
    if (safeStorage.isEncryptionAvailable()) {
      this.store.set({
        encrypted: safeStorage.encryptString(token).toString('base64'),
        plain: null
      })
    } else {
      this.store.set({ encrypted: null, plain: token })
    }
  }
}

export class HttpBackend implements BackendClient {
  readonly mode = 'http' as const
  readonly baseUrl: string
  private vault = new TokenVault()

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  setToken(token: string | null): void {
    this.vault.set(token)
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'content-type': 'application/json' }
    const token = this.vault.get()
    if (token) h['authorization'] = `Bearer ${token}`
    return h
  }

  private async post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
      signal: signal ?? null
    })
    if (!res.ok) throw new Error(`${path} → ${res.status} ${res.statusText}`)
    return (await res.json()) as T
  }

  async health(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const t = setTimeout(() => controller.abort(), 3000)
      const res = await fetch(`${this.baseUrl}/health`, {
        headers: this.headers(),
        signal: controller.signal
      })
      clearTimeout(t)
      return res.ok
    } catch {
      return false
    }
  }

  /** Server-sent events. Data lines are JSON: {delta} | {done, text, citations}. */
  ask(ctx: AskContext, handlers: StreamHandlers): () => void {
    const controller = new AbortController()

    void (async () => {
      try {
        const res = await fetch(`${this.baseUrl}/ask`, {
          method: 'POST',
          headers: { ...this.headers(), accept: 'text/event-stream' },
          body: JSON.stringify({
            question: ctx.question,
            scope: ctx.scope,
            conversationId: ctx.conversationId,
            pages: ctx.pages.map((p) => ({
              tabId: p.tabId,
              url: p.url,
              title: p.title,
              text: p.text,
              product: p.product
            }))
          }),
          signal: controller.signal
        })

        if (!res.ok || !res.body) throw new Error(`ask → ${res.status} ${res.statusText}`)

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let text = ''

        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          let sep: number
          while ((sep = buffer.indexOf('\n\n')) >= 0) {
            const frame = buffer.slice(0, sep)
            buffer = buffer.slice(sep + 2)
            for (const line of frame.split('\n')) {
              if (!line.startsWith('data:')) continue
              const payload = line.slice(5).trim()
              if (!payload || payload === '[DONE]') continue
              try {
                const msg = JSON.parse(payload) as {
                  delta?: string
                  done?: boolean
                  text?: string
                  citations?: never
                  error?: string
                }
                if (msg.error) throw new Error(msg.error)
                if (msg.delta) {
                  text += msg.delta
                  handlers.onDelta(msg.delta)
                }
                if (msg.done) {
                  handlers.onDone({ text: msg.text ?? text, citations: msg.citations ?? [] })
                  return
                }
              } catch (err) {
                handlers.onError(err instanceof Error ? err.message : String(err))
                return
              }
            }
          }
        }
        handlers.onDone({ text, citations: [] })
      } catch (err) {
        if (controller.signal.aborted) return
        handlers.onError(err instanceof Error ? err.message : String(err))
      }
    })()

    return () => controller.abort()
  }

  organize(pages: ExtractedPage[]): Promise<OrganizeSuggestion[]> {
    return this.post('/organize', { pages: pages.map(slim) })
  }

  summarize(pages: ExtractedPage[]): Promise<SummaryResult[]> {
    return this.post('/summarize', { pages: pages.map(slim) })
  }

  compare(pages: ExtractedPage[]): Promise<CompareResult> {
    return this.post('/compare', { pages: pages.map(slim) })
  }

  search(query: string, corpus: SearchCorpusEntry[]): Promise<SearchHit[]> {
    return this.post('/search', { query, corpus })
  }
}

/** Trim extraction payloads before they cross the wire. */
function slim(p: ExtractedPage): Record<string, unknown> {
  return {
    tabId: p.tabId,
    url: p.url,
    title: p.title,
    text: p.text.slice(0, 40_000),
    headings: p.headings,
    product: p.product,
    lang: p.lang,
    wordCount: p.wordCount
  }
}
