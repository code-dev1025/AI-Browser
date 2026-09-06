import { useEffect, useRef, useState } from 'react'
import { api, send } from '../../shared/api'
import { Icon } from '../../shared/Icon'
import { on } from '../../shared/bus'
import { useShell } from '../../shared/store/shell'
import { useTabs } from '../../shared/store/tabs'

export function Toolbar(): React.ReactElement {
  const active = useTabs((s) => (s.activeTabId ? s.tabs[s.activeTabId] : undefined))
  const order = useTabs((s) => s.order)
  const shell = useShell((s) => s.shell)
  const patchShell = useShell((s) => s.patchShell)

  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [composing, setComposing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const suggestTimer = useRef<number | null>(null)

  const shownUrl = active?.pendingUrl ?? active?.url ?? ''

  useEffect(() => {
    if (!editing) setDraft(shownUrl)
  }, [shownUrl, editing])

  useEffect(
    () =>
      on('focus-omnibox', () => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }),
    []
  )

  const closeSuggest = (): void => {
    if (suggestTimer.current) window.clearTimeout(suggestTimer.current)
    void api.invoke('overlay.close')
  }

  /** Suggestions fire on composition end, never per keystroke during IME. */
  const requestSuggest = (query: string): void => {
    if (suggestTimer.current) window.clearTimeout(suggestTimer.current)
    if (!query.trim()) return closeSuggest()
    const rect = boxRef.current?.getBoundingClientRect()
    if (!rect) return
    suggestTimer.current = window.setTimeout(() => {
      void api.invoke('overlay.open', {
        mode: 'urlsuggest',
        anchor: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        query
      })
    }, 90)
  }

  const navigate = (): void => {
    if (!active) return
    closeSuggest()
    setEditing(false)
    send('tab.navigate', { tabId: active.id, input: draft })
    inputRef.current?.blur()
  }

  const toggleSplit = (): void => {
    if (shell.splitRatio.length > 1) {
      send('split.close', { pane: 1 })
      return
    }
    const other = order.find((id) => id !== active?.id) ?? null
    send('split.set', { paneTabIds: [active?.id ?? null, other], splitRatio: [0.5, 0.5] })
  }

  const busy = active?.status === 'loading'

  return (
    <div className="toolbar a-tool">
      <button
        className="iconbtn"
        title="戻る (Alt+←)"
        disabled={!active?.canGoBack}
        onClick={() => active && send('tab.goBack', { tabId: active.id })}
      >
        <Icon name="back" />
      </button>
      <button
        className="iconbtn"
        title="進む (Alt+→)"
        disabled={!active?.canGoForward}
        onClick={() => active && send('tab.goForward', { tabId: active.id })}
      >
        <Icon name="forward" />
      </button>
      <button
        className="iconbtn"
        title={busy ? '停止 (Esc)' : '再読み込み'}
        disabled={!active?.url && !busy}
        onClick={() =>
          active && (busy ? send('tab.stop', { tabId: active.id }) : send('tab.reload', { tabId: active.id }))
        }
      >
        <Icon name={busy ? 'stop' : 'reload'} />
      </button>

      <div className="omnibox" ref={boxRef}>
        <span className="scheme">
          {shownUrl.startsWith('https://') ? 'https' : shownUrl.startsWith('http://') ? 'http' : ''}
        </span>
        <input
          ref={inputRef}
          value={draft}
          spellCheck={false}
          placeholder="URL を入力、または検索"
          onChange={(e) => {
            setDraft(e.target.value)
            if (!composing) requestSuggest(e.target.value)
          }}
          onFocus={() => setEditing(true)}
          onBlur={() => {
            setEditing(false)
            window.setTimeout(closeSuggest, 120)
          }}
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={(e) => {
            setComposing(false)
            requestSuggest(e.currentTarget.value)
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || composing || e.keyCode === 229) return
            if (e.key === 'Enter') navigate()
            if (e.key === 'Escape') {
              closeSuggest()
              setDraft(shownUrl)
              inputRef.current?.blur()
            }
          }}
        />
        {composing && <span className="composing">変換中</span>}
      </div>

      <button
        className="iconbtn"
        aria-pressed={active?.focusMode ?? false}
        title="集中モード — 不要な要素を隠す"
        disabled={!active?.url}
        onClick={() =>
          active && send('focus.set', { tabId: active.id, enabled: !active.focusMode })
        }
      >
        <Icon name="focus" />
      </button>
      <button
        className="iconbtn"
        aria-pressed={shell.splitRatio.length > 1}
        title="分割画面"
        onClick={toggleSplit}
      >
        <Icon name="split" />
      </button>
      <button
        className="iconbtn"
        title="コマンドパレット (Ctrl+K)"
        onClick={() => void api.invoke('overlay.open', { mode: 'palette', anchor: null, query: '' })}
      >
        <Icon name="menu" />
      </button>
      <button
        className="iconbtn"
        aria-pressed={shell.aiOpen}
        title="AIパネル (Ctrl+Shift+K)"
        onClick={() => patchShell({ aiOpen: !shell.aiOpen })}
      >
        <Icon name="panel" />
      </button>
    </div>
  )
}
