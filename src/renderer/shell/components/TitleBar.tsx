import { LOCALES, LOCALE_LABEL, LOCALE_SHORT } from '@shared/i18n'
import { send } from '../../shared/api'
import { useLibrary } from '../../shared/store/library'
import { useLocaleStore, useT } from '../../shared/store/locale'
import { useShell } from '../../shared/store/shell'
import { useTabs } from '../../shared/store/tabs'
import { useUi } from '../../shared/store/ui'
import { Icon } from '../../shared/Icon'

/**
 * Windows draws the minimise/maximise/close buttons itself (titleBarOverlay),
 * so this bar only reserves their width — see --wco-right in useBootstrap.
 */
export function TitleBar(): React.ReactElement {
  const t = useT()
  const tabCount = useTabs((s) => s.order.length)
  const sleeping = useTabs((s) => s.order.filter((id) => s.tabs[id]?.asleep).length)
  const backend = useUi((s) => s.backend)
  const workspaces = useLibrary((s) => s.workspaces)
  const shell = useShell((s) => s.shell)
  const patchShell = useShell((s) => s.patchShell)

  const badgeClass = backend.mode === 'mock' ? 'mock' : backend.reachable ? 'live' : 'down'
  const badgeKey =
    backend.mode === 'mock'
      ? 'titlebar.backend_mock'
      : backend.reachable
        ? 'titlebar.backend_live'
        : 'titlebar.backend_down'

  return (
    <header className="titlebar a-title">
      <div className="brand">
        <i />
        <span className="ws">AI Browser</span>
      </div>

      <button
        className="badge"
        title={t('titlebar.tabmode')}
        onClick={() => {
          const next = shell.tabMode === 'horizontal' ? 'vertical' : 'horizontal'
          // Vertical tabs are useless collapsed — open the sidebar with them.
          patchShell({ tabMode: next, railExpanded: next === 'vertical' ? true : shell.railExpanded })
        }}
      >
        {t(shell.tabMode === 'horizontal' ? 'titlebar.mode_horizontal' : 'titlebar.mode_vertical')}
      </button>

      <span className="badge">
        {t('common.tabs', { n: tabCount })}
        {sleeping > 0 ? ` · ${t('titlebar.sleeping', { n: sleeping })}` : ''}
      </span>

      {workspaces.length > 0 && (
        <span className="badge">{t('titlebar.workspaces', { n: workspaces.length })}</span>
      )}

      <div className="spacer" />

      <LanguagePicker />

      <span
        className={`badge ${badgeClass}`}
        title={backend.lastError ?? backend.baseUrl ?? t('titlebar.backend_mock_tip')}
      >
        {t(badgeKey)}
      </span>

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
 * The window is frameless, so these are ours to draw. Sizes follow the Windows
 * convention (46px wide, full title-bar height) so the hit targets land where
 * muscle memory expects them.
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

/**
 * Both languages are always visible rather than hidden behind a single toggle:
 * someone who cannot read the current interface still has to be able to find
 * the way out of it.
 */
function LanguagePicker(): React.ReactElement {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const changeLocale = useLocaleStore((s) => s.changeLocale)

  return (
    <div className="langpicker" role="group" aria-label={t('titlebar.language')}>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={l === locale}
          title={`${t('titlebar.language')} — ${LOCALE_LABEL[l]}`}
          onClick={() => changeLocale(l)}
        >
          {LOCALE_SHORT[l]}
        </button>
      ))}
    </div>
  )
}
