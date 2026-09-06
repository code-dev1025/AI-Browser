# バックエンド接続仕様 / Backend integration contract

フロントエンドは**すでに完成しており、バックエンドを待っていません**。
AI 機能はすべて `src/main/api/` の 1 インターフェース越しに呼ばれ、いまはモック実装が応答しています。

The frontend is **finished and does not wait for the backend**. Every AI feature
goes through one interface in `src/main/api/`, currently served by a mock.

---

## 切り替え方 / How to switch over

```powershell
# 開発時
$env:AI_BACKEND_URL = "http://localhost:8000"; npm run dev
```

`AI_BACKEND_URL` があれば `HttpBackend`、なければ `MockBackend` が使われます
(`src/main/api/index.ts`)。**レンダラー側のコードは 1 行も変わりません。**

タイトルバーのバッジが `MOCK API` → `API LIVE` に変われば接続成功です。

---

## 大前提 / Ground rules

1. **レンダラーは API を直接呼びません。** すべて main プロセスが代理で呼びます。
   認証トークンは `safeStorage`（Windows は DPAPI）に暗号化保存され、Web
   コンテンツを描画するプロセスのメモリには一切載りません。
2. **CORS 設定は不要です。** リクエストは Node 側から出ます。
3. **ページ本文の抽出はフロント側で完了しています。** バックエンドはスクレイピング
   不要で、整形済みテキストを受け取ります。

---

## エンドポイント / Endpoints

ベース URL は `AI_BACKEND_URL`。すべて `POST`、`Content-Type: application/json`、
`Authorization: Bearer <token>`（トークン未設定時はヘッダなし）。

### `GET /health`

200 を返せば接続済みと判定します。ボディは見ません。

---

### `POST /ask` — ページ質問 / 全タブ質問（ストリーミング）

**Request**

```jsonc
{
  "question": "一番安いのはどれ？",
  "scope": "page" | "tabs" | "selection",
  "conversationId": "default",
  "pages": [
    {
      "tabId": "t3x9k",
      "url": "https://example.com/item/123",
      "title": "商品ページ",
      "text": "抽出済みの本文テキスト（最大 40,000 文字）",
      "product": {
        "name": "...", "price": "¥12,800", "priceValue": 12800,
        "currency": "JPY", "availability": "InStock",
        "rating": "4.3", "reviewCount": "215", "seller": "...",
        "specs": [{ "label": "重量", "value": "1.2kg" }]
      }
    }
  ]
}
```

**Response** — `text/event-stream`

```
data: {"delta":"最"}

data: {"delta":"安は"}

data: {"done":true,"text":"最安は B 社の ¥12,800 です。","citations":[
  {"tabId":"t3x9k","url":"https://...","title":"商品ページ","quote":"¥12,800","offset":1840}
]}

```

- `delta` は差分文字列。UI がそのまま追記します。
- `done` フレームで `text`（全文）と `citations` を返してください。
- `citations[].offset` は **リクエストで渡した `text` 内の文字位置**です。
  これがあると UI が「引用元へジャンプ」を出せます。null でも動きます。
- エラーは `data: {"error":"..."}` で返してください。

---

### `POST /organize` — AIタブ自動整理

**Request**: `{ "pages": [ ...上と同じ形... ] }`

**Response**

```json
[
  {
    "groupName": "開発",
    "color": "indigo",
    "tabIds": ["t1", "t4", "t9"],
    "reason": "React と TypeScript のドキュメント"
  }
]
```

`color` は `indigo | teal | amber | rose | violet | slate` のいずれか。

---

### `POST /summarize` — 複数ページ一括要約

**Request**: `{ "pages": [...] }`

**Response**

```json
[
  {
    "tabId": "t1",
    "title": "...",
    "url": "https://...",
    "bullets": ["要点1", "要点2", "要点3"],
    "readingMinutes": 6
  }
]
```

---

### `POST /compare` — ページ比較モード

**Request**: `{ "pages": [...] }` （`product` フィールド入り）

**Response**

```json
{
  "tabIds": ["t1", "t2"],
  "columns": [{ "tabId": "t1", "title": "...", "url": "https://..." }],
  "rows": [
    { "label": "価格", "values": ["¥12,800", "¥13,400"], "bestIndex": 0 },
    { "label": "在庫", "values": ["あり", "なし"], "bestIndex": null }
  ],
  "verdict": "B 社が ¥600 安いが在庫なし。"
}
```

`bestIndex` を返すと該当セルが緑でハイライトされます。不要なら `null`。

---

### `POST /search` — 曖昧タブ検索（意味検索）

**Request**

```jsonc
{
  "query": "昨日見た赤いバッグのページ",
  "corpus": [
    {
      "url": "https://...",
      "title": "...",
      "text": "履歴タイトル、または開いているタブの本文（最大 6,000 文字）",
      "visitedAt": 1757000000000,
      "tabId": "t3" // 開いているタブなら id、履歴なら null
    }
  ]
}
```

`corpus` はフロントが持っている候補です。**バックエンドが独自にインデックスを
持つ場合は無視して構いません** — その場合 `corpus` を空配列にする変更だけ
`src/main/ipc.ts` の `ai.search` ハンドラで行ってください。

**Response**

```json
[
  {
    "url": "https://...",
    "title": "...",
    "snippet": "一致箇所の前後",
    "score": 0.82,
    "visitedAt": 1757000000000,
    "tabId": "t3"
  }
]
```

---

## いまフロント側がローカルで持っているもの / Currently local

これらは `%APPDATA%/ai-browser/data/*.json` に保存されています。
バックエンドが引き取る場合、置き換えるのは `src/main/ipc.ts` のハンドラだけで、
型（`src/shared/types.ts`）と UI はそのまま使えます。

| データ | ファイル | 対応する型 |
| --- | --- | --- |
| 閲覧履歴 | `history.json` | `HistoryEntry[]` |
| メモ・ハイライト | `notes.json` | `Note[]` |
| ワークスペース | `workspaces.json` | `WorkspaceSnapshot[]` |
| 認証トークン | `credentials.json` | 暗号化済み |

---

## 認証 / Auth

`HttpBackend.setToken(token)` を呼ぶと `safeStorage` で暗号化して保存し、以降の
全リクエストに `Authorization: Bearer` が付きます。ログイン UI はまだ無いので、
方式（APIキー / OAuth / セッション）が決まったら教えてください。フロント側は
main プロセスに 1 画面追加するだけで済みます。
