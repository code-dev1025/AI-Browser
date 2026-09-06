import { useEffect, useState } from 'react'
import { useLibrary } from '../../../shared/store/library'
import { useTabs } from '../../../shared/store/tabs'
import { dayLabel } from '../../../shared/format'

/** Save the whole working set — tabs, order, groups, layout — and bring it back. */
export function WorkspacePanel(): React.ReactElement {
  const workspaces = useLibrary((s) => s.workspaces)
  const load = useLibrary((s) => s.loadWorkspaces)
  const save = useLibrary((s) => s.saveWorkspace)
  const restore = useLibrary((s) => s.restoreWorkspace)
  const remove = useLibrary((s) => s.removeWorkspace)
  const tabCount = useTabs((s) => s.order.length)

  const [name, setName] = useState('')
  const [composing, setComposing] = useState(false)

  useEffect(() => {
    void load()
  }, [load])

  const suggestion = (): string => {
    const d = new Date()
    return `作業 ${d.getMonth() + 1}/${d.getDate()}`
  }

  const doSave = async (): Promise<void> => {
    await save(name.trim() || suggestion())
    setName('')
  }

  return (
    <div className="panel">
      <header>
        <h2>ワークスペース</h2>
        <span className="grow" />
        <span className="badge">{tabCount} タブ</span>
      </header>

      <div className="body">
        {workspaces.length === 0 && (
          <p className="empty">
            今の作業状態をまるごと保存しておくと、
            <br />
            あとで同じ並びのまま復元できます。
          </p>
        )}
        {[...workspaces].reverse().map((w) => (
          <div key={w.id} className="card" style={{ gap: 6 }}>
            <div className="t">{w.name}</div>
            <div className="d">
              {w.tabs.length} タブ · {w.groups.length} グループ · {dayLabel(w.createdAt)}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button className="chip" onClick={() => void restore(w.id, false)}>
                追加で開く
              </button>
              <button className="chip" onClick={() => void restore(w.id, true)}>
                置き換えて復元
              </button>
              <button className="chip" onClick={() => void remove(w.id)}>
                削除
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="foot" style={{ display: 'flex', gap: 6 }}>
        <input
          className="field"
          value={name}
          placeholder={suggestion()}
          onChange={(e) => setName(e.target.value)}
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={() => setComposing(false)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || composing || e.keyCode === 229) return
            if (e.key === 'Enter') void doSave()
          }}
        />
        <button className="btn primary" onClick={() => void doSave()}>
          保存
        </button>
      </div>
    </div>
  )
}
