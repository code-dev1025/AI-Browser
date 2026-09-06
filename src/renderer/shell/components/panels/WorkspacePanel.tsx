import { useEffect, useState } from 'react'
import { useLibrary } from '../../../shared/store/library'
import { useLocale, useT } from '../../../shared/store/locale'
import { useTabs } from '../../../shared/store/tabs'
import { dayLabel } from '../../../shared/format'

/** Save the whole working set — tabs, order, groups, layout — and bring it back. */
export function WorkspacePanel(): React.ReactElement {
  const t = useT()
  const locale = useLocale()
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
    return t('ws.default_name', { month: d.getMonth() + 1, day: d.getDate() })
  }

  const doSave = async (): Promise<void> => {
    await save(name.trim() || suggestion())
    setName('')
  }

  return (
    <div className="panel">
      <header>
        <h2>{t('ws.title')}</h2>
        <span className="badge">{t('common.tabs', { n: tabCount })}</span>
      </header>

      <div className="body">
        {workspaces.length === 0 && (
          <p className="empty">{t('ws.empty')}</p>
        )}
        {[...workspaces].reverse().map((w) => (
          <div key={w.id} className="card" style={{ gap: 6 }}>
            <div className="t">{w.name}</div>
            <div className="d">
              {t('ws.meta', {
                tabs: w.tabs.length,
                groups: w.groups.length,
                when: dayLabel(w.createdAt, locale)
              })}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button className="btn sm" onClick={() => void restore(w.id, false)}>
                {t('ws.restore_add')}
              </button>
              <button className="btn sm" onClick={() => void restore(w.id, true)}>
                {t('ws.restore_replace')}
              </button>
              <button className="btn sm" onClick={() => void remove(w.id)}>
                {t('common.delete')}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="foot">
        <div className="rowfield">
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
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
