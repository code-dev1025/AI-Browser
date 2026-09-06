import { useShell } from '../../shared/store/shell'
import { useTabs } from '../../shared/store/tabs'
import { useUi } from '../../shared/store/ui'
import { shortUrl } from '../../shared/format'
import { densityFor } from '@shared/layout'

export function StatusBar(): React.ReactElement {
  const hoverUrl = useUi((s) => s.hoverUrl)
  const find = useUi((s) => s.find)
  const selection = useUi((s) => s.selection)
  const metrics = useShell((s) => s.metrics)
  const rect = useShell((s) => s.rect)
  const active = useTabs((s) => (s.activeTabId ? s.tabs[s.activeTabId] : undefined))

  return (
    <footer className="statusbar a-status">
      <span className="hover">
        {hoverUrl ? shortUrl(hoverUrl) : active?.status === 'loading' ? '読み込み中…' : ''}
      </span>
      <div className="right">
        {selection.length > 0 && <span>{selection.length} 選択</span>}
        {find.matches > 0 && (
          <span>
            {find.activeMatch}/{find.matches}
          </span>
        )}
        <span>
          {metrics.width}×{metrics.height} · {densityFor(metrics.width)}
        </span>
        <span title="main が計算したページ矩形">
          page {rect.width}×{rect.height}
        </span>
      </div>
    </footer>
  )
}
