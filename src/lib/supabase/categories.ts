/**
 * categories テーブルの Supabase 操作ユーティリティ
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Category } from '@/types/cards';

/**
 * 自分のカテゴリー一覧を取得する（作成日昇順）
 */
export async function fetchCategories(
  supabase: SupabaseClient
): Promise<{ categories: Category[]; error: string | null }> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    return { categories: [], error: `取得に失敗しました: ${error.message}` };
  }

  return { categories: data ?? [], error: null };
}

/**
 * カテゴリーごとの使用枚数を取得し、使用頻度の多い順に並び替えたカテゴリー一覧を返す
 *
 * ダッシュボード・フォームで「よく使うカテゴリー」を先頭に表示するために使用
 */
export async function fetchCategoriesByUsage(
  supabase: SupabaseClient
): Promise<{ categories: (Category & { usage: number })[]; error: string | null }> {
  // カテゴリー一覧を取得
  const { data: cats, error: catError } = await supabase
    .from('categories')
    .select('*')
    .order('created_at', { ascending: true });

  if (catError) {
    return { categories: [], error: `取得に失敗しました: ${catError.message}` };
  }

  // 各カテゴリーの使用枚数を取得（cards_categories を集計）
  const { data: usage, error: usageError } = await supabase
    .from('cards_categories')
    .select('category_id');

  if (usageError) {
    // 使用枚数が取得できなくても、カテゴリーは返す
    console.warn('[fetchCategoriesByUsage] 使用枚数取得失敗:', usageError.message);
    return {
      categories: (cats ?? []).map((c) => ({ ...c, usage: 0 })),
      error: null,
    };
  }

  // category_id ごとに使用枚数を集計
  const countMap: Record<string, number> = {};
  for (const row of usage ?? []) {
    countMap[row.category_id] = (countMap[row.category_id] ?? 0) + 1;
  }

  // 使用枚数を付加し、多い順 → 作成日順 でソート
  const withUsage = (cats ?? []).map((c) => ({
    ...c,
    usage: countMap[c.id] ?? 0,
  }));

  withUsage.sort((a, b) => {
    if (b.usage !== a.usage) return b.usage - a.usage; // 使用頻度の多い順
    return a.created_at.localeCompare(b.created_at);   // 同率は作成日昇順
  });

  return { categories: withUsage, error: null };
}

/**
 * 新しいカテゴリーを作成する
 *
 * @returns 作成したカテゴリー（エラー時は null）
 */
export async function createCategory(
  supabase: SupabaseClient,
  name: string,
  color: string
): Promise<{ category: Category | null; error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { category: null, error: '認証が必要です' };
  }

  const { data, error } = await supabase
    .from('categories')
    .insert({ user_id: user.id, name, color })
    .select()
    .single();

  if (error) {
    return { category: null, error: `作成に失敗しました: ${error.message}` };
  }

  return { category: data as Category, error: null };
}
