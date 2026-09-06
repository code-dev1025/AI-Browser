/**
 * The stand-in backend, used until the real API exists.
 *
 * It is deliberately NOT random noise: every answer is derived from text we
 * actually extracted from the open pages, so the UI is exercised with realistic
 * shapes (citations that point at real offsets, comparison rows built from real
 * product fields). Where a real model would be needed, the text says so plainly
 * rather than inventing facts — mock output must never be mistaken for an
 * answer.
 *
 * It speaks the interface language, because a Japanese UI answering in English
 * (or the reverse) reads as a bug even when the content is a placeholder.
 */

import type {
  Citation,
  CompareResult,
  CompareRow,
  ExtractedPage,
  GroupColor,
  OrganizeSuggestion,
  SearchHit,
  SummaryResult
} from '@shared/types'
import type { MessageKey } from '@shared/i18n'
import { tm } from '../settings'
import type { AskContext, BackendClient, SearchCorpusEntry, StreamHandlers } from './types'

const MOCK = '[mock]'

/** Domain → bucket. The same buckets the AI organiser is expected to produce. */
const BUCKETS: { key: MessageKey; color: GroupColor; hosts: RegExp; words: RegExp }[] = [
  {
    key: 'mock.group_dev',
    color: 'indigo',
    hosts: /github|gitlab|stackoverflow|npmjs|developer\.mozilla|localhost|codepen|vercel|zenn|qiita/i,
    words: /\b(api|typescript|javascript|react|python|npm|install|function|component|repository)\b/i
  },
  {
    key: 'mock.group_video',
    color: 'rose',
    hosts: /youtube|youtu\.be|vimeo|nicovideo|twitch|abema|netflix/i,
    words: /(subscribe|watch later|再生|チャンネル登録)/i
  },
  {
    key: 'mock.group_shopping',
    color: 'amber',
    hosts: /amazon|rakuten|mercari|yahoo.*shopping|ebay|aliexpress|zozo|kakaku/i,
    words: /(カートに入れる|add to cart|税込|送料無料|在庫あり|price|¥\s?\d)/i
  },
  {
    key: 'mock.group_research',
    color: 'teal',
    hosts: /wikipedia|scholar|arxiv|nature|note\.com|medium|hatena/i,
    words: /\b(research|study|論文|調査|according to)\b/i
  }
]

function bucketFor(page: ExtractedPage): { key: MessageKey; color: GroupColor } {
  const host = safeHost(page.url)
  const sample = `${page.title} ${page.text.slice(0, 1500)}`
  for (const b of BUCKETS) {
    if (b.hosts.test(host)) return { key: b.key, color: b.color }
  }
  for (const b of BUCKETS) {
    if (b.words.test(sample)) return { key: b.key, color: b.color }
  }
  return { key: 'mock.group_other', color: 'slate' }
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[。．.!?！？])\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12)
}

function firstQuote(page: ExtractedPage): { quote: string; offset: number | null } {
  const sentence = sentences(page.text)[0] ?? page.excerpt ?? page.title
  const at = page.text.indexOf(sentence)
  return { quote: sentence.slice(0, 180), offset: at >= 0 ? at : null }
}

export class MockBackend implements BackendClient {
  readonly mode = 'mock' as const
  readonly baseUrl = null

  async health(): Promise<boolean> {
    return true
  }

  ask(ctx: AskContext, handlers: StreamHandlers): () => void {
    const text = this.composeAnswer(ctx)
    const citations: Citation[] = ctx.pages.slice(0, 4).map((p) => {
      const q = firstQuote(p)
      return { tabId: p.tabId, url: p.url, title: p.title, quote: q.quote, offset: q.offset }
    })

    // Stream in small chunks so the UI's streaming path is genuinely exercised.
    const chunks = text.match(/[\s\S]{1,14}/g) ?? [text]
    let i = 0
    let cancelled = false
    const timer = setInterval(() => {
      if (cancelled) return
      const chunk = chunks[i++]
      if (chunk === undefined) {
        clearInterval(timer)
        handlers.onDone({ text, citations })
        return
      }
      handlers.onDelta(chunk)
    }, 18)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }

  private composeAnswer(ctx: AskContext): string {
    const { question, pages } = ctx
    if (pages.length === 0) {
      return `${MOCK} ${tm('mock.no_pages')}\n\n${tm('mock.not_connected')}`
    }

    const lines: string[] = []
    lines.push(`${MOCK} ${tm('mock.read_pages', { n: pages.length })}\n`)
    lines.push(`${tm('mock.question', { q: question })}\n`)

    for (const p of pages.slice(0, 6)) {
      const host = safeHost(p.url)
      const heads = p.headings.slice(0, 3).map((h) => h.text).filter(Boolean)
      lines.push(`\n■ ${p.title || host} (${host}) — ${p.wordCount} words`)
      if (heads.length) lines.push(`  ${tm('mock.headings', { list: heads.join(' / ') })}`)
      for (const line of sentences(p.text).slice(0, 2)) lines.push(`  ${line.slice(0, 160)}`)
      if (p.product?.price) {
        const stock = p.product.availability ? ` · ${p.product.availability}` : ''
        lines.push(`  ${tm('mock.price', { price: p.product.price })}${stock}`)
      }
    }

    lines.push(`\n──\n${tm('mock.footer')}`)
    return lines.join('\n')
  }

