# サプリンク 引き継ぎ仕様書（HANDOVER）

> 物品オーダーシステム / Sapurink
> 最終更新: 2026-05-18

このドキュメントは、本プロジェクトの**実装済み機能・技術構成・運用ポリシー・拡張時の指針**を 1 ファイルにまとめたものです。社内の引き継ぎ、外部委託先への共有を想定しています。

---

## 目次

1. [プロジェクト概要](#1-プロジェクト概要)
2. [技術スタック](#2-技術スタック)
3. [クイックスタート（開発環境）](#3-クイックスタート開発環境)
4. [画面・機能仕様](#4-画面機能仕様)
5. [データモデル](#5-データモデル)
6. [API リファレンス](#6-api-リファレンス)
7. [状態管理・ローカル保存](#7-状態管理ローカル保存)
8. [リアルタイム同期・通知音](#8-リアルタイム同期通知音)
9. [セキュリティ・RLS](#9-セキュリティrls)
10. [デプロイ・運用](#10-デプロイ運用)
11. [ディレクトリ構成・ファイル責務](#11-ディレクトリ構成ファイル責務)
12. [既知の制約・運用上の注意](#12-既知の制約運用上の注意)
13. [今後の拡張提案](#13-今後の拡張提案)
14. [トラブルシュート](#14-トラブルシュート)

---

## 1. プロジェクト概要

### 1.1 目的
病院の手術室（OP 室）の看護師が、サプライ課（中央材料室）へ手術用物品を依頼するための Web アプリケーション。電話・PHS・紙運用を置き換え、依頼内容を正確に伝達し、ピッキング・配送までを可視化することが目的。

### 1.2 想定利用者

| ロール | 主な端末 | 主な画面 |
|---|---|---|
| 手術室看護師（依頼側） | iPhone 等のスマートフォン | `/`（物品検索 / カート / 送信） |
| サプライ課スタッフ（受付側） | PC / タブレット | `/status`（受付状況 / 詳細 / 履歴） |
| 物品マスタ管理者 | PC | `/settings` |

### 1.3 現在のフェーズ
- **PBL / 試運用フェーズ**
- 認証は未導入。URL を知っている人のみが利用できる前提
- Supabase RLS で DB レイヤーの権限は最小限に絞っている
- 個人情報（患者氏名・カルテ番号等）は扱わない

---

## 2. 技術スタック

| 項目 | 内容 |
|---|---|
| フレームワーク | Next.js 15 (App Router) + TypeScript + React 19 |
| UI | Tailwind CSS 3.4 / lucide-react / Kaisei Opti (Google Fonts) |
| データベース | Supabase Postgres |
| リアルタイム | Supabase Realtime（postgres_changes 購読） |
| ストレージ | Supabase Storage（`item-photos` バケット） |
| デプロイ | Vercel（Production / Preview 自動） |
| 通知音 | WebAudio API（AudioBufferSource ループ再生） |
| Excel/CSV | xlsx (SheetJS) |
| 認証 | **未導入** |

主要ライブラリは [`package.json`](package.json) を参照。

---

## 3. クイックスタート（開発環境）

### 3.1 必須環境
- Node.js 20 以上
- npm
- Supabase プロジェクト（無料プランで動作）

### 3.2 セットアップ手順

```bash
git clone <repo-url>
cd <repo>
npm install
cp .env.local.example .env.local
# .env.local を編集して Supabase の URL と publishable (anon) key を貼る
npm run dev
# http://localhost:3000
```

### 3.3 必須の環境変数

| 変数名 | 値 | 取得先 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project>.supabase.co` | Supabase ダッシュボード → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOi...` | Supabase ダッシュボード → Settings → API → Project API keys → `anon` / `publishable` |

`NEXT_PUBLIC_` プレフィックスはブラウザバンドルに焼き込まれるため、**公開しても安全な設計のキーのみ**を使用する。`service_role` キーは絶対に `NEXT_PUBLIC_` を付けない。

### 3.4 Supabase 側の初期設定
[9 章 セキュリティ・RLS](#9-セキュリティrls) のテーブル作成 SQL と RLS ポリシー SQL を実行する。

---

## 4. 画面・機能仕様

### 4.1 ルート一覧

| ルート | 概要 | SSR/CSR |
|---|---|---|
| `/` | 物品検索 + カート + 配送依頼送信 | SSR で items を取得 |
| `/status` | 受付状況（依頼中・ピッキング中・配送済） | SSR で初期表示、Realtime で更新 |
| `/status/[id]` | 依頼詳細・ピッキング・状態遷移 | SSR |
| `/status/history` | 依頼履歴・フィルタ・ページネーション・CSV エクスポート | SSR |
| `/settings` | 物品マスタ / 診療科マスタの管理 | SSR |

### 4.2 物品検索 `/`

- **検索ボックス**: 物品名・棚番号・コード等で曖昧検索
- **カテゴリ絞り込みプルダウン**（カテゴリが 1 件以上設定されていれば表示）
- **検索結果カード（グリッド表示）**: 写真 + カテゴリ + #コード + 物品名 + 仕様 + メモ + 棚番号
  - PC は 3 列、タブレットは 2 列、スマホは 1 列のレスポンシブ
  - カート在中の物品は枠線とアクセントバーで強調表示
- **数量入力ダイアログ** (`QuantityDialog`): カード/写真タップで出現
  - +/- ボタンと直接入力、上書き/削除ボタン
  - カートに既に入っている場合は「現在 N 個（上書き）」表示
- **写真の Lightbox 拡大**: サムネタップで全画面表示
- **検索ロジック**: [`lib/normalize.ts`](lib/normalize.ts)
  - NFKC 正規化（全角→半角、互換分解）
  - 英大文字↔小文字の同一視
  - ひらがな↔カタカナの同一視
  - 元データ内の空白を無視（"PDS Z77" → "pdsz77" でもヒット）
  - 空白区切りクエリは AND 検索
  - 数字のみのクエリでコード完全一致があれば、その物品を結果の先頭に並べ替える

### 4.3 カート / 配送依頼 `/` 上のモーダル

- 右下の **FloatingCartButton**（フローティング FAB）でモーダルを開く
  - 物品検索 `/` ページでのみ表示
  - カートに物品が入ると **オレンジ + 黒文字** にゆっくり遷移し注意を引く（700ms フェード）
  - PC では h-28 w-28（112px）、スマホ h-14 w-14（56px）
- モーダル内の構成:
  - カート明細（写真 / 物品名 / 数量 +/- ボタン / 削除）
  - **手術室** プルダウン（OP1 ～ OP10、必須）
  - **診療科** / **術式** プルダウン（任意、診療科を選ぶと術式が絞り込まれる）
  - 「すべて削除」「配送依頼を送信」ボタン
- 送信時に **物品マスタのスナップショット**を `orders.lines.snapshot` に同梱
  - 後でマスタが更新されても履歴は当時の状態を保持
- 送信成功すると "依頼を送信しました" 画面に切り替わり、「続けて依頼する」で閉じる
- PC でも縦並びレイアウト（max-w-md）で操作しやすく統一

### 4.4 端末用 手術室選択モーダル `RoomSelectionModal`

- アプリ初回起動時（`room` 未設定で `/status` 以外の画面を開いた時）に**強制的に**部屋選択を要求
- OP1 〜 OP10 のボタングリッドから 1 つを選択
- 選択値は `sessionStorage` に保存され、以降同セッション内では出ない
- カートの手術室プルダウンで後から変更可能

### 4.5 受付状況 `/status`

- **通知音 ON/OFF トグル**（`localStorage` で永続化）
  - ON にすると新規依頼到着時から `dq_levelup_10s.wav` をループ再生
  - 「依頼中」が 1 件以上ある間ループ継続
  - 「ピッキング中」に遷移するとループ停止
- **Realtime 接続状態インジケータ**（接続中 / 接続待ち）
- **Wake Lock**: 受付タブを開いている間は画面スリープを防止
- セクション構成:
  - **依頼中**: 日付に関わらず全件表示（履歴側で削除できないため、進行中案件が当日を超えても残り続けても見えるように）
  - **ピッキング中**: 同上、全期間表示
  - **配送済**: **本日分のみ** 最新 10 件、超えた分は履歴で確認の案内
- 各カード（OrderCard）:
  - 手術室 / 状態バッジ / 受付時刻
  - 物品の箇条書き 3 件（名前 + × 数量、超過分は「ほか N 件」）
  - クリックで詳細 `/status/[id]` へ遷移

### 4.6 依頼詳細 `/status/[id]`

- ヘッダ: 手術室 / 状態 / 診療科+術式 / タイムスタンプ（受付・ピッキング開始・配送完了）
- 物品明細カード（写真 + カテゴリ + #コード + 物品名 + 仕様 + メモ + 棚番号 + 数量）
- **ピッキング中** の場合、各物品カード下部に「ピッキング完了」チェックボタン
  - チェック済みの物品はグレーアウト + 取り消し線
  - チェック状態は `localStorage` に依頼 ID 単位で保存（リロードしても保持）
- 下部 sticky 操作バー:
  - 「依頼中」→ 「ピッキング開始」ボタン
  - 「ピッキング中」→ 「配送完了」ボタン（全物品チェック必須）
  - 「配送済」→ 何も表示せず
- 配送完了後は自動で `/status` に戻る
- **削除機能は無し**（履歴を残す方針）

### 4.7 履歴 `/status/history`

- **フィルタ**: 日付（カレンダー） / 状態 / 手術室 / 診療科
- **ページネーション**: 1 ページ 20 件、結果リストの上下に切替コントロール
- **CSV エクスポート**: フィルタ後の全件を **明細行単位**（1 物品 1 行）で出力
  - 列: 依頼ID / 受付日時 / ピッキング開始 / 配送完了 / 状態 / 手術室 / 診療科 / 術式 / 物品コード / 物品名 / 規格 / 棚番 / メモ / カテゴリ / 数量
  - UTF-8 BOM 付き
- **削除機能は無し**（UI から削除する手段はない）

### 4.8 設定 `/settings`

タブで「物品マスタ」「診療科・術式」に切替。

#### 物品マスタタブ

- **インポート / エクスポート**:
  - CSV / TSV / Excel(.xlsx, .xls) を取り込み、プレビュー表示後に確定で全置換
  - 列見出しは別名対応（物品コード/コード/code、材料名/品名/name 等）
  - **CSV エクスポート**: 現在のマスタを同じ列順で書き出し（UTF-8 BOM 付き）
  - インポート時、既存の `photo_path` は **保持** される（CSV 再投入で写真が消えない）
- **物品一覧**:
  - 検索 + カテゴリフィルタ
  - 行展開で写真の登録 / 撮影 / 削除 と **メモの編集**
  - 写真は最大 80KB に自動圧縮（[`lib/photoStore.ts`](lib/photoStore.ts) の `compressImage`）

#### 診療科・術式タブ

- 同様の CSV/Excel インポート / CSV エクスポート機能
- 登録済み一覧は **診療科ごとにグルーピング** 表示

### 4.9 ヘッダ・ナビゲーション

- 左: ブランドロゴ + 「サプリンク」（Kaisei Opti, weight 800）
- 中央: 検索 / 受付 / 履歴
- 右: 設定アイコン
- sticky で常時表示（コンテンツ末尾までスクロールしても追従）

---

## 5. データモデル

### 5.1 `items` テーブル

| カラム | 型 | 内容 |
|---|---|---|
| `code` | INTEGER (PK) | 物品コード（最大 8 桁を想定） |
| `name` | TEXT | 材料名 |
| `spec` | TEXT | 製品番号・規格 |
| `shelf` | TEXT | 棚番号 |
| `memo` | TEXT | 通称・検索ワード |
| `category` | TEXT | カテゴリ（任意） |
| `photo_path` | TEXT | Storage オブジェクトキー（例: `"100.jpg"`） |
| `updated_at` | TIMESTAMPTZ | 写真 URL のキャッシュバスタに利用 |

CSV インポート時は **全件 DELETE → INSERT**。ただし既存の `photo_path` は `code` をキーに引き継ぐ ([`lib/itemsDb.ts`](lib/itemsDb.ts) の `replaceAllItems`)。

### 5.2 `orders` テーブル

| カラム | 型 | 内容 |
|---|---|---|
| `id` | UUID (PK) | 依頼 ID |
| `room` | TEXT | 手術室名（"OP1" 等） |
| `lines` | JSONB | 物品行配列（下記スキーマ） |
| `status` | TEXT | `requested` / `picking` / `delivered` |
| `created_at` | TIMESTAMPTZ | 受付時刻 |
| `picked_at` | TIMESTAMPTZ | ピッキング開始時刻 |
| `delivered_at` | TIMESTAMPTZ | 配送完了時刻 |
| `department` | TEXT | 診療科（任意） |
| `procedure_name` | TEXT | 術式名（任意） |

`lines` の JSONB 構造:

```json
[
  {
    "itemCode": 100,
    "quantity": 5,
    "snapshot": {
      "name": "...",
      "spec": "...",
      "shelf": "...",
      "memo": "...",
      "category": "..."
    }
  }
]
```

`snapshot` は依頼送信時点の物品マスタを凍結する。マスタが更新されても履歴は当時の表示を保つ。写真 (`photo_path`) は snapshot に含めず、表示時に items テーブルから最新を引く（写真は Storage 同一キー上書き運用のため）。

### 5.3 `procedures` テーブル

| カラム | 型 | 内容 |
|---|---|---|
| `id` | INTEGER (PK) | 自動採番 |
| `department` | TEXT | 診療科 |
| `name` | TEXT | 術式名 |

CSV インポート時は全件 DELETE → INSERT。

### 5.4 Storage バケット `item-photos`

- アクセス: Public
- オブジェクトキー規約: `{code}.jpg` (固定。.jpg のみ受け入れ)
- 圧縮後の上限サイズ: 約 80KB
- 公開 URL: `https://{project}.supabase.co/storage/v1/object/public/item-photos/{code}.jpg?v={updated_at}`
  - `?v=` クエリは items.updated_at を載せてキャッシュバスタする

### 5.5 型定義

TypeScript の型は [`lib/types.ts`](lib/types.ts) に集約。主要なものは `Item`, `Order`, `OrderLine`, `OrderLineSnapshot`, `OrderStatus`, `Procedure`。

---

## 6. API リファレンス

すべて Next.js Route Handler。レスポンスは `application/json`。

### 6.1 物品マスタ

| メソッド | パス | 概要 |
|---|---|---|
| GET | `/api/items` | 全物品の取得（空ならバンドルされた fallback を返す） |
| POST | `/api/items` | **全置換**。body: `{ items: Item[] }` |
| PATCH | `/api/items/[code]` | 単一物品の部分更新（現状 `memo` のみ）。body: `{ memo: string }` |

### 6.2 依頼

| メソッド | パス | 概要 |
|---|---|---|
| GET | `/api/orders` | 全依頼の取得（新しい順） |
| POST | `/api/orders` | 依頼を作成。body: `{ room, lines, department?, procedure? }` |
| GET | `/api/orders/[id]` | 依頼の取得 |
| PATCH | `/api/orders/[id]` | 状態遷移。body: `{ status: "requested" \| "picking" \| "delivered" }` |
| DELETE | `/api/orders/[id]` | 依頼削除（**UI からは呼ばれない**。RLS でも anon に対しては拒否） |

状態遷移ルール ([`lib/db.ts`](lib/db.ts) の `isAllowedTransition`):
- `requested → picking`
- `picking → delivered`
- `requested → delivered`（1 ステップ飛ばし許可）
- 逆方向は不可

### 6.3 診療科・術式マスタ

| メソッド | パス | 概要 |
|---|---|---|
| GET | `/api/procedures` | 全件取得 |
| POST | `/api/procedures` | **全置換**。body: `{ entries: [{ department, name }] }` |

---

## 7. 状態管理・ローカル保存

### 7.1 React Context

[`components/providers.tsx`](components/providers.tsx) に 2 つ:

| Context | 内容 |
|---|---|
| `RoomContext` | `room` (現在の手術室) と `setRoom` |
| `CartContext` | `lines`, `add`, `setQuantity`, `remove`, `clear`, `count`, `isOpen`, `open`, `close` |

### 7.2 ローカルストレージ

| 用途 | API | キー | 内容 |
|---|---|---|---|
| カート内容 | sessionStorage | `or-cart` | `CartLine[]` |
| 手術室選択 | sessionStorage | `or-room` | string |
| 通知音 ON/OFF | localStorage | `or-supply-audio-on` | "true" / "false" |
| ピッキングチェック | localStorage | `or-supply-picking-checks-{orderId}` | `number[]` (itemCode) |

カートと手術室は **sessionStorage**。タブを閉じれば消える（次回起動で `RoomSelectionModal` が出る）。

### 7.3 物品マスタ / 診療科マスタの取得

- SSR で初期データを取得 (`listItemsOrFallback`, `listProcedures`)
- クライアントで `useItems` / `useProcedures` フックが Realtime 購読し、変更があれば自動で再取得
- SSR データを初期値として渡すので、初期表示はサーバ側でレンダリング済み

---

## 8. リアルタイム同期・通知音

### 8.1 Supabase Realtime チャンネル

| チャンネル | 場所 | 用途 |
|---|---|---|
| `items-stream` | `useItems` | 物品マスタの自動再取得 |
| `procedures-stream` | `useProcedures` | 診療科・術式の自動再取得 |
| `orders-stream` | `StatusClient` | 受付状況のリアルタイム更新（INSERT / UPDATE / DELETE） |
| `history-orders` | `HistoryClient` | 履歴のリアルタイム更新 |

### 8.2 通知音 / アラーム

[`lib/beep.ts`](lib/beep.ts) — WebAudio API を使った再生制御。

- ファイル: `/sounds/dq_levelup_10s.wav`（10 秒の WAV ファイル）
- `unlockAudio()` で AudioContext を起こす（モバイル制限対応、ユーザー操作起点で呼ぶ必要あり）
- `startAlarm()` / `stopAlarm()` で `AudioBufferSourceNode.loop = true` でループ再生
- 二重再生防止 + 「読み込み中に stop されたら破棄」する generation token 機構

StatusClient のループ制御:
- `shouldAlarm = audioOn && pendingRequestedCount > 0`
- `shouldAlarm` の boolean 遷移時のみ `startAlarm()` / `stopAlarm()` を呼ぶ
- 件数 1→2 のような数値変動では再起動しない（再生が途切れない）

### 8.3 Wake Lock

`/status` を開いている間、Screen Wake Lock API でスクリーンスリープを防止。タブを離れると一旦解放され、再びアクティブになった時に再取得する。Wake Lock 非対応ブラウザでは何も起こらない。

---

## 9. セキュリティ・RLS

### 9.1 環境変数とキー管理

- `.env.local` は **`.gitignore` で除外**（`.env*` パターン）
- リポジトリには `.env.local.example` というテンプレートのみ含む
- 本番デプロイ (Vercel) の環境変数は Vercel ダッシュボードの Environment Variables に登録
- AI ツール (Claude Code 等) を使う場合、`.env.local` をローカルに残さず 1Password 等のシークレットマネージャー経由で注入する運用を推奨

### 9.2 Supabase の Publishable Key（旧 anon key）

- ブラウザバンドルに焼き込まれる前提のキー
- 公開しても**設計上**問題ないが、それを支えるのが RLS
- 安全策として「使い終わったキーはダッシュボードで削除し、新しい publishable key に切替」運用が可能
- `service_role` キーは使わない（コードからの呼び出しなし）

### 9.3 RLS ポリシー

すべてのテーブルで Row Level Security を有効化済。`anon` ロールに対する許可は以下:

| テーブル | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `items` | ✅ | ✅ | ✅ | ✅ |
| `procedures` | ✅ | ✅ | ✅ | ✅ |
| `orders` | ✅ | ✅ | ✅ | **❌ 拒否** |
| Storage `item-photos` | ✅ | ✅ | ✅ | ✅ |

orders の DELETE は **意図的にポリシーを書かない** ことで拒否（履歴保全方針）。

セットアップ用 SQL:

```sql
-- items
alter table items enable row level security;
create policy "anon can read items" on items for select to anon using (true);
create policy "anon can insert items" on items for insert to anon with check (true);
create policy "anon can update items" on items for update to anon using (true) with check (true);
create policy "anon can delete items" on items for delete to anon using (true);

-- procedures
alter table procedures enable row level security;
create policy "anon can read procedures" on procedures for select to anon using (true);
create policy "anon can insert procedures" on procedures for insert to anon with check (true);
create policy "anon can update procedures" on procedures for update to anon using (true) with check (true);
create policy "anon can delete procedures" on procedures for delete to anon using (true);

-- orders (DELETE policy 無し = DENY)
alter table orders enable row level security;
create policy "anon can read orders" on orders for select to anon using (true);
create policy "anon can insert orders" on orders for insert to anon with check (true);
create policy "anon can update orders" on orders for update to anon using (true) with check (true);
```

Storage の `item-photos` バケットは Supabase ダッシュボード → Storage → Policies で SELECT / INSERT / UPDATE / DELETE を anon に許可。

### 9.4 認証
未実装。導入する場合は Supabase Auth を利用し、`authenticated` ロールに権限を移すリファクタが必要。

---

## 10. デプロイ・運用

### 10.1 Vercel
- Production: `main` ブランチ
- Preview: 任意のブランチを push すると自動で Preview Deployment 作成

### 10.2 環境変数（Vercel）
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

両方とも Vercel ダッシュボードの Settings → Environment Variables に登録。

### 10.3 Supabase
- 無料プラン (Free) で運用中
- 想定負荷（依頼日 500 件規模）であれば無料枠で十分
- 自動バックアップ: Supabase が日次で自動取得（無料プランは 1 日分）

### 10.4 ブランチ運用
- 機能追加: `feature/xxx` で作業 → main へ `--no-ff` マージ
- 軽微な修正: main 直接コミット可
- `feature/*` ブランチはマージ後リモート / ローカルから削除する

---

## 11. ディレクトリ構成・ファイル責務

```
.
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Provider, Header, FloatingCartButton, CartModal, RoomSelectionModal をマウント
│   ├── page.tsx            # 物品検索ページ (SSR で items 取得)
│   ├── globals.css
│   ├── api/
│   │   ├── items/route.ts
│   │   ├── items/[code]/route.ts
│   │   ├── orders/route.ts
│   │   ├── orders/[id]/route.ts
│   │   └── procedures/route.ts
│   ├── status/
│   │   ├── page.tsx        # 受付状況
│   │   ├── [id]/page.tsx   # 依頼詳細
│   │   └── history/page.tsx # 履歴
│   └── settings/page.tsx
├── components/
│   ├── Header.tsx
│   ├── SearchClient.tsx
│   ├── CartModal.tsx
│   ├── FloatingCartButton.tsx
│   ├── QuantityDialog.tsx
│   ├── StatusClient.tsx
│   ├── DetailClient.tsx
│   ├── HistoryClient.tsx
│   ├── SettingsClient.tsx
│   ├── ItemMasterTab.tsx
│   ├── ProceduresTab.tsx
│   ├── ItemPhotoEditor.tsx
│   ├── ItemPhotoThumb.tsx
│   ├── PhotoLightbox.tsx
│   ├── RoomSelectionModal.tsx
│   └── providers.tsx
├── lib/
│   ├── types.ts            # ドメイン型定義
│   ├── db.ts               # orderStore (Supabase 経由)
│   ├── itemsDb.ts          # itemsCRUD + 全置換
│   ├── proceduresDb.ts     # proceduresCRUD + 全置換
│   ├── photoStore.ts       # 写真の保存・削除・URL 生成・圧縮
│   ├── normalize.ts        # 検索の正規化と AND 検索
│   ├── beep.ts             # アラーム再生制御
│   ├── csv.ts              # CSV 生成・ダウンロード
│   ├── pickingChecksStore.ts # ピッキングチェック状態の localStorage
│   ├── items.ts            # バンドルされたフォールバックマスタ
│   ├── useItems.ts         # クライアント側 items 取得 + Realtime 購読
│   ├── useProcedures.ts    # 同上 procedures
│   ├── supabaseBrowser.ts  # クライアント用 Supabase クライアント
│   └── supabaseServer.ts   # サーバー用 Supabase クライアント
├── public/
│   ├── sapurink_image.png  # ヘッダロゴ
│   └── sounds/
│       └── dq_levelup_10s.wav # 通知音
├── .env.local.example      # 環境変数のテンプレート
├── .gitignore
├── HANDOVER.md             # 本ドキュメント
├── README.md
├── next.config.mjs
├── package.json
├── postcss.config.js
├── tailwind.config.js
└── tsconfig.json
```

---

## 12. 既知の制約・運用上の注意

### 12.1 認証なし運用
- URL を知っていれば誰でも全機能を利用可能
- RLS で「削除はできない」「想定範囲を超えた操作はできない」という最低限の防御は敷いているが、入力データそのもの（依頼内容など）は誰でも自由に投入できる
- 本番運用時は認証を入れる前提

### 12.2 依頼の削除は不可
- UI 上からも、anon ロールでも、orders を削除できない
- 履歴は基本的に残り続ける
- 試運用中にテストデータが大量に溜まったら、Supabase 管理画面から直接 SQL で削除する

### 12.3 進行中案件は受付状況に残り続ける
- 削除できない以上、`requested` や `picking` のまま放置されると受付状況の上部に残る
- 過去日付の依頼でも、状態が完了していない限り表示される（運用上の整理が必要）

### 12.4 物品マスタは「全置換」のみ
- 部分更新は写真とメモのみ対応
- CSV インポートは全削除 → 全挿入だが、写真の `photo_path` は code をキーに引き継ぐ
- 写真自体は Storage 上で同一キー上書きされる

### 12.5 OP 室の識別はデバイスごと
- 各デバイスが「OP1」「OP2」など 1 つの部屋を表す（sessionStorage に保存）
- タブを閉じると忘れる → 次回開いたとき `RoomSelectionModal` で再選択
- 1 つのデバイスを複数 OP 室で共有する運用は想定外

### 12.6 ブラウザのオートプレイポリシー
- 通知音 ON ボタンの押下や `RoomSelectionModal` のタップが「ユーザー操作」として AudioContext のロックを解除
- 初回ロード後にユーザーが何も触らない状態だと音は鳴らない（モバイル特に厳格）

### 12.7 文字化け対応
- CSV エクスポートは UTF-8 BOM 付き
- Excel で開いても日本語が化けない設計

---

## 13. 今後の拡張提案

優先度高めから順に。

### 13.1 認証・ロール分離
- Supabase Auth 導入（メール、または院内 SSO 連携）
- ロール: `anon`（未使用化） / `operator` (OP 室) / `supply` (サプライ課) / `admin` (マスタ管理)
- RLS ポリシーを `authenticated` 向けに書き換え

### 13.2 OS Push 通知
- Web Push API + Service Worker
- アプリを閉じている / バックグラウンドでも通知を受け取れるようにする
- 特にサプライ課側の新規依頼通知に有効

### 13.3 配送完了の依頼元通知
- サプライ側で「配送完了」にすると、依頼元 OP 室のデバイスで通知音が鳴る
- 既に部分実装の経験あり（`DeliveryNotifier` コンポーネントの設計を再利用可能）
- RoomContext で各デバイスの所属 OP 室を識別し、Supabase Realtime で `room=eq.OP1` フィルタを使う

### 13.4 集計・分析
- 履歴データを使った診療科別 / 術式別 / 月次の物品消費レポート
- 受付からピッキング・配送までのリードタイム可視化
- Supabase の SQL Editor で集計、または BI ツール（Metabase, Looker Studio）連携

### 13.5 物品マスタの差分インポート
- 現状は全置換のみ
- 「特定の物品だけ追加 / 更新 / 削除」を扱える UI と API

### 13.6 国内クラウドへの移行（必要に応じて）
- Vercel と Supabase は両方とも米国系
- 院内 IT ポリシー次第では AWS Tokyo / Google Cloud Tokyo 等への移行が必要
- アプリ層は Docker 化可能、DB は Postgres 互換へ移行可能

### 13.7 PWA 化
- ホーム画面追加対応
- オフラインキャッシュ（マスタの読み取りまでは可能）

---

## 14. トラブルシュート

### 14.1 物品が検索に出ない
- 検索文字列に余計な空白や記号が入っていないか
- カテゴリフィルタが効いていないか
- normalize の仕様上、全角・半角・大小・ひらがな・カタカナは同一視されるはず

### 14.2 通知音が鳴らない
- 通知音 ON ボタンを少なくとも 1 回押したか
- ブラウザのサウンド設定が許可されているか
- OS のミュート設定
- `public/sounds/dq_levelup_10s.wav` が存在するか

### 14.3 写真が表示されない
- Supabase Storage の `item-photos` バケットが Public か
- ポリシーで SELECT が許可されているか
- items.photo_path に値が入っているか
- URL の `?v=` クエリ（updated_at）が付与されているか

### 14.4 Realtime が接続しない
- Supabase ダッシュボードで該当テーブルの Realtime が ON か
- RLS で SELECT が許可されているか
- ブラウザのコンソールで Realtime のエラーが出ていないか

### 14.5 依頼を送信できない
- 手術室が選択されているか（必須項目）
- カートが空でないか
- Supabase の Realtime / Postgres が正常稼働しているか
- ブラウザコンソール / Supabase の Logs を確認

### 14.6 CSV インポートが失敗する
- 列の見出しが想定（物品コード / 材料名 / 製品番号 / 棚番 / メモ / カテゴリ）に近いか
- 物品コードが数値か
- プレビュー画面の警告メッセージを確認

---

## 付録: 用語集

| 用語 | 説明 |
|---|---|
| OP 室 | 手術室。Operating Room。OP1 〜 OP10 |
| サプライ課 | 中央材料室。物品の管理・配送を担う部門 |
| ピッキング | 依頼に応じて物品を棚から取り出して準備する作業 |
| マスタ | 物品 / 診療科 / 術式 などの基礎データ |
| スナップショット | 依頼送信時点の物品情報を凍結保存したもの |
| RLS | Row Level Security。Postgres の行レベルアクセス制御 |
| anon キー | Supabase で「未認証ユーザー」が使う公開前提のキー（最新名称は publishable key） |

---

## 連絡先 / 参考リンク

- リポジトリ: GitHub（プライベート）
- 本番 URL: Vercel 上にデプロイ済み（URL は別途共有）
- Supabase ダッシュボード: 別途アカウント情報共有

質問・引き継ぎ事項があればプロジェクトオーナーに連絡。
