'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Building2,
  User,
  Phone,
  Mail,
  Globe,
  Hash,
  Smartphone,
  NotebookPen,
  Tag,
  CheckCircle,
} from 'lucide-react';
import { createCardAction, updateCardByIdAction } from './actions';
import { OCR_SESSION_KEY, SCAN_IMAGE_PATH_KEY, SCAN_BACK_IMAGE_PATH_KEY } from '@/app/(app)/scan/page';
import type { CardOcrResult } from '@/lib/ocr/gemini';
import type { Category } from '@/types/cards';
import CategorySelector from '@/components/cards/CategorySelector';
import { SaveSuccessOverlay } from '@/components/ui/SaveSuccessOverlay';
import { VoiceMemoButton } from '@/components/ui/VoiceMemoButton';

// ============================================================
// フォーム値の型（すべて string で管理 ※ null は空文字に変換）
// ============================================================
type FormValues = {
  company_name: string;
  company_name_reading: string;
  industry: string;
  branch_office: string;
  department: string;
  position: string;
  full_name: string;
  name_reading: string;
  postal_code: string;
  address: string;
  company_phone: string;
  extension: string;
  mobile_phone: string;
  email: string;
  website_url: string;
  free_memo: string;
};

const emptyValues: FormValues = {
  company_name: '',
  company_name_reading: '',
  industry: '',
  branch_office: '',
  department: '',
  position: '',
  full_name: '',
  name_reading: '',
  postal_code: '',
  address: '',
  company_phone: '',
  extension: '',
  mobile_phone: '',
  email: '',
  website_url: '',
  free_memo: '',
};

/** CardOcrResult（null あり）を FormValues（空文字）に変換 */
function ocrToFormValues(ocr: Partial<CardOcrResult>): FormValues {
  return {
    company_name:         ocr.company_name         ?? '',
    company_name_reading: ocr.company_name_reading ?? '',
    industry:             ocr.industry             ?? '',
    branch_office:        ocr.branch_office        ?? '',
    department:           ocr.department           ?? '',
    position:             ocr.position             ?? '',
    full_name:            ocr.full_name            ?? '',
    name_reading:         ocr.name_reading         ?? '',
    postal_code:          ocr.postal_code          ?? '',
    address:              ocr.address              ?? '',
    company_phone:        ocr.company_phone        ?? '',
    extension:            ocr.extension            ?? '',
    mobile_phone:         ocr.mobile_phone         ?? '',
    email:                ocr.email                ?? '',
    website_url:          ocr.website_url          ?? '',
    free_memo:            ocr.free_memo ?? '', // 裏面の補足情報があれば自動入力
  };
}

// ============================================================
// 送信ボタン
// ============================================================
function SubmitButton({ pending, onClick }: { pending: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="
        w-full min-h-[58px]
        bg-[#81d8d0] hover:bg-[#5bbfb6] active:bg-[#4aafa8]
        text-white text-base font-bold
        rounded-2xl transition-colors
        disabled:opacity-60 disabled:cursor-not-allowed
      "
    >
      {pending ? '登録中...' : 'この名刺を名刺帳へ登録する'}
    </button>
  );
}

// ============================================================
// セクション見出し
// ============================================================
function SectionHeading({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[#81d8d0]">{icon}</span>
      <h2 className="text-sm font-semibold text-gray-500 tracking-wide">{label}</h2>
    </div>
  );
}

// ============================================================
// セクションカード
// ============================================================
function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-4">
      {children}
    </div>
  );
}

