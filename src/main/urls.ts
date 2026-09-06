/** URL / search-query handling for the omnibox. No network, no dependencies. */

export const SEARCH_ENGINE = 'https://duckduckgo.com/?q='

const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i
const LOOKS_LIKE_HOST_RE = /^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/
const LOCALHOST_RE = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/.*)?$/i

/** Turn whatever the user typed into a URL we are willing to navigate to. */
export function toNavigableUrl(input: string): string {
  const raw = input.trim()
  if (!raw) return ''

  if (SCHEME_RE.test(raw)) {
    const scheme = raw.slice(0, raw.indexOf(':')).toLowerCase()
    // Never navigate a tab to a privileged or local scheme from the omnibox.
    if (scheme === 'javascript' || scheme === 'data' || scheme === 'file' || scheme === 'tabshot') {
      return SEARCH_ENGINE + encodeURIComponent(raw)
    }
    return raw
  }

  if (LOCALHOST_RE.test(raw)) return `http://${raw}`
  if (LOOKS_LIKE_HOST_RE.test(raw) && !raw.includes(' ')) return `https://${raw}`

  return SEARCH_ENGINE + encodeURIComponent(raw)
}

/** Short label for the address bar and tab titles. */
export function hostLabel(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function isHttpLike(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

/** Google's favicon service is not used — we take what the page reports. */
export function pickFavicon(favicons: string[]): string | null {
  if (favicons.length === 0) return null
  const https = favicons.find((f) => f.startsWith('https://'))
  return https ?? favicons[0] ?? null
}
