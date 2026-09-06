/**
 * A tiny intent bus for one-shot UI actions ("focus the omnibox now").
 *
 * These are events, not state: putting them in the store would mean inventing
 * nonce counters and clearing them again on every consumer.
 */

type Intent = 'focus-omnibox' | 'focus-ask' | 'scroll-ai-bottom' | 'open-find'

type Handler = (arg?: string) => void

const handlers = new Map<Intent, Set<Handler>>()

export function on(intent: Intent, handler: Handler): () => void {
  const set = handlers.get(intent) ?? new Set<Handler>()
  set.add(handler)
  handlers.set(intent, set)
  return () => set.delete(handler)
}

export function emit(intent: Intent, arg?: string): void {
  handlers.get(intent)?.forEach((h) => h(arg))
}
