'use server';

/**
 * デジタル名刺 受け取り確認ページ — Server Action
 *
 * フォームデータから:
 *   - target_user_id: 受け取る相手のユーザーID
 *   - overwrite_card_id: 上書き対象の名刺ID（重複時のみ）
 *   - free_memo: 自由メモ
 *   - category_ids: 選択済みカテゴリーID（複数可）
 *   - new_category_name / new_category_color: 新規カテゴリー（複数可）
 */

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { fetchProfile } from '@/lib/supabase/profile';
import { insertDigitalCard, updateCard } from '@/lib/supabase/cards';
import { createCategory } from '@/lib/supabase/categories';

export type ConfirmFormState = {
  error?: string;
  ok?: boolean;
};

export async function saveDigitalCardAction(
  _prevState: ConfirmFormState,
  formData: FormData
): Promise<ConfirmFormState> {
  // 認証確認
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: 'ログインセッションが切れました。再度ログインしてください。' };
  }

  const targetUserId    = (formData.get('target_user_id')    as string)?.trim();
  const overwriteCardId = (formData.get('overwrite_card_id') as string)?.trim() || null;
  const freeMemo        = (formData.get('free_memo')         as string)?.trim() || null;
  const industry        = (formData.get('industry')          as string)?.trim() || null;
  const rawCategoryIds  = formData.getAll('category_ids') as string[];
  const rawNewNames     = formData.getAll('new_category_name') as string[];

  console.log('[saveDigitalCardAction] 受信データ:', {
    targetUserId, overwriteCardId,
    category_ids: rawCategoryIds,
    new_category_name: rawNewNames,
  });

  if (!targetUserId) return { error: '対象ユーザーIDが不正です。' };

  // サービスロールで相手のプロフィールを取得（RLSバイパス）
  const serviceClient = createServiceClient();
  const { profile, error: profileError } = await fetchProfile(serviceClient, targetUserId);
  if (profileError || !profile) {
    return { error: 'プロフィールの取得に失敗しました。' };
  }

  // 新規カテゴリーを作成
  const newCategoryNames  = (formData.getAll('new_category_name')  as string[]).map(s => s.trim()).filter(Boolean);
  const newCategoryColors = formData.getAll('new_category_color') as string[];
  const newlyCreatedIds: string[] = [];

  for (let i = 0; i < newCategoryNames.length; i++) {
    const name  = newCategoryNames[i];
    const color = newCategoryColors[i] || '#81d8d0';
    const { category, error: catError } = await createCategory(supabase, name, color);
    if (catError) return { error: `カテゴリー「${name}」の作成に失敗しました。` };
    if (category) newlyCreatedIds.push(category.id);
  }

  const categoryIds = [
    ...(formData.getAll('category_ids') as string[]),
    ...newlyCreatedIds,
  ].filter(Boolean);

  let cardId: string;

  if (overwriteCardId) {
    // ── 上書きモード（スマートマージ）──────────────────────────────
    // 既存カードのメモを取得してから合体する
    const { data: existing, error: fetchError } = await supabase
      .from('cards')
      .select('free_memo')
      .eq('id', overwriteCardId)
      .single();

    if (fetchError) {
      console.warn('[saveDigitalCardAction] 既存カード取得失敗（メモ合体スキップ）:', fetchError.message);
    }

    // フリーメモの合体ロジック（既存末尾に追記。重複追記は防止）
    const existingMemo = existing?.free_memo?.trim() ?? '';
    const newMemo      = freeMemo?.trim() ?? '';
    let mergedMemo: string | null;
    if (!existingMemo && !newMemo) {
      mergedMemo = null;
    } else if (!existingMemo) {
      mergedMemo = newMemo || null;
    } else if (!newMemo || existingMemo === newMemo || existingMemo.includes(newMemo)) {
      mergedMemo = existingMemo;
    } else {
      mergedMemo = `${existingMemo}\n${newMemo}`;
    }

    const { error: updateError } = await updateCard(supabase, overwriteCardId, {
      full_name:            profile.full_name,
      name_reading:         profile.name_reading,
      company_name:         profile.company_name,
      company_name_reading: profile.company_name_reading,
      industry:             industry ?? profile.industry,
      branch_office:        profile.branch_office,
      department:           profile.department,
      position:             profile.position,
      postal_code:          profile.postal_code,
      address:              profile.address,
      company_phone:        profile.company_phone,
      mobile_phone:         profile.mobile_phone,
      email:                profile.email,
      website_url:          profile.website_url,
      image_path:           `profiles/${profile.id}/avatar.jpg`,
      free_memo:            mergedMemo,
      source:               'digital',
      source_user_id:       profile.id,
    });
    if (updateError) return { error: updateError };
    cardId = overwriteCardId;

    console.log('[saveDigitalCardAction] 上書き完了 cardId:', cardId, '/ memo合体:', !!mergedMemo);

    // カテゴリーは「維持＋追記」— 既存を削除せず、未登録のものだけ追加
    if (categoryIds.length > 0) {
      const { data: existingCats } = await supabase
        .from('cards_categories')
        .select('category_id')
        .eq('card_id', cardId);

      const existingCatIds = new Set((existingCats ?? []).map((r: { category_id: string }) => r.category_id));
      const newRows = categoryIds
        .filter((cid) => !existingCatIds.has(cid))
        .map((category_id) => ({ card_id: cardId, category_id }));

      if (newRows.length > 0) {
        const { error: catLinkError } = await supabase.from('cards_categories').insert(newRows);
        if (catLinkError) {
          console.warn('[saveDigitalCardAction] カテゴリー追記エラー:', catLinkError.message);
        } else {
          console.log('[saveDigitalCardAction] カテゴリー追記成功:', newRows.length, '件');
        }
      } else {
        console.log('[saveDigitalCardAction] 追記すべき新カテゴリーなし');
      }
    }
  } else {
    // ── 新規保存 ──────────────────────────────────────────────────
    const { card, error: insertError } = await insertDigitalCard(
      supabase, user.id, profile, { free_memo: freeMemo ?? undefined, industry }
    );
    if (insertError || !card) return { error: insertError ?? '保存に失敗しました。' };
    cardId = card.id;

    console.log('[saveDigitalCardAction] 新規保存完了 cardId:', cardId, '/ カテゴリーID数:', categoryIds.length);

    // 新規の場合はそのまま全カテゴリーを紐付け
    if (categoryIds.length > 0) {
      const rows = categoryIds.map((category_id) => ({ card_id: cardId, category_id }));
      const { error: catLinkError } = await supabase.from('cards_categories').insert(rows);
      if (catLinkError) {
        console.error('[saveDigitalCardAction] カテゴリー紐付けエラー:', catLinkError.message);
      } else {
        console.log('[saveDigitalCardAction] カテゴリー紐付け成功:', categoryIds.length, '件');
      }
    } else {
      console.log('[saveDigitalCardAction] カテゴリーなし — 紐付けスキップ');
    }
  }

  return { ok: true };
}
