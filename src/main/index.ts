import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { AppWindow } from './AppWindow'
import { registerIpc } from './ipc'
import { hardenSession, setContentPreloadPath } from './security'
import { initSnapshots, registerSnapshotScheme } from './snapshots'
import { initBackend, backendStatus } from './api'
import { initSettings, tm } from './settings'

// Must run before the app is ready: privileged schemes are registered once.
registerSnapshotScheme()

/** Sleep tabs untouched for this long, always keeping the N most recent. */
const IDLE_SLEEP_MINUTES = 30
const KEEP_AWAKE = 8

let appWindow: AppWindow | null = null

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!appWindow) return
    if (appWindow.win.isMinimized()) appWindow.win.restore()
    appWindow.win.focus()
  })

  void app.whenReady().then(async () => {
    initSnapshots()
    // Settings first: everything below can produce user-visible text.
    initSettings()
    setContentPreloadPath(join(__dirname, '../preload/content.js'))

    const session = hardenSession((ask) => {
      // Permissions are denied by default; the shell shows what was blocked.
      ask.allow(false)
      appWindow?.toast(
        'info',
        tm('toast.permission_blocked', { permission: ask.permission, origin: ask.origin })
      )
    })

    await initBackend()

    appWindow = new AppWindow(session)
    registerIpc(appWindow)

    // One empty tab: no WebContentsView is created until it navigates, so a
    // fresh window costs a single renderer process.
    // AI_BROWSER_START_URL / --url=… open a page straight away, which is what
    // you want when checking a layout change without clicking through.
    const startUrl =
      process.env['AI_BROWSER_START_URL'] ??
      process.argv.find((a) => a.startsWith('--url='))?.slice('--url='.length)
    appWindow.tabs.create(startUrl ? { url: startUrl } : {})

    const status = backendStatus()
    if (status.mode === 'mock') {
      appWindow.toast('info', tm('toast.backend_mock'))
    } else if (!status.reachable) {
      appWindow.toast('error', tm('toast.backend_down', { url: status.baseUrl ?? '' }))
    }

    setInterval(() => appWindow?.tabs.sweepIdle(IDLE_SLEEP_MINUTES, KEEP_AWAKE), 60_000)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0 && !appWindow) {
        appWindow = new AppWindow(session)
        registerIpc(appWindow)
      }
    })
  })

  app.on('window-all-closed', () => {
    app.quit()
  })
}
