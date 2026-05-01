// 認証関連の型定義

/** ログインフォームの入力値 */
export type LoginFormData = {
  email: string;
  password: string;
};

/** サインアップフォームの入力値 */
export type SignupFormData = {
  email: string;
  password: string;
  confirmPassword: string;
};

/** Server Action の共通戻り値 */
export type AuthActionResult = {
  /** エラーメッセージ（undefined = 成功） */
  error?: string;
};

/** サインアップ専用の戻り値（メール送信完了フラグ付き） */
export type SignupActionResult = {
  error?: string;
  /** true = 確認メール送信完了（または即時ログイン成功） */
  success?: boolean;
  /** true = Supabase がセッションを即座に作成（メール確認不要設定時） */
  sessionCreated?: boolean;
};
