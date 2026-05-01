'use server';

import { createClient } from '@/lib/supabase/server';
import { updateCard } from '@/lib/supabase/cards';
import { createCategory } from '@/lib/supabase/categories';
import type { CardUpdate } from '@/types/cards';

export type EditFormState = {
  error?: string;
  ok?: boolean;
};

/** FormData の空文字列を null に変換するヘルパー */
function toNullable(formData: FormData, key: string): string | null {
  const value = (formData.get(key) as string)?.trim();
  return value || null;
}

/** 電話番号・郵便番号：数字のみ保存（ハイフン等を除去） */
function toDigitsOnly(formData: FormData, key: string): string | null {
  const value = (formData.get(key) as string)?.trim();
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  return digits || null;
}

/**
 * 名刺を更新する Server Action
 *
 * bind() 経由で cardId を受け取る（Next.js 公式パターン）:
 *   const boundAction = updateCardAction.bind(null, cardId);
 *   useActionState(boundAction, initialState)
 *
 * カテゴリーは「全削除→再挿入」方式で差分更新する。
 * 新規カテゴリーがあれば先に作成してから紐付ける。
 */
export async function updateCardAction(
  cardId: string,
  _prevState: EditFormState,
  formData: FormData
): Promise<EditFormState> {
  const supabase = await createClient();

  // 認証確認
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'ログインセッションが切れました。再度ログインしてください。' };
  }

  const cardData: CardUpdate = {
    // 会社情報
    company_name:         toNullable(formData, 'company_name'),
    company_name_reading: toNullable(formData, 'company_name_reading'),
    industry:             toNullable(formData, 'industry'),
    branch_office:        toNullable(formData, 'branch_office'),
    department:           toNullable(formData, 'department'),
    position:             toNullable(formData, 'position'),
    // 個人情報
    full_name:    toNullable(formData, 'full_name'),
    name_reading: toNullable(formData, 'name_reading'),
    // 連絡先（電話番号・郵便番号は数字のみ保存）
    postal_code:   toDigitsOnly(formData, 'postal_code'),
    address:       toNullable(formData, 'address'),
    company_phone: toDigitsOnly(formData, 'company_phone'),
    extension:     toDigitsOnly(formData, 'extension'),
    mobile_phone:  toDigitsOnly(formData, 'mobile_phone'),
    email:         toNullable(formData, 'email'),
    website_url:   toNullable(formData, 'website_url'),
    // メモ
    free_memo: toNullable(formData, 'free_memo'),
  };

  // 会社名または名前のいずれかは必須
  if (!cardData.company_name && !cardData.full_name) {
    return { error: '「会社名」または「名前」のいずれかを入力してください。' };
  }

  // ── 新規カテゴリーの作成（複数対応）──
  const newCategoryNames  = (formData.getAll('new_category_name')  as string[]).map((s) => s.trim()).filter(Boolean);
  const newCategoryColors = formData.getAll('new_category_color') as string[];

  const newlyCreatedIds: string[] = [];
  for (let i = 0; i < newCategoryNames.length; i++) {
    const name  = newCategoryNames[i];
    const color = newCategoryColors[i] || '#81d8d0';
    const { category, error: catError } = await createCategory(supabase, name, color);
    if (catError) {
      return { error: `カテゴリー「${name}」の作成に失敗しました: ${catError}` };
    }
    if (category) newlyCreatedIds.push(category.id);
  }

  // ── 名刺の基本情報を更新 ──
  const { error } = await updateCard(supabase, cardId, cardData);
  if (error) {
    console.error('[updateCardAction] updateCard エラー:', error);
    return { error };
  }

  // ── カテゴリーを差分更新（全削除 → 再挿入）──
  const { error: deleteError } = await supabase
    .from('cards_categories')
    .delete()
    .eq('card_id', cardId);

  if (deleteError) {
    console.warn('[updateCardAction] カテゴリー削除エラー:', deleteError.message);
  }

  const categoryIds = [
    ...(formData.getAll('category_ids') as string[]),
    ...newlyCreatedIds,
  ].filter(Boolean);

  if (categoryIds.length > 0) {
    const rows = categoryIds.map((category_id) => ({
      card_id: cardId,
      category_id,
    }));
    const { error: catLinkError } = await supabase
      .from('cards_categories')
      .insert(rows);

    if (catLinkError) {
      console.warn('[updateCardAction] カテゴリー紐付けエラー（名刺は更新済み）:', catLinkError.message);
    }
  }

  console.log('[updateCardAction] 更新成功 id:', cardId, '/ カテゴリー数:', categoryIds.length);
  return { ok: true };
}
