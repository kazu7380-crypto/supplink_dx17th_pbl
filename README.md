# サプリンク

> 物品オーダーシステム

手術室（OP室）の看護師が、手術用物品をサプライ課にオーダーするための Web アプリ。

詳細仕様は [仕様書.md](./仕様書.md) を参照してください。

## 起動

```bash
npm install
npm run dev
# http://localhost:3000
```

## 動作確認の流れ

1. ブラウザ A（手術室側）で `/` を開き、初回モーダルで手術室を選択。
2. 物品を検索 → クリック → 数量入力 → カートへ追加。
3. 右下のフロートカートアイコンをクリック → カートモーダルが開く。
4. 数量調整して「配送依頼を送信」。
5. ブラウザ B（サプライ課側）で `/status` を開き、「通知音 ON」を一度クリックして音声を有効化。
6. ブラウザ A から依頼を送ると、ブラウザ B にカードが追加されアラームが鳴る。
7. 受付側でカードの「完了にする」、または詳細ページで「配送完了にする」をクリックでグレーアウト。

## 構成

| パス | 役割 |
|------|------|
| `app/page.tsx` | 物品検索画面（依頼側）。カートはこの画面上のモーダル |
| `app/status/page.tsx` | 受付状況一覧（サプライ課側） |
| `app/status/[id]/page.tsx` | 依頼詳細 |
| `app/api/items/route.ts` | 物品マスタ |
| `app/api/orders/route.ts` | 依頼の作成・一覧 |
| `app/api/orders/[id]/route.ts` | 依頼の取得・完了 |
| `app/api/stream/route.ts` | Server-Sent Events（新規依頼通知） |
| `components/CartModal.tsx` | カート / 配送依頼モーダル（旧 `/cart` 画面の代替） |
| `components/FloatingCartButton.tsx` | 右下フロート FAB（カートを開く） |
| `lib/db.ts` | インメモリストア（DB 確定後に差し替え） |
| `lib/items.ts` | 物品マスタ（種データ） |
| `lib/normalize.ts` | あいまい検索の文字列正規化 |
| `lib/beep.ts` | WebAudio による通知音 |

## デプロイ

Vercel にそのままデプロイ可能。ただし現状はインメモリ DB のため、関数インスタンスをまたぐと依頼が永続化されません（`lib/db.ts` を差し替えれば対応可）。

## 未確定事項

- 院内セキュリティ要件に応じたデータベース選定（Vercel Postgres / Neon / 院内DB 等）。
- 音以外の通知（OS Push、メール、デスクトップ通知）。
- ユーザ認証（手術室側 / サプライ課側のロール）。
