/**
 * 文字列ユーティリティ
 */

/**
 * 重複チェック用の文字列正規化
 *
 * 1. NFKC 正規化 — 全角英数・全角カタカナ → 半角に統一
 *    （例: "Ａ" → "A"、"テスト" → "ﾃｽﾄ"、"１２３" → "123"）
 * 2. 全空白を除去 — 全角スペース（U+3000）・半角スペース・タブ等を削除
 *    （例: "田中　太郎" = "田中 太郎" → "田中太郎"）
 * 3. 小文字化 — 大文字・小文字を区別しない
 *    （例: "Tanaka" → "tanaka"）
 */
export function normalizeForComparison(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .normalize('NFKC')
    .replace(/[\s　]+/g, '')
    .toLowerCase();
}
