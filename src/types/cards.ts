// cards テーブル・categories テーブルの TypeScript 型定義

export type Card = {
  id: string;
  user_id: string;

  // 会社情報
  company_name: string | null;
  company_name_reading: string | null;  // 会社名（ふりがな）
  industry: string | null;              // 業種
  branch_office: string | null;         // 営業所
  department: string | null;            // 部署
  position: string | null;              // 役職

  // 個人情報
  full_name: string | null;      // 名前
  name_reading: string | null;   // 名前（ふりがな）

  // 連絡先
  postal_code: string | null;    // 郵便番号
  address: string | null;        // 住所
  company_phone: string | null;  // 会社電話番号
  extension: string | null;      // 内線番号
  mobile_phone: string | null;   // 携帯電話番号
  email: string | null;          // メールアドレス
  website_url: string | null;    // WebサイトURL

  // メモ
  free_memo: string | null;      // フリーメモ

  // 画像
  image_path:      string | null;  // Storage 内の表面画像パス（例: {userId}/{timestamp}.jpg）
  back_image_path: string | null;  // Storage 内の裏面画像パス（任意）

  // 登録元（省略時は DB DEFAULT 'paper' が適用される）
  source?: 'paper' | 'digital' | 'manual';

  // デジタル名刺の参照先ユーザーID（source='digital' の場合のみ。データ同期に使用）
  source_user_id?: string | null;

  // タイムスタンプ（Supabase が自動設定）
  created_at: string;
  updated_at: string;
};

// 新規登録用（id・タイムスタンプは DB が自動生成）
export type CardInsert = Omit<Card, 'id' | 'created_at' | 'updated_at'>;

// 更新用（id・user_id・タイムスタンプは変更不可）
export type CardUpdate = Partial<Omit<Card, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

// cards_categories 中間テーブルの型定義
export type CardCategory = {
  card_id: string;
  category_id: string;
};

// categories テーブルの型定義
export type Category = {
  id: string;
  user_id: string;
  name: string;
  color: string;         // デフォルト '#81d8d0'
  created_at: string;
};

// カード一覧取得時にカテゴリー情報を含めた型
export type CardWithCategories = Card & {
  cards_categories: { category_id: string }[];
};
