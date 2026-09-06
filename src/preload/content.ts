/**
 * The NARROW preload — runs beside untrusted pages.
 *
 * It exposes NOTHING to the page: no contextBridge call, no globals. It only
 * listens for a handful of requests from main and answers them. Everything it
 * reads comes from the DOM it already shares with the page, in the isolated
 * world, so page JavaScript cannot reach our IPC.
 */

import { ipcRenderer } from 'electron'
import { CONTENT_CHANNELS } from '@shared/contract'

/* ------------------------------------------------------------------ */
/* Readable-text extraction                                            */
/* ------------------------------------------------------------------ */

const BLOCK_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'NAV', 'HEADER', 'FOOTER', 'ASIDE', 'FORM',
  'IFRAME', 'SVG', 'BUTTON', 'SELECT', 'TEMPLATE'
])

const CONTENT_SELECTORS = [
  'article',
  'main',
  '[role="main"]',
  '#content',
  '.post-content',
  '.article-body',
  '.entry-content'
]

function pickRoot(): Element {
  for (const sel of CONTENT_SELECTORS) {
    const el = document.querySelector(sel)
    if (el && (el.textContent ?? '').trim().length > 400) return el
  }
  // Fall back to the densest block-level element.
  let best: Element = document.body
  let bestScore = 0
  for (const el of Array.from(document.body.querySelectorAll('div,section,article,main'))) {
    const text = (el.textContent ?? '').trim()
    if (text.length < 400) continue
    const links = el.querySelectorAll('a').length
    const score = text.length / (1 + links * 40)
    if (score > bestScore) {
      bestScore = score
      best = el
    }
  }
  return best
}

function visibleText(root: Element): string {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      if (BLOCK_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT
      const style = window.getComputedStyle(parent)
      if (style.display === 'none' || style.visibility === 'hidden') return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    }
  })

  const parts: string[] = []
  let total = 0
  let node = walker.nextNode()
  while (node && total < 200_000) {
    const t = (node.nodeValue ?? '').replace(/\s+/g, ' ').trim()
    if (t) {
      parts.push(t)
      total += t.length
    }
    node = walker.nextNode()
  }
  return parts.join('\n')
}

function metaContent(names: string[]): string | null {
  for (const name of names) {
    const el =
      document.querySelector(`meta[property="${name}"]`) ??
      document.querySelector(`meta[name="${name}"]`)
    const c = el?.getAttribute('content')?.trim()
    if (c) return c
  }
  return null
}

function textOf(selectors: string[]): string | null {
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel)
      const t = el?.textContent?.replace(/\s+/g, ' ').trim()
      if (t) return t
    } catch {
      /* invalid selector on this page */
    }
  }
  return null
}

/** JSON-LD is the most reliable product source when a site publishes it. */
function jsonLdProduct(): Record<string, unknown> | null {
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
  for (const s of scripts) {
    try {
      const parsed: unknown = JSON.parse(s.textContent ?? '')
      const list = Array.isArray(parsed) ? parsed : [parsed]
      for (const item of list) {
        const obj = item as Record<string, unknown>
        const type = obj['@type']
        if (type === 'Product' || (Array.isArray(type) && type.includes('Product'))) return obj
      }
    } catch {
      /* malformed ld+json is common */
    }
  }
  return null
}

