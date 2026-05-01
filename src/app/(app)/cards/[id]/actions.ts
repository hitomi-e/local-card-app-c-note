'use server';

import { createClient } from '@/lib/supabase/server';
import { deleteCard } from '@/lib/supabase/cards';
import { deleteCardImage } from '@/lib/supabase/storage';

/**
 * 名刺を削除する Server Action
 *
 * 処理順:
 *   1. 認証確認
 *   2. image_path を取得（Storage 画像の削除に必要）
 *   3. Storage から画像を削除（失敗しても DB 削除は続行）
 *   4. cards テーブルから削除
 *
 * 戻り値:
 *   成功 → { ok: true }
 *   失敗 → { error: string }
 */
export async function deleteCardAction(
  id: string
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();

  // 認証確認
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'ログインセッションが切れました。再度ログインしてください。' };
  }

  // image_path を取得（Storage からも削除するため）
  const { data: card } = await supabase
    .from('cards')
    .select('image_path')
    .eq('id', id)
    .single();

  // Storage 画像を削除（失敗してもスキップして DB 削除を続行）
  if (card?.image_path) {
    const { error: storageError } = await deleteCardImage(supabase, card.image_path);
    if (storageError) {
      console.warn('[deleteCardAction] Storage 画像削除失敗（スキップ）:', storageError);
    }
  }

  // DB から削除
  const { error } = await deleteCard(supabase, id);
  if (error) {
    console.error('[deleteCardAction] DB 削除エラー:', error);
    return { error };
  }

  console.log('[deleteCardAction] 削除成功 id:', id);
  return { ok: true };
}
