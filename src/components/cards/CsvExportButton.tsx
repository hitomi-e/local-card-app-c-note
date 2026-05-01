'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { CardWithCategories, Category } from '@/types/cards';

// ─────────────────────────────────────────────────
// CSV セル エスケープ
// カンマ・ダブルクォート・改行を含む値を RFC 4180 に従いクォートする
// ─────────────────────────────────────────────────
function escape(value: string | null | undefined): string {
  if (value == null || value === '') return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// ─────────────────────────────────────────────────
// 郵便番号フォーマット（7桁 → 3-4）
// ─────────────────────────────────────────────────
function formatPostal(raw: string | null): string {
  if (!raw) return '';
  const d = raw.replace(/\D/g, '');
  return d.length === 7 ? `${d.slice(0, 3)}-${d.slice(3)}` : raw;
}

// ─────────────────────────────────────────────────
// 電話番号フォーマット
// ─────────────────────────────────────────────────
function formatPhone(raw: string | null): string {
  if (!raw) return '';
  const d = raw.replace(/\D/g, '');
  if (d.length === 10) {
    if (/^(0120|0570|0800)/.test(d)) return `${d.slice(0, 4)}-${d.slice(4, 7)}-${d.slice(7)}`;
    if (/^(03|06)/.test(d))          return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  }
  if (d.length === 11) {
    if (/^(090|080|070|050)/.test(d)) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
    return `${d.slice(0, 4)}-${d.slice(4, 8)}-${d.slice(8)}`;
  }
  return raw;
}

// ─────────────────────────────────────────────────
// CSV 文字列生成
// ─────────────────────────────────────────────────
function buildCsv(cards: CardWithCategories[], categoryMap: Map<string, string>): string {
  const HEADERS = [
    '会社名', '会社名（ふりがな）', '業種', '営業所', '部署', '役職',
    '氏名', '氏名（ふりがな）',
    '郵便番号', '住所', '会社電話番号', '内線番号', '携帯電話番号',
    'メールアドレス', 'WebサイトURL',
    'メモ', '登録種別', 'カテゴリー', '登録日',
  ];

  const sourceLabel = (src?: string | null) => {
    if (src === 'digital') return 'デジタル名刺';
    if (src === 'manual')  return '手入力';
    return '名刺スキャン';
  };

  const rows = cards.map(c => {
    const categories = (c.cards_categories ?? [])
      .map(cc => categoryMap.get(cc.category_id) ?? '')
      .filter(Boolean)
      .join('／');

    const dateStr = new Date(c.created_at).toLocaleDateString('ja-JP', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    });

    return [
      c.company_name,
      c.company_name_reading,
      c.industry,
      c.branch_office,
      c.department,
      c.position,
      c.full_name,
      c.name_reading,
      formatPostal(c.postal_code),
      c.address,
      formatPhone(c.company_phone),
      c.extension,
      formatPhone(c.mobile_phone),
      c.email,
      c.website_url,
      c.free_memo,
      sourceLabel(c.source),
      categories,
      dateStr,
    ].map(escape).join(',');
  });

  const header = HEADERS.map(escape).join(',');
  return [header, ...rows].join('\r\n');
}

// ─────────────────────────────────────────────────
// ボタンコンポーネント
// ─────────────────────────────────────────────────
export default function CsvExportButton() {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    if (loading) return;
    setLoading(true);

    try {
      const supabase = createClient();

      // 名刺とカテゴリーを並行取得（RLS により自分のデータのみ返る）
      const [cardsRes, catsRes] = await Promise.all([
        supabase
          .from('cards')
          .select('*, cards_categories(category_id)')
          .order('created_at', { ascending: false }),
        supabase.from('categories').select('id, name'),
      ]);

      if (cardsRes.error) throw new Error(cardsRes.error.message);

      const cards      = (cardsRes.data ?? []) as CardWithCategories[];
      const categories = (catsRes.data ?? []) as Pick<Category, 'id' | 'name'>[];
      const catMap     = new Map(categories.map(c => [c.id, c.name]));

      const csvBody = buildCsv(cards, catMap);

      // BOM付き UTF-8 → Excel で文字化けしない
      const blob = new Blob(['﻿' + csvBody], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);

      // ファイル名: C-Note_名刺データ_YYYYMMDD.csv
      const now     = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const filename = `C-Note_名刺データ_${dateStr}.csv`;

      const a = document.createElement('a');
      a.href     = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log(`[CsvExport] ${cards.length}件 → ${filename}`);
    } catch (err) {
      console.error('[CsvExport] エラー:', err);
      alert('CSV出力に失敗しました。もう一度お試しください。');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={loading}
      className="
        flex items-center gap-1.5
        px-3 py-2 rounded-xl
        border border-gray-200 bg-white
        text-xs font-medium text-gray-600
        hover:bg-gray-50 hover:border-gray-300
        active:scale-95
        disabled:opacity-60 disabled:cursor-not-allowed
        transition-all touch-manipulation
        shadow-sm
      "
    >
      {loading
        ? <Loader2 size={14} className="animate-spin shrink-0" />
        : <Download size={14} className="shrink-0" />
      }
      {loading ? '出力中...' : 'CSV出力'}
    </button>
  );
}