function extractProduct(): Record<string, unknown> | null {
  const ld = jsonLdProduct()
  const offers = (ld?.['offers'] ?? null) as Record<string, unknown> | null
  const agg = (ld?.['aggregateRating'] ?? null) as Record<string, unknown> | null

  const price =
    (offers?.['price'] as string | undefined) ??
    metaContent(['product:price:amount', 'og:price:amount']) ??
    textOf([
      '[itemprop="price"]',
      '.a-price .a-offscreen',
      '#priceblock_ourprice',
      '.price',
      '[class*="Price"]'
    ])

  const name =
    (ld?.['name'] as string | undefined) ??
    metaContent(['og:title']) ??
    textOf(['h1', '[itemprop="name"]'])

  const availability =
    (offers?.['availability'] as string | undefined)?.replace(/^.*\//, '') ??
    textOf(['[itemprop="availability"]', '#availability', '[class*="stock" i]'])

  const rating =
    (agg?.['ratingValue'] as string | undefined) ?? textOf(['[itemprop="ratingValue"]'])
  const reviewCount =
    (agg?.['reviewCount'] as string | undefined) ?? textOf(['[itemprop="reviewCount"]'])
  const seller =
    (offers?.['seller'] as Record<string, unknown> | undefined)?.['name'] as string | undefined

  const specs: { label: string; value: string }[] = []
  for (const row of Array.from(document.querySelectorAll('table tr')).slice(0, 120)) {
    const cells = row.querySelectorAll('th,td')
    if (cells.length !== 2) continue
    const label = cells[0]?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    const value = cells[1]?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    if (label && value && label.length < 40 && value.length < 120) specs.push({ label, value })
    if (specs.length >= 30) break
  }

  if (!price && !name && specs.length === 0) return null

  const priceValue = price ? Number(String(price).replace(/[^\d.]/g, '')) : NaN

  return {
    name: name ?? null,
    price: price ? String(price) : null,
    priceValue: Number.isFinite(priceValue) ? priceValue : null,
    currency:
      (offers?.['priceCurrency'] as string | undefined) ??
      metaContent(['product:price:currency', 'og:price:currency']) ??
      null,
    availability: availability ?? null,
    rating: rating ? String(rating) : null,
    reviewCount: reviewCount ? String(reviewCount) : null,
    seller: seller ?? null,
    specs
  }
}

function extract(schema: string): Record<string, unknown> {
  const root = pickRoot()
  const text = visibleText(root)

  const headings = Array.from(root.querySelectorAll('h1,h2,h3'))
    .slice(0, 60)
    .map((h) => ({ level: Number(h.tagName[1]), text: (h.textContent ?? '').replace(/\s+/g, ' ').trim() }))
    .filter((h) => h.text.length > 0)

  const links = Array.from(root.querySelectorAll('a[href]'))
    .slice(0, 120)
    .map((a) => ({
      href: (a as HTMLAnchorElement).href,
      text: (a.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120)
    }))
    .filter((l) => l.text.length > 1)

  const images = Array.from(root.querySelectorAll('img[src]'))
    .slice(0, 20)
    .map((i) => (i as HTMLImageElement).src)

  // Character ranges per heading, so a citation can be scrolled to later.
  const sections: { start: number; end: number; heading: string | null }[] = []
  let cursor = 0
  for (const h of headings) {
    const at = text.indexOf(h.text, cursor)
    if (at < 0) continue
    if (sections.length > 0) {
      const prev = sections[sections.length - 1]
      if (prev) prev.end = at
    }
    sections.push({ start: at, end: text.length, heading: h.text })
    cursor = at + h.text.length
  }

  return {
    url: location.href,
    title: document.title,
    text,
    excerpt: metaContent(['og:description', 'description']) ?? text.slice(0, 280),
    headings,
    links,
    images,
    lang: document.documentElement.lang || null,
    product: schema === 'product' ? extractProduct() : null,
    sections,
    extractedAt: Date.now(),
    wordCount: text.split(/\s+/).filter(Boolean).length
  }
}

/* ------------------------------------------------------------------ */
/* Selection capture (highlights)                                      */
/* ------------------------------------------------------------------ */

/** Best-effort structural anchor, so a highlight can be re-found later. */
function anchorFor(node: Node | null): string | null {
  let el: Element | null = node instanceof Element ? node : (node?.parentElement ?? null)
  const parts: string[] = []
  while (el && el !== document.body && parts.length < 6) {
    if (el.id) {
      parts.unshift(`#${el.id}`)
      break
    }
    const parent: Element | null = el.parentElement
    const index = parent ? Array.from(parent.children).indexOf(el) + 1 : 1
    parts.unshift(`${el.tagName.toLowerCase()}:nth-child(${index})`)
    el = parent
  }
  return parts.length > 0 ? parts.join(' > ') : null
}

function getSelection(): { text: string; anchor: string | null } | null {
  const sel = window.getSelection()
  const text = sel?.toString().trim() ?? ''
  if (!text) return null
  return { text, anchor: anchorFor(sel?.anchorNode ?? null) }
}

/* ------------------------------------------------------------------ */
/* Wiring — main asks, we answer. Nothing is exposed to the page.      */
/* ------------------------------------------------------------------ */

ipcRenderer.on(CONTENT_CHANNELS.extractRequest, (_e, payload: { requestId: string; schema: string }) => {
  let data: Record<string, unknown> | null = null
  try {
    data = extract(payload.schema)
  } catch (err) {
    data = null
    void err
  }
  ipcRenderer.send(CONTENT_CHANNELS.extractResult, { requestId: payload.requestId, data })
})

ipcRenderer.on(CONTENT_CHANNELS.selectionRequest, (_e, payload: { requestId: string }) => {
  let data: { text: string; anchor: string | null } | null = null
  try {
    data = getSelection()
  } catch {
    data = null
  }
  ipcRenderer.send(CONTENT_CHANNELS.selectionResult, { requestId: payload.requestId, data })
})

/** Paint a highlight the user just saved, so the page reflects the library. */
ipcRenderer.on(CONTENT_CHANNELS.highlightApply, () => {
  try {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
    const range = sel.getRangeAt(0)
    const mark = document.createElement('mark')
    mark.style.background = 'rgba(255, 214, 102, .55)'
    mark.style.color = 'inherit'
    mark.setAttribute('data-ai-browser-highlight', '1')
    range.surroundContents(mark)
    sel.removeAllRanges()
  } catch {
    // surroundContents throws when the range crosses element boundaries;
    // the note is still saved, only the visual mark is skipped.
  }
})
