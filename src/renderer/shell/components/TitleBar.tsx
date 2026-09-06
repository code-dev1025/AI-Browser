import { useLibrary } from '../../shared/store/library'
import { useShell } from '../../shared/store/shell'
import { useTabs } from '../../shared/store/tabs'
import { useUi } from '../../shared/store/ui'
import { Icon } from '../../shared/Icon'

/**
 * Windows draws the minimise/maximise/close buttons itself (titleBarOverlay),
 * so this bar only reserves their width — see --wco-right in useBootstrap.
 */
export function TitleBar(): React.ReactElement {
  const tabCount = useTabs((s) => s.order.length)
  const sleeping = useTabs((s) => s.order.filter((id) => s.tabs[id]?.asleep).length)
  const backend = useUi((s) => s.backend)
  const workspaces = useLibrary((s) => s.workspaces)
  const shell = useShell((s) => s.shell)
  const patchShell = useShell((s) => s.patchShell)

  const badgeClass = backend.mode === 'mock' ? 'mock' : backend.reachable ? 'live' : 'down'
  const badgeText =
    backend.mode === 'mock' ? 'MOCK API' : backend.reachable ? 'API LIVE' : 'API DOWN'

  return (
    <header className="titlebar a-title">
      <div className="brand">
        <i />
        <span className="ws">AI Browser</span>
      </div>

      <button
        className="badge"
        title="タブ表示を切り替え (縦 / 横)"
        onClick={() => {
          const next = shell.tabMode === 'horizontal' ? 'vertical' : 'horizontal'
          // Vertical tabs are useless collapsed — open the sidebar with them.
          patchShell({ tabMode: next, railExpanded: next === 'vertical' ? true : shell.railExpanded })
        }}
      >
        {shell.tabMode === 'horizontal' ? '横タブ' : '縦タブ'}
      </button>

      <span className="badge">
        {tabCount} タブ{sleeping > 0 ? ` · ${sleeping} 休眠` : ''}
      </span>

      {workspaces.length > 0 && <span className="badge">{workspaces.length} WS</span>}

      <div className="spacer" />

      <span className={`badge ${badgeClass}`} title={backend.lastError ?? backend.baseUrl ?? 'モック応答'}>
        {badgeText}
      </span>

      <button
        className="iconbtn"
        aria-pressed={shell.aiOpen}
        title="AIパネル (Ctrl+Shift+K)"
        onClick={() => patchShell({ aiOpen: !shell.aiOpen })}
      >
        <Icon name="ai" />
      </button>
    </header>
  )
}
