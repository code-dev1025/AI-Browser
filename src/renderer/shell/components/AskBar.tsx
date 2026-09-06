import { useEffect, useRef, useState } from 'react'
import { useAi } from '../../shared/store/ai'
import { useShell } from '../../shared/store/shell'
import { useTabs } from '../../shared/store/tabs'
import { useUi } from '../../shared/store/ui'
import { on } from '../../shared/bus'

/** The one-line ask bar from the sketch: always there, never in the way. */
export function AskBar(): React.ReactElement {
  const [value, setValue] = useState('')
  const [composing, setComposing] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  const ask = useAi((s) => s.ask)
  const busy = useAi((s) => s.busy)
  const scope = useAi((s) => s.scope)
  const activeTabId = useTabs((s) => s.activeTabId)
  const selection = useUi((s) => s.selection)
  const patchShell = useShell((s) => s.patchShell)
  const aiOpen = useShell((s) => s.shell.aiOpen)

  useEffect(() => on('focus-ask', () => ref.current?.focus()), [])

  const submit = (): void => {
    const q = value.trim()
    if (!q || busy) return
    const tabIds =
      scope === 'tabs' ? selection : activeTabId ? [activeTabId] : []
    if (!aiOpen) patchShell({ aiOpen: true })
    void ask(q, tabIds)
    setValue('')
  }

  return (
    <div className="askbar a-ask">
      <span className="ic">AI</span>
      <input
        ref={ref}
        value={value}
        placeholder={
          scope === 'tabs'
            ? '開いているタブ全部に質問…'
            : 'このページについて質問してください…'
        }
        onChange={(e) => setValue(e.target.value)}
        onCompositionStart={() => setComposing(true)}
        onCompositionEnd={() => setComposing(false)}
        onKeyDown={(e) => {
          // Enter during IME conversion commits the conversion, not the query.
          if (e.nativeEvent.isComposing || composing || e.keyCode === 229) return
          if (e.key === 'Enter') submit()
        }}
      />
      <button className="btn" onClick={submit} disabled={busy || !value.trim()}>
        {busy ? '応答中…' : '送信'}
      </button>
    </div>
  )
}
