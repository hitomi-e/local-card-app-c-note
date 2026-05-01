/**
 * Supabase Storage ユーティリティ
 * 名刺画像のアップロード・取得・削除を担当
 * バケット: business-cards（非公開・RLS 有効）
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/** バケット名定数 */
export const CARD_IMAGES_BUCKET = 'business-cards';

/** 許可する画像拡張子 */
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic'] as const;

/** アップロード上限サイズ（10MB） */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * ストレージ内のファイルパスを生成する
 * 形式: {userId}/{タイムスタンプ}.{拡張子}
 * RLS ポリシーが storage.foldername(name)[1] = user_id を要求するため
 * 必ず userId をフォルダ名にすること
 */
export function generateCardImagePath(userId: string, file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const timestamp = Date.now();
  return `${userId}/${timestamp}.${ext}`;
}

/**
 * ファイルのバリデーション（拡張子・サイズ）
 */
export function validateCardImageFile(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    return `対応していないファイル形式です（対応形式: ${ALLOWED_EXTENSIONS.join(', ')}）`;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `ファイルサイズが大きすぎます（上限: 10MB）`;
  }
  return null;
}

/**
 * 名刺画像をアップロードする
 * @param supabase - Supabase クライアント（ブラウザ/サーバー どちらでも可）
 * @param userId   - 認証中のユーザー ID
 * @param file     - アップロードするファイル
 * @returns path（保存先パス）または error メッセージ
 */
export async function uploadCardImage(
  supabase: SupabaseClient,
  userId: string,
  file: File
): Promise<{ path: string | null; error: string | null }> {
  // バリデーション
  const validationError = validateCardImageFile(file);
  if (validationError) {
    return { path: null, error: validationError };
  }

  const path = generateCardImagePath(userId, file);

  const { error } = await supabase.storage
    .from(CARD_IMAGES_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false, // 同名ファイルの上書きを禁止
    });

  if (error) {
    return { path: null, error: `アップロードに失敗しました: ${error.message}` };
  }

  return { path, error: null };
}

/**
 * 名刺画像の署名付き URL を取得する（有効期限: デフォルト 1 時間）
 * 非公開バケットのため、表示の都度署名付き URL を発行する必要がある
 * @param supabase   - Supabase クライアント
 * @param path       - ストレージ内のファイルパス
 * @param expiresIn  - 有効期限（秒）デフォルト 3600 秒 = 1 時間
 */
export async function getCardImageSignedUrl(
  supabase: SupabaseClient,
  path: string,
  expiresIn = 3600
): Promise<{ url: string | null; error: string | null }> {
  const { data, error } = await supabase.storage
    .from(CARD_IMAGES_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    return { url: null, error: `URL の取得に失敗しました: ${error?.message}` };
  }

  return { url: data.signedUrl, error: null };
}

/**
 * 名刺画像を削除する
 * @param supabase - Supabase クライアント
 * @param path     - ストレージ内のファイルパス
 */
export async function deleteCardImage(
  supabase: SupabaseClient,
  path: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.storage
    .from(CARD_IMAGES_BUCKET)
    .remove([path]);

  if (error) {
    return { error: `削除に失敗しました: ${error.message}` };
  }

  return { error: null };
}

// ─────────────────────────────────────────────────────────────
// 顔写真（プロフィール用）
// ─────────────────────────────────────────────────────────────

/**
 * 顔写真を Supabase Storage にアップロードする
 * パス: profiles/{userId}/avatar.{ext}
 * 同バケット（business-cards）を利用、upsert: true で上書き可能。
 */
export async function uploadProfilePhoto(
  supabase: SupabaseClient,
  userId: string,
  file: File
): Promise<{ path: string | null; error: string | null }> {
  const validationError = validateCardImageFile(file);
  if (validationError) return { path: null, error: validationError };

  const rawExt = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  // .jpeg と .jpg を統一（既存データとのパス不一致を防ぐ）
  const ext  = rawExt === 'jpeg' ? 'jpg' : rawExt;
  const path = `profiles/${userId}/avatar.${ext}`;

  const { error } = await supabase.storage
    .from(CARD_IMAGES_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: true });

  if (error) {
    // RLS ポリシー違反は専用メッセージで案内（Supabase ダッシュボードでの設定が必要）
    const msg = error.message.toLowerCase().includes('row-level security')
      ? '顔写真の保存権限がありません。Supabase Storage の RLS ポリシー（profiles フォルダ）を設定してください。'
      : `顔写真のアップロードに失敗しました: ${error.message}`;
    return { path: null, error: msg };
  }

  return { path, error: null };
}

/**
 * 会社ロゴを Supabase Storage にアップロードする
 * パス: profiles/{userId}/logo.{ext}
 * upsert: true で上書き可能。
 */
export async function uploadCompanyLogo(
  supabase: SupabaseClient,
  userId: string,
  file: File
): Promise<{ path: string | null; error: string | null }> {
  const validationError = validateCardImageFile(file);
  if (validationError) return { path: null, error: validationError };

  const rawExt = file.name.split('.').pop()?.toLowerCase() ?? 'png';
  const ext  = rawExt === 'jpeg' ? 'jpg' : rawExt;
  const path = `profiles/${userId}/logo.${ext}`;

  const { error } = await supabase.storage
    .from(CARD_IMAGES_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: true });

  if (error) {
    return { path: null, error: `ロゴのアップロードに失敗しました: ${error.message}` };
  }

  return { path, error: null };
}

/**
 * デジタル名刺の顔写真 — 正規ストレージパスを返す
 * 形式: profiles/{userId}/avatar.jpg
 * 実ファイルが .jpeg の場合は getJpegAlternativePath でフォールバックすること
 */
export function getCanonicalProfilePhotoPath(userId: string): string {
  return `profiles/${userId}/avatar.jpg`;
}

/**
 * JPEG 拡張子の代替パスを返す（.jpg ↔ .jpeg の切り替え）
 * 既存データの拡張子不一致をフォールバックで救済するために使用する
 * 対象外（.png / .webp など）の場合は null を返す
 */
export function getJpegAlternativePath(path: string): string | null {
  if (path.endsWith('.jpg'))  return path.slice(0, -4)  + '.jpeg';
  if (path.endsWith('.jpeg')) return path.slice(0, -5) + '.jpg';
  return null;
}

/**
 * 名刺画像の公開 URL を取得する（バケットが Public 設定の場合のみ機能）
 * 署名付きURL の代替フォールバックとして使用する。
 * ※ Private バケットの場合はブラウザで 400/403 になるため注意
 */
export function getCardImagePublicUrl(
  supabase: SupabaseClient,
  path: string
): string {
  const { data } = supabase.storage
    .from(CARD_IMAGES_BUCKET)
    .getPublicUrl(path);
  return data.publicUrl;
}

/**
 * バケットの疎通確認（接続テスト用）
 * バケットが存在してアクセス可能かどうかを返す
 * @param supabase - Supabase クライアント（サーバー側推奨）
 */
export async function checkStorageConnection(
  supabase: SupabaseClient
): Promise<{ ok: boolean; message: string }> {
  const { data, error } = await supabase.storage
    .from(CARD_IMAGES_BUCKET)
    .list('', { limit: 1 });

  if (error) {
    return { ok: false, message: `接続エラー: ${error.message}` };
  }

  return {
    ok: true,
    message: `"${CARD_IMAGES_BUCKET}" バケットに正常に接続できました（ファイル数: ${data?.length ?? 0} 件確認）`,
  };
}
