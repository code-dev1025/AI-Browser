import { useState } from 'react'
import { send } from '../../../shared/api'
import { clockTime, shortUrl } from '../../../shared/format'
import { useLibrary } from '../../../shared/store/library'
import { useLocale, useT } from '../../../shared/store/locale'
import { useUi } from '../../../shared/store/ui'

/**
 * Natural-language search over history and the live text of open tabs.
 * Today it is keyword scoring in main; when the backend ships embeddings the
 * same call returns semantic hits and nothing here changes.
 */
export function SearchPanel(): React.ReactElement {
  const t = useT()
  const locale = useLocale()
  const hits = useLibrary((s) => s.searchHits)
  const searching = useLibrary((s) => s.searching)
  const search = useLibrary((s) => s.search)
  const backend = useUi((s) => s.backend)

  const [query, setQuery] = useState('')
  const [composing, setComposing] = useState(false)

  return (
    <div className="panel">
      <header>
        <h2>{t('search.title')}</h2>
      </header>

      <div className="foot" style={{ borderTop: 0, borderBottom: '1px solid var(--line-soft)' }}>
        <input
          className="field"
          value={query}
          placeholder={t('search.placeholder')}
          onChange={(e) => setQuery(e.target.value)}
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={() => setComposing(false)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || composing || e.keyCode === 229) return
            if (e.key === 'Enter') void search(query)
          }}
        />
      </div>

      <div className="body">
        {searching && <p className="empty">{t('search.searching')}</p>}
        {!searching && hits.length === 0 && (
          <p className="empty">
            {t(backend.mode === 'mock' ? 'search.empty_mock' : 'search.empty')}
          </p>
        )}
        {hits.map((h) => (
          <button
            key={`${h.url}-${h.visitedAt ?? 0}`}
            className="listrow"
            title={h.url}
            onClick={() =>
              h.tabId ? send('tab.activate', { tabId: h.tabId }) : send('tab.create', { url: h.url })
            }
          >
            <span className="col">
              <span className="t">{h.title || shortUrl(h.url)}</span>
              <span className="u">{shortUrl(h.url)}</span>
              {h.snippet && (
                <span className="u" style={{ color: 'var(--fg-2)', fontFamily: 'var(--font)' }}>
                  {h.snippet}
                </span>
              )}
            </span>
            {h.visitedAt && <time>{clockTime(h.visitedAt, locale)}</time>}
          </button>
        ))}
      </div>
    </div>
  )
}
