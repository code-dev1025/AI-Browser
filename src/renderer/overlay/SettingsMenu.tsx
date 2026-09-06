import { useEffect, useState } from 'react'
import type { AppSnapshot } from '@shared/contract'
import type { Locale, Rect } from '@shared/types'
import { LOCALES, LOCALE_LABEL, LOCALE_SHORT } from '@shared/i18n'
import { api } from '../shared/api'
import { useT } from '../shared/store/locale'

/**
 * Settings live in the overlay view, not the shell, for the same reason the
 * command palette does: a menu dropped from the title bar reaches past the
 * chrome and over the page, and a DOM element in the shell can never paint
 * there.
 *
 * It reads state rather than owning it — every control below hands the change
 * to main, which persists it and broadcasts back.
 */
export function SettingsMenu({ anchor }: { anchor: Rect | null }): React.ReactElement {
  const t = useT()
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null)

  const refresh = (): void => {
    void api.invoke('app.snapshot').then(setSnapshot)
  }

  useEffect(() => {
    refresh()
    const offs = [
      api.on('shell:state', refresh),
      api.on('settings:changed', refresh),
      api.on('tab:order', refresh),
      api.on('backend:status', refresh)
    ]
    return () => offs.forEach((off) => off())
  }, [])

  const close = (): void => void api.invoke('overlay.close')

  const tabMode = snapshot?.shell.tabMode ?? 'horizontal'
  const locale: Locale = snapshot?.settings.locale ?? 'ja'
  const backend = snapshot?.backend
  const asleep = snapshot?.tabs.filter((tab) => tab.asleep).length ?? 0

  const setTabMode = (mode: 'horizontal' | 'vertical'): void => {
    void api.invoke('shell.setState', {
      tabMode: mode,
      // Side tabs are useless collapsed — open the sidebar with them.
      ...(mode === 'vertical' ? { railExpanded: true } : {})
    })
  }

  const backendTone = !backend
    ? 'muted'
    : backend.mode === 'mock'
      ? 'warn'
      : backend.reachable
        ? 'ok'
        : 'bad'

  const backendLabel = !backend
    ? ''
    : backend.mode === 'mock'
      ? t('titlebar.backend_mock')
      : backend.reachable
        ? t('titlebar.backend_live')
        : t('titlebar.backend_down')

  const backendDetail = !backend
    ? ''
    : backend.mode === 'mock'
      ? t('settings.backend_mock_desc')
      : t(backend.reachable ? 'settings.backend_live_desc' : 'settings.backend_down_desc', {
          url: backend.baseUrl ?? ''
        })

  // Right-aligned to the gear it came from, hanging just below it.
  const style: React.CSSProperties = anchor
    ? { right: Math.max(8, window.innerWidth - (anchor.x + anchor.width)), top: anchor.y + anchor.height + 6 }
    : { right: 12, top: 44 }

  return (
    <div className="scrim plain" onPointerDown={close}>
      <div className="menu" style={style} onPointerDown={(e) => e.stopPropagation()}>
        <div className="menu-title">{t('settings.title')}</div>

        <div className="menu-row">
          <span className="menu-label">{t('settings.tab_layout')}</span>
          <div className="segmented">
            <button
              aria-pressed={tabMode === 'horizontal'}
              onClick={() => setTabMode('horizontal')}
            >
              {t('titlebar.mode_horizontal')}
            </button>
            <button aria-pressed={tabMode === 'vertical'} onClick={() => setTabMode('vertical')}>
              {t('titlebar.mode_vertical')}
            </button>
          </div>
        </div>

        <div className="menu-row">
          <span className="menu-label">{t('settings.language')}</span>
          <div className="segmented">
            {LOCALES.map((l) => (
              <button
                key={l}
                aria-pressed={l === locale}
                title={LOCALE_LABEL[l]}
                onClick={() => void api.invoke('settings.setLocale', { locale: l })}
              >
                {LOCALE_SHORT[l]}
              </button>
            ))}
          </div>
        </div>

        <div className="menu-sep" />

        <div className="menu-block">
          <span className="menu-label">{t('settings.backend')}</span>
          <span className={`menu-state ${backendTone}`}>
            <i />
            {backendLabel}
          </span>
          <span className="menu-detail">{backendDetail}</span>
        </div>

        <div className="menu-block">
          <span className="menu-label">{t('settings.session')}</span>
          <span className="menu-detail">
            {t('settings.session_value', {
              tabs: snapshot?.order.length ?? 0,
              asleep,
              groups: snapshot?.groups.length ?? 0
            })}
          </span>
        </div>
      </div>
    </div>
  )
}