  async organize(pages: ExtractedPage[]): Promise<OrganizeSuggestion[]> {
    const byBucket = new Map<MessageKey, { color: GroupColor; tabIds: string[] }>()
    for (const p of pages) {
      const b = bucketFor(p)
      const entry = byBucket.get(b.key) ?? { color: b.color, tabIds: [] }
      entry.tabIds.push(p.tabId)
      byBucket.set(b.key, entry)
    }
    return [...byBucket.entries()]
      .filter(([, v]) => v.tabIds.length > 0)
      .map(([key, v]) => ({
        groupName: tm(key),
        color: v.color,
        tabIds: v.tabIds,
        reason: `${tm('mock.organize_reason')} ${MOCK}`
      }))
      .sort((a, b) => b.tabIds.length - a.tabIds.length)
  }

  async summarize(pages: ExtractedPage[]): Promise<SummaryResult[]> {
    return pages.map((p) => {
      const bullets: string[] = []
      for (const h of p.headings.slice(0, 5)) if (h.text.trim()) bullets.push(h.text.trim())
      for (const s of sentences(p.text).slice(0, 5 - bullets.length)) bullets.push(s.slice(0, 200))
      if (bullets.length === 0) bullets.push(tm('mock.no_text'))
      return {
        tabId: p.tabId,
        title: p.title,
        url: p.url,
        bullets,
        readingMinutes: Math.max(1, Math.round(p.wordCount / 400))
      }
    })
  }

  async compare(pages: ExtractedPage[]): Promise<CompareResult> {
    const columns = pages.map((p) => ({ tabId: p.tabId, title: p.title, url: p.url }))
    const rows: CompareRow[] = []

    const add = (label: string, values: (string | null)[], best: 'min' | 'max' | null = null): void => {
      if (values.every((v) => v === null || v === '')) return
      let bestIndex: number | null = null
      if (best) {
        const nums = values.map((v) => (v ? Number(v.replace(/[^\d.]/g, '')) : NaN))
        let bi = -1
        for (let i = 0; i < nums.length; i++) {
          const n = nums[i]
          if (!Number.isFinite(n as number)) continue
          if (bi === -1) bi = i
          else {
            const cur = nums[bi] as number
            const cand = n as number
            if ((best === 'min' && cand < cur) || (best === 'max' && cand > cur)) bi = i
          }
        }
        bestIndex = bi >= 0 ? bi : null
      }
      rows.push({ label, values, bestIndex })
    }

    const priceLabel = tm('mock.col_price')

    add(tm('mock.col_site'), pages.map((p) => safeHost(p.url)))
    add(tm('mock.col_name'), pages.map((p) => p.product?.name ?? p.title ?? null))
    add(priceLabel, pages.map((p) => p.product?.price ?? null), 'min')
    add(tm('mock.col_stock'), pages.map((p) => p.product?.availability ?? null))
    add(tm('mock.col_rating'), pages.map((p) => p.product?.rating ?? null), 'max')
    add(tm('mock.col_reviews'), pages.map((p) => p.product?.reviewCount ?? null), 'max')
    add(tm('mock.col_seller'), pages.map((p) => p.product?.seller ?? null))
    add(tm('mock.col_length'), pages.map((p) => `${p.wordCount} words`))

    // Any spec label that appears on at least two pages becomes a row.
    const labels = new Map<string, number>()
    for (const p of pages) for (const s of p.product?.specs ?? []) {
      labels.set(s.label, (labels.get(s.label) ?? 0) + 1)
    }
    for (const [label, count] of labels) {
      if (count < 2) continue
      add(label, pages.map((p) => p.product?.specs.find((s) => s.label === label)?.value ?? null))
    }

    const priceRow = rows.find((r) => r.label === priceLabel)
    const verdict =
      priceRow && priceRow.bestIndex !== null
        ? `${tm('mock.verdict_cheapest', {
            title: columns[priceRow.bestIndex]?.title ?? '',
            price: priceRow.values[priceRow.bestIndex] ?? ''
          })} ${MOCK}`
        : `${tm('mock.verdict_generic')} ${MOCK}`

    return { tabIds: pages.map((p) => p.tabId), columns, rows, verdict }
  }

  async search(query: string, corpus: SearchCorpusEntry[]): Promise<SearchHit[]> {
    const terms = query
      .toLowerCase()
      .split(/[\s、。,.]+/)
      .filter((t) => t.length > 0)
    if (terms.length === 0) return []

    const hits: SearchHit[] = []
    for (const entry of corpus) {
      const haystack = `${entry.title} ${entry.url} ${entry.text}`.toLowerCase()
      let score = 0
      for (const t of terms) {
        if (entry.title.toLowerCase().includes(t)) score += 3
        if (entry.url.toLowerCase().includes(t)) score += 1
        if (haystack.includes(t)) score += 1
      }
      if (score === 0) continue
      const firstTerm = terms.find((t) => entry.text.toLowerCase().includes(t))
      const at = firstTerm ? entry.text.toLowerCase().indexOf(firstTerm) : 0
      hits.push({
        url: entry.url,
        title: entry.title,
        snippet: entry.text.slice(Math.max(0, at - 60), at + 160).replace(/\s+/g, ' '),
        score,
        visitedAt: entry.visitedAt,
        tabId: entry.tabId
      })
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, 40)
  }
}
