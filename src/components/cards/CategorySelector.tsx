'use client';

/**
 * CategorySelector — カテゴリー選択 + 新規作成UI
 *
 * 機能:
 *   1. 既存カテゴリーをカラーチップで表示。タップでトグル選択（複数可）。
 *   2. チップ右端の色丸をタップ → インラインカラーパレットで即座に色変更（DB更新）。
 *   3. 「+ 新しいカテゴリーを追加」でフォームを展開。
 *   4. 名前を入力 → 「＋」で確定 → 一度に複数カテゴリーを追加可能。
 *   5. 同名カテゴリーの重複登録を防止（既存・保留リスト両方をチェック）。
 *   6. 似た名前の既存カテゴリーをリアルタイム提案（表記ゆれ防止）。
 *   7. OCR 自動判別: 業種同義語マップでカテゴリーを推測してハイライト。
 *
 * レイアウト安定化:
 *   - ルート要素に w-full overflow-hidden を設定して横はみ出しを防止
 *   - flex行はすべて min-w-0 + w-full で折り返し保証
 *   - 入力フィールドは min-w-0 flex-1 で親幅に収まるよう制約
 */

import { useState, useMemo, useEffect } from 'react';
import { Plus, X, Lightbulb, Palette, Check } from 'lucide-react';
import type { Category } from '@/types/cards';
import { updateCategoryColorAction } from '@/lib/categoryActions';

// ─────────────────────────────────────────────────
// カラーパレット
// ─────────────────────────────────────────────────
const COLOR_PALETTE = [
  '#81d8d0', // ティール
  '#E8B84B', // マスタード
  '#7DB5E8', // スカイブルー
  '#E87D7D', // コーラル
  '#9AE87D', // グリーン
  '#B87DE8', // パープル
  '#F0A070', // オレンジ
  '#A0A0A0', // グレー
];

// ─────────────────────────────────────────────────
// テキスト正規化（全角→半角、カタカナ→ひらがな、大文字→小文字）
// ─────────────────────────────────────────────────
function normalize(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\u30a1-\u30f6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

// ─────────────────────────────────────────────────
// 業種・分野の同義語グループ
// ─────────────────────────────────────────────────
const SYNONYM_GROUPS: string[][] = [
  ['銀行', 'ばんく', 'bank', '金融', '信用金庫', '信金', 'ふぁいなんす', '証券', '投資'],
  ['建設', '工務', '建築', '土木', 'ぜねこん', '施工', '工事', 'りふぉーむ'],
  ['医療', '病院', 'くりにっく', '医院', '診療', '歯科', '薬局', '調剤', '介護'],
  ['it', 'しすてむ', 'そふとうぇあ', 'てっく', 'てくのろじー', 'web', 'でじたる', 'ねっと', '通信'],
  ['不動産', '住宅', '建物', 'はうす', 'ほーむ', 'まんしょん', '賃貸', '売買'],
  ['製造', 'めーかー', '工場', '産業', '機械', '部品', '加工', '組立'],
  ['保険', 'いんしゅあらんす', '共済', '生命', '損害'],
  ['自動車', '車', 'かー', 'もーたー', '整備', 'でぃーらー'],
  ['食品', '飲食', 'れすとらん', 'ふーど', '料理', 'かふぇ', '食材', '農産', '水産'],
  ['教育', '学校', '大学', '学院', 'すくーる', '塾', '研修', '予備校'],
  ['物流', '運輸', '配送', 'ろじすてぃくす', '運送', '倉庫', '流通'],
  ['小売', '販売', 'しょっぷ', '店舗', '商店'],
  ['広告', '宣伝', 'まーけてぃんぐ', 'ぴーあーる', 'めでぃあ', '印刷'],
  ['法律', '弁護士', '司法書士', '行政書士', '法務', '特許', '弁理士'],
  ['会計', '税理士', '経理', '監査', '財務'],
  ['観光', 'ほてる', '旅館', '旅行', 'りぞーと', '宿泊'],
  ['農業', '農産', '林業', '漁業', '水産', '畜産'],
  ['えねるぎー', '電力', 'がす', '石油', '再生可能', '太陽光'],
];

function isSemanticallySimilar(na: string, nb: string): boolean {
  for (const group of SYNONYM_GROUPS) {
    const normGroup = group.map(normalize);
    const aInGroup = normGroup.some((w) => na.includes(w) || w.includes(na));
    const bInGroup = normGroup.some((w) => nb.includes(w) || w.includes(nb));
    if (aInGroup && bInGroup) return true;
  }
  return false;
}

function isSimilar(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na.includes(nb) || nb.includes(na)) return true;
  return isSemanticallySimilar(na, nb);
}

