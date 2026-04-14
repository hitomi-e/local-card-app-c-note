# 地域密着デジタル名刺アプリ：要件定義書（MVP版）

## 1. プロジェクト概要
- **目的**: 地方の中小企業のデジタル化支援。名刺交換を「ただの記録」から「会話のきっかけ」に変える。
- **戦略**: 
  - フェーズA（個人用）: 自分一人が名刺を管理する機能を最優先で開発。
  - フェーズB（団体用）: 運用後に商工会議所などの団体契約向けに拡張。
- **ターゲット**: 広島県内の中小企業経営者・ビジネスパーソン。

## 2. 主要機能仕様（MVP範囲）

### 名刺登録・OCR
- **技術**: Google Cloud Vision API を使用。
- **精度**: 縦書き、デザイン名刺、ロゴ混じりへの対応を重視。
- **フロー**: カメラ撮影 → OCR解析 → 確認・修正画面 → 保存。

### AI会話支援・活動ログ
- **ニュース取得**: Yahoo!ニュース RSS (中国新聞セクション) + NewsData.io。
- **Dify連携**: 会社名や地域に基づいた「会話のネタ」を要約して提示。
- **音声メモ**: mp3/m4a形式の音声入力をAIが構造化して「フリーメモ」として保存。

### 閲覧・検索
- **3層UI**: 
  1. 上段（最優先）: 顔写真、名前、社名を大きく表示。
  2. 中段: 電話・MAP・Web・転送アイコンを配置。
  3. 下段: 趣味・特技・座右の銘をアコーディオン形式で収納。
- **MAP連携**: 名刺交換時のGPS座標から施設名をAI補完（Google Maps API）。

## 3. 技術スタック
- **Frontend**: Next.js (App Router), Tailwind CSS
- **Backend**: Supabase (Database / Auth / Storage)
- **Automation**: Dify, Make
- **API**: Google Cloud Vision, Google Maps, Yahoo!ニュース

## 4. デザインガイドライン
- **コンセプト**: 「シンプル・スタイリッシュ」。
- **カラー**: ベース #81d8d0（ブルーグリーン）、アクセントカラー（マスタードイエロー #E8B84B）。
- **アクセシビリティ**: 現場での使いやすさを重視し、ボタンなどのタッチターゲットを通常より20%大きく設計。

## 5. Supabase テーブル設計

### テーブル一覧

#### `profiles`（自分のデジタル名刺）
| カラム名 | 型 | 説明 |
|---|---|---|
| id | uuid PK | Supabase Auth の user.id と同じ値 |
| face_photo_url | text | 顔写真（Storage URL）|
| company_logo_url | text | 会社ロゴ（Storage URL）|
| company_name | text | 社名 |
| branch_office | text | 営業所 |
| department | text | 部署 |
| position | text | 役職 |
| full_name | text | 氏名 |
| name_reading | text | 氏名読み（ルビ）|
| postal_code | text | 郵便番号 |
| address | text | 住所 |
| company_phone | text | 会社電話番号 |
| extension | text | 内線番号 |
| mobile_phone | text | 携帯番号 |
| email | text | メールアドレス |
| website_url | text | WebサイトURL |
| sns_links | jsonb | SNSリンク群（複数対応）|
| business_description | text | 事業内容 |
| organizations | text[] | 所属団体（配列）|
| hobbies | text | 趣味 |
| skills | text | 特技 |
| motto | text | 座右の銘 |
| created_at | timestamptz | 作成日時 |
| updated_at | timestamptz | 更新日時 |

#### `contacts`（受け取った名刺帳）
| カラム名 | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| owner_id | uuid FK→auth.users | この名刺を持つユーザー |
| face_photo_url | text | |
| company_logo_url | text | |
| company_name | text | |
| branch_office | text | |
| department | text | |
| position | text | |
| full_name | text | |
| name_reading | text | |
| postal_code | text | |
| address | text | |
| company_phone | text | |
| extension | text | |
| mobile_phone | text | |
| email | text | |
| website_url | text | |
| sns_links | jsonb | |
| business_description | text | |
| organizations | text[] | |
| hobbies | text | |
| skills | text | |
| motto | text | |
| exchange_lat | numeric | 名刺交換場所の緯度 |
| exchange_lng | numeric | 名刺交換場所の経度 |
| exchange_location_name | text | AI補完の場所名（例：広島カンツリー倶楽部）|
| exchange_date | date | 名刺交換日 |
| source | text | 登録方法（'ocr' / 'qr' / 'manual'）|
| original_card_image_url | text | 撮影した名刺の画像URL |
| free_memo | text | フリーメモ（音声入力含む）|
| voice_memo_url | text | 音声ファイルURL |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### `categories`（カテゴリーマスター）
| カラム名 | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK→auth.users | |
| name | text | カテゴリー名 |
| color | text | 表示色（任意）|
| created_at | timestamptz | |

#### `contact_categories`（名刺↔カテゴリー 中間テーブル）
| カラム名 | 型 | 説明 |
|---|---|---|
| contact_id | uuid FK→contacts | 複合PK |
| category_id | uuid FK→categories | 複合PK |

#### `ai_news_cache`（AIニュースキャッシュ）
| カラム名 | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| company_name | text | 検索した会社名 |
| news_summary | text | AI要約テキスト |
| fetched_at | timestamptz | 取得日時 |
| expires_at | timestamptz | キャッシュ有効期限（24時間後）|

### RLS（行レベルセキュリティ）方針
- `profiles`：自分のレコードのみ読み書き可
- `contacts`：owner_id が自分のレコードのみ読み書き可
- `categories`：user_id が自分のレコードのみ読み書き可
- `ai_news_cache`：全ユーザー読み込み可（書き込みはサービスロールのみ）

### Supabase Storage バケット
- `avatars`：顔写真（公開）
- `logos`：会社ロゴ（公開）
- `business-cards`：撮影した名刺画像（非公開）
- `voice-memos`：音声ファイル（非公開）

## 6. 収益モデル
1. **メディア連携**: 中国新聞社等との提携。アプリ内記事引用と引き換えに広告収入。
2. **法人・団体契約**: 商工会議所・ライオンズクラブ等向け「デジタル会員証・会則・名簿」追加の月額契約。

## 7. 直近の目標
1. 身近な経営者（西条ヒルサイドゴルフ代表取締役）によるテスト運用とヒアリング
2. 中国新聞社・商工会議所・ライオンズクラブへの提携営業

## 8. 更新履歴
| 日付 | 内容 |
|---|---|
| 2026-04-14 | 初版作成（講師アドバイス反映・最終版）|
