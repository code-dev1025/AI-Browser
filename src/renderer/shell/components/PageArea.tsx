import { useEffect, useRef, useState } from 'react'
import { paneRects } from '@shared/layout'
import type { Rect, TabModel } from '@shared/types'
import { api, send } from '../../shared/api'
import { Icon } from '../../shared/Icon'
import { shortUrl } from '../../shared/format'
import { useLibrary } from '../../shared/store/library'
import { useT } from '../../shared/store/locale'
import { useShell } from '../../shared/store/shell'
import { useTabs } from '../../shared/store/tabs'

/**
 * The hole in the chrome.
 *
 * Native page views paint on top of this element, so most of the time it draws
 * nothing. It owns exactly the states where NO live view exists — start page,
 * sleeping, crashed — plus the split gutters, which live in the gaps between
 * views and are therefore visible.
 */
export function PageArea(): React.ReactElement {
  const shell = useShell((s) => s.shell)
  const rect = useShell((s) => s.rect)
  const tabs = useTabs((s) => s.tabs)
  const activeTabId = useTabs((s) => s.activeTabId)

  const [preview, setPreview] = useState<number[] | null>(null)
  const dragRef = useRef<{ index: number; startX: number; ratios: number[] } | null>(null)

  const ratios = preview ?? (shell.splitRatio.length > 0 ? shell.splitRatio : [1])
  const panes = paneRects(rect, ratios)

  const paneTabs: (TabModel | undefined)[] = panes.map((_, i) =>
    i === 0 ? (activeTabId ? tabs[activeTabId] : undefined) : tabs[shell.paneTabIds[i] ?? '']
  )

  /* ---- splitter drag: main hides the views, we drag pixels instead ---- */

  useEffect(() => {
    const onMove = (e: PointerEvent): void => {
      const drag = dragRef.current
      if (!drag || rect.width === 0) return
      const deltaRatio = (e.clientX - drag.startX) / rect.width
      const next = [...drag.ratios]
      const a = next[drag.index] ?? 0
      const b = next[drag.index + 1] ?? 0
      const limit = 0.12
      const applied = Math.max(-a + limit, Math.min(b - limit, deltaRatio))
      next[drag.index] = a + applied
      next[drag.index + 1] = b - applied
      setPreview(next)
    }

    const onUp = (): void => {
      if (!dragRef.current) return
      const finalRatios = preview
      dragRef.current = null
      setPreview(null)
      void api.invoke('shell.endDrag', finalRatios ? { splitRatio: finalRatios } : {})
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [rect.width, preview])

  const beginDrag = (index: number, clientX: number): void => {
    dragRef.current = { index, startX: clientX, ratios: [...ratios] }
    setPreview([...ratios])
    void api.invoke('shell.beginDrag')
  }

  const loading = activeTabId ? tabs[activeTabId]?.status === 'loading' : false

  return (
    <div className="pagearea a-page">
      {loading && (
        <div className="loadbar">
          <span />
        </div>
      )}

      {/* While dragging, main has hidden the live views — show their last frame */}
      {shell.dragging &&
        panes.map((pane, i) => {
          const tab = paneTabs[i]
          if (!tab || tab.snapshotVersion === 0) return null
          return (
            <img
              key={`shot-${i}`}
              className="paneshot"
              alt=""
              src={`tabshot://${tab.id}/?v=${tab.snapshotVersion}`}
              style={{ left: pane.x - rect.x, width: pane.width }}
            />
          )
        })}

      {panes.map((pane, i) => (
        <PanePlaceholder key={`p-${i}`} pane={pane} rect={rect} tab={paneTabs[i]} index={i} />
      ))}

      {panes.slice(0, -1).map((pane, i) => (
        <div
          key={`gutter-${i}`}
          className="gutter"
          data-dragging={dragRef.current?.index === i}
          style={{ left: pane.x - rect.x + pane.width }}
          onPointerDown={(e) => {
            e.preventDefault()
            beginDrag(i, e.clientX)
          }}
          role="separator"
          aria-orientation="vertical"
        />
      ))}
    </div>
  )
}

/** Drawn only when the pane has no live WebContentsView behind it. */
function PanePlaceholder({
  pane,
  rect,
  tab,
  index
}: {
  pane: Rect
  rect: Rect
  tab: TabModel | undefined
  index: number
}): React.ReactElement | null {
  const t = useT()
  const style = {
    position: 'absolute' as const,
    left: pane.x - rect.x,
    top: 0,
    width: pane.width,
    height: pane.height
  }

  if (!tab) {
    if (index === 0) return <div style={style}><StartPage /></div>
    return (
      <div style={style} className="placeholder">
        <div className="empty">{t('pane.empty')}</div>
      </div>
    )
  }

  if (tab.asleep) {
    return (
      <div style={style} className="placeholder">
        <div className="sleeping">
          {tab.snapshotVersion > 0 && (
            <img src={`tabshot://${tab.id}/?v=${tab.snapshotVersion}`} alt="" />
          )}
          <div>
            <strong>{tab.title}</strong>
            <div className="empty" style={{ padding: '4px 0' }}>
              {t('sleeping.body', { host: shortUrl(tab.url) })}
            </div>
          </div>
          <button className="btn primary" onClick={() => send('tab.wake', { tabId: tab.id })}>
            <Icon name="reload" size={13} /> {t('sleeping.wake')}
          </button>
        </div>
      </div>
    )
  }

  if (tab.status === 'crashed') {
    return (
      <div style={style} className="placeholder">
        <div className="sleeping">
          <strong>{t('crashed.title')}</strong>
          <div className="empty" style={{ padding: 0 }}>{tab.errorText}</div>
          <button className="btn primary" onClick={() => send('tab.reload', { tabId: tab.id })}>
            {t('common.reload')}
          </button>
        </div>
      </div>
    )
  }

  if (!tab.url && !tab.pendingUrl) {
    return (
      <div style={style}>
        <StartPage />
      </div>
    )
  }

  // A live view covers this rect — draw nothing.
  return null
}

/** The home screen: recent work, not a grid of logos. */
function StartPage(): React.ReactElement {
  const t = useT()
  const history = useLibrary((s) => s.history)
  const workspaces = useLibrary((s) => s.workspaces)
  const notes = useLibrary((s) => s.notes)
  const activeTabId = useTabs((s) => s.activeTabId)
  const restore = useLibrary((s) => s.restoreWorkspace)

  const seen = new Set<string>()
  const recent = history
    .filter((h) => {
      const key = shortUrl(h.url)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 8)

  const open = (url: string): void => {
    if (activeTabId) send('tab.navigate', { tabId: activeTabId, input: url })
    else send('tab.create', { url })
  }

  return (
    <div className="placeholder">
      <div className="startpage">
        <div>
          <h1>{t('start.title')}</h1>
          <div className="sub">{t('start.sub')}</div>
        </div>

        {recent.length > 0 && (
          <div>
            <div className="vhead">{t('start.recent')}</div>
            <div className="cards">
              {recent.map((h) => (
                <button key={h.id} className="card" onClick={() => open(h.url)}>
                  <span className="t">{h.title || shortUrl(h.url)}</span>
                  <span className="d">{shortUrl(h.url)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {workspaces.length > 0 && (
          <div>
            <div className="vhead">{t('start.workspaces')}</div>
            <div className="cards">
              {[...workspaces].reverse().slice(0, 4).map((w) => (
                <button key={w.id} className="card" onClick={() => void restore(w.id, false)}>
                  <span className="t">{w.name}</span>
                  <span className="d">{t('start.restore_n', { n: w.tabs.length })}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {notes.length > 0 && (
          <div>
            <div className="vhead">{t('start.notes', { n: notes.length })}</div>
            <div className="cards">
              {[...notes].reverse().slice(0, 3).map((n) => (
                <button key={n.id} className="card" onClick={() => n.url && open(n.url)}>
                  <span className="t">{n.text.slice(0, 60)}</span>
                  <span className="d">{n.url ? shortUrl(n.url) : t('start.note')}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
