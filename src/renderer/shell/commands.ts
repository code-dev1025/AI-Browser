import { send } from '../shared/api'
import { emit } from '../shared/bus'
import { useAi } from '../shared/store/ai'
import { useLibrary } from '../shared/store/library'
import { tr, useLocaleStore } from '../shared/store/locale'
import { useShell } from '../shared/store/shell'
import { useTabs } from '../shared/store/tabs'
import { useUi } from '../shared/store/ui'

export { COMMANDS } from '../shared/commands'

/** Executes a command named by the palette, a shortcut, or a toolbar button. */
export function runCommand(commandId: string, arg?: string): void {
  const { activeTabId, order, tabs } = useTabs.getState()
  const shell = useShell.getState()
  const ai = useAi.getState()
  const ui = useUi.getState()

  const liveTabs = (): string[] => {
    if (ui.selection.length > 0) return ui.selection
    return order.filter((id) => tabs[id]?.url && !tabs[id]?.asleep)
  }

  switch (commandId) {
    case 'navigate':
      if (arg && activeTabId) send('tab.navigate', { tabId: activeTabId, input: arg })
      else if (arg) send('tab.create', { url: arg })
      return
    case 'tab.new':
      send('tab.create', {})
      return
    case 'tab.close':
      if (activeTabId) send('tab.close', { tabId: activeTabId })
      return
    case 'tab.sleep':
      if (activeTabId) {
        const next = order.find((id) => id !== activeTabId)
        if (next) send('tab.activate', { tabId: next })
        send('tab.sleep', { tabId: activeTabId })
      }
      return
    case 'tab.activate':
      if (arg) send('tab.activate', { tabId: arg })
      return
    case 'tabmode.toggle': {
      const next = shell.shell.tabMode === 'horizontal' ? 'vertical' : 'horizontal'
      shell.patchShell({ tabMode: next, railExpanded: next === 'vertical' ? true : shell.shell.railExpanded })
      return
    }
    case 'split.toggle': {
      if (shell.shell.splitRatio.length > 1) {
        send('split.close', { pane: 1 })
        return
      }
      const other = order.find((id) => id !== activeTabId) ?? null
      send('split.set', { paneTabIds: [activeTabId, other], splitRatio: [0.5, 0.5] })
      return
    }
    case 'focus.toggle':
      if (activeTabId) {
        const tab = tabs[activeTabId]
        send('focus.set', { tabId: activeTabId, enabled: !tab?.focusMode })
      }
      return
    case 'language.toggle':
      useLocaleStore.getState().toggleLocale()
      return
    case 'ai.panel':
      shell.patchShell({ aiOpen: !shell.shell.aiOpen })
      return
    case 'ai.organize':
      shell.patchShell({ aiOpen: true })
      void ai.runOrganize(liveTabs())
      return
    case 'ai.summarize':
      shell.patchShell({ aiOpen: true })
      void ai.runSummaries(liveTabs())
      return
    case 'ai.compare':
      shell.patchShell({ aiOpen: true })
      void ai.runCompare(liveTabs().slice(0, 4))
      return
    case 'workspace.save': {
      const d = new Date()
      void useLibrary
        .getState()
        .saveWorkspace(tr('ws.default_name', { month: d.getMonth() + 1, day: d.getDate() }))
      return
    }
    case 'omnibox.focus':
      emit('focus-omnibox')
      return
    default:
      if (commandId.startsWith('panel.')) {
        const panel = commandId.slice('panel.'.length) as 'search' | 'history' | 'notes' | 'workspaces'
        shell.patchShell({ railPanel: panel, railExpanded: true })
      }
  }
}
