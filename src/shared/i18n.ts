/**
 * Every user-visible string in the app, in one file.
 *
 * It lives in `shared/` because main writes user-visible text too — toasts, and
 * the stand-in backend's answers — and there must be exactly one place a
 * translation can be wrong. `en` is typed against `ja`, so adding a Japanese
 * key without its English counterpart is a compile error.
 *
 * Placeholders are `{name}` and are substituted positionally by `translate`.
 */

import type { Locale } from './types'

export const LOCALES: Locale[] = ['ja', 'en']

export const LOCALE_LABEL: Record<Locale, string> = {
  ja: '日本語',
  en: 'English'
}

/** Short label for the toggle button in the title bar. */
export const LOCALE_SHORT: Record<Locale, string> = {
  ja: 'JA',
  en: 'EN'
}

const ja = {
  /* --- shared --- */
  'common.close': '閉じる',
  'common.delete': '削除',
  'common.open': '開く',
  'common.save': '保存',
  'common.cancel': 'やめる',
  'common.reload': '再読み込み',
  'common.send': '送信',
  'common.stop': '停止',
  'common.clear': '消去',
  'common.tabs': '{n} タブ',
  'common.today': '今日',
  'common.yesterday': '昨日',

  /* --- title bar --- */
  'titlebar.tabmode': 'タブ表示を切り替え（縦 / 横）',
  'titlebar.mode_horizontal': '横タブ',
  'titlebar.mode_vertical': '縦タブ',
  'titlebar.sleeping': '{n} 休眠',
  'titlebar.workspaces': 'WS {n}',
  'titlebar.backend_mock': 'MOCK API',
  'titlebar.backend_live': 'API LIVE',
  'titlebar.backend_down': 'API DOWN',
  'titlebar.backend_mock_tip': 'モック応答',
  'titlebar.ai_panel': 'AIパネル (Ctrl+Shift+K)',
  'titlebar.language': '表示言語を切り替え',
  'win.minimize': '最小化',
  'win.maximize': '最大化',
  'win.restore': '元のサイズに戻す',
  'win.close': '閉じる',

  /* --- toolbar --- */
  'toolbar.back': '戻る (Alt+←)',
  'toolbar.forward': '進む (Alt+→)',
  'toolbar.stop': '停止 (Esc)',
  'toolbar.reload': '再読み込み',
  'toolbar.omnibox': 'URL を入力、または検索',
  'toolbar.composing': '変換中',
  'toolbar.focus': '集中モード — 不要な要素を隠す',
  'toolbar.split': '分割画面',
  'toolbar.palette': 'コマンドパレット (Ctrl+K)',

  /* --- tabs --- */
  'tab.new': '新しいタブ',
  'tab.new_tip': '新しいタブ (Ctrl+T)',
  'tab.close_tip': 'タブを閉じる (Ctrl+W)',
  'tab.group_expand': 'グループを展開',
  'tab.group_collapse': 'グループを折りたたむ',
  'tab.audible': '音声再生中',
  'vtabs.pinned': 'ピン留め',
  'vtabs.importance': '重要度順 · {n} タブ',
  'vtabs.asleep': '休眠中',

  /* --- rail --- */
  'rail.search': '検索 — 自然文で過去のページを探す',
  'rail.history': '閲覧タイムライン',
  'rail.notes': 'メモ・ハイライト',
  'rail.workspaces': 'ワークスペース',

  /* --- start page and pane states --- */
  'start.title': '新しいタブ',
  'start.sub': 'URL を入力するか、下から続きを再開してください。Ctrl+K で全機能を検索できます。',
  'start.recent': '最近見たページ',
  'start.workspaces': '保存済みワークスペース',
  'start.restore_n': '{n} タブを復元',
  'start.notes': '保存したメモ · {n} 件',
  'start.note': 'メモ',
  'pane.empty': 'このペインは空です。タブを選ぶと表示されます。',
  'sleeping.body': 'メモリ節約のため休眠中です。{host}',
  'sleeping.wake': '復元する',
  'crashed.title': 'このタブは応答しなくなりました',

  /* --- AI panel --- */
  'ai.scope_page': 'このページ',
  'ai.scope_tabs': '全タブ',
  'ai.scope_tabs_tip': '開いているタブを横断して質問します',
  'ai.close_panel': 'AIパネルを閉じる',
  'ai.organize': 'タブ自動整理',
  'ai.organizing': '整理中…',
  'ai.summarize': '一括要約',
  'ai.summarizing': '要約中…',
  'ai.compare': '比較',
  'ai.comparing': '比較中…',
  'ai.compare_tip': '2つ以上のタブを選ぶと比較できます',
  'ai.clear_selection': '選択解除',
  'ai.mock_notice_1': 'バックエンド未接続です。いまは抽出結果をそのまま返すモック応答が返ります。',
  'ai.mock_notice_2': 'AI_BACKEND_URL を設定すると実APIに切り替わります。',
  'ai.suggest_groups': 'グループ提案',
  'ai.apply_groups': 'この分類を適用',
  'ai.summaries': 'まとめ · {n} ページ',
  'ai.reading_minutes': '約{n}分',
  'ai.you': 'あなた',
  'ai.error': 'エラー: {message}',
  'ai.selection_prefix': '選択範囲:',
  'ai.placeholder_page': 'このページに質問…',
  'ai.placeholder_tabs': '全タブに質問…',

  /* --- ask bar --- */
  'ask.placeholder_page': 'このページについて質問してください…',
  'ask.placeholder_tabs': '開いているタブ全部に質問…',
  'ask.busy': '応答中…',

  /* --- status bar --- */
  'status.loading': '読み込み中…',
  'status.selected': '{n} 選択',
  'status.page_rect': 'main が計算したページ矩形',

  /* --- compare --- */
  'compare.title': '比較表',

  /* --- history --- */
  'history.title': '閲覧タイムライン',
  'history.empty': 'まだ履歴がありません。ページを開くとここに時系列で並びます。',

  /* --- notes --- */
  'notes.title': 'メモ・ハイライト',
  'notes.capture': '選択範囲を保存',
  'notes.empty': 'ページ上でテキストを選択し「選択範囲を保存」を押すと、ハイライトとして知識庫に残ります。',
  'notes.no_page': 'ページ指定なし',
  'notes.placeholder': 'メモを追加…',
  'notes.save_hint': '保存 (Ctrl+Enter)',

  /* --- workspaces --- */
  'ws.title': 'ワークスペース',
  'ws.empty': '今の作業状態をまるごと保存しておくと、あとで同じ並びのまま復元できます。',
  'ws.meta': '{tabs} タブ · {groups} グループ · {when}',
  'ws.restore_add': '追加で開く',
  'ws.restore_replace': '置き換えて復元',
  'ws.default_name': '作業 {month}/{day}',

  /* --- search --- */
  'search.title': '曖昧タブ検索',
  'search.placeholder': '昨日見た赤いバッグのページ…',
  'search.searching': '検索中…',
  'search.empty_mock': 'キーワード一致で検索します。バックエンド接続後は意味検索になります。',
  'search.empty': '該当するページはありません。',

  /* --- overlay --- */
  'palette.placeholder': 'コマンドを検索…',
  'palette.no_match': '一致するコマンドがありません',
  'find.placeholder': 'ページ内を検索',
  'find.prev': '前へ',
  'find.next': '次へ',

  /* --- command palette entries --- */
  'cmdgroup.tab': 'タブ',
  'cmdgroup.view': '表示',
  'cmdgroup.ai': 'AI',
  'cmdgroup.panel': 'パネル',
  'cmdgroup.workspace': 'ワークスペース',
  'cmdgroup.nav': '移動',
  'cmd.tab_new': '新しいタブ',
  'cmd.tab_close': 'このタブを閉じる',
  'cmd.tab_sleep': 'このタブを休眠させる',
  'cmd.tab_sleep_hint': 'メモリを解放します',
  'cmd.tabmode': 'タブ表示を切り替え（縦 / 横）',
  'cmd.split': '分割画面を切り替え',
  'cmd.focus': '集中モードを切り替え',
  'cmd.focus_hint': '不要な要素を隠します',
  'cmd.ai_panel': 'AIパネルを開閉',
  'cmd.ai_organize': 'タブをAIで自動整理',
  'cmd.ai_organize_hint': '開発 / 調査 / 動画 / 買い物',
  'cmd.ai_summarize': '開いているタブを一括要約',
  'cmd.ai_compare': '選択したタブを比較',
  'cmd.ai_compare_hint': '2つ以上のタブが必要',
  'cmd.panel_search': '曖昧タブ検索',
  'cmd.panel_search_hint': '自然文で過去のページを探す',
  'cmd.panel_history': '閲覧タイムライン',
  'cmd.panel_notes': 'メモ・ハイライト',
  'cmd.panel_workspaces': 'ワークスペース',
  'cmd.workspace_save': '今の作業をワークスペースに保存',
  'cmd.omnibox': 'アドレスバーにフォーカス',
  'cmd.language': '表示言語を切り替え（日本語 / English）',

  /* --- toasts, written by main --- */
  'toast.permission_blocked': '{permission} の要求をブロックしました ({origin})',
  'toast.focus_on': '集中モード: {n} 種類の要素を非表示',
  'toast.focus_off': '集中モードを解除',
  'toast.goal_set': '目的を設定: {goal}',
  'toast.goal_clear': '目的をクリア',
  'toast.organized': '{n} グループに整理しました',
  'toast.ws_saved': 'ワークスペース「{name}」を保存しました',
  'toast.ws_restored': '「{name}」を復元しました（{n} タブ）',
  'toast.select_text': 'ページ上でテキストを選択してから実行してください',
  'toast.highlight_saved': 'ハイライトを保存しました',
  'toast.backend_mock': 'バックエンド未接続 — AI機能はモック応答です (AI_BACKEND_URL で切替)',
  'toast.backend_down': 'バックエンドに接続できません: {url}',
  'toast.language': '表示言語を {lang} に変更しました',

  /* --- focus mode: why an element disappeared --- */
  'hide.sidebar': 'サイドバー',
  'hide.ads': '広告',
  'hide.related': '関連記事',
  'hide.social': 'SNSボタン',
  'hide.sticky': '固定バナー',
  'hide.newsletter': '購読案内',
  'hide.yt_next': '次の動画',
  'hide.yt_comments': 'コメント',
  'hide.gh_feed': 'サイドフィード',

  /* --- stand-in backend --- */
  'mock.no_pages': '読み取れるページがありません。タブを開いてからもう一度お試しください。',
  'mock.not_connected':
    '(バックエンド未接続。INTEGRATION.md の /ask を実装すると、この応答が実際のモデル出力に置き換わります。)',
  'mock.read_pages': '{n} 件のページを読み取りました。',
  'mock.question': '質問: {q}',
  'mock.headings': '見出し: {list}',
  'mock.price': '価格: {price}',
  'mock.footer': 'これは抽出結果をそのまま並べたものです。要約・推論はバックエンド接続後に有効になります。',
  'mock.organize_reason': 'ドメインと本文のキーワードから分類',
  'mock.no_text': '本文を抽出できませんでした。',
  'mock.verdict_cheapest': '最安は「{title}」（{price}）',
  'mock.verdict_generic': '抽出できた項目を並べました。判定はバックエンド接続後に有効になります。',
  'mock.col_site': 'サイト',
  'mock.col_name': '商品名',
  'mock.col_price': '価格',
  'mock.col_stock': '在庫',
  'mock.col_rating': '評価',
  'mock.col_reviews': 'レビュー数',
  'mock.col_seller': '販売者',
  'mock.col_length': '本文の長さ',
  'mock.group_dev': '開発',
  'mock.group_video': '動画',
  'mock.group_shopping': '買い物',
  'mock.group_research': '調査',
  'mock.group_other': 'その他'
} as const