// ============================================================
// 共通入力フィールド
// ============================================================
function FormField({
  label,
  note,
  name,
  type = 'text',
  placeholder,
  required,
  inputMode,
  value,
  onChange,
}: {
  label: string;
  note?: string;   // ラベル横に表示する小さな補足テキスト（任意）
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-xs font-medium text-gray-500 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
        {note && <span className="text-[11px] text-gray-400 font-normal">{note}</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        inputMode={inputMode}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="
          min-h-[48px] px-4 py-2
          bg-white border border-gray-200 rounded-xl
          text-sm text-gray-800 placeholder:text-gray-300
          focus:outline-none focus:ring-2 focus:ring-[#81d8d0] focus:border-transparent
          transition-shadow
        "
      />
    </div>
  );
}

// ============================================================
// アイコン付き入力フィールド
// ============================================================
function IconField({
  label,
  id,
  name,
  type = 'text',
  inputMode,
  placeholder,
  icon,
  value,
  onChange,
}: {
  label: string;
  id: string;
  name: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  placeholder?: string;
  icon: React.ReactNode;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-gray-500">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none">
          {icon}
        </span>
        <input
          id={id}
          name={name}
          type={type}
          inputMode={inputMode}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className="
            w-full min-h-[48px] pl-9 pr-4 py-2
            bg-white border border-gray-200 rounded-xl
            text-sm text-gray-800 placeholder:text-gray-300
            focus:outline-none focus:ring-2 focus:ring-[#81d8d0] focus:border-transparent
            transition-shadow
          "
        />
      </div>
    </div>
  );
}

// ============================================================
// メインフォームコンポーネント
// ============================================================
export function CardForm({ categories }: { categories: (Category & { usage?: number })[] }) {
  const [values,      setValues]      = useState<FormValues>(emptyValues);
  const [ocrLoaded,   setOcrLoaded]   = useState(false);
  const [imagePath,   setImagePath]   = useState<string>('');
  const [backImagePath, setBackImagePath] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState(false); // お祝いオーバーレイ表示フラグ
  const [ocrTexts,    setOcrTexts]    = useState<string[]>([]); // OCR自動判別用テキスト

  // 保存処理ステート
  const [saving,      setSaving]      = useState(false);
  const [cardError,   setCardError]   = useState<string | null>(null);
  const savingRef = useRef(false); // React 19 の二重起動防止

  // 重複ダイアログ関連
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicateCardId,     setDuplicateCardId]     = useState<string | null>(null);
  const [isUpdating,          setIsUpdating]          = useState(false);
  const [updateError,         setUpdateError]         = useState<string | null>(null);

  // フォーム全体の ref（FormData 取得・「別の名刺として保存」に使用）
  const formRef = useRef<HTMLFormElement>(null);

  // フリーメモ textarea ref（自動高さ拡張に使用）
  const freeMemoRef = useRef<HTMLTextAreaElement>(null);

  /** フォーム送信（useActionState の代わりに手動で呼び出す） */
  async function handleSubmit() {
    if (savingRef.current || !formRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setCardError(null);

    const fd = new FormData(formRef.current);
    const result = await createCardAction({}, fd);

    savingRef.current = false;
    setSaving(false);

    if (result.ok) {
      setShowSuccess(true);
    } else if (result.duplicateId) {
      setDuplicateCardId(result.duplicateId);
      setShowDuplicateDialog(true);
      setUpdateError(null);
    } else if (result.error) {
      setCardError(result.error);
    }
  }

  /** 重複ダイアログで「更新する」を選択した際の処理 */
  async function handleConfirmUpdate() {
    if (!duplicateCardId || !formRef.current) return;
    setIsUpdating(true);
    setUpdateError(null);

    // フォーム全体（hidden inputのimage_path・category_ids含む）を一括取得
    const fd = new FormData(formRef.current);

    const result = await updateCardByIdAction(duplicateCardId, fd);
    setIsUpdating(false);

    if (result.ok) {
      setShowDuplicateDialog(false);
      setShowSuccess(true);
    } else {
      setUpdateError(result.error ?? '更新に失敗しました。');
    }
  }

  /** 重複ダイアログで「別の名刺として保存」を選択した際の処理 */
  async function handleSaveAsNew() {
    if (!formRef.current || isUpdating) return;
    setIsUpdating(true);
    setUpdateError(null);
    setShowDuplicateDialog(false);

    const fd = new FormData(formRef.current);
    fd.set('bypass_duplicate_check', 'true');

    const result = await createCardAction({}, fd);
    setIsUpdating(false);

    if (result.ok) {
      setShowDuplicateDialog(false);
      setShowSuccess(true);
    } else {
      setUpdateError(result.error ?? '登録に失敗しました。');
      setShowDuplicateDialog(true);
    }
  }

  // OCR 読み込み後にフリーメモの高さを自動調整（裏面情報が入っている場合に対応）
  useEffect(() => {
    if (!ocrLoaded) return;
    const el = freeMemoRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [ocrLoaded]);

  // sessionStorage から OCR 結果 + 画像パスを読み込む（スキャン後の遷移時のみ実行）
  useEffect(() => {
    // OCR 結果
    const stored = sessionStorage.getItem(OCR_SESSION_KEY);
    if (stored) {
      try {
        const ocr = JSON.parse(stored) as Partial<CardOcrResult>;
        setValues(ocrToFormValues(ocr));
        setOcrLoaded(true);
        // OCR テキストを自動判別用に保存（カテゴリー提案に使用）
        setOcrTexts([
          ocr.company_name, ocr.branch_office, ocr.department, ocr.position,
        ].filter((t): t is string => !!t));
      } catch {
        // 解析失敗時は無視してフォームを空のまま表示
      }
      sessionStorage.removeItem(OCR_SESSION_KEY);
    }

    // Storage アップロード済み表面画像パス
    const storedPath = sessionStorage.getItem(SCAN_IMAGE_PATH_KEY);
    if (storedPath) {
      console.log('[CardForm] 表面画像パス読み込み:', storedPath);
      setImagePath(storedPath);
      sessionStorage.removeItem(SCAN_IMAGE_PATH_KEY);
    }

    // Storage アップロード済み裏面画像パス
    const storedBackPath = sessionStorage.getItem(SCAN_BACK_IMAGE_PATH_KEY);
    if (storedBackPath) {
      console.log('[CardForm] 裏面画像パス読み込み:', storedBackPath);
      setBackImagePath(storedBackPath);
      sessionStorage.removeItem(SCAN_BACK_IMAGE_PATH_KEY);
    }
  }, []);

  /** フィールドを汎用的に更新するハンドラーを生成 */
  function fieldHandler(key: keyof FormValues) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((prev) => ({ ...prev, [key]: e.target.value }));
  }

  return (
    <>
    {/* 保存成功お祝いオーバーレイ（フォームの外、最前面に表示） */}
    {showSuccess && <SaveSuccessOverlay redirectTo="/dashboard" />}

    {/* ── 重複確認ダイアログ ── */}
    {showDuplicateDialog && (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#e8f8f7] flex items-center justify-center shrink-0">
              <CheckCircle size={20} className="text-[#81d8d0]" />
            </div>
            <p className="text-base font-bold text-gray-800">既に登録があります</p>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            <span className="font-semibold">{values.full_name || values.company_name || '—'}</span>
            {values.full_name && values.company_name && (
              <span className="text-gray-400">（{values.company_name}）</span>
            )}
            さんはすでに登録されています。どうしますか？
          </p>
          <p className="text-xs text-gray-400 -mt-1">
            ※ メモとカテゴリーは現在の設定を保持（または追記）します。
          </p>
          {updateError && (
            <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{updateError}</p>
          )}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleConfirmUpdate}
              disabled={isUpdating}
              className="w-full py-3 rounded-xl text-sm font-bold text-white
                         hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
              style={{ backgroundColor: '#81d8d0' }}
            >
              {isUpdating ? '更新中...' : '上書き保存する'}
            </button>
            <button
              type="button"
              onClick={handleSaveAsNew}
              disabled={isUpdating}
              className="w-full py-3 rounded-xl text-sm font-medium text-gray-700
                         bg-gray-100 hover:bg-gray-200 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              別の名刺として保存
            </button>
            <button
              type="button"
              onClick={() => setShowDuplicateDialog(false)}
              disabled={isUpdating}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-gray-400
                         hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              キャンセル
            </button>
          </div>
        </div>
      </div>
    )}

    <form ref={formRef} onSubmit={e => e.preventDefault()} className="flex flex-col gap-5">
      {/* Storage アップロード済み画像パス（サーバーアクションへ渡す） */}
      <input type="hidden" name="image_path"      value={imagePath} />
      <input type="hidden" name="back_image_path" value={backImagePath} />

      {/* OCR 自動入力バナー */}
      {ocrLoaded && (
        <div className="bg-[#e8f8f7] border border-[#81d8d0] rounded-xl px-4 py-3 text-sm text-[#3a9e97]">
          ご縁がつながりました！名刺の内容をAIが読み取りました。内容を確認いただき修正・追加してから登録してください
        </div>
      )}

      {/* エラーメッセージ（ダイアログ表示中は非表示、閉じた後に表示） */}
      {cardError && !showDuplicateDialog && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {cardError}
        </div>
      )}

      {/* ── 会社情報 ── */}
      <div>
        <SectionHeading icon={<Building2 size={16} />} label="会社情報" />
        <SectionCard>
          <FormField
            label="会社名"
            name="company_name"
            placeholder="例：株式会社〇〇"
            required
            value={values.company_name}
            onChange={fieldHandler('company_name')}
          />
          <FormField
            label="会社名（ふりがな）"
            note="※「株式会社」等は不要、入力すると会社名順に並びます"
            name="company_name_reading"
            placeholder="例：おりづるぎんこう"
            value={values.company_name_reading}
            onChange={fieldHandler('company_name_reading')}
          />
          <FormField
            label="業種"
            note="※入力すると最新ニュースの表示精度が高くなります"
            name="industry"
            placeholder="例：保険代理店・建設業・ITサービス"
            value={values.industry}
            onChange={fieldHandler('industry')}
          />
          <FormField
            label="営業所名"
            name="branch_office"
            placeholder="例：広島中央支店"
            value={values.branch_office}
            onChange={fieldHandler('branch_office')}
          />
          <FormField
            label="部署名"
            name="department"
            placeholder="例：第一営業部"
            value={values.department}
            onChange={fieldHandler('department')}
          />
          <FormField
            label="役職"
            name="position"
            placeholder="例：部長"
            value={values.position}
            onChange={fieldHandler('position')}
          />
        </SectionCard>
      </div>

      {/* ── 担当者情報 ── */}
      <div>
        <SectionHeading icon={<User size={16} />} label="担当者情報" />
        <SectionCard>
          <FormField
            label="名前"
            name="full_name"
            placeholder="例：山田 太郎"
            required
            value={values.full_name}
            onChange={fieldHandler('full_name')}
          />
          <FormField
            label="名前（ふりがな）"
            name="name_reading"
            placeholder="例：やまだ たろう"
            value={values.name_reading}
            onChange={fieldHandler('name_reading')}
          />
        </SectionCard>
      </div>

      {/* ── 連絡先 ── */}
      <div>
        <SectionHeading icon={<Phone size={16} />} label="連絡先" />
        <SectionCard>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="郵便番号"
              name="postal_code"
              placeholder="例：730-0011"
              inputMode="numeric"
              value={values.postal_code}
              onChange={fieldHandler('postal_code')}
            />
            <div />
          </div>
          <FormField
            label="住所"
            name="address"
            placeholder="例：広島県広島市中区基町1-1"
            value={values.address}
            onChange={fieldHandler('address')}
          />
          {/* 会社電話番号 + 内線 */}
          <div className="flex flex-col gap-1">
            <label htmlFor="company_phone" className="text-xs font-medium text-gray-500">
              会社電話番号
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
                <input
                  id="company_phone"
                  name="company_phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="例：082-000-0000"
                  value={values.company_phone}
                  onChange={fieldHandler('company_phone')}
                  className="
                    w-full min-h-[48px] pl-9 pr-4 py-2
                    bg-white border border-gray-200 rounded-xl
                    text-sm text-gray-800 placeholder:text-gray-300
                    focus:outline-none focus:ring-2 focus:ring-[#81d8d0] focus:border-transparent
                    transition-shadow
                  "
                />
              </div>
              <div className="relative w-28">
                <Hash size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
                <input
                  name="extension"
                  type="text"
                  inputMode="numeric"
                  placeholder="内線"
                  value={values.extension}
                  onChange={fieldHandler('extension')}
                  className="
                    w-full min-h-[48px] pl-9 pr-3 py-2
                    bg-white border border-gray-200 rounded-xl
                    text-sm text-gray-800 placeholder:text-gray-300
                    focus:outline-none focus:ring-2 focus:ring-[#81d8d0] focus:border-transparent
                    transition-shadow
                  "
                />
              </div>
            </div>
          </div>
          <IconField
            label="携帯電話番号"
            id="mobile_phone"
            name="mobile_phone"
            type="tel"
            inputMode="tel"
            placeholder="例：090-0000-0000"
            icon={<Smartphone size={15} />}
            value={values.mobile_phone}
            onChange={fieldHandler('mobile_phone')}
          />
          <IconField
            label="メールアドレス"
            id="email"
            name="email"
            type="email"
            inputMode="email"
            placeholder="例：yamada@example.com"
            icon={<Mail size={15} />}
            value={values.email}
            onChange={fieldHandler('email')}
          />
          <IconField
            label="WebサイトURL"
            id="website_url"
            name="website_url"
            type="url"
            inputMode="url"
            placeholder="例：https://example.com"
            icon={<Globe size={15} />}
            value={values.website_url}
            onChange={fieldHandler('website_url')}
          />
        </SectionCard>
      </div>

      {/* ── フリーメモ ── */}
      <div>
        <SectionHeading icon={<NotebookPen size={16} />} label="フリーメモ" />
        <SectionCard>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label htmlFor="free_memo" className="text-xs font-medium text-gray-500">
                メモ（趣味・出会いのきっかけなど）
              </label>
              <VoiceMemoButton
                onAppend={(text) =>
                  setValues((prev) => ({
                    ...prev,
                    free_memo: prev.free_memo ? prev.free_memo + '\n' + text : text,
                  }))
                }
              />
            </div>
            <textarea
              id="free_memo"
              name="free_memo"
              ref={freeMemoRef}
              placeholder="例：ゴルフが趣味。〇〇の交流会で知り合った。"
              value={values.free_memo}
              onChange={fieldHandler('free_memo')}
              onInput={(e) => {
                // 入力に合わせて高さを自動拡張（iPhone でもスクロール不要）
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = `${el.scrollHeight}px`;
              }}
              className="
                px-4 py-3
                bg-white border border-gray-200 rounded-xl
                text-sm text-gray-800 placeholder:text-gray-300
                focus:outline-none focus:ring-2 focus:ring-[#81d8d0] focus:border-transparent
                transition-shadow resize-none overflow-hidden
              "
              style={{ minHeight: '96px' }}
            />
          </div>
        </SectionCard>
      </div>

      {/* ── カテゴリー ── */}
      <div>
        <SectionHeading icon={<Tag size={16} />} label="カテゴリー" />
        <SectionCard>
          <CategorySelector
            categories={categories}
            ocrTexts={ocrTexts}
          />
        </SectionCard>
      </div>

      {/* ── 送信 ── */}
      <div className="pb-4">
        <p className="text-xs text-gray-400 text-center mb-3">
          <span className="text-red-400">*</span> 会社名または名前のいずれかは必須です
        </p>
        <SubmitButton pending={saving} onClick={handleSubmit} />
      </div>

    </form>
    </>
  );
}
