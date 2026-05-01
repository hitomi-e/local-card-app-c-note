# 地域密着デジタル名刺アプリ — プロジェクト専用ガイドライン

## プロジェクト概要
- **アプリ名**: 地域密着デジタル名刺アプリ（仮）
- **ターゲット**: 広島県内の中小企業経営者・ビジネスパーソン
- **要件定義書**: `docs/requirements.md` を参照
- **現在のフェーズ**: Phase 0 完了 → Phase 1（MVP開発）

## 技術スタック
| 役割 | 技術 |
|---|---|
| フロントエンド | Next.js 16（App Router）, Tailwind CSS v4 |
| データベース | Supabase（PostgreSQL）|
| 認証・ストレージ | Supabase Auth / Storage |
| AI会話支援 | Dify |
| 自動化 | Make（Integromat）|
| OCR | Google Cloud Vision API |
| 地図 | Google Maps API |
| ニュース取得 | Yahoo!ニュース RSS + NewsData.io |
| デプロイ | Vercel |

## ディレクトリ構成
```
src/
  app/
    (auth)/         # ログイン・サインアップページ
    (app)/          # アプリ本体（要認証）
      dashboard/    # 名刺一覧
      contacts/     # 名刺詳細・編集
      profile/      # 自分のデジタル名刺
      scan/         # OCR撮影
  components/
    ui/             # 共通UIパーツ（ボタン、モーダルなど）
    cards/          # 名刺関連コンポーネント
    search/         # 検索UI
  lib/
    supabase/       # Supabase クライアント（ここに集約）
    ocr/            # Google Vision API 呼び出し
    maps/           # Google Maps API 呼び出し
    dify/           # Dify API 呼び出し
  types/            # TypeScript 型定義
docs/
  requirements.md       # 要件定義書
  supabase_schema.sql   # Supabase テーブル作成SQL
```

## コーディングルール
- **コメントはすべて日本語**で記述する
- **APIキーは `.env.local` で管理**。コードに直書き厳禁
- **Supabase操作は `src/lib/supabase/` に集約**（ページから直接呼ばない）
- **コンポーネントは機能ごとに分割**（1ファイル1責務）
- **型定義は `src/types/` に集約**する
- タッチターゲットは **`min-h-[58px]` 以上**（通常より20%大）

## カラーテーマ（globals.css で定義済み）
- プライマリ: `--color-primary: #81d8d0`（ブルーグリーン）
- アクセント: `--color-accent: #E8B84B`（マスタードイエロー）
- Tailwindクラスでは `bg-[#81d8d0]`, `text-[#E8B84B]` のように使用

## 作業ルール
- **新しい機能の追加前は必ず `/plan` で承認を得る**
- 各フェーズ完了後に動作確認チェックリストを実施する
- エラーは原因を特定してから修正（推測で直さない）
- 不明点は勝手に進めず、ユーザーに質問する

## 環境変数一覧（.env.local）
```
NEXT_PUBLIC_SUPABASE_URL          # Supabase プロジェクトURL
NEXT_PUBLIC_SUPABASE_ANON_KEY     # Supabase 匿名キー
SUPABASE_SERVICE_ROLE_KEY         # Supabase サービスロールキー（サーバーのみ）
GOOGLE_VISION_API_KEY             # OCR用（サーバーのみ）
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY   # 地図表示用（クライアント可）
DIFY_API_KEY                      # Dify API キー（サーバーのみ）
DIFY_BASE_URL                     # Dify ベースURL
NEWSDATA_API_KEY                  # NewsData.io キー（サーバーのみ）
```

## Supabase テーブル構成
| テーブル | 役割 |
|---|---|
| `profiles` | 自分のデジタル名刺情報 |
| `contacts` | 受け取った名刺帳（GPS・交換場所含む）|
| `categories` | カテゴリーマスター |
| `contact_categories` | 名刺とカテゴリーの中間テーブル |
| `ai_news_cache` | AIニュース要約キャッシュ（24時間）|

## 開発フェーズ
- **Phase 0**（完了）: 環境構築・テーブル設計
- **Phase 1**（進行中）: MVP — 名刺登録・OCR・一覧・カテゴリー・検索
- **Phase 2**: AI機能 — QRコード・Dify連携・音声メモ・重複検知
- **Phase 3**: 検索強化 — 顔写真スワイプ・MAP連携
- **Phase 4**: 法人・収益化対応
