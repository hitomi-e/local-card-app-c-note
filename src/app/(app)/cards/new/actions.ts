'use server';

import { createClient } from '@/lib/supabase/server';
import { createCategory } from '@/lib/supabase/categories';
import { normalizeForComparison } from '@/lib/utils';
import type { CardInsert } from '@/types/cards';

/**
 * フォームの状態型
 * ok: true      → 保存・更新成功
 * error         → 失敗メッセージ
 * duplicateId   → 重複が見つかった場合の既存カードID（ダイアログ表示用）
 *
 * ⚠️ Server Action 内で redirect() を使うと iOS Safari で full reload が発生し
 *    セッションが失われることがある。そのため redirect は廃止し、
 *    クライアント側（CardForm.tsx）で router.push() を使う方式に変更。
 */
export type CardFormState = {
  error?: string;
  ok?: boolean;
  duplicateId?: string;
};

/** FormData の空文字列を null に変換するヘルパー */
function toNullable(formData: FormData, key: string): string | null {
  const value = (formData.get(key) as string)?.trim();
  return value || null;
}

/**
 * 電話番号・郵便番号用: 数字以外（ハイフン等）を除去して保存
 * 入力時はハイフンを許可するが、DB には数字のみ保存し混在を防ぐ
 */
function toDigitsOnly(formData: FormData, key: string): string | null {
  const value = (formData.get(key) as string)?.trim();
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  return digits || null;
}

/**
 * 名刺を新規登録する Server Action
 *
 * フォームから category_ids（選択済みカテゴリー）と
 * new_category_name / new_category_color（新規カテゴリー）を受け取り、
 * cards_categories 中間テーブルにも保存する。
 */
export async function createCardAction(
  _prevState: CardFormState,
  formData: FormData
): Promise<CardFormState> {
  const supabase = await createClient();

  // 認証確認
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'ログインセッションが切れました。再度ログインしてください。' };
  }

  const cardData: CardInsert = {
    user_id: user.id,
    // 会社情報
    company_name:         toNullable(formData, 'company_name'),
    company_name_reading: toNullable(formData, 'company_name_reading'),
    industry:             toNullable(formData, 'industry'),
    branch_office:        toNullable(formData, 'branch_office'),
    department:           toNullable(formData, 'department'),
    position:             toNullable(formData, 'position'),
    // 個人情報
    full_name:     toNullable(formData, 'full_name'),
    name_reading:  toNullable(formData, 'name_reading'),
    // 連絡先（電話番号・郵便番号は数字のみ保存）
    postal_code:   toDigitsOnly(formData, 'postal_code'),
    address:       toNullable(formData, 'address'),
    company_phone: toDigitsOnly(formData, 'company_phone'),
    extension:     toDigitsOnly(formData, 'extension'),
    mobile_phone:  toDigitsOnly(formData, 'mobile_phone'),
    email:         toNullable(formData, 'email'),
    website_url:   toNullable(formData, 'website_url'),
    // メモ
    free_memo:     toNullable(formData, 'free_memo'),
    // 画像（スキャン時に Storage へアップロード済みのパス）
    image_path:      toNullable(formData, 'image_path'),
    back_image_path: toNullable(formData, 'back_image_path'),
  };

  // 会社名または名前のいずれかは必須
  if (!cardData.company_name && !cardData.full_name) {
    return { error: '「会社名」または「名前」のいずれかを入力してください。' };
  }

  // ── 重複チェック（bypass_duplicate_check フラグがあればスキップ）──
  // 「別の名刺として保存」選択時はダイアログ側でフラグをセットして再送信する
  const bypassDuplicateCheck = formData.get('bypass_duplicate_check') === 'true';

  if (!bypassDuplicateCheck) {
    const newKey =
      normalizeForComparison(cardData.company_name) +
      '|' +
      normalizeForComparison(cardData.full_name);

    const { data: existingCards, error: fetchError } = await supabase
      .from('cards')
      .select('id, company_name, full_name')
      .eq('user_id', user.id);

    if (fetchError) {
      // 重複チェック自体のエラーは警告にとどめ、保存は続行する
      console.warn('[createCardAction] 重複チェック失敗（スキップ）:', fetchError.message);
    } else {
      const duplicate = (existingCards ?? []).find(card => {
        const existingKey =
          normalizeForComparison(card.company_name) +
          '|' +
          normalizeForComparison(card.full_name);
        return existingKey === newKey;
      });

      if (duplicate) {
        console.log('[createCardAction] 重複検出:', duplicate.id, '会社名:', cardData.company_name, '氏名:', cardData.full_name);
        return {
          error: 'この名刺（会社名・氏名）は既に登録されています。名刺帳に戻って編集画面より情報を編集するか、このまま情報を更新してください。',
          duplicateId: duplicate.id,
        };
      }
    }
  }

  // ── 新規カテゴリーの作成（複数対応）──
  // CategorySelector は new_category_name / new_category_color を複数送信する
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

  // ── 名刺を挿入 ──
  const { data: insertedCard, error: insertError } = await supabase
    .from('cards')
    .insert(cardData)
    .select('id')
    .single();

  if (insertError || !insertedCard) {
    console.error('[createCardAction] insertCard エラー:', insertError);
    return { error: '名刺の保存に失敗しました。もう一度お試しください。' };
  }

  // ── cards_categories を保存 ──
  const categoryIds = [
    ...(formData.getAll('category_ids') as string[]),
    ...newlyCreatedIds,
  ].filter(Boolean);

  if (categoryIds.length > 0) {
    const rows = categoryIds.map((category_id) => ({
      card_id: insertedCard.id,
      category_id,
    }));
    const { error: catLinkError } = await supabase
      .from('cards_categories')
      .insert(rows);

    if (catLinkError) {
      console.warn('[createCardAction] カテゴリー紐付けエラー（名刺は保存済み）:', catLinkError.message);
    }
  }

  console.log('[createCardAction] 保存成功 id:', insertedCard.id, '/ カテゴリー数:', categoryIds.length);
  return { ok: true };
}

