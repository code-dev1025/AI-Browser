import type { PaletteCommand } from '@shared/types'

/**
 * Command *data* only — no imports from stores, and no display text.
 *
 * The overlay renders this list and the shell executes it (see
 * shell/commands.ts). Entries hold message keys rather than strings so the
 * palette is in the viewer's language without a second catalogue.
 */
export const COMMANDS: PaletteCommand[] = [
  { id: 'tab.new', titleKey: 'cmd.tab_new', hintKey: null, shortcut: 'Ctrl+T', groupKey: 'cmdgroup.tab' },
  { id: 'tab.close', titleKey: 'cmd.tab_close', hintKey: null, shortcut: 'Ctrl+W', groupKey: 'cmdgroup.tab' },
  { id: 'tab.sleep', titleKey: 'cmd.tab_sleep', hintKey: 'cmd.tab_sleep_hint', shortcut: null, groupKey: 'cmdgroup.tab' },
  { id: 'tabmode.toggle', titleKey: 'cmd.tabmode', hintKey: null, shortcut: null, groupKey: 'cmdgroup.tab' },
  { id: 'split.toggle', titleKey: 'cmd.split', hintKey: null, shortcut: null, groupKey: 'cmdgroup.view' },
  { id: 'focus.toggle', titleKey: 'cmd.focus', hintKey: 'cmd.focus_hint', shortcut: null, groupKey: 'cmdgroup.view' },
  { id: 'ai.panel', titleKey: 'cmd.ai_panel', hintKey: null, shortcut: 'Ctrl+Shift+K', groupKey: 'cmdgroup.view' },
  { id: 'language.toggle', titleKey: 'cmd.language', hintKey: null, shortcut: null, groupKey: 'cmdgroup.view' },
  { id: 'ai.organize', titleKey: 'cmd.ai_organize', hintKey: 'cmd.ai_organize_hint', shortcut: null, groupKey: 'cmdgroup.ai' },
  { id: 'ai.summarize', titleKey: 'cmd.ai_summarize', hintKey: null, shortcut: null, groupKey: 'cmdgroup.ai' },
  { id: 'ai.compare', titleKey: 'cmd.ai_compare', hintKey: 'cmd.ai_compare_hint', shortcut: null, groupKey: 'cmdgroup.ai' },
  { id: 'panel.search', titleKey: 'cmd.panel_search', hintKey: 'cmd.panel_search_hint', shortcut: null, groupKey: 'cmdgroup.panel' },
  { id: 'panel.history', titleKey: 'cmd.panel_history', hintKey: null, shortcut: null, groupKey: 'cmdgroup.panel' },
  { id: 'panel.notes', titleKey: 'cmd.panel_notes', hintKey: null, shortcut: null, groupKey: 'cmdgroup.panel' },
  { id: 'panel.workspaces', titleKey: 'cmd.panel_workspaces', hintKey: null, shortcut: null, groupKey: 'cmdgroup.panel' },
  { id: 'workspace.save', titleKey: 'cmd.workspace_save', hintKey: null, shortcut: null, groupKey: 'cmdgroup.workspace' },
  { id: 'omnibox.focus', titleKey: 'cmd.omnibox', hintKey: null, shortcut: 'Ctrl+L', groupKey: 'cmdgroup.nav' }
]
