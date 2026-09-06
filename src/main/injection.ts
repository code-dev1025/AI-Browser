/**
 * Focus mode = a content-script subsystem, not a component.
 *
 * Rules are data (a versioned list), never code scattered through the UI, so
 * the backend can ship new rules later without an app release. Every insertCSS
 * returns a key we keep per tab, and SPAs get the CSS re-applied after their
 * own navigations wipe it.
 */

import type { WebContents } from 'electron'
import type { TabId } from '@shared/types'

export interface HideRule {
  id: string
  /** Hosts this rule applies to. `*` = everywhere. */
  host: string
  selector: string
  reason: string
}

export const RULE_VERSION = 1

/**
 * Generic distraction selectors. Kept conservative on purpose: a focus mode
 * that hides real content gets switched off and never switched back on.
 */
export const DEFAULT_RULES: HideRule[] = [
  { id: 'aside', host: '*', selector: 'aside', reason: 'サイドバー' },
  { id: 'ads', host: '*', selector: '[id*="ad-" i],[class*="advert" i],ins.adsbygoogle', reason: '広告' },
  { id: 'related', host: '*', selector: '[class*="related" i],[class*="recommend" i]', reason: '関連記事' },
  { id: 'social', host: '*', selector: '[class*="share" i],[class*="social" i]', reason: 'SNSボタン' },
  { id: 'sticky', host: '*', selector: '[class*="sticky" i][class*="banner" i],[class*="popup" i]', reason: '固定バナー' },
  { id: 'newsletter', host: '*', selector: '[class*="newsletter" i],[class*="subscribe" i]', reason: '購読案内' },
  { id: 'yt-sidebar', host: 'youtube.com', selector: '#secondary,#related', reason: '次の動画' },
  { id: 'yt-comments', host: 'youtube.com', selector: '#comments', reason: 'コメント' },
  { id: 'gh-feed', host: 'github.com', selector: '.feed-right-sidebar', reason: 'サイドフィード' }
]

function cssFor(host: string, rules: HideRule[]): string {
  const applicable = rules.filter((r) => r.host === '*' || host.endsWith(r.host))
  if (applicable.length === 0) return ''
  const selectors = applicable.map((r) => r.selector).join(',\n')
  return `${selectors} { display: none !important; }\n:root { scroll-behavior: auto !important; }`
}

interface Applied {
  key: string
  host: string
  hidden: { selector: string; reason: string }[]
}

export class InjectionManager {
  private applied = new Map<TabId, Applied>()
  private rules: HideRule[] = DEFAULT_RULES

  setRules(rules: HideRule[]): void {
    this.rules = rules
  }

  /** What was hidden on this tab, so the UI can explain itself. */
  report(tabId: TabId): { selector: string; reason: string }[] {
    return this.applied.get(tabId)?.hidden ?? []
  }

  isOn(tabId: TabId): boolean {
    return this.applied.has(tabId)
  }

  async enable(tabId: TabId, wc: WebContents): Promise<void> {
    await this.disable(tabId, wc)
    const host = safeHost(wc.getURL())
    const css = cssFor(host, this.rules)
    if (!css) return
    try {
      const key = await wc.insertCSS(css)
      this.applied.set(tabId, {
        key,
        host,
        hidden: this.rules
          .filter((r) => r.host === '*' || host.endsWith(r.host))
          .map((r) => ({ selector: r.selector, reason: r.reason }))
      })
    } catch {
      /* page gone mid-injection */
    }
  }

  async disable(tabId: TabId, wc: WebContents): Promise<void> {
    const current = this.applied.get(tabId)
    if (!current) return
    this.applied.delete(tabId)
    try {
      if (!wc.isDestroyed()) await wc.removeInsertedCSS(current.key)
    } catch {
      /* already gone */
    }
  }

  /** Call on did-frame-navigate: single-page apps drop injected CSS. */
  async reapply(tabId: TabId, wc: WebContents): Promise<void> {
    if (!this.applied.has(tabId)) return
    this.applied.delete(tabId)
    await this.enable(tabId, wc)
  }

  forget(tabId: TabId): void {
    this.applied.delete(tabId)
  }
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}
