'use server';

/**
 * カテゴリー関連の Server Actions
 *
 * Client Component（CategorySelector）から呼び出す。
 */

import { createClient } from '@/lib/supabase/server';

/**
 * カテゴリーの色を変更する
 * セキュリティ: user_id 一致チェックで他ユーザーのカテゴリーを変更できないようにする
 */
export async function updateCategoryColorAction(
  categoryId: string,
  color: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: '認証が必要です' };
  }

  const { error } = await supabase
    .from('categories')
    .update({ color })
    .eq('id', categoryId)
    .eq('user_id', user.id); // 自分のカテゴリーのみ更新可能

  if (error) {
    console.error('[updateCategoryColorAction] 色変更エラー:', error.message);
    return { ok: false, error: error.message };
  }

  console.log('[updateCategoryColorAction] 色変更成功 id:', categoryId, 'color:', color);
  return { ok: true };
}