export type MessageKey = keyof typeof ja

/** Typed against `ja`, so a missing translation will not compile. */
const en: Record<MessageKey, string> = {
  'common.close': 'Close',
  'common.delete': 'Delete',
  'common.open': 'Open',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.reload': 'Reload',
  'common.send': 'Send',
  'common.stop': 'Stop',
  'common.clear': 'Clear',
  'common.tabs': '{n} tabs',
  'common.today': 'Today',
  'common.yesterday': 'Yesterday',

  'titlebar.tabmode': 'Switch tab layout (side / top)',
  'titlebar.mode_horizontal': 'Top tabs',
  'titlebar.mode_vertical': 'Side tabs',
  'titlebar.sleeping': '{n} asleep',
  'titlebar.workspaces': 'WS {n}',
  'titlebar.backend_mock': 'MOCK API',
  'titlebar.backend_live': 'API LIVE',
  'titlebar.backend_down': 'API DOWN',
  'titlebar.backend_mock_tip': 'Mock responses',
  'titlebar.ai_panel': 'AI panel (Ctrl+Shift+K)',
  'titlebar.language': 'Switch interface language',
  'win.minimize': 'Minimise',
  'win.maximize': 'Maximise',
  'win.restore': 'Restore down',
  'win.close': 'Close',

  'toolbar.back': 'Back (Alt+Left)',
  'toolbar.forward': 'Forward (Alt+Right)',
  'toolbar.stop': 'Stop (Esc)',
  'toolbar.reload': 'Reload',
  'toolbar.omnibox': 'Enter a URL, or search',
  'toolbar.composing': 'IME',
  'toolbar.focus': 'Focus mode — hide the distractions',
  'toolbar.split': 'Split view',
  'toolbar.palette': 'Command palette (Ctrl+K)',

  'tab.new': 'New tab',
  'tab.new_tip': 'New tab (Ctrl+T)',
  'tab.close_tip': 'Close tab (Ctrl+W)',
  'tab.group_expand': 'Expand group',
  'tab.group_collapse': 'Collapse group',
  'tab.audible': 'Playing audio',
  'vtabs.pinned': 'Pinned',
  'vtabs.importance': 'By importance · {n} tabs',
  'vtabs.asleep': 'Asleep',

  'rail.search': 'Search — find past pages in plain language',
  'rail.history': 'Browsing timeline',
  'rail.notes': 'Notes and highlights',
  'rail.workspaces': 'Workspaces',

  'start.title': 'New tab',
  'start.sub': 'Type a URL, or pick up where you left off below. Ctrl+K searches every feature.',
  'start.recent': 'Recently visited',
  'start.workspaces': 'Saved workspaces',
  'start.restore_n': 'Restore {n} tabs',
  'start.notes': 'Saved notes · {n}',
  'start.note': 'Note',
  'pane.empty': 'This pane is empty. Pick a tab to show it here.',
  'sleeping.body': 'Asleep to save memory. {host}',
  'sleeping.wake': 'Wake up',
  'crashed.title': 'This tab stopped responding',

  'ai.scope_page': 'This page',
  'ai.scope_tabs': 'All tabs',
  'ai.scope_tabs_tip': 'Ask across every open tab at once',
  'ai.close_panel': 'Close the AI panel',
  'ai.organize': 'Sort tabs',
  'ai.organizing': 'Sorting…',
  'ai.summarize': 'Summarise all',
  'ai.summarizing': 'Summarising…',
  'ai.compare': 'Compare',
  'ai.comparing': 'Comparing…',
  'ai.compare_tip': 'Select two or more tabs to compare them',
  'ai.clear_selection': 'Clear selection',
  'ai.mock_notice_1':
    'The backend is not connected. Answers are mock responses that echo the extracted page.',
  'ai.mock_notice_2': 'Set AI_BACKEND_URL to switch to the real API.',
  'ai.suggest_groups': 'Suggested groups',
  'ai.apply_groups': 'Apply these groups',
  'ai.summaries': 'Summaries · {n} pages',
  'ai.reading_minutes': '~{n} min',
  'ai.you': 'You',
  'ai.error': 'Error: {message}',
  'ai.selection_prefix': 'Selected text:',
  'ai.placeholder_page': 'Ask about this page…',
  'ai.placeholder_tabs': 'Ask across all tabs…',

  'ask.placeholder_page': 'Ask anything about this page…',
  'ask.placeholder_tabs': 'Ask across every open tab…',
  'ask.busy': 'Answering…',

  'status.loading': 'Loading…',
  'status.selected': '{n} selected',
  'status.page_rect': 'Page rect computed in the main process',

  'compare.title': 'Comparison',

  'history.title': 'Browsing timeline',
  'history.empty': 'No history yet. Pages you visit appear here in order.',

  'notes.title': 'Notes and highlights',
  'notes.capture': 'Save selection',
  'notes.empty':
    'Select text on a page and press “Save selection” to keep it in your library as a highlight.',
  'notes.no_page': 'No page',
  'notes.placeholder': 'Add a note…',
  'notes.save_hint': 'Save (Ctrl+Enter)',

  'ws.title': 'Workspaces',
  'ws.empty': 'Save the whole working set now and bring it back later in the same order.',
  'ws.meta': '{tabs} tabs · {groups} groups · {when}',
  'ws.restore_add': 'Open alongside',
  'ws.restore_replace': 'Replace and restore',
  'ws.default_name': 'Session {month}/{day}',

  'search.title': 'Fuzzy page search',
  'search.placeholder': 'the red bag page I saw yesterday…',
  'search.searching': 'Searching…',
  'search.empty_mock': 'Keyword matching for now. Semantic search arrives with the backend.',
  'search.empty': 'No matching pages.',

  'palette.placeholder': 'Search commands…',
  'palette.no_match': 'No matching commands',
  'find.placeholder': 'Find in page',
  'find.prev': 'Previous',
  'find.next': 'Next',

  'cmdgroup.tab': 'Tabs',
  'cmdgroup.view': 'View',
  'cmdgroup.ai': 'AI',
  'cmdgroup.panel': 'Panels',
  'cmdgroup.workspace': 'Workspaces',
  'cmdgroup.nav': 'Navigate',
  'cmd.tab_new': 'New tab',
  'cmd.tab_close': 'Close this tab',
  'cmd.tab_sleep': 'Put this tab to sleep',
  'cmd.tab_sleep_hint': 'Frees its memory',
  'cmd.tabmode': 'Switch tab layout (side / top)',
  'cmd.split': 'Toggle split view',
  'cmd.focus': 'Toggle focus mode',
  'cmd.focus_hint': 'Hides the distractions',
  'cmd.ai_panel': 'Toggle the AI panel',
  'cmd.ai_organize': 'Sort tabs into groups with AI',
  'cmd.ai_organize_hint': 'Dev / Research / Video / Shopping',
  'cmd.ai_summarize': 'Summarise every open tab',
  'cmd.ai_compare': 'Compare the selected tabs',
  'cmd.ai_compare_hint': 'Needs two or more tabs',
  'cmd.panel_search': 'Fuzzy page search',
  'cmd.panel_search_hint': 'Find past pages in plain language',
  'cmd.panel_history': 'Browsing timeline',
  'cmd.panel_notes': 'Notes and highlights',
  'cmd.panel_workspaces': 'Workspaces',
  'cmd.workspace_save': 'Save the current work as a workspace',
  'cmd.omnibox': 'Focus the address bar',
  'cmd.language': 'Switch interface language (日本語 / English)',

  'toast.permission_blocked': 'Blocked a {permission} request ({origin})',
  'toast.focus_on': 'Focus mode: {n} kinds of element hidden',
  'toast.focus_off': 'Focus mode off',
  'toast.goal_set': 'Goal set: {goal}',
  'toast.goal_clear': 'Goal cleared',
  'toast.organized': 'Sorted into {n} groups',
  'toast.ws_saved': 'Workspace “{name}” saved',
  'toast.ws_restored': 'Restored “{name}” ({n} tabs)',
  'toast.select_text': 'Select some text on the page first',
  'toast.highlight_saved': 'Highlight saved',
  'toast.backend_mock': 'Backend not connected — AI features return mock responses (set AI_BACKEND_URL)',
  'toast.backend_down': 'Cannot reach the backend: {url}',
  'toast.language': 'Interface language set to {lang}',

  'hide.sidebar': 'Sidebar',
  'hide.ads': 'Ads',
  'hide.related': 'Related articles',
  'hide.social': 'Share buttons',
  'hide.sticky': 'Sticky banners',
  'hide.newsletter': 'Newsletter prompts',
  'hide.yt_next': 'Up next',
  'hide.yt_comments': 'Comments',
  'hide.gh_feed': 'Side feed',

  'mock.no_pages': 'No readable pages. Open a tab and try again.',
  'mock.not_connected':
    '(Backend not connected. Implement /ask from INTEGRATION.md and this is replaced by real model output.)',
  'mock.read_pages': 'Read {n} pages.',
  'mock.question': 'Question: {q}',
  'mock.headings': 'Headings: {list}',
  'mock.price': 'Price: {price}',
  'mock.footer':
    'This is the extracted content listed as-is. Summarising and reasoning arrive with the backend.',
  'mock.organize_reason': 'Grouped by domain and page keywords',
  'mock.no_text': 'No body text could be extracted.',
  'mock.verdict_cheapest': 'Cheapest: “{title}” ({price})',
  'mock.verdict_generic':
    'Listing the fields we could extract. Verdicts arrive with the backend.',
  'mock.col_site': 'Site',
  'mock.col_name': 'Product',
  'mock.col_price': 'Price',
  'mock.col_stock': 'Stock',
  'mock.col_rating': 'Rating',
  'mock.col_reviews': 'Reviews',
  'mock.col_seller': 'Seller',
  'mock.col_length': 'Body length',
  'mock.group_dev': 'Dev',
  'mock.group_video': 'Video',
  'mock.group_shopping': 'Shopping',
  'mock.group_research': 'Research',
  'mock.group_other': 'Other'
}

const DICTIONARIES: Record<Locale, Record<MessageKey, string>> = { ja, en }

export type MessageParams = Record<string, string | number>

export function translate(locale: Locale, key: MessageKey, params?: MessageParams): string {
  const template = DICTIONARIES[locale][key] ?? ja[key] ?? key
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name]
    return value === undefined ? match : String(value)
  })
}

/** BCP 47 tag for Intl formatters. */
export function intlLocale(locale: Locale): string {
  return locale === 'ja' ? 'ja-JP' : 'en-US'
}

/** First run picks the OS language; after that the stored setting wins. */
export function localeFromSystem(systemLocale: string): Locale {
  return systemLocale.toLowerCase().startsWith('ja') ? 'ja' : 'en'
}
