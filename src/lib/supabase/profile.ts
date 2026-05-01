/**
 * profiles テーブルの操作ユーティリティ
 * profiles 行はユーザー新規登録時に DB トリガーで自動作成されるため、
 * INSERT ではなく常に UPDATE（upsert）を使う。
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile } from '@/types/profile';

/**
 * ログインユーザーのプロフィールを取得する
 * 行が存在しない場合は null を返す（通常は自動作成済みのため発生しない）
 */
export async function fetchProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<{ profile: Profile | null; error: string | null }> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    // PGRST116: 行が見つからない（新規ユーザーで稀に発生）
    if (error.code === 'PGRST116') return { profile: null, error: null };
    return { profile: null, error: error.message };
  }

  // sns_links / organizations が null の場合はデフォルト値に変換
  const profile: Profile = {
    ...data,
    sns_links:     data.sns_links     ?? [],
    organizations: data.organizations ?? [],
  };

  return { profile, error: null };
}

/**
 * プロフィールを更新する（行が存在しない場合は挿入）
 */
export async function upsertProfile(
  supabase: SupabaseClient,
  userId: string,
  data: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...data }, { onConflict: 'id' });

  if (error) {
    // RLS ポリシー違反は専用メッセージで案内
    const msg = error.message.toLowerCase().includes('row-level security')
      ? 'プロフィールの保存権限がありません。Supabase の RLS ポリシー（profiles テーブル）を確認してください。'
      : error.message;
    return { error: msg };
  }
  return { error: null };
}
