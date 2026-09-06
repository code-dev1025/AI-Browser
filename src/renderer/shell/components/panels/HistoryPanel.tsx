import { useEffect } from 'react'
import { send } from '../../../shared/api'
import { clockTime, dayLabel, duration, shortUrl } from '../../../shared/format'
import { useLibrary } from '../../../shared/store/library'
import { useLocale, useT } from '../../../shared/store/locale'

/** The browsing timeline: what was looked at, when, and for how long. */
export function HistoryPanel(): React.ReactElement {
  const t = useT()
  const locale = useLocale()
  const history = useLibrary((s) => s.history)
  const loadHistory = useLibrary((s) => s.loadHistory)

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  let lastDay = ''

  return (
    <div className="panel">
      <header>
        <h2>{t('history.title')}</h2>
        <span className="grow" />
        <button
          className="chip"
          onClick={() => {
            send('history.clear')
            void loadHistory()
          }}
        >
          {t('common.clear')}
        </button>
      </header>
      <div className="body">
        {history.length === 0 && (
          <p className="empty">{t('history.empty')}</p>
        )}
        {history.map((h) => {
          const day = dayLabel(h.visitedAt, locale)
          const showDay = day !== lastDay
          lastDay = day
          return (
            <div key={h.id}>
              {showDay && <div className="vhead">{day}</div>}
              <button
                className="listrow"
                onClick={() => send('tab.create', { url: h.url })}
                title={h.url}
              >
                <time>{clockTime(h.visitedAt, locale)}</time>
                <span className="col">
                  <span className="t">{h.title || shortUrl(h.url)}</span>
                  <span className="u">{shortUrl(h.url)}</span>
                </span>
                {h.dwellSeconds > 0 && <time>{duration(h.dwellSeconds)}</time>}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
