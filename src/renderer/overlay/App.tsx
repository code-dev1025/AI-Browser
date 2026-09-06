import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { HistoryEntry, OverlayPayload, PaletteCommand } from '@shared/types'
import { api } from '../shared/api'
import { Icon } from '../shared/Icon'
import { COMMANDS } from '../shared/commands'
import { bindLocale, useT } from '../shared/store/locale'
import { SettingsMenu } from './SettingsMenu'
import { shortUrl } from '../shared/format'

/**
 * The overlay renderer.
 *
 * It exists because a DOM element in the shell can never paint above a
 * WebContentsView (blueprint L3). It deliberately knows nothing about the app's
 * state: it names a command and main relays it to the shell.
 */
export function App(): React.ReactElement | null {
  const [payload, setPayload] = useState<OverlayPayload>({ mode: null, anchor: null, query: '' })

  useEffect(() => api.on('overlay:payload', setPayload), [])
  // The overlay is its own React root, so it binds to the language itself.
  useEffect(() => bindLocale(), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') void api.invoke('overlay.close')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (payload.mode === 'palette') return <Palette />
  if (payload.mode === 'settings') return <SettingsMenu anchor={payload.anchor} />
  if (payload.mode === 'urlsuggest') return <UrlSuggest query={payload.query} />
  if (payload.mode === 'find') return <FindBar />
  return null
}

/** Report our natural height so main can size the anchored view to fit. */
function useReportHeight(ref: React.RefObject<HTMLElement | null>, deps: unknown[]): void {
  useLayoutEffect(() => {
    const h = ref.current?.getBoundingClientRect().height ?? 0
    if (h > 0) void api.invoke('overlay.resultRect', { height: Math.ceil(h) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

/* ------------------------------------------------------------------ */
/* Command palette                                                     */
/* ------------------------------------------------------------------ */

function Palette(): React.ReactElement {
  const t = useT()
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const [composing, setComposing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => inputRef.current?.focus(), [])

  const q = query.trim().toLowerCase()
  const matches: PaletteCommand[] = q
    ? COMMANDS.filter((c) =>
        `${t(c.titleKey)} ${c.hintKey ? t(c.hintKey) : ''}`.toLowerCase().includes(q)
      )
    : COMMANDS

  const run = useCallback((commandId: string) => {
    void api.invoke('overlay.runCommand', { commandId })
  }, [])

  let lastGroup = ''

  return (
    <div className="scrim" onPointerDown={() => void api.invoke('overlay.close')}>
      <div className="palette" onPointerDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={query}
          placeholder={t('palette.placeholder')}
          onChange={(e) => {
            setQuery(e.target.value)
            setIndex(0)
          }}
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={() => setComposing(false)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || composing || e.keyCode === 229) return
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setIndex((i) => Math.min(matches.length - 1, i + 1))
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setIndex((i) => Math.max(0, i - 1))
            }
            if (e.key === 'Enter') {
              const cmd = matches[index]
              if (cmd) run(cmd.id)
            }
          }}
        />
        <div className="plist">
          {matches.length === 0 && (
            <div className="pgroup" style={{ padding: 16 }}>
              {t('palette.no_match')}
            </div>
          )}
          {matches.map((c, i) => {
            const header = c.groupKey !== lastGroup && !q
            lastGroup = c.groupKey
            return (
              <div key={c.id}>
                {header && <div className="pgroup">{t(c.groupKey)}</div>}
                <button
                  className="prow"
                  data-active={i === index}
                  onPointerEnter={() => setIndex(i)}
                  onClick={() => run(c.id)}
                >
                  <span className="t">{t(c.titleKey)}</span>
                  {c.hintKey && <span className="h">{t(c.hintKey)}</span>}
                  {c.shortcut && <kbd>{c.shortcut}</kbd>}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Omnibox suggestions                                                 */
/* ------------------------------------------------------------------ */

function UrlSuggest({ query }: { query: string }): React.ReactElement | null {
  const [hits, setHits] = useState<HistoryEntry[]>([])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    void api.invoke('history.search', { query, limit: 8 }).then((rows) => {
      if (!cancelled) setHits(rows)
    })
    return () => {
      cancelled = true
    }
  }, [query])

  const rows = hits.slice(0, 8)
  useReportHeight(ref, [rows.length])

  if (rows.length === 0) return null

  return (
    <div className="anchored" ref={ref}>
      <div className="suggest">
        {rows.map((h) => (
          <button
            key={h.id}
            className="prow"
            title={h.url}
            // pointerdown, not click: the omnibox blurs before click fires.
            onPointerDown={() => void api.invoke('overlay.runCommand', { commandId: 'navigate', arg: h.url })}
          >
            <span className="t">{h.title || shortUrl(h.url)}</span>
            <span className="h">{shortUrl(h.url)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Find in page                                                        */
/* ------------------------------------------------------------------ */

function FindBar(): React.ReactElement {
  const t = useT()
  const [query, setQuery] = useState('')
  const [composing, setComposing] = useState(false)
  const [state, setState] = useState({ matches: 0, activeMatch: 0 })
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => inputRef.current?.focus(), [])
  useEffect(() => api.on('find:state', (s) => setState(s)), [])
  useReportHeight(ref, [])

  const search = (value: string, forward = true): void => {
    setQuery(value)
    void api.invoke('find.start', { query: value, forward })
  }

  return (
    <div className="findbar" ref={ref}>
      <input
        ref={inputRef}
        value={query}
        placeholder={t('find.placeholder')}
        onChange={(e) => {
          if (composing) return setQuery(e.target.value)
          search(e.target.value)
        }}
        onCompositionStart={() => setComposing(true)}
        onCompositionEnd={(e) => {
          setComposing(false)
          search(e.currentTarget.value)
        }}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing || composing || e.keyCode === 229) return
          if (e.key === 'Enter') search(query, !e.shiftKey)
        }}
      />
      <span className="count">
        {state.matches > 0 ? `${state.activeMatch}/${state.matches}` : query ? '0' : ''}
      </span>
      <button title={t('find.prev')} onClick={() => search(query, false)}>
        <Icon name="chevron" size={13} />
      </button>
      <button title={t('find.next')} onClick={() => search(query, true)}>
        <Icon name="chevronRight" size={13} />
      </button>
      <button
        title={t('common.close')}
        onClick={() => {
          void api.invoke('find.stop')
          void api.invoke('overlay.close')
        }}
      >
        <Icon name="close" size={13} />
      </button>
    </div>
  )
}
