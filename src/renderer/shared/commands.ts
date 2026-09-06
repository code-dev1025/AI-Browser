import type { PaletteCommand } from '@shared/types'

/**
 * Command *data* only — no imports from stores.
 *
 * The overlay renders this list; the shell executes it (see shell/commands.ts).
 * Keeping the catalogue free of store imports is what stops the overlay bundle
 * from pulling in the entire shell.
 */
export const COMMANDS: PaletteCommand[] = [
  { id: 'tab.new', title: '新しいタブ', hint: null, shortcut: 'Ctrl+T', group: 'タブ' },
  { id: 'tab.close', title: 'このタブを閉じる', hint: null, shortcut: 'Ctrl+W', group: 'タブ' },
  { id: 'tab.sleep', title: 'このタブを休眠させる', hint: 'メモリを解放します', shortcut: null, group: 'タブ' },
  { id: 'tabmode.toggle', title: 'タブ表示を切り替え（縦 / 横）', hint: null, shortcut: null, group: 'タブ' },
  { id: 'split.toggle', title: '分割画面を切り替え', hint: null, shortcut: null, group: '表示' },
  { id: 'focus.toggle', title: '集中モードを切り替え', hint: '不要な要素を隠します', shortcut: null, group: '表示' },
  { id: 'ai.panel', title: 'AIパネルを開閉', hint: null, shortcut: 'Ctrl+Shift+K', group: '表示' },
  { id: 'ai.organize', title: 'タブをAIで自動整理', hint: '開発 / 調査 / 動画 / 買い物', shortcut: null, group: 'AI' },
  { id: 'ai.summarize', title: '開いているタブを一括要約', hint: null, shortcut: null, group: 'AI' },
  { id: 'ai.compare', title: '選択したタブを比較', hint: '2つ以上のタブが必要', shortcut: null, group: 'AI' },
  { id: 'panel.search', title: '曖昧タブ検索', hint: '自然文で過去のページを探す', shortcut: null, group: 'パネル' },
  { id: 'panel.history', title: '閲覧タイムライン', hint: null, shortcut: null, group: 'パネル' },
  { id: 'panel.notes', title: 'メモ・ハイライト', hint: null, shortcut: null, group: 'パネル' },
  { id: 'panel.workspaces', title: 'ワークスペース', hint: null, shortcut: null, group: 'パネル' },
  { id: 'workspace.save', title: '今の作業をワークスペースに保存', hint: null, shortcut: null, group: 'ワークスペース' },
  { id: 'omnibox.focus', title: 'アドレスバーにフォーカス', hint: null, shortcut: 'Ctrl+L', group: '移動' }
]
