import { useEffect } from 'react'
import { CHROME, aiPanelWidth, bottomChromeHeight } from '@shared/layout'
import { api } from '../shared/api'
import { on } from '../shared/bus'
import { useShell } from '../shared/store/shell'
import { AiPanel } from './components/AiPanel'
import { AskBar } from './components/AskBar'
import { LeftChrome } from './components/LeftChrome'
import { PageArea } from './components/PageArea'
import { StatusBar } from './components/StatusBar'
import { TabStrip } from './components/TabStrip'
import { TitleBar } from './components/TitleBar'
import { Toasts } from './components/Toasts'
import { Toolbar } from './components/Toolbar'
import { runCommand } from './commands'
import { useBootstrap } from './useBootstrap'

export function App(): React.ReactElement {
  useBootstrap()

  const shell = useShell((s) => s.shell)
  const metrics = useShell((s) => s.metrics)

  // Commands named by the overlay are executed here, where the stores live.
  useEffect(() => api.on('overlay:commandRun', ({ commandId, arg }) => runCommand(commandId, arg)), [])

  // Ctrl+F: the find bar has to live in the overlay view, anchored under the
  // toolbar — a DOM element here would be hidden behind the page.
  const rect = useShell((s) => s.rect)
  useEffect(
    () =>
      on('open-find', () => {
        const width = 360
        void api.invoke('overlay.open', {
          mode: 'find',
          anchor: {
            x: Math.max(0, rect.x + rect.width - width - 12),
            y: rect.y - 2,
            width,
            height: 2
          },
          query: ''
        })
      }),
    [rect.x, rect.y, rect.width]
  )

  const aiWidth = aiPanelWidth(metrics, shell)
  const showAsk = bottomChromeHeight(metrics, shell) > CHROME.statusBar

  return (
    <div className="app" data-tabmode={shell.tabMode}>
      <TitleBar />
      <Toolbar />
      {shell.tabMode === 'horizontal' && <TabStrip />}
      <LeftChrome />
      <PageArea />
      {aiWidth > 0 && <AiPanel />}
      {showAsk && <AskBar />}
      <StatusBar />
      <Toasts />
    </div>
  )
}
