import { useRef } from 'react'
import { api, send } from '../../shared/api'
import { useT } from '../../shared/store/locale'
import { useShell } from '../../shared/store/shell'
import { useUi } from '../../shared/store/ui'
import { Icon } from '../../shared/Icon'

/**
 * The title bar carries identity, the two controls in constant use, and the
 * window buttons. Everything that is a *setting* — tab layout, language,
 * backend — moved behind the gear, because a row of always-on badges is
 * chrome that never earns its width back.
 *
 * The window is frameless, so the buttons at the right are ours to draw.
 */
export function TitleBar(): React.ReactElement {
  const t = useT()
  const backend = useUi((s) => s.backend)
  const shell = useShell((s) => s.shell)
  const patchShell = useShell((s) => s.patchShell)
  const gearRef = useRef<HTMLButtonElement>(null)

  // Only an error earns a permanent mark; a healthy backend says nothing.
  const backendFailing = backend.mode === 'http' && !backend.reachable

  const openSettings = (): void => {
    const r = gearRef.current?.getBoundingClientRect()
    void api.invoke('overlay.open', {
      mode: 'settings',
      anchor: r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null,
      query: ''
    })
  }

  return (
    <header className="titlebar a-title">
      <div className="brand">
        <i />
        <span className="ws">AI Browser</span>
      </div>

      <div className="spacer" />

      <button
        ref={gearRef}
        className="iconbtn hasdot"
        title={t('titlebar.settings')}
        onClick={openSettings}
      >
        <Icon name="settings" />
        {backendFailing && <span className="dot" />}
      </button>

      <button
        className="iconbtn"
        aria-pressed={shell.aiOpen}
        title={t('titlebar.ai_panel')}
        onClick={() => patchShell({ aiOpen: !shell.aiOpen })}
      >
        <Icon name="ai" />
      </button>

      <WindowControls />
    </header>
  )
}

/**
 * Sizes follow the Windows convention (46px wide, full title-bar height) so
 * the hit targets land where muscle memory expects them.
 */
function WindowControls(): React.ReactElement {
  const t = useT()
  const maximized = useShell((s) => s.metrics.maximized)

  return (
    <div className="wincontrols">
      <button title={t('win.minimize')} onClick={() => send('window.minimize')}>
        <Icon name="winMinimize" size={13} />
      </button>
      <button
        title={t(maximized ? 'win.restore' : 'win.maximize')}
        onClick={() => send('window.toggleMaximize')}
      >
        <Icon name={maximized ? 'winRestore' : 'winMaximize'} size={13} />
      </button>
      <button className="close" title={t('win.close')} onClick={() => send('window.close')}>
        <Icon name="close" size={13} />
      </button>
    </div>
  )
}
