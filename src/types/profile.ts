// profiles テーブルの TypeScript 型定義

/** SNS リンクの1件 */
export type SnsLink = {
  type: 'X' | 'Instagram' | 'Facebook' | 'LinkedIn' | 'LINE' | 'YouTube' | 'other';
  url: string;
};

/** profiles テーブルの型 */
export type Profile = {
  id: string;  // = auth.users(id)

  // 顔写真
  face_photo_path: string | null;  // Supabase Storage パス（署名付きURLを都度発行）

  // 会社ロゴ
  company_logo_path: string | null;  // Supabase Storage パス

  // 会社情報
  company_name:         string | null;
  company_name_reading: string | null;  // 会社名ふりがな
  industry:             string | null;  // 業種
  branch_office:        string | null;
  department:           string | null;
  position:             string | null;

  // 個人情報
  full_name:    string | null;  // 氏名
  name_reading: string | null;  // 氏名ふりがな

  // 連絡先
  postal_code:  string | null;
  address:      string | null;
  company_phone: string | null;
  extension:    string | null;
  mobile_phone: string | null;
  email:        string | null;
  website_url:  string | null;

  // SNS（JSONB 配列）
  sns_links: SnsLink[];

  // ビジネス詳細
  business_description: string | null;  // 事業内容
  business_hours:       string | null;  // 営業時間
  regular_holiday:      string | null;  // 定休日
  menus:                string | null;  // メニュー・サービス

  // 所属団体（最大5件の配列）
  organizations: string[];

  // パーソナル情報
  hobbies: string | null;  // 趣味
  skills:  string | null;  // 特技
  motto:   string | null;  // 座右の銘

  // タイムスタンプ
  created_at: string;
  updated_at: string;
};
