/**
 * cards テーブルの Supabase 操作ユーティリティ
 * ページや Server Action からは直接 supabase.from('cards') を呼ばず、
 * このファイルの関数を経由すること（CLAUDE.md ルール準拠）
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Card, CardInsert, CardUpdate } from '@/types/cards';
import type { Profile } from '@/types/profile';
import { normalizeForComparison } from '@/lib/utils';

/**
 * 名刺を1件登録する
 */
export async function insertCard(
  supabase: SupabaseClient,
  data: CardInsert
): Promise<{ card: Card | null; error: string | null }> {
  const { data: card, error } = await supabase
    .from('cards')
    .insert(data)
    .select()
    .single();

  if (error) {
    return { card: null, error: `保存に失敗しました: ${error.message}` };
  }

  return { card, error: null };
}

/**
 * 自分の名刺一覧を取得する（作成日降順）
 */
export async function fetchCards(
  supabase: SupabaseClient
): Promise<{ cards: Card[]; error: string | null }> {
  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return { cards: [], error: `取得に失敗しました: ${error.message}` };
  }

  return { cards: data ?? [], error: null };
}

/**
 * 名刺を1件取得する
 */
export async function fetchCardById(
  supabase: SupabaseClient,
  id: string
): Promise<{ card: Card | null; error: string | null }> {
  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    return { card: null, error: `取得に失敗しました: ${error.message}` };
  }

  return { card: data, error: null };
}

/**
 * 名刺を更新する
 */
export async function updateCard(
  supabase: SupabaseClient,
  id: string,
  data: CardUpdate
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('cards')
    .update(data)
    .eq('id', id);

  if (error) {
    return { error: `更新に失敗しました: ${error.message}` };
  }

  return { error: null };
}

/**
 * デジタル名刺として登録する
 *
 * 相手の Profile データを cards テーブルに保存する。
 * face_photo_path を image_path に流用してサムネイルに使う。
 * source: 'digital' を付与してデジタル名刺として識別できるようにする。
 */
export async function insertDigitalCard(
  supabase: SupabaseClient,
  userId: string,
  profile: Profile,
  extra: { free_memo?: string; industry?: string | null } = {}
): Promise<{ card: Card | null; error: string | null }> {
  const data: CardInsert = {
    user_id:       userId,
    full_name:     profile.full_name,
    name_reading:  profile.name_reading,
    company_name:  profile.company_name,
    company_name_reading: profile.company_name_reading,
    industry:      extra.industry ?? profile.industry ?? null,
    branch_office: profile.branch_office,
    department:    profile.department,
    position:      profile.position,
    postal_code:   profile.postal_code,
    address:       profile.address,
    company_phone: profile.company_phone,
    extension:     null,
    mobile_phone:  profile.mobile_phone,
    email:         profile.email,
    website_url:   profile.website_url,
    image_path:    `profiles/${profile.id}/avatar.jpg`,  // 正規パス（face_photo_path の旧形式を無視）
    back_image_path: null,
    free_memo:     extra.free_memo ?? null,
    source:        'digital',
    source_user_id: profile.id,  // データ同期用：参照先ユーザーID
  };

  const { data: card, error } = await supabase
    .from('cards')
    .insert(data)
    .select()
    .single();

  if (error) {
    return { card: null, error: `保存に失敗しました: ${error.message}` };
  }

  return { card, error: null };
}

/**
 * 同一ユーザーの名刺帳に「同じ会社名 ＋ 同じ氏名」の組み合わせが存在するか確認する
 *
 * - NFKC 正規化（全角英数→半角）＋ スペース除去 ＋ 小文字化 で比較する
 * - 会社名が異なれば同姓同名でも「別の名刺」として扱う
 */
export async function checkDuplicateCard(
  supabase: SupabaseClient,
  userId: string,
  fullName: string | null,
  companyName: string | null
): Promise<{ id: string; full_name: string | null; company_name: string | null } | null> {
  const newKey =
    normalizeForComparison(companyName) + '|' + normalizeForComparison(fullName);

  // 会社名・氏名が両方とも空なら重複チェック不要
  if (newKey === '|') return null;

  const { data, error } = await supabase
    .from('cards')
    .select('id, full_name, company_name')
    .eq('user_id', userId);

  if (error || !data) return null;

  return (
    data.find((card) => {
      const existingKey =
        normalizeForComparison(card.company_name) + '|' + normalizeForComparison(card.full_name);
      return existingKey === newKey;
    }) ?? null
  );
}

/**
 * 名刺を削除する
 */
export async function deleteCard(
  supabase: SupabaseClient,
  id: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('cards')
    .delete()
    .eq('id', id);

  if (error) {
    return { error: `削除に失敗しました: ${error.message}` };
  }

  return { error: null };
}
