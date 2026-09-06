import { send } from '../../shared/api'
import { Icon, type IconName } from '../../shared/Icon'
import { importance } from '../../shared/format'
import { useShell } from '../../shared/store/shell'
import { groupColorVar, useTabs } from '../../shared/store/tabs'
import { useUi } from '../../shared/store/ui'
import type { RailPanel } from '@shared/types'
import { HistoryPanel } from './panels/HistoryPanel'
import { NotesPanel } from './panels/NotesPanel'
import { SearchPanel } from './panels/SearchPanel'
import { WorkspacePanel } from './panels/WorkspacePanel'

const BUTTONS: { id: RailPanel; icon: IconName; label: string }[] = [
  { id: 'search', icon: 'search', label: '検索 — 自然文で過去のページを探す' },
  { id: 'history', icon: 'history', label: '閲覧タイムライン' },
  { id: 'notes', icon: 'note', label: 'メモ・ハイライト' },
  { id: 'workspaces', icon: 'workspace', label: 'ワークスペース' }
]

/**
 * The left column. One component serves both shell layouts (blueprint L5):
 * horizontal mode shows an icon rail, vertical mode shows the tab list beside
 * it. Nothing here is duplicated per mode — only the constants differ.
 */
export function LeftChrome(): React.ReactElement {
  const shell = useShell((s) => s.shell)
  const patchShell = useShell((s) => s.patchShell)
  const vertical = shell.tabMode === 'vertical'

  const openPanel = (id: RailPanel): void => {
    const same = shell.railPanel === id && shell.railExpanded
    if (vertical) {
      patchShell({ railPanel: same ? null : id, railExpanded: true })
    } else {
      patchShell({ railPanel: same ? null : id, railExpanded: !same })
    }
  }

  const panelBody = shell.railPanel ? <PanelFor panel={shell.railPanel} /> : null
  const showContent = shell.railExpanded && (panelBody !== null || vertical)

  return (
    <div className={`${vertical ? 'vtabs' : 'rail'} a-left`} style={{ display: 'flex' }}>
      <nav className="railbar">
        {BUTTONS.map((b) => (
          <button
            key={b.id}
            className="railbtn"
            title={b.label}
            aria-pressed={shell.railPanel === b.id && shell.railExpanded}
            onClick={() => openPanel(b.id)}
          >
            <Icon name={b.icon} size={17} />
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {vertical && (
          <button
            className="railbtn"
            title="新しいタブ (Ctrl+T)"
            onClick={() => send('tab.create', {})}
          >
            <Icon name="plus" size={17} />
          </button>
        )}
      </nav>

      {showContent && (
        <div className="railpanel">{panelBody ?? <VerticalTabList />}</div>
      )}
    </div>
  )
}

function PanelFor({ panel }: { panel: RailPanel }): React.ReactElement | null {
  if (panel === 'history') return <HistoryPanel />
  if (panel === 'notes') return <NotesPanel />
  if (panel === 'workspaces') return <WorkspacePanel />
  if (panel === 'search') return <SearchPanel />
  return null
}

/** The vertical tab list: the only layout where a tab can show words. */
function VerticalTabList(): React.ReactElement {
  const tabs = useTabs((s) => s.tabs)
  const order = useTabs((s) => s.order)
  const groups = useTabs((s) => s.groups)
  const activeTabId = useTabs((s) => s.activeTabId)
  const selection = useUi((s) => s.selection)
  const toggleSelected = useUi((s) => s.toggleSelected)

  const models = order.map((id) => tabs[id]).filter((t) => !!t)
  const pinned = models.filter((t) => t.pinned)
  const rest = models
    .filter((t) => !t.pinned)
    .sort((a, b) => importance(b) - importance(a))

  return (
    <div className="panel">
      <div className="vlist" style={{ paddingTop: 6 }}>
        {pinned.length > 0 && <div className="vhead">ピン留め</div>}
        {pinned.map((t) => (
          <Row
            key={t.id}
            tab={t}
            active={t.id === activeTabId}
            checked={selection.includes(t.id)}
            onCheck={toggleSelected}
            color={groups.find((g) => g.id === t.groupId)?.color}
          />
        ))}
        <div className="vhead">
          重要度順 · {rest.length} タブ
        </div>
        {rest.map((t) => (
          <Row
            key={t.id}
            tab={t}
            active={t.id === activeTabId}
            checked={selection.includes(t.id)}
            onCheck={toggleSelected}
            color={groups.find((g) => g.id === t.groupId)?.color}
          />
        ))}
      </div>
    </div>
  )
}

function Row({
  tab,
  active,
  checked,
  onCheck,
  color
}: {
  tab: { id: string; title: string; url: string; asleep: boolean; activeSeconds: number }
  active: boolean
  checked: boolean
  onCheck: (id: string) => void
  color?: string | undefined
}): React.ReactElement {
  return (
    <button
      className="vtab"
      data-active={active}
      data-asleep={tab.asleep}
      title={`${tab.title}\n${tab.url}`}
      style={color ? { borderLeftColor: active ? undefined : groupColorVar(color as never) } : undefined}
      onClick={(e) => {
        if (e.ctrlKey || e.metaKey) return onCheck(tab.id)
        send('tab.activate', { tabId: tab.id })
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        onCheck(tab.id)
      }}
    >
      <span style={{ opacity: checked ? 1 : 0.28, flex: 'none', color: 'var(--accent)' }}>
        <Icon name="check" size={12} />
      </span>
      <span className="label">{tab.title || '新しいタブ'}</span>
      {tab.asleep ? (
        <span className="meta" title="休眠中">
          zzz
        </span>
      ) : tab.activeSeconds > 60 ? (
        <span className="meta">{Math.round(tab.activeSeconds / 60)}m</span>
      ) : null}
    </button>
  )
}
