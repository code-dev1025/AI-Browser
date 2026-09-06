# AI Browser — フロントエンド

Electron + React 19 + TypeScript 5 で作った AI ブラウザのシェル。
**バックエンドなしで完全に動きます。** AI 応答はモックが返します
（接続方法は [INTEGRATION.md](./INTEGRATION.md)）。

対象: Windows 10 (1809+) / 11 · x64 · 1920×1080 基準、1366×768〜4K 対応。

---

## 動かす

```powershell
npm install
npm run dev          # 開発（HMR あり）
npm run build        # 型チェック + 本番ビルド
npm run typecheck    # 型だけ
npm run package      # Windows インストーラ（NSIS）※ Node 22.12+ が必要
```

バックエンドが用意できたら:

```powershell
$env:AI_BACKEND_URL = "http://localhost:8000"; npm run dev
```

---

## 設計の芯 — Web ページを描画するのは React ではない

React が持つのは**シェル（外枠）だけ**です。タブバー、ツールバー、サイドバー、
AI パネル。ページ本体は Chromium の `WebContentsView` で、DOM の**上に浮いて**
います。ここから 3 つの帰結が出ます。

1. **DOM 要素をページの上に重ねられない。** だからコマンドパレット・ページ内検索・
   URL 補完は 2 本目の React エントリ（`renderer/overlay/`）で描き、透明な
   `WebContentsView` として最前面に置きます。
2. **レイアウトは main が計算する。** レンダラーは「状態」だけ送り、ピクセルは
   送りません。`shared/layout.ts` を main と renderer の両方が import するので、
   ウィンドウリサイズ時にページとクロームがズレません。
3. **タブの正は main。** React はそれを投影するだけで、タブを生成も破棄もしません。

---

## ディレクトリ

```
src/
├─ shared/                 main と renderer の両方が import する唯一の場所
│  ├─ layout.ts            CHROME 定数 + contentRect() ← リサイズの要
│  ├─ contract.ts          全 IPC チャンネルと型（1ファイル）
│  └─ types.ts             ドメイン型
├─ main/                   Node。タブ・セッション・View の所有者
│  ├─ AppWindow.ts         BaseWindow + shellView + overlayView + レイアウト適用
│  ├─ tabs.ts              TabRegistry — 生成/破棄/休眠/グループ
│  ├─ ipc.ts               contract.ts の実装、全ハンドラ
│  ├─ injection.ts         集中モードの CSS 注入パイプライン
│  ├─ snapshots.ts         tabshot:// プロトコル + capturePage
│  ├─ security.ts          サンドボックス・権限・window.open 遮断
│  └─ api/                 ★ バックエンドとの継ぎ目（mock / http 差し替え）
├─ preload/
│  ├─ shell.ts             広い API — 自前 UI 専用
│  └─ content.ts           狭い API — 信頼できないページの隣で動く。page に何も公開しない
└─ renderer/
   ├─ shell/               エントリ1：クローム本体
   ├─ overlay/             エントリ2：ページの上に出る UI
   ├─ shared/store/        zustand スライス（tabs / shell / ai / library / ui）
   └─ styles/              トークン + CSS
```

---

## 実装済みの機能

| 機能 | 状態 | 実体 |
| --- | --- | --- |
| タブ管理 | ✅ | 生成・並べ替え(D&D)・ピン留め・複製・ミュート・中クリック閉じ |
| タブグループ | ✅ | 色分け・折りたたみ・メンバーの連続配置を main が保証 |
| タブ寿命（休眠） | ✅ | 30分無操作で自動休眠。プロセス破棄、スナップショットのみ保持 |
| タブ重要度スコア | ✅ | 縦タブモードで最終使用・滞在時間・訪問数から並べ替え |
| ワークスペース保存・復元 | ✅ | タブ・並び・グループ・レイアウトを丸ごと |
| 分割画面 | ✅ | N ペイン。ドラッグ中は View を凍結しスナップショットを掴む |
| 集中モード | ✅ | ルール駆動の CSS 注入。SPA の遷移後に自動再適用 |
| メモ・ハイライト | ✅ | 選択範囲を保存 + ページ上に `<mark>` |
| 閲覧タイムライン | ✅ | 日付区切り・滞在時間つき |
| 曖昧タブ検索 | ✅ | 履歴 + 開いているタブの本文を横断（接続後は意味検索に） |
| コマンドパレット | ✅ | Ctrl+K。オーバーレイ View 実装 |
| ページ内検索 | ✅ | Ctrl+F。同上 |
| サイドバー | ✅ | 検索 / タイムライン / メモ / ワークスペース |
| シェル構成 2種 | ✅ | 横タブ（既定）↔ 縦タブ をワンクリック切替 |
| ページAI質問 | 🔌 | UI 完成・ストリーミング動作。応答はモック |
| 全タブ質問 | 🔌 | 同上 |
| AIタブ自動整理 | 🔌 | ドメイン+本文のヒューリスティックで実際に動く |
| 一括要約 | 🔌 | 抽出は本物、要約はモック |
| ページ比較 | 🔌 | **抽出は本物** — JSON-LD/meta から価格・在庫・スペックを取得し表を組む |

🔌 = `AI_BACKEND_URL` を設定すると実 API に切り替わる箇所。

---

## ショートカット

| キー | 動作 |
| --- | --- |
| `Ctrl+T` / `Ctrl+W` | タブを開く / 閉じる |
| `Ctrl+L` | アドレスバー |
| `Ctrl+K` | コマンドパレット |
| `Ctrl+F` / `F3` | ページ内検索 |
| `Ctrl+Shift+K` | AI パネル開閉 |
| `Ctrl+Tab` / `Ctrl+1..9` | タブ切替 |
| `Alt+←` / `Alt+→` | 戻る / 進む |
| `Ctrl+クリック`（縦タブ） | 複数選択（比較・要約の対象） |

ページにフォーカスがある間もこれらは効きます（`before-input-event` で横取り）。

---

## Windows / 日本語での注意点

- **IME**: URL バー・検索・メモ・AI 入力のすべてで `isComposing` を見てから
  Enter を処理します。変換中の Enter で遷移・送信しません。補完は
  `compositionend` で発火します。
- **タイトルバー**: `titleBarOverlay` を使用（Windows 10 で動作）。ボタン幅は
  `navigator.windowControlsOverlay.getTitlebarAreaRect()` から実測し、決め打ち
  しません。
- **Windows 11 専用機能は不使用**: Mica や角丸ウィンドウは Windows 10 で無視
  されるため、それ抜きで成立する見た目にしています。
- **配布**: `npm run package` は electron-builder のツールが Node 22.12+ を要求
  します。開発は Node 20 で問題ありません。

---

## セキュリティ

ブラウザなので、読み込むコードは他人が書いたものです。

- 全ページ View で `sandbox: true` / `contextIsolation: true` / `nodeIntegration: false`
- ページ View には**狭い preload のみ**。`contextBridge` で page に何も公開しない
- `window.open` は遮断し自前タブへ。外部スキームは許可リスト経由で OS に渡す
- 権限（カメラ・マイク・位置・通知）は既定で拒否
- シェル文書に CSP。抽出テキストは HTML として描画しない

---

## 意図的にフレームワークを入れていない点

Tailwind / Radix / UI ライブラリは未導入で、CSS はトークン + 素の CSS です。
ブラウザのクロームは既製コンポーネントと形が合わず、クラス名の羅列より
読みやすいと判断しました。後から Tailwind を足す場合も
`renderer/styles/tokens.css` の変数がそのまま使えます。
