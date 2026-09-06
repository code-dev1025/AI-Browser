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

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })
const dayFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })

export function clockTime(ts: number): string {
  return timeFmt.format(ts)
}

export function dayLabel(ts: number): string {
  const d = new Date(ts)
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  if (isToday) return '今日'
  const yesterday = new Date(today.getTime() - 86_400_000)
  if (d.toDateString() === yesterday.toDateString()) return '昨日'
  return dayFmt.format(ts)
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
