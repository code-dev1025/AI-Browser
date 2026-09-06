import { useEffect } from 'react'
import { send } from '../../../shared/api'
import { clockTime, dayLabel, duration, shortUrl } from '../../../shared/format'
import { useLibrary } from '../../../shared/store/library'

/** The browsing timeline: what was looked at, when, and for how long. */
export function HistoryPanel(): React.ReactElement {
  const history = useLibrary((s) => s.history)
  const loadHistory = useLibrary((s) => s.loadHistory)

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  let lastDay = ''

  return (
    <div className="panel">
      <header>
        <h2>閲覧タイムライン</h2>
        <span className="grow" />
        <button
          className="chip"
          onClick={() => {
            send('history.clear')
            void loadHistory()
          }}
        >
          消去
        </button>
      </header>
      <div className="body">
        {history.length === 0 && (
          <p className="empty">
            まだ履歴がありません。
            <br />
            ページを開くとここに時系列で並びます。
          </p>
        )}
        {history.map((h) => {
          const day = dayLabel(h.visitedAt)
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
                <time>{clockTime(h.visitedAt)}</time>
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
