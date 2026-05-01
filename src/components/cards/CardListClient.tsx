'use client';

/**
 * 名刺一覧クライアントコンポーネント
 * - 3段ヘッダー: タイトル+件数+クリアボタン / 検索バー / カテゴリーボタン
 * - キーワード検索（スペース区切り複数トークン AND 検索）
 *   対象: 会社名・名前・部署・役職・メール・住所・フリーメモ・カテゴリー名
 * - カテゴリーフィルター（複数行折り返し表示）
 * - ソート切り替え: 会社名順（あいうえお・法人格除去）/ 登録順（新しい順）
 * - 横スクロールカードビュー + 左右移動ボタン
 * - 名刺画像を Storage 署名付き URL で表示（なければイニシャルアバター）
 * - カードタップで名刺画像をフルスクリーン拡大表示（4:3 固定比率）
 * - 全カードの各行高さを固定してツラを完全に揃える
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Search, BookOpen, X, Tag, ChevronLeft, ChevronRight } from 'lucide-react';
import type { CardWithCategories, Category } from '@/types/cards';
import { VoiceMemoButton } from '@/components/ui/VoiceMemoButton';

// ─────────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────────
type Props = {
  cards: CardWithCategories[];
  categories: Category[];
  cardCount: number;
  imageUrls: Record<string, string>; // card.id → 署名付き URL
  logoUrls?: Record<string, string>; // card.id → 会社ロゴ URL（デジタル名刺のみ）
};

// ─────────────────────────────────────────────────
// 法人格除去（ソートキー生成時のみ使用、表示には使わない）
//
// 先頭・末尾の両方をチェックし、以下の全パターンに対応：
//   漢字: 株式会社, 有限会社, 合同会社
//   かな: かぶしきがいしゃ, ゆうげんがいしゃ, ごうどうがいしゃ
//   略記: （株）, (株), （有）, (有)
// ─────────────────────────────────────────────────
const CORP_WORDS = [
  '株式会社', '有限会社', '合同会社',
  'かぶしきがいしゃ', 'ゆうげんがいしゃ', 'ごうどうがいしゃ',
  '（株）', '(株)', '（有）', '(有)',
];

function stripCorporate(str: string): string {
  let s = str.trim();
  for (const corp of CORP_WORDS) {
    if (s.startsWith(corp)) s = s.slice(corp.length).trimStart();
    if (s.endsWith(corp))   s = s.slice(0, s.length - corp.length).trimEnd();
  }
  // 全部除去されたときは元の文字列を返す（安全策）
  return s || str;
}

// ─────────────────────────────────────────────────
// あいうえお順ソートキー
//
// 優先順位:
//   会社名あり → company_name_reading → company_name（法人格を除去して比較）
//   会社名なし → name_reading → full_name
// ─────────────────────────────────────────────────
function getSortKey(card: CardWithCategories): string {
  if (card.company_name) {
    // 会社名が存在 → 会社名を基準にする（reading優先、なければ漢字）
    const base = card.company_name_reading || card.company_name;
    return stripCorporate(base);
  }
  // 会社名なし → 人名を基準にする
  return card.name_reading || card.full_name || '\uFFFF';
}

// ─────────────────────────────────────────────────
// イニシャルアバター背景色
// ─────────────────────────────────────────────────
const AVATAR_COLORS = [
  '#81d8d0', '#E8B84B', '#7DB5E8', '#E87D7D', '#9AE87D', '#B87DE8',
];
function getAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function getInitial(card: CardWithCategories): string {
  return (card.company_name || card.full_name || '?').charAt(0);
}

// カード1枚 + gap のスクロール量（px）
const CARD_SCROLL_AMOUNT = 220 + 12;

// ─────────────────────────────────────────────────
// メインコンポーネント
// ─────────────────────────────────────────────────
export default function CardListClient({ cards, categories, cardCount, imageUrls, logoUrls = {} }: Props) {
  const [keyword,     setKeyword]     = useState('');
  const [activeCats,  setActiveCats]  = useState<string[]>([]);   // 複数選択 OR 検索
  const [showCatArea, setShowCatArea] = useState(false);
  const [sortOrder,   setSortOrder]   = useState<'name' | 'date'>('name'); // 'name'=あいうえお順 / 'date'=登録順

  // スクロールコンテナと左右ボタン表示フラグ
  const scrollRef      = useRef<HTMLDivElement>(null);
  const [canScrollLeft,  setCanScrollLeft]  = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  console.log('[CardList] 全件数:', cardCount, '/ カテゴリー数:', categories.length, '/ 画像あり:', Object.keys(imageUrls).length, '件');

  // ── スクロールボタンの表示制御 ─────────────────
  function updateScrollState() {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }

  function scrollCards(dir: 'left' | 'right') {
    scrollRef.current?.scrollBy({
      left: dir === 'right' ? CARD_SCROLL_AMOUNT : -CARD_SCROLL_AMOUNT,
      behavior: 'smooth',
    });
  }

  // フィルター変更時にスクロール位置をリセット & ボタン状態を再評価
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = 0;
    requestAnimationFrame(() => updateScrollState());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, keyword, activeCats, sortOrder]);

  // ── カテゴリーチップの並び順 ──────────────────────
  // 優先度1: 紐付き名刺枚数が多い順（よく使うカテゴリーを先頭に）
  // 優先度2: 枚数が同じ場合は作成日が古い順（安定したソート）
  const sortedCategories = useMemo(() => {
    // 全名刺データからカテゴリーごとの使用枚数を集計
    const countMap: Record<string, number> = {};
    for (const card of cards) {
      for (const cc of card.cards_categories) {
        countMap[cc.category_id] = (countMap[cc.category_id] ?? 0) + 1;
      }
    }
    return [...categories].sort((a, b) => {
      // 枚数の多い順
      const diff = (countMap[b.id] ?? 0) - (countMap[a.id] ?? 0);
      if (diff !== 0) return diff;
      // 同枚数は作成日の古い順（先に作ったカテゴリーが前）
      return a.created_at.localeCompare(b.created_at);
    });
  }, [cards, categories]);

  // ── カテゴリー名マップ（id → name）キーワード検索に使用 ──
  const categoryNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const cat of categories) map[cat.id] = cat.name;
    return map;
  }, [categories]);

  // ── フィルタリング & ソート ─────────────────────
  const filtered = useMemo(() => {
    console.log('[CardList] フィルタリング開始 keyword:', keyword, 'activeCats:', activeCats, 'sortOrder:', sortOrder);
    let result = [...cards];

    // カテゴリー複数選択: 選択した全てのカテゴリーを持つ名刺のみ表示（AND検索）
    if (activeCats.length > 0) {
      result = result.filter((c) => {
        const cardCatIds = c.cards_categories.map((cc) => cc.category_id);
        return activeCats.every((id) => cardCatIds.includes(id));
      });
      console.log('[CardList] カテゴリーANDフィルター後:', result.length, '件');
    }

    // スペース区切り複数キーワード AND 検索
    // 全角・半角スペースの両方を区切り文字とし、空トークンを除外する
    if (keyword.trim()) {
      const tokens = keyword.trim().toLowerCase().split(/[\s\u3000]+/).filter(Boolean);
      result = result.filter((c) => {
        // このカードに紐付くカテゴリー名を結合
        const catNames = c.cards_categories
          .map((cc) => categoryNameMap[cc.category_id] ?? '')
          .join(' ');
        // 検索対象フィールドを一つの文字列にまとめる
        // （住所・フリーメモも含め、あらゆる記述内容をヒット対象にする）
        const haystack = [
          c.company_name, c.company_name_reading,
          c.industry,
          c.branch_office, c.department, c.position,
          c.full_name, c.name_reading,
          c.address, c.email, c.website_url,
          c.free_memo,
          catNames,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        // 全トークンが haystack に含まれる場合のみヒット（AND）
        return tokens.every((token) => haystack.includes(token));
      });
      console.log('[CardList] キーワードフィルター後:', result.length, '件');
    }

    // ソート
    if (sortOrder === 'date') {
      // 登録順（新しい順）
      result.sort((a, b) => b.created_at.localeCompare(a.created_at));
    } else {
      // 会社名順（法人格を除去した上でのあいうえお順）
      result.sort((a, b) =>
        getSortKey(a).localeCompare(getSortKey(b), 'ja', { sensitivity: 'base' })
      );
    }
    return result;
  }, [cards, keyword, activeCats, categoryNameMap, sortOrder]);

  // ─────────────────────────────────────────────
  // レンダリング
  // ─────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">

      {/* ── 1段目: タイトル + 件数 | [n件選択中] [解除] ── */}
      <div className="flex items-center justify-between px-0.5">
        {/* 左側: 見出し + 件数 */}
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-600 tracking-wide">受け取った名刺</h2>
          <span className="text-sm text-gray-900 font-bold">
            {(keyword || activeCats.length > 0)
              ? `${filtered.length} / ${cardCount} 件`
              : `${cardCount} 件`}
          </span>
        </div>
        {/* 右側: 絞り込み中の場合のみ表示（カテゴリー件数 + 解除ボタン） */}
        {(keyword || activeCats.length > 0) && (
          <div className="flex items-center gap-2">
            {/* カテゴリー選択数バッジ（カテゴリーで絞り込み中のみ表示） */}
            {activeCats.length > 0 && (
              <span className="
                flex items-center
                text-xs text-[#3a9e97] font-semibold
                px-3 py-1.5 rounded-full
                bg-[#e8f8f7]
              ">
                {activeCats.length}件選択中
              </span>
            )}
            {/* 全解除ボタン */}
            <button
              type="button"
              onClick={() => {
                setKeyword('');
                setActiveCats([]);
                setShowCatArea(false);
                console.log('[CardList] 絞り込みを全解除');
              }}
              className="
                flex items-center gap-1
                text-xs text-[#3a9e97] font-semibold
                px-3 py-1.5 rounded-full
                bg-[#e8f8f7] hover:bg-[#d0f0ee]
                transition-colors active:scale-95
              "
            >
              <X size={11} />
              解除
            </button>
          </div>
        )}
      </div>

      {/* ── 2段目: 検索バー（マイク音声検索つき）────── */}
      {/*
        flex レイアウトで入力欄とボタンを隣接させる
        → absolute 配置をなくし、テキストがボタンの下に潜り込む問題を根本解消
      */}
      {/* コンテナ自体に px-3.5 gap-2 を持たせることで
          左右に均一なゆとりを確保し、各子要素の個別 margin を不要にする */}
      <div className="
        flex items-center gap-2 min-h-[46px] px-3.5
        rounded-2xl border border-gray-200 bg-white
        focus-within:ring-2 focus-within:ring-[#81d8d0] focus-within:border-transparent
        transition
      ">
        {/* 左: 検索アイコン */}
        <Search size={16} className="shrink-0 text-gray-400 pointer-events-none" />

        {/* 中: テキスト入力（flex-1 で残り幅を占有、min-w-0 で縮小を許可） */}
        <input
          type="text"
          value={keyword}
          onChange={(e) => { console.log('[CardList] キーワード変更:', e.target.value); setKeyword(e.target.value); }}
          placeholder="会社名・名前・メモなど"
          className="
            flex-1 min-w-0 py-2 bg-transparent
            text-sm text-gray-800 placeholder:text-gray-400
            focus:outline-none
          "
        />

        {/* 右: X クリア（キーワードあり時）+ マイク */}
        <div className="flex items-center gap-1 shrink-0">
          {keyword && (
            <button
              type="button"
              onClick={() => setKeyword('')}
              className="p-1 text-gray-400 hover:text-gray-600 touch-manipulation"
              aria-label="検索をクリア"
            >
              <X size={15} />
            </button>
          )}
          <VoiceMemoButton
            compact
            onAppend={(text) => {
              console.log('[CardList] 音声検索:', text);
              setKeyword(text);
            }}
          />
        </div>
      </div>

      {/* ── 3段目: カテゴリーで探すボタン ────────── */}
      <button
        type="button"
        onClick={() => { console.log('[CardList] カテゴリーエリア トグル'); setShowCatArea((p) => !p); }}
        className={`
          w-full min-h-[46px] flex items-center justify-center gap-1.5
          rounded-2xl border transition-colors text-sm font-semibold
          ${showCatArea || activeCats.length > 0
            ? 'bg-[#81d8d0] border-[#81d8d0] text-white'
            : 'bg-white border-gray-200 text-gray-500 hover:border-[#81d8d0] hover:text-[#81d8d0]'}
        `}
        aria-label="カテゴリーで絞り込む"
      >
        <Tag size={15} />
        カテゴリーで探す
      </button>

      {/* ── カテゴリーチップ（折り返し複数行）─────── */}
      {showCatArea && (
        <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3">
          {categories.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-1">カテゴリーはまだ未登録です</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {/* 「すべて」= 選択解除 */}
              <button type="button"
                onClick={() => { setActiveCats([]); }}
                className={`min-h-[36px] px-4 rounded-full text-xs font-semibold border transition-colors
                  ${activeCats.length === 0 ? 'bg-[#81d8d0] text-white border-[#81d8d0]' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                すべて
              </button>
              {sortedCategories.map((cat) => {
                const isActive = activeCats.includes(cat.id);
                return (
                  <button key={cat.id} type="button"
                    onClick={() => {
                      setActiveCats((prev) =>
                        prev.includes(cat.id) ? prev.filter((x) => x !== cat.id) : [...prev, cat.id]
                      );
                    }}
                    className={`min-h-[36px] px-4 rounded-full text-xs font-semibold border transition-all active:scale-95
                      ${isActive ? 'text-white border-transparent shadow-sm' : 'bg-gray-50 text-gray-500 border-gray-200'}`}
                    style={isActive ? { backgroundColor: cat.color, borderColor: cat.color } : {}}>
                    {cat.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 4段目: ソート切り替えボタン ─────────── */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setSortOrder('name')}
          className={`
            flex-1 min-h-[40px] rounded-2xl text-sm font-semibold border transition-colors
            ${sortOrder === 'name'
              ? 'bg-[#81d8d0] border-[#81d8d0] text-white'
              : 'bg-white border-gray-200 text-gray-500 hover:border-[#81d8d0] hover:text-[#81d8d0]'}
          `}
        >
          会社名順
        </button>
        <button
          type="button"
          onClick={() => setSortOrder('date')}
          className={`
            flex-1 min-h-[40px] rounded-2xl text-sm font-semibold border transition-colors
            ${sortOrder === 'date'
              ? 'bg-[#81d8d0] border-[#81d8d0] text-white'
              : 'bg-white border-gray-200 text-gray-500 hover:border-[#81d8d0] hover:text-[#81d8d0]'}
          `}
        >
          登録順
        </button>
      </div>

      {/* ── カード一覧（横スクロール）+ 左右ボタン ── */}
      {filtered.length === 0 ? (
        <EmptyResult hasFilter={!!(keyword || activeCats.length > 0)} />
      ) : (
        <div className="relative group -mx-4">

          {/* 左スクロールボタン */}
          <button
            type="button"
            onClick={() => scrollCards('left')}
            aria-label="左へスクロール"
            className={`
              absolute left-2 top-1/2 -translate-y-1/2 z-10
              w-9 h-9 rounded-full
              bg-white/80 shadow-md backdrop-blur-sm
              flex items-center justify-center text-gray-600
              transition-all duration-200
              hover:bg-white hover:shadow-lg hover:scale-110
              opacity-0 group-hover:opacity-100
              ${canScrollLeft ? 'pointer-events-auto' : 'pointer-events-none invisible'}
            `}
          >
            <ChevronLeft size={18} strokeWidth={2.5} />
          </button>

          {/* スクロールコンテナ */}
          <div
            ref={scrollRef}
            onScroll={updateScrollState}
            className="flex gap-3 overflow-x-auto pb-3 px-4 snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none' }}
          >
            {filtered.map((card) => (
              <BusinessCard
                key={card.id}
                card={card}
                imageUrl={imageUrls[card.id] ?? null}
              />
            ))}
            <div className="shrink-0 w-1" aria-hidden />
          </div>

          {/* 右スクロールボタン */}
          <button
            type="button"
            onClick={() => scrollCards('right')}
            aria-label="右へスクロール"
            className={`
              absolute right-2 top-1/2 -translate-y-1/2 z-10
              w-9 h-9 rounded-full
              bg-white/80 shadow-md backdrop-blur-sm
              flex items-center justify-center text-gray-600
              transition-all duration-200
              hover:bg-white hover:shadow-lg hover:scale-110
              opacity-0 group-hover:opacity-100
              ${canScrollRight ? 'pointer-events-auto' : 'pointer-events-none invisible'}
            `}
          >
            <ChevronRight size={18} strokeWidth={2.5} />
          </button>
        </div>
      )}

    </div>
  );
}

// ─────────────────────────────────────────────────
// 名刺カードコンポーネント
//
// ポイント：全行を常にレンダリングし、固定高さで空行を保持する。
// conditional rendering（{subLine && ...}）は使わない。
// これにより隣り合うカードの文字位置（ツラ）が常に一致する。
// ─────────────────────────────────────────────────
function BusinessCard({
  card,
  imageUrl,
}: {
  card: CardWithCategories;
  imageUrl: string | null;
}) {
  const initial     = getInitial(card);
  const avatarColor = getAvatarColor(card.company_name || card.full_name || card.id);
  const subLine     = [card.branch_office, card.department].filter(Boolean).join(' • ');

  return (
    <Link
      href={`/cards/${card.id}`}
      className="
        snap-start shrink-0 w-[220px]
        bg-white rounded-2xl shadow-sm overflow-hidden text-left
        active:scale-[0.97] transition-transform
      "
    >
      {/* ── 画像エリア：4:3 比率（固定）────────────
           縦型・横型どちらも枠のサイズが変わらない。
           object-contain で内容が切れないことを保証。        */}
      <div
        className="w-full flex items-center justify-center overflow-hidden relative"
        style={{
          aspectRatio: '4 / 3',
          backgroundColor: card.source === 'digital'
            ? '#e8f8f7'
            : (imageUrl ? '#f9fafb' : `${avatarColor}22`),
        }}
      >
        {card.source === 'digital' ? (
          // ── デジタル名刺: ブルーグリーン円形フレーム + 顔写真 or イニシャル ──
          // フレームは外側リングを重ねる2層構造（overflow-hidden で画像を確実にクリップ）
          <div className="relative shrink-0" style={{ width: '120px', height: '120px' }}>
            {/* 写真またはイニシャル（内側コンテナ） */}
            <div
              className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
              style={{
                backgroundColor: '#e8f8f7',
                boxShadow: '0 0 0 3px #81d8d0, 0 0 0 5px #e8f8f7, 0 0 0 8px rgba(129,216,208,0.5), 0 0 0 10px #e8f8f7, 0 0 0 12px rgba(129,216,208,0.25)',
              }}
            >
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt={`${card.full_name ?? ''}の顔写真`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="text-3xl font-bold text-[#81d8d0] select-none">
                  {initial}
                </span>
              )}
            </div>
          </div>
        ) : imageUrl ? (
          // ── 紙名刺: 名刺画像を表示 ──
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={`${card.company_name ?? ''} ${card.full_name ?? ''}の名刺`}
            className="w-full h-full object-contain"
            loading="lazy"
            onLoad={() => console.log('[CardList] 画像表示成功 card:', card.id)}
            onError={() => console.warn('[CardList] 画像表示失敗 card:', card.id)}
          />
        ) : (
          // ── 画像なし: イニシャルアバター ──
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center
                       text-white text-2xl font-bold shadow-sm"
            style={{ backgroundColor: avatarColor }}
          >
            {initial}
          </div>
        )}
      </div>

      {/* ── カード本文（行高さ固定でツラを揃える）──
           各行は常にレンダリング。空欄でも高さを保持する。    */}
      <div className="px-4 py-3 flex flex-col">
        {/* 会社名：h-5（20px）固定 */}
        <p className="h-5 text-sm font-bold text-gray-800 truncate leading-tight">
          {card.company_name ?? '（会社名なし）'}
        </p>
        {/* 営業所 • 部署：h-4（16px）固定。空でもスペースを確保 */}
        <p className="h-4 mt-0.5 text-[11px] text-gray-400 truncate">
          {subLine}
        </p>
        {/* 役職：h-4（16px）固定。空でもスペースを確保 */}
        <p className="h-4 mt-0.5 text-[11px] text-[#81d8d0] font-medium truncate">
          {card.position ?? ''}
        </p>
        {/* 名前：区切り線 + h-5（20px）固定 */}
        <div className="mt-2 pt-2 border-t border-gray-100">
          <p className="h-5 text-sm font-semibold text-gray-700 truncate">
            {card.full_name ?? '（名前なし）'}
          </p>
        </div>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────
// 空状態コンポーネント
// ─────────────────────────────────────────────────
function EmptyResult({ hasFilter }: { hasFilter: boolean }) {
  if (hasFilter) {
    return (
      <div className="flex flex-col items-center gap-3 bg-white rounded-2xl shadow-sm px-6 py-12 text-center">
        <Search size={28} className="text-gray-300" />
        <p className="text-sm font-semibold text-gray-500">条件に一致する名刺がありません</p>
        <p className="text-xs text-gray-400">キーワードやカテゴリーを変更してみてください</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-4 bg-white rounded-2xl shadow-sm px-6 py-14 text-center">
      <div className="w-16 h-16 rounded-full bg-[#e8f8f7] flex items-center justify-center">
        <BookOpen size={30} className="text-[#81d8d0]" />
      </div>
      <div>
        <p className="text-base font-semibold text-gray-700 mb-1">まだ名刺がありません</p>
        <p className="text-sm text-gray-400 leading-relaxed">最初の名刺を追加してみましょう</p>
      </div>
      <Link href="/scan" className="mt-2 min-h-[48px] px-6 flex items-center justify-center rounded-2xl bg-[#81d8d0] text-white text-sm font-semibold hover:bg-[#5bbfb6] transition-colors">
        名刺をスキャンして追加
      </Link>
      <Link href="/cards/new" className="min-h-[48px] px-6 flex items-center justify-center gap-1.5 rounded-2xl border border-[#81d8d0] text-[#81d8d0] text-sm font-semibold hover:bg-[#f0fbfa] transition-colors">
        自分で入力して登録
      </Link>
    </div>
  );
}
