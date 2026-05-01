import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchCategoriesByUsage } from '@/lib/supabase/categories';
import { CardEditForm, type FormValues } from './CardEditForm';
import type { Card } from '@/types/cards';

/**
 * 名刺編集ページ（Server Component）
 *
 * - 既存の名刺データを取得して CardEditForm に渡す
 * - 電話番号・郵便番号はフォームで ハイフン入りで表示する
 *   （DB には数字のみ保存済みなので、表示時に整形）
 */
export default async function CardEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // 名刺取得（カテゴリー情報を join）
  const { data, error } = await supabase
    .from('cards')
    .select('*, cards_categories(category_id)')
    .eq('id', id)
    .single();

  if (error || !data) {
    console.warn('[CardEdit] 名刺が見つかりません id:', id);
    notFound();
  }

  const card = data as Card & { cards_categories: { category_id: string }[] };

  // カテゴリー一覧（使用頻度の多い順）
  const { categories } = await fetchCategoriesByUsage(supabase);

  // このカードに紐付いているカテゴリーIDの配列
  const initialCategoryIds = card.cards_categories.map((cc) => cc.category_id);

  // DB の数字のみデータを、フォーム表示用にハイフンあり形式に変換
  const initialValues: FormValues = {
    company_name:         card.company_name         ?? '',
    company_name_reading: card.company_name_reading ?? '',
    industry:             card.industry             ?? '',
    branch_office:        card.branch_office        ?? '',
    department:           card.department           ?? '',
    position:             card.position             ?? '',
    full_name:            card.full_name            ?? '',
    name_reading:         card.name_reading         ?? '',
    postal_code:          formatPostalCodeForInput(card.postal_code),
    address:              card.address              ?? '',
    company_phone:        formatPhoneForInput(card.company_phone),
    extension:            card.extension            ?? '',
    mobile_phone:         formatPhoneForInput(card.mobile_phone),
    email:                card.email                ?? '',
    website_url:          card.website_url          ?? '',
    free_memo:            card.free_memo            ?? '',
  };

  return (
    <div className="px-4 py-5 flex flex-col gap-5">

      {/* ── ヘッダー ── */}
      <header className="flex items-center gap-2">
        <h1 className="flex-1 text-base font-bold text-gray-800 truncate px-1">名刺を編集</h1>
      </header>

      {/* ── 編集フォーム ── */}
      <CardEditForm
        cardId={id}
        initialValues={initialValues}
        categories={categories}
        initialCategoryIds={initialCategoryIds}
      />

    </div>
  );
}

// ─────────────────────────────────────────────────
// DB の数字のみデータをフォーム表示用に整形するヘルパー
// ─────────────────────────────────────────────────

/** 郵便番号: 7桁 → 3桁-4桁 */
function formatPostalCodeForInput(raw: string | null): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return raw;
}

/** 電話番号: 桁数に応じてハイフンを挿入 */
function formatPhoneForInput(raw: string | null): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');

  if (digits.length === 10) {
    if (/^(0120|0570|0800)/.test(digits))
      return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
    if (/^(03|06)/.test(digits))
      return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11) {
    if (/^(090|080|070|050)/.test(digits))
      return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}`;
  }

  return raw;
}