/** 完全一致チェック（重複防止用・正規化比較） */
function isExactDuplicate(a: string, b: string): boolean {
  return normalize(a) === normalize(b);
}

// ─────────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────────
type PendingCategory = { name: string; color: string };

type Props = {
  categories: (Category & { usage?: number })[];
  initialSelectedIds?: string[];
  ocrTexts?: string[];
};

// ─────────────────────────────────────────────────
// メインコンポーネント
// ─────────────────────────────────────────────────
export default function CategorySelector({
  categories,
  initialSelectedIds = [],
  ocrTexts = [],
}: Props) {
  const [selectedIds,       setSelectedIds]       = useState<string[]>(initialSelectedIds);
  const [showNew,           setShowNew]           = useState(false);
  const [newName,           setNewName]           = useState('');
  const [newColor,          setNewColor]          = useState(COLOR_PALETTE[0]);
  const [pendingCategories, setPendingCategories] = useState<PendingCategory[]>([]);
  const [ocrSuggested,      setOcrSuggested]      = useState<string[]>([]);
  const [duplicateError,    setDuplicateError]    = useState('');

  // 色変更UI
  const [editingColorId, setEditingColorId] = useState<string | null>(null);
  const [localColors,    setLocalColors]    = useState<Record<string, string>>({});

  // ── OCR 自動判別 ──
  useEffect(() => {
    if (ocrTexts.length === 0) return;
    const allText = ocrTexts.join(' ');
    const suggested = categories
      .filter((cat) => isSimilar(cat.name, allText))
      .map((cat) => cat.id);
    setOcrSuggested(suggested);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ocrTexts.join(',')]);

  // ── カテゴリーのトグル選択 ──
  function toggleCategory(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  // ── 新規カテゴリーを保留リストに追加（重複防止つき）──
  function addToPending() {
    const trimmed = newName.trim();
    if (!trimmed) return;

    // 既存カテゴリーと重複チェック
    const existingDup = categories.find((c) => isExactDuplicate(c.name, trimmed));
    if (existingDup) {
      setDuplicateError(`「${existingDup.name}」はすでに登録されています。選択してください。`);
      return;
    }
    // 保留リストと重複チェック
    const pendingDup = pendingCategories.find((p) => isExactDuplicate(p.name, trimmed));
    if (pendingDup) {
      setDuplicateError(`「${pendingDup.name}」はすでに追加済みです。`);
      return;
    }

    setDuplicateError('');
    setPendingCategories((prev) => [...prev, { name: trimmed, color: newColor }]);
    setNewName('');
    setNewColor(COLOR_PALETTE[0]);
  }

  function removePending(index: number) {
    setPendingCategories((prev) => prev.filter((_, i) => i !== index));
  }

  // ── 既存カテゴリーの色を即座に変更（DB更新）──
  async function handleColorChange(catId: string, color: string) {
    // 楽観的UI更新（DB応答を待たずに即座に反映）
    setLocalColors((prev) => ({ ...prev, [catId]: color }));
    setEditingColorId(null);
    // DB更新
    const result = await updateCategoryColorAction(catId, color);
    if (!result.ok) {
      // 失敗時はロールバック
      setLocalColors((prev) => {
        const next = { ...prev };
        delete next[catId];
        return next;
      });
      console.warn('[CategorySelector] 色変更失敗:', result.error);
    }
  }

  // ── 表記ゆれ候補（新規名入力中） ──
  const similarCategories = useMemo(() => {
    if (!newName.trim()) return [];
    // 完全一致は重複エラーで処理するため除外
    return categories.filter(
      (cat) => isSimilar(cat.name, newName) && !isExactDuplicate(cat.name, newName)
    );
  }, [newName, categories]);

  // 名前変更時に重複エラーをリセット
  function handleNameChange(value: string) {
    setNewName(value);
    if (duplicateError) setDuplicateError('');
  }

  // ─────────────────────────────────────────────
  // レンダリング
  // ─────────────────────────────────────────────
  return (
    // w-full + overflow-hidden で横はみ出しを防止
    <div className="w-full overflow-hidden flex flex-col gap-4">

      {/* ── OCR 自動判別バナー ──────────────────── */}
      {ocrSuggested.length > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
          <Lightbulb size={14} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700 leading-relaxed">
            名刺の内容から関連するカテゴリーを検出しました。選択してください。
          </p>
        </div>
      )}

      {/* ── 既存カテゴリーのチップ一覧 ──────────── */}
      {categories.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-1">
          カテゴリーはまだ作成されていません
        </p>
      ) : (
        <>
          {/* flex-wrap で折り返し、min-h で最小高さを確保 */}
          <div className="w-full flex flex-wrap gap-2 min-h-[40px]">
            {categories.map((cat) => {
              const isSelected   = selectedIds.includes(cat.id);
              const isSuggested  = ocrSuggested.includes(cat.id) && !isSelected;
              const currentColor = localColors[cat.id] ?? cat.color;
              const isEditingThis = editingColorId === cat.id;
              return (
                <div key={cat.id} className="relative inline-flex shrink-0">
                  {/* チップ本体 */}
                  <button
                    type="button"
                    onClick={() => {
                      toggleCategory(cat.id);
                      // 色変更パレットを開いていたら閉じる
                      if (editingColorId === cat.id) setEditingColorId(null);
                    }}
                    className={[
                      'flex items-center gap-1 min-h-[36px] pl-3 pr-8 rounded-full text-xs font-semibold',
                      'border transition-all active:scale-95 whitespace-nowrap',
                      isSelected
                        ? 'text-white border-transparent shadow-sm'
                        : isSuggested
                          ? 'bg-amber-50 border-amber-300 text-amber-700'
                          : 'bg-gray-50 text-gray-500 border-gray-200',
                    ].join(' ')}
                    style={isSelected ? { backgroundColor: currentColor, borderColor: currentColor } : {}}
                  >
                    {isSuggested && <span className="text-amber-500">★</span>}
                    {cat.name}
                    {!!cat.usage && (
                      <span className={`text-[10px] opacity-60 ${isSelected ? '' : 'text-gray-400'}`}>
                        {cat.usage}
                      </span>
                    )}
                  </button>

                  {/* 色変更ボタン（チップ右端の色丸） */}
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault(); // iOS の遅延防止
                      e.stopPropagation();
                      setEditingColorId(isEditingThis ? null : cat.id);
                    }}
                    className={[
                      'absolute right-1.5 top-1/2 -translate-y-1/2',
                      'w-5 h-5 rounded-full border-2 border-white shadow-md',
                      'transition-transform active:scale-90',
                      isEditingThis ? 'ring-2 ring-gray-400 ring-offset-1' : '',
                    ].join(' ')}
                    style={{ backgroundColor: currentColor }}
                    aria-label={`${cat.name}の色を変更`}
                  />
                </div>
              );
            })}
          </div>

          {/* 色変更パレット（選択中チップの直下にインライン表示） */}
          {editingColorId !== null && (
            <div className="w-full bg-white rounded-2xl border border-[#81d8d0]/30 p-3 flex flex-col gap-2">
              <p className="text-xs text-gray-500 font-medium">
                「{categories.find((c) => c.id === editingColorId)?.name}」の色を変更
              </p>
              <div className="flex flex-wrap gap-3">
                {COLOR_PALETTE.map((color) => {
                  const isCurrent =
                    (localColors[editingColorId] ??
                      categories.find((c) => c.id === editingColorId)?.color) === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        handleColorChange(editingColorId, color);
                      }}
                      className={[
                        'w-9 h-9 rounded-full flex items-center justify-center',
                        'transition-transform active:scale-90',
                        isCurrent ? 'ring-2 ring-offset-2 ring-gray-600 scale-110' : '',
                      ].join(' ')}
                      style={{ backgroundColor: color }}
                      aria-label={`カラー ${color}`}
                    >
                      {isCurrent && (
                        <Check size={14} className="text-white drop-shadow" strokeWidth={3} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── 選択済みカテゴリーを hidden input で送信 ── */}
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name="category_ids" value={id} />
      ))}

      {/* ── 保留中の新規カテゴリーを hidden input で送信 ── */}
      {pendingCategories.map((pc, i) => (
        <span key={i}>
          <input type="hidden" name="new_category_name"  value={pc.name} />
          <input type="hidden" name="new_category_color" value={pc.color} />
        </span>
      ))}

      {/* ── 保留中カテゴリーのプレビューチップ ─────── */}
      {pendingCategories.length > 0 && (
        <div className="w-full flex flex-col gap-2 bg-[#f0fbfa] rounded-xl px-3 py-2.5 border border-[#c8f0ee]">
          <p className="text-[10px] text-[#3a9e97] font-semibold">
            保存時に新規作成されます:
          </p>
          <div className="flex flex-wrap gap-2">
            {pendingCategories.map((pc, i) => (
              <div
                key={i}
                className="flex items-center gap-1 rounded-full pr-1 pl-3 py-1 text-white text-xs font-semibold shrink-0"
                style={{ backgroundColor: pc.color }}
              >
                <span className="max-w-[120px] truncate">{pc.name}</span>
                <button
                  type="button"
                  onClick={() => removePending(i)}
                  className="w-4 h-4 flex items-center justify-center opacity-80 hover:opacity-100 shrink-0"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 新規カテゴリー追加フォーム ──────────── */}
      {!showNew ? (
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="
            self-start flex items-center gap-1.5
            min-h-[36px] px-4 rounded-full
            border border-dashed border-gray-300 text-gray-400
            text-xs font-medium
            hover:border-[#81d8d0] hover:text-[#81d8d0]
            transition-colors
          "
        >
          <Plus size={13} />
          新しいカテゴリーを追加
        </button>
      ) : (
        // w-full + overflow-hidden でフォームが親幅を超えないよう制約
        <div className="w-full overflow-hidden bg-gray-50 rounded-2xl p-4 flex flex-col gap-3 border border-gray-100">
          {/* ヘッダー */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-gray-600 shrink-0">新しいカテゴリーを追加</p>
            <button
              type="button"
              onClick={() => { setShowNew(false); setNewName(''); setDuplicateError(''); }}
              className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors shrink-0"
            >
              <X size={14} />
            </button>
          </div>

          {/* カテゴリー名の入力 + 追加ボタン
              横はみ出し対策: 親に w-full、input に min-w-0 flex-1 */}
          <div className="flex gap-2 w-full min-w-0">
            <input
              type="text"
              placeholder="例：製造業、取引先、VIP"
              value={newName}
              onChange={(e) => handleNameChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addToPending(); } }}
              className="
                flex-1 min-w-0 min-h-[44px] px-3 py-2
                bg-white border border-gray-200 rounded-xl
                text-sm text-gray-800 placeholder:text-gray-300
                focus:outline-none focus:ring-2 focus:ring-[#81d8d0] focus:border-transparent
                transition-shadow
              "
            />
            <button
              type="button"
              onClick={addToPending}
              disabled={!newName.trim()}
              className="
                shrink-0 w-11 h-11 self-center
                flex items-center justify-center
                bg-[#81d8d0] hover:bg-[#5bbfb6] active:bg-[#4aafa8]
                disabled:opacity-40 disabled:cursor-not-allowed
                text-white rounded-xl transition-colors
              "
              aria-label="カテゴリーを追加"
            >
              <Plus size={18} strokeWidth={2.5} />
            </button>
          </div>

          {/* 重複エラー */}
          {duplicateError && (
            <p className="text-xs text-red-500 leading-snug">{duplicateError}</p>
          )}

          {/* 表記ゆれ候補 */}
          {similarCategories.length > 0 && !duplicateError && (
            <div className="flex items-start gap-1.5">
              <Lightbulb size={12} className="text-amber-500 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-600 leading-snug">
                似た名前があります。既存のものを使いませんか？
                {' '}
                {similarCategories.map((cat, i) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      toggleCategory(cat.id);
                      setShowNew(false);
                      setNewName('');
                    }}
                    className="underline text-[#3a9e97] font-semibold"
                  >
                    {cat.name}{i < similarCategories.length - 1 ? '、' : ''}
                  </button>
                ))}
              </p>
            </div>
          )}

          {/* カラーパレット
              iOS対策: onPointerDown + e.preventDefault() でフォームsubmit防止
              タッチターゲット: w-9 h-9（36px）で十分な大きさを確保 */}
          <div>
            <p className="text-[10px] text-gray-400 mb-2 flex items-center gap-1">
              <Palette size={11} />
              カラーを選択
            </p>
            <div className="flex flex-wrap gap-3">
              {COLOR_PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault(); // iOS でのフォームsubmit防止
                    setNewColor(color);
                  }}
                  className={[
                    'w-9 h-9 rounded-full flex items-center justify-center',
                    'transition-transform active:scale-90',
                    newColor === color ? 'ring-2 ring-offset-2 ring-gray-600 scale-110' : '',
                  ].join(' ')}
                  style={{ backgroundColor: color }}
                  aria-label={`カラー ${color}`}
                >
                  {newColor === color && (
                    <Check size={14} className="text-white drop-shadow" strokeWidth={3} />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* プレビュー */}
          {newName.trim() && !duplicateError && (
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="px-3 py-1 rounded-full text-xs font-semibold text-white shrink-0"
                style={{ backgroundColor: newColor }}
              >
                {newName}
              </span>
              <p className="text-xs text-gray-400">← ＋ボタンでリストに追加</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
