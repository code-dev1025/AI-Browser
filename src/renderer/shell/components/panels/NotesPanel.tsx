import { useEffect, useState } from 'react'
import { api } from '../../../shared/api'
import { shortUrl } from '../../../shared/format'
import { useLibrary } from '../../../shared/store/library'
import { useTabs } from '../../../shared/store/tabs'
import { useUi } from '../../../shared/store/ui'

export function NotesPanel(): React.ReactElement {
  const notes = useLibrary((s) => s.notes)
  const loadNotes = useLibrary((s) => s.loadNotes)
  const addNote = useLibrary((s) => s.addNote)
  const removeNote = useLibrary((s) => s.removeNote)
  const active = useTabs((s) => (s.activeTabId ? s.tabs[s.activeTabId] : undefined))
  const pushToast = useUi((s) => s.pushToast)

  const [draft, setDraft] = useState('')
  const [composing, setComposing] = useState(false)

  useEffect(() => {
    void loadNotes()
  }, [loadNotes])

  const saveNote = async (): Promise<void> => {
    if (!draft.trim()) return
    await addNote({
      kind: 'note',
      text: draft.trim(),
      comment: null,
      url: active?.url ?? '',
      title: active?.title ?? '',
      anchor: null,
      tags: []
    })
    setDraft('')
  }

  const captureHighlight = async (): Promise<void> => {
    if (!active) return
    const note = await api.invoke('notes.captureHighlight', { tabId: active.id })
    if (!note) return
    await loadNotes()
    pushToast('success', 'ハイライトを保存しました')
  }

  return (
    <div className="panel">
      <header>
        <h2>メモ・ハイライト</h2>
        <span className="grow" />
        <button className="chip" onClick={() => void captureHighlight()} disabled={!active?.url}>
          選択範囲を保存
        </button>
      </header>

      <div className="body">
        {notes.length === 0 && (
          <p className="empty">
            ページ上でテキストを選択し「選択範囲を保存」を押すと
            <br />
            ハイライトとして知識庫に残ります。
          </p>
        )}
        {[...notes].reverse().map((n) => (
          <div key={n.id} className="card" style={{ gap: 6 }}>
            <div className="t" style={{ whiteSpace: 'normal', userSelect: 'text' }}>
              {n.kind === 'highlight' ? '“' : ''}
              {n.text}
              {n.kind === 'highlight' ? '”' : ''}
            </div>
            <div className="d">{n.url ? shortUrl(n.url) : 'ページ指定なし'}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {n.url && (
                <button className="chip" onClick={() => api.invoke('tab.create', { url: n.url })}>
                  開く
                </button>
              )}
              <button className="chip" onClick={() => void removeNote(n.id)}>
                削除
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="foot">
        <textarea
          className="field"
          style={{ height: 56, padding: 6, resize: 'none' }}
          value={draft}
          placeholder="メモを追加…"
          onChange={(e) => setDraft(e.target.value)}
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={() => setComposing(false)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || composing || e.keyCode === 229) return
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void saveNote()
          }}
        />
        <button className="btn" style={{ marginTop: 6 }} onClick={() => void saveNote()}>
          保存 (Ctrl+Enter)
        </button>
      </div>
    </div>
  )
}
