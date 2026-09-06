/**
 * We are shipping a browser, not an app: the code we load is written by
 * strangers. Every default here is set explicitly, per session and per view.
 */

import { session, shell, type Session, type WebContents, type WebPreferences } from 'electron'

export const CONTENT_PARTITION = 'persist:default'

let contentPreloadPath = ''

export function setContentPreloadPath(p: string): void {
  contentPreloadPath = p
}

/** webPreferences for a view that will render untrusted web content. */
export function contentWebPreferences(): WebPreferences {
  return {
    preload: contentPreloadPath,
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false,
    nodeIntegrationInSubFrames: false,
    webSecurity: true,
    allowRunningInsecureContent: false,
    safeDialogs: true,
    safeDialogsMessage: 'This page is showing too many dialogs.',
    spellcheck: false,
    backgroundThrottling: true,
    webviewTag: false
  }
}

/** webPreferences for our own React UI. Wider API, but still sandboxed. */
export function shellWebPreferences(preload: string): WebPreferences {
  return {
    preload,
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false,
    webSecurity: true,
    spellcheck: false,
    // The chrome must never sleep — it draws the tab strip for sleeping tabs.
    backgroundThrottling: false,
    webviewTag: false
  }
}

export interface PermissionAsk {
  origin: string
  permission: string
  allow: (granted: boolean) => void
}

type PermissionHandler = (ask: PermissionAsk) => void

/** Permissions we will never grant silently, but may ask the user about. */
const ASKABLE = new Set(['media', 'geolocation', 'notifications', 'clipboard-read', 'midi'])

/** Permissions granted without asking, because the page needs them to work. */
const AUTO_GRANT = new Set(['fullscreen', 'pointerLock', 'background-sync', 'idle-detection'])

export function hardenSession(onPermission: PermissionHandler): Session {
  const s = session.fromPartition(CONTENT_PARTITION)

  s.setPermissionRequestHandler((_wc, permission, callback, details) => {
    if (AUTO_GRANT.has(permission)) return callback(true)
    if (!ASKABLE.has(permission)) return callback(false)
    onPermission({
      origin: (details as { requestingUrl?: string }).requestingUrl ?? '',
      permission,
      allow: callback
    })
  })

  // Synchronous check (used by some APIs before the async request).
  s.setPermissionCheckHandler((_wc, permission) => AUTO_GRANT.has(permission))

  // No extension or plugin loading from the web.
  s.setDevicePermissionHandler(() => false)

  return s
}

/**
 * Applied to every content webContents. Anything a page can do to escape the
 * tab model has to be intercepted here.
 */
export function hardenWebContents(
  wc: WebContents,
  hooks: {
    openInNewTab: (url: string, background: boolean) => void
    onCertificateError?: (url: string, error: string) => void
  }
): void {
  // window.open / target=_blank → our own tab, never an unmanaged window.
  wc.setWindowOpenHandler(({ url, disposition }) => {
    if (/^https?:/i.test(url)) {
      hooks.openInNewTab(url, disposition === 'background-tab')
    }
    return { action: 'deny' }
  })

  // External schemes (mailto:, tel:, custom app protocols) go to the OS,
  // after an explicit allowlist check.
  wc.on('will-navigate', (event, url) => {
    if (!/^(https?|about|chrome-error):/i.test(url)) {
      event.preventDefault()
      if (/^(mailto|tel|sms):/i.test(url)) void shell.openExternal(url)
    }
  })

  wc.on('certificate-error' as never, () => {
    /* handled at session level; never auto-trust */
  })

  // No devtools opening themselves inside a page view.
  wc.on('devtools-opened', () => {
    if (!process.env['ELECTRON_RENDERER_URL']) wc.closeDevTools()
  })
}
