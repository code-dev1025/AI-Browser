import type { Locale } from '@shared/types'
import { intlLocale, translate } from '@shared/i18n'

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function shortUrl(url: string): string {
  try {
    const u = new URL(url)
    const path = u.pathname === '/' ? '' : u.pathname
    return `${u.hostname.replace(/^www\./, '')}${path}`
  } catch {
    return url
  }
}

/* Formatters are built per locale and cached — constructing an Intl formatter
   on every row is measurable in a list of several hundred history entries. */
const timeFmts = new Map<Locale, Intl.DateTimeFormat>()
const dayFmts = new Map<Locale, Intl.DateTimeFormat>()

function timeFmt(locale: Locale): Intl.DateTimeFormat {
  let f = timeFmts.get(locale)
  if (!f) {
    f = new Intl.DateTimeFormat(intlLocale(locale), { hour: '2-digit', minute: '2-digit' })
    timeFmts.set(locale, f)
  }
  return f
}

function dayFmt(locale: Locale): Intl.DateTimeFormat {
  let f = dayFmts.get(locale)
  if (!f) {
    f = new Intl.DateTimeFormat(intlLocale(locale), { month: 'short', day: 'numeric' })
    dayFmts.set(locale, f)
  }
  return f
}

export function clockTime(ts: number, locale: Locale): string {
  return timeFmt(locale).format(ts)
}

export function dayLabel(ts: number, locale: Locale): string {
  const d = new Date(ts)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return translate(locale, 'common.today')
  const yesterday = new Date(today.getTime() - 86_400_000)
  if (d.toDateString() === yesterday.toDateString()) return translate(locale, 'common.yesterday')
  return dayFmt(locale).format(ts)
}

export function duration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  return `${(seconds / 3600).toFixed(1)}h`
}

/**
 * Importance score for the tab list. Deliberately simple and explainable:
 * recency dominates, time spent and revisits lift it. Users must be able to
 * guess why a tab is at the top.
 */
export function importance(tab: {
  lastActiveAt: number
  activeSeconds: number
  visits: number
  pinned: boolean
}): number {
  if (tab.pinned) return Number.MAX_SAFE_INTEGER
  const hoursAgo = (Date.now() - tab.lastActiveAt) / 3_600_000
  const recency = 100 / (1 + hoursAgo)
  return recency + Math.min(60, tab.activeSeconds / 30) + Math.min(20, tab.visits * 2)
}
