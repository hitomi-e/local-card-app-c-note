'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
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
} from 'lucide-react';
import { updateCardAction, type EditFormState } from './actions';
import type { Category } from '@/types/cards';
import CategorySelector from '@/components/cards/CategorySelector';
import { SaveSuccessOverlay } from '@/components/ui/SaveSuccessOverlay';
import { VoiceMemoButton } from '@/components/ui/VoiceMemoButton';

// ============================================================
// フォーム値の型
// ============================================================
export type FormValues = {
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

// ============================================================
// 送信ボタン
// ============================================================
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="
        w-full min-h-[58px]
        bg-[#81d8d0] hover:bg-[#5bbfb6] active:bg-[#4aafa8]
        text-white text-base font-bold
        rounded-2xl transition-colors
        disabled:opacity-60 disabled:cursor-not-allowed
      "
    >
      {pending ? '保存中...' : '変更を保存する'}
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
const initialState: EditFormState = {};

export function CardEditForm({
  cardId,
  initialValues,
  categories,
  initialCategoryIds,
}: {
  cardId: string;
  initialValues: FormValues;
  categories: (Category & { usage?: number })[];
  initialCategoryIds: string[];
}) {
  // bind() で cardId を Server Action に渡す（Next.js 公式パターン）
  const boundAction = updateCardAction.bind(null, cardId);
  const [state, formAction] = useActionState(boundAction, initialState);
  const [values,      setValues]      = useState<FormValues>(initialValues);
  const [showSuccess, setShowSuccess] = useState(false); // お祝いオーバーレイ表示フラグ

  // 更新成功 → お祝いオーバーレイを表示（オーバーレイ側が 2 秒後に /dashboard へ遷移）
  useEffect(() => {
    if (!state.ok) return;
    console.log('[CardEditForm] ✓ 更新成功 → SaveSuccessOverlay を表示');
    setShowSuccess(true);
  }, [state.ok]);

  /** フィールドを汎用的に更新するハンドラーを生成 */
  function fieldHandler(key: keyof FormValues) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((prev) => ({ ...prev, [key]: e.target.value }));
  }

  return (
    <>
    {/* 保存成功お祝いオーバーレイ（フォームの外、最前面に表示） */}
    {showSuccess && <SaveSuccessOverlay redirectTo="/dashboard" />}

    <form action={formAction} className="flex flex-col gap-5">

      {/* エラーメッセージ */}
      {state.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {state.error}
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
              rows={4}
              placeholder="例：ゴルフが趣味。〇〇の交流会で知り合った。"
              value={values.free_memo}
              onChange={fieldHandler('free_memo')}
              className="
                px-4 py-3
                bg-white border border-gray-200 rounded-xl
                text-sm text-gray-800 placeholder:text-gray-300
                focus:outline-none focus:ring-2 focus:ring-[#81d8d0] focus:border-transparent
                transition-shadow resize-none
              "
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
            initialSelectedIds={initialCategoryIds}
          />
        </SectionCard>
      </div>

      {/* ── 送信 ── */}
      <div className="pb-4">
        <p className="text-xs text-gray-400 text-center mb-3">
          <span className="text-red-400">*</span> 会社名または名前のいずれかは必須です
        </p>
        <SubmitButton />
      </div>

    </form>
    </>
  );
}
