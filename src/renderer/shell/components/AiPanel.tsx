import { useEffect, useRef, useState } from 'react'
import { send } from '../../shared/api'
import { on } from '../../shared/bus'
import { hostOf } from '../../shared/format'
import { useAi } from '../../shared/store/ai'
import { useShell } from '../../shared/store/shell'
import { useTabs } from '../../shared/store/tabs'
import { useUi } from '../../shared/store/ui'
import { CompareTable } from './CompareTable'

export function AiPanel(): React.ReactElement {
  const ai = useAi()
  const activeTabId = useTabs((s) => s.activeTabId)
  const order = useTabs((s) => s.order)
  const tabs = useTabs((s) => s.tabs)
  const selection = useUi((s) => s.selection)
  const clearSelection = useUi((s) => s.clearSelection)
  const backend = useUi((s) => s.backend)
  const patchShell = useShell((s) => s.patchShell)

  const [draft, setDraft] = useState('')
  const [composing, setComposing] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => on('scroll-ai-bottom', () => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight })
  }), [])

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight })
  }, [ai.messages.length])

  /** Which tabs an action applies to: the ticked ones, else everything live. */
  const targetTabs = (): string[] => {
    if (selection.length > 0) return selection
    return order.filter((id) => tabs[id]?.url && !tabs[id]?.asleep)
  }

  const askTabs = (): string[] =>
    ai.scope === 'tabs' ? targetTabs() : activeTabId ? [activeTabId] : []

  const submit = (): void => {
    const q = draft.trim()
    if (!q || ai.busy) return
    void ai.ask(q, askTabs())
    setDraft('')
  }

  return (
    <aside className="panel aipanel a-ai">
      <header>
        <h2>AI</h2>
        <button
          className="chip"
          aria-pressed={ai.scope === 'page'}
          onClick={() => ai.setScope('page')}
        >
          このページ
        </button>
        <button
          className="chip"
          aria-pressed={ai.scope === 'tabs'}
          onClick={() => ai.setScope('tabs')}
          title="開いているタブを横断して質問します"
        >
          全タブ{selection.length > 0 ? ` (${selection.length})` : ''}
        </button>
        <span className="grow" />
        <button className="chip" title="AIパネルを閉じる" onClick={() => patchShell({ aiOpen: false })}>
          ×
        </button>
      </header>

      <div className="foot" style={{ borderTop: 0, borderBottom: '1px solid var(--line-soft)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          className="chip"
          disabled={ai.working !== null}
          onClick={() => void ai.runOrganize(targetTabs())}
        >
          {ai.working === 'organize' ? '整理中…' : 'タブ自動整理'}
        </button>
        <button
          className="chip"
          disabled={ai.working !== null}
          onClick={() => void ai.runSummaries(targetTabs())}
        >
          {ai.working === 'summaries' ? '要約中…' : '一括要約'}
        </button>
        <button
          className="chip"
          disabled={ai.working !== null || targetTabs().length < 2}
          title="2つ以上のタブを選ぶと比較できます"
          onClick={() => void ai.runCompare(targetTabs().slice(0, 4))}
        >
          {ai.working === 'compare' ? '比較中…' : '比較'}
        </button>
        {selection.length > 0 && (
          <button className="chip" onClick={clearSelection}>
            選択解除
          </button>
        )}
      </div>

      <div className="body" ref={bodyRef}>
        {backend.mode === 'mock' && ai.messages.length === 0 && (
          <p className="empty">
            バックエンド未接続です。
            <br />
            いまは抽出結果をそのまま返すモック応答が返ります。
            <br />
            <code style={{ fontSize: 11 }}>AI_BACKEND_URL</code> を設定すると実APIに切り替わります。
          </p>
        )}

        {ai.organize.length > 0 && (
          <div className="card" style={{ gap: 8 }}>
            <strong style={{ fontSize: 12 }}>グループ提案</strong>
            {ai.organize.map((s) => (
              <div key={s.groupName} style={{ fontSize: 12, color: 'var(--fg-2)' }}>
                <b style={{ color: `var(--g-${s.color})` }}>{s.groupName}</b> — {s.tabIds.length} タブ
                <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{s.reason}</div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn primary" onClick={() => void ai.applyOrganize()}>
                この分類を適用
              </button>
              <button className="btn" onClick={() => ai.dismiss('organize')}>
                やめる
              </button>
            </div>
          </div>
        )}

        {ai.compare && <CompareTable result={ai.compare} onDismiss={() => ai.dismiss('compare')} />}

        {ai.summaries.length > 0 && (
          <div className="card" style={{ gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <strong style={{ fontSize: 12 }}>まとめ · {ai.summaries.length} ページ</strong>
              <span style={{ flex: 1 }} />
              <button className="chip" onClick={() => ai.dismiss('summaries')}>
                閉じる
              </button>
            </div>
            {ai.summaries.map((s) => (
              <div key={s.tabId} style={{ fontSize: 12 }}>
                <button
                  className="cite"
                  style={{ width: '100%' }}
                  onClick={() => send('tab.activate', { tabId: s.tabId })}
                >
                  <b>{hostOf(s.url)} · 約{s.readingMinutes}分</b>
                  {s.title}
                </button>
                <ul style={{ margin: '4px 0 0', paddingLeft: 16, color: 'var(--fg-2)' }}>
                  {s.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {ai.messages.map((m) => (
          <div key={m.id} className={`msg ${m.role}`}>
            <span className="who">{m.role === 'user' ? 'あなた' : 'AI'}</span>
            <div className="bubble">
              {m.text}
              {m.streaming && <span style={{ opacity: 0.5 }}>▌</span>}
              {m.error && <span style={{ color: 'var(--seal)' }}>エラー: {m.error}</span>}
            </div>
            {m.citations.length > 0 && (
              <div className="cites">
                {m.citations.map((c, i) => (
                  <button
                    key={i}
                    className="cite"
                    title={c.url}
                    onClick={() => send('tab.activate', { tabId: c.tabId })}
                  >
                    <b>{hostOf(c.url)}</b>
                    {c.quote}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="foot">
        <div className="composer">
          <textarea
            value={draft}
            placeholder={ai.scope === 'tabs' ? '全タブに質問…' : 'このページに質問…'}
            onChange={(e) => setDraft(e.target.value)}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={() => setComposing(false)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || composing || e.keyCode === 229) return
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
          />
          {ai.busy ? (
            <button className="btn danger" onClick={ai.cancel}>
              停止
            </button>
          ) : (
            <button className="btn primary" onClick={submit} disabled={!draft.trim()}>
              送信
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
