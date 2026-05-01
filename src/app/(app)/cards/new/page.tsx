import { createClient } from '@/lib/supabase/server';
import { fetchCategoriesByUsage } from '@/lib/supabase/categories';
import { CardForm } from './CardForm';

export default async function NewCardPage() {
  const supabase = await createClient();

  // カテゴリー一覧を使用頻度の多い順で取得
  const { categories } = await fetchCategoriesByUsage(supabase);

  return (
    <div className="px-4 py-5 flex flex-col gap-5">

      {/* ── ヘッダー ── */}
      <header className="flex items-center gap-2">
        <h1 className="flex-1 text-base font-bold text-gray-800 truncate px-1">名刺登録フォーム</h1>
      </header>

      {/* ── フォーム ── */}
      <CardForm categories={categories} />

    </div>
  );
}
