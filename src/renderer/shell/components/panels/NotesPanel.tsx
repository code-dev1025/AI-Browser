import { useEffect, useState } from 'react'
import { api } from '../../../shared/api'
import { shortUrl } from '../../../shared/format'
import { useLibrary } from '../../../shared/store/library'
import { useT } from '../../../shared/store/locale'
import { useTabs } from '../../../shared/store/tabs'
import { useUi } from '../../../shared/store/ui'

export function NotesPanel(): React.ReactElement {
  const t = useT()
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
    pushToast('success', t('toast.highlight_saved'))
  }

  return (
    <div className="panel">
      <header>
        <h2>{t('notes.title')}</h2>
      </header>

      <div className="panelactions">
        <button
          className="btn sm primary"
          onClick={() => void captureHighlight()}
          disabled={!active?.url}
        >
          {t('notes.capture')}
        </button>
      </div>

      <div className="body">
        {notes.length === 0 && (
          <p className="empty">{t('notes.empty')}</p>
        )}
        {[...notes].reverse().map((n) => (
          <div key={n.id} className="card" style={{ gap: 6 }}>
            <div className="t" style={{ whiteSpace: 'normal', userSelect: 'text' }}>
              {n.kind === 'highlight' ? '“' : ''}
              {n.text}
              {n.kind === 'highlight' ? '”' : ''}
            </div>
            <div className="d">{n.url ? shortUrl(n.url) : t('notes.no_page')}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {n.url && (
                <button className="btn sm" onClick={() => api.invoke('tab.create', { url: n.url })}>
                  {t('common.open')}
                </button>
              )}
              <button className="btn sm" onClick={() => void removeNote(n.id)}>
                {t('common.delete')}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="foot">
        <div className="composer">
          <textarea
            value={draft}
            placeholder={t('notes.placeholder')}
            onChange={(e) => setDraft(e.target.value)}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={() => setComposing(false)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || composing || e.keyCode === 229) return
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void saveNote()
            }}
          />
          <button
            className="btn primary send"
            title={t('notes.save_tip')}
            onClick={() => void saveNote()}
            disabled={!draft.trim()}
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
