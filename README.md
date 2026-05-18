# サプリンク

> 物品オーダーシステム / Sapurink

手術室（OP 室）の看護師がサプライ課（中央材料室）へ手術用物品を依頼するための Web アプリ。Next.js 15 + Supabase をベースに、スマートフォン中心で運用できる UI で構築。

**詳細な機能仕様・データモデル・API・運用ポリシー・引き継ぎ情報は [HANDOVER.md](./HANDOVER.md) を参照してください。**

## 技術スタック

- Next.js 15 (App Router) + TypeScript + React 19
- Tailwind CSS / lucide-react
- Supabase（Postgres + Realtime + Storage）
- Vercel デプロイ

## クイックスタート

```bash
git clone <repo-url>
cd <repo>
npm install
cp .env.local.example .env.local
# .env.local を編集して Supabase の URL と publishable (anon) key を貼る
npm run dev
# http://localhost:3000
```

必須の環境変数:

| 変数名 | 取得元 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase ダッシュボード → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase ダッシュボード → Settings → API → publishable key |

Supabase 側の初期セットアップ（テーブル作成、RLS ポリシー設定、Storage バケット作成）は [HANDOVER.md の 9 章](./HANDOVER.md#9-セキュリティrls) を参照。

## 動作確認の流れ

1. ブラウザ A（手術室側）で `/` を開く → 初回モーダルで手術室を選択
2. 物品を検索 → 数量入力 → カートへ追加
3. 右下のフローティングカートからモーダルを開き、配送依頼を送信
4. ブラウザ B（サプライ課側）で `/status` を開く → 「通知音 ON」をクリック
5. ブラウザ A から依頼を送ると、ブラウザ B にカードが追加されアラームが鳴る
6. ピッキング開始 → 全物品チェック → 配送完了で履歴に積まれる

## ディレクトリ概要

| パス | 役割 |
|---|---|
| `app/` | Next.js App Router のページと API |
| `components/` | クライアントコンポーネント |
| `lib/` | データアクセス、型定義、ユーティリティ |
| `public/sounds/` | 通知音 (WAV) |

ファイル単位の責務は [HANDOVER.md の 11 章](./HANDOVER.md#11-ディレクトリ構成ファイル責務) を参照。

## デプロイ

Vercel に main ブランチを push すると自動デプロイされる。環境変数は Vercel ダッシュボードの Environment Variables に登録する（`.env.local` は Git 管理外）。