/**
 * 重複確認ダイアログで「更新する」を選んだ際に呼ばれる Server Action
 *
 * - 基本項目: スキャン結果で全上書き（空欄だった項目も最新情報で補完される）
 * - free_memo: 既存末尾に改行 + 新内容を追記（同一内容の重複追記は防止）
 * - カテゴリー: cards_categories を変更しないことで維持
 * - 画像パス: 新スキャン画像があれば更新、なければ既存を維持
 */
export async function updateCardByIdAction(
  cardId: string,
  formData: FormData
): Promise<CardFormState> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'ログインセッションが切れました。再度ログインしてください。' };
  }

  // 既存カードを全フィールド取得（スマート補完のための比較に使用）
  const { data: existing, error: fetchError } = await supabase
    .from('cards')
    .select(`
      id, user_id,
      company_name, company_name_reading, industry, branch_office, department, position,
      full_name, name_reading,
      postal_code, address,
      company_phone, extension, mobile_phone, email, website_url,
      free_memo, image_path, back_image_path
    `)
    .eq('id', cardId)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !existing) {
    console.error('[updateCardByIdAction] 既存カード取得失敗:', fetchError?.message);
    return { error: '更新対象の名刺が見つかりませんでした。' };
  }

  // ── フリーメモの合体ロジック ──────────────────────────────
  // 既存メモの末尾に新しいメモを追記する。同一内容は重複追記しない。
  const existingMemo = existing.free_memo?.trim() ?? '';
  const newMemo      = toNullable(formData, 'free_memo')?.trim() ?? '';

  let mergedMemo: string | null;
  if (!existingMemo && !newMemo) {
    mergedMemo = null;
  } else if (!existingMemo) {
    mergedMemo = newMemo;
  } else if (!newMemo || existingMemo === newMemo) {
    // 新メモが空、または既存と完全一致 → 既存をそのまま保持（重複防止）
    mergedMemo = existingMemo;
  } else {
    // 新メモが既存の中に含まれている場合も追記しない
    mergedMemo = existingMemo.includes(newMemo)
      ? existingMemo
      : `${existingMemo}\n${newMemo}`;
  }

  // ── 画像パス: 新スキャンがあれば更新、なければ既存を維持 ──
  const newImagePath     = toNullable(formData, 'image_path');
  const newBackImagePath = toNullable(formData, 'back_image_path');

  const updateData = {
    // 基本項目: スキャン結果に値があれば上書き、空なら既存値を維持（賢い補完）
    company_name:         toNullable(formData, 'company_name')         ?? existing.company_name,
    company_name_reading: toNullable(formData, 'company_name_reading') ?? existing.company_name_reading,
    industry:             toNullable(formData, 'industry')             ?? existing.industry,
    branch_office:        toNullable(formData, 'branch_office')        ?? existing.branch_office,
    department:           toNullable(formData, 'department')           ?? existing.department,
    position:             toNullable(formData, 'position')             ?? existing.position,
    full_name:            toNullable(formData, 'full_name')            ?? existing.full_name,
    name_reading:         toNullable(formData, 'name_reading')         ?? existing.name_reading,
    postal_code:          toDigitsOnly(formData, 'postal_code')        ?? existing.postal_code,
    address:              toNullable(formData, 'address')              ?? existing.address,
    company_phone:        toDigitsOnly(formData, 'company_phone')      ?? existing.company_phone,
    extension:            toDigitsOnly(formData, 'extension')          ?? existing.extension,
    mobile_phone:         toDigitsOnly(formData, 'mobile_phone')       ?? existing.mobile_phone,
    email:                toNullable(formData, 'email')                ?? existing.email,
    website_url:          toNullable(formData, 'website_url')          ?? existing.website_url,
    // フリーメモ: 合体結果を保存
    free_memo:       mergedMemo,
    // 画像パス
    image_path:      newImagePath     ?? existing.image_path,
    back_image_path: newBackImagePath ?? existing.back_image_path,
  };

  const { data: updatedRow, error: updateError } = await supabase
    .from('cards')
    .update(updateData)
    .eq('id', cardId)
    .eq('user_id', user.id)
    .select('id')
    .single();

  if (updateError || !updatedRow) {
    console.error('[updateCardByIdAction] 更新失敗:', updateError?.message ?? '対象行なし');
    return { error: `名刺の更新に失敗しました: ${updateError?.message ?? '対象行が見つかりません'}` };
  }

  // カテゴリー: フォームに category_ids がある場合のみ追記（既存は削除しない）
  const newCategoryIds = (formData.getAll('category_ids') as string[]).filter(Boolean);
  if (newCategoryIds.length > 0) {
    const { data: existingCats } = await supabase
      .from('cards_categories')
      .select('category_id')
      .eq('card_id', cardId);

    const existingCatIds = new Set(
      (existingCats ?? []).map((r: { category_id: string }) => r.category_id)
    );
    const rowsToAdd = newCategoryIds
      .filter(id => !existingCatIds.has(id))
      .map(category_id => ({ card_id: cardId, category_id }));

    if (rowsToAdd.length > 0) {
      const { error: catErr } = await supabase.from('cards_categories').insert(rowsToAdd);
      if (catErr) {
        console.warn('[updateCardByIdAction] カテゴリー追記エラー:', catErr.message);
      } else {
        console.log('[updateCardByIdAction] カテゴリー追記:', rowsToAdd.length, '件');
      }
    }
  }

  console.log('[updateCardByIdAction] 更新成功 id:', cardId, '/ memo合体:', !!mergedMemo, '/ image_path:', updateData.image_path);
  return { ok: true };
}
