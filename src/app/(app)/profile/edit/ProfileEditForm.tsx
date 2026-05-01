'use client';

/**
 * My名刺 編集フォーム（Client Component）
 *
 * セクション構成:
 *   1. 顔写真
 *   2. 基本情報（会社名・ふりがな・営業所・部署・役職）
 *   3. 担当者情報（氏名・ふりがな）
 *   4. 連絡先（郵便番号・住所・電話・内線・携帯・メール・URL）
 *   5. SNS・オンライン（X / Instagram / Facebook / LinkedIn / LINE / YouTube）
 *   6. ビジネス詳細（事業内容・営業時間・定休日・メニュー）
 *   7. 所属団体（1〜5）
 *   8. パーソナル情報（趣味・特技・座右の銘）
 */

import { useActionState, useEffect, useRef, useState } from 'react';
// useFormStatus は SubmitButton を prop 化したため不要
import {
  Building2,
  User,
  Phone,
  Mail,
  Globe,
  Smartphone,
  MapPin,
  Hash,
  Briefcase,
  ListOrdered,
  Smile,
  Camera,
} from 'lucide-react';
import { upsertProfileAction, type ProfileFormState } from './actions';
import type { Profile } from '@/types/profile';
import { SaveSuccessOverlay } from '@/components/ui/SaveSuccessOverlay';

// ============================================================
// クライアント側画像リサイズ
// 長辺を maxPx 以下に縮小し JPEG に変換する。
// すでに小さい場合・エラー時はそのままを返す（アップロード自体は中断しない）
// ============================================================
async function resizeImage(file: File, maxPx = 1200, quality = 0.85): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const blobUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(blobUrl);
      const { width, height } = img;
      if (width <= maxPx && height <= maxPx) { resolve(file); return; }
      const scale = Math.min(maxPx / width, maxPx / height);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(width  * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], 'avatar.jpg', { type: 'image/jpeg' }) : file),
        'image/jpeg',
        quality,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(file); };
    img.src = blobUrl;
  });
}

// ============================================================
// 送信ボタン（useFormStatus の代わりに isPending を prop で受け取る）
// ============================================================
function SubmitButton({ isPending, isNew }: { isPending: boolean; isNew: boolean }) {
  return (
    <button
      type="submit"
      disabled={isPending}
      className="
        w-full min-h-[58px]
        bg-[#81d8d0] hover:bg-[#5bbfb6] active:bg-[#4aafa8]
        text-white text-base font-bold
        rounded-2xl transition-colors
        disabled:opacity-60 disabled:cursor-not-allowed
      "
    >
      {isPending ? '保存中...' : (isNew ? 'My名刺を登録する' : 'My名刺を保存する')}
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
// 共通入力フィールド（テキスト）
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
  note?: string;
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
// テキストエリアフィールド
// ============================================================
function TextAreaField({
  label,
  name,
  placeholder,
  rows = 3,
  value,
  onChange,
}: {
  label: string;
  name: string;
  placeholder?: string;
  rows?: number;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-xs font-medium text-gray-500">{label}</label>
      <textarea
        id={name}
        name={name}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="
          px-4 py-3
          bg-white border border-gray-200 rounded-xl
          text-sm text-gray-800 placeholder:text-gray-300
          focus:outline-none focus:ring-2 focus:ring-[#81d8d0] focus:border-transparent
          transition-shadow resize-none
        "
      />
    </div>
  );
}

// ============================================================
// フォーム値の型
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
  sns_x: string;
  sns_instagram: string;
  sns_facebook: string;
  sns_linkedin: string;
  sns_line: string;
  sns_youtube: string;
  business_description: string;
  business_hours: string;
  regular_holiday: string;
  menus: string;
  org_1: string;
  org_2: string;
  org_3: string;
  org_4: string;
  org_5: string;
  hobbies: string;
  skills: string;
  motto: string;
};

/** Profile | null から FormValues に変換 */
function profileToFormValues(profile: Profile | null): FormValues {
  const sns = profile?.sns_links ?? [];
  const getSnsByType = (type: string) => sns.find((s) => s.type === type)?.url ?? '';
  const orgs = profile?.organizations ?? [];

  return {
    company_name:         profile?.company_name         ?? '',
    company_name_reading: profile?.company_name_reading ?? '',
    industry:             profile?.industry             ?? '',
    branch_office:        profile?.branch_office        ?? '',
    department:           profile?.department           ?? '',
    position:             profile?.position             ?? '',
    full_name:            profile?.full_name            ?? '',
    name_reading:         profile?.name_reading         ?? '',
    postal_code:          profile?.postal_code          ?? '',
    address:              profile?.address              ?? '',
    company_phone:        profile?.company_phone        ?? '',
    extension:            profile?.extension            ?? '',
    mobile_phone:         profile?.mobile_phone         ?? '',
    email:                profile?.email                ?? '',
    website_url:          profile?.website_url          ?? '',
    sns_x:                getSnsByType('X'),
    sns_instagram:        getSnsByType('Instagram'),
    sns_facebook:         getSnsByType('Facebook'),
    sns_linkedin:         getSnsByType('LinkedIn'),
    sns_line:             getSnsByType('LINE'),
    sns_youtube:          getSnsByType('YouTube'),
    business_description: profile?.business_description ?? '',
    business_hours:       profile?.business_hours       ?? '',
    regular_holiday:      profile?.regular_holiday      ?? '',
    menus:                profile?.menus                ?? '',
    org_1: orgs[0] ?? '',
    org_2: orgs[1] ?? '',
    org_3: orgs[2] ?? '',
    org_4: orgs[3] ?? '',
    org_5: orgs[4] ?? '',
    hobbies: profile?.hobbies ?? '',
    skills:  profile?.skills  ?? '',
    motto:   profile?.motto   ?? '',
  };
}

// ============================================================
// メインコンポーネント
// ============================================================
export default function ProfileEditForm({
  profile,
  facePhotoUrl,
  logoUrl,
}: {
  profile: Profile | null;
  /** 既存の顔写真の署名付き URL（編集時のプレビュー初期表示用） */
  facePhotoUrl?: string | null;
  /** 既存の会社ロゴの署名付き URL */
  logoUrl?: string | null;
}) {
  const initialState: ProfileFormState = {};
  // React 19: useActionState は [state, dispatch, isPending] の3要素を返す
  const [state, formDispatch, isActionPending] = useActionState(upsertProfileAction, initialState);

  // リサイズ中のフラグ（送信ボタンを無効化するために使用）
  const [isResizing, setIsResizing] = useState(false);
  const isPending = isActionPending || isResizing;

  // フォーム値の状態管理
  const [values, setValues] = useState<FormValues>(() => profileToFormValues(profile));

  // 顔写真プレビュー
  const [photoPreview, setPhotoPreview] = useState<string | null>(facePhotoUrl ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 会社ロゴプレビュー
  const [logoPreview, setLogoPreview] = useState<string | null>(logoUrl ?? null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // ハイドレーション完了後、prop の URL をプレビューに確実に反映する
  useEffect(() => {
    if (facePhotoUrl) setPhotoPreview(facePhotoUrl);
  }, [facePhotoUrl]);

  useEffect(() => {
    if (logoUrl) setLogoPreview(logoUrl);
  }, [logoUrl]);

  // フィールド更新ヘルパー
  const set = (key: keyof FormValues) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setValues((prev) => ({ ...prev, [key]: e.target.value }));

  // 顔写真選択時のプレビュー更新（リサイズは submit 時に実施）
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoPreview(URL.createObjectURL(file));
  };

  // ロゴ選択時のプレビュー更新
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoPreview(URL.createObjectURL(file));
  };

  // フォーム送信 — 画像を事前リサイズして Server Action に渡す
  // React 19: formDispatch 自体が transition 対応のため startTransition で包まない
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const photoEntry = formData.get('face_photo') as File | null;
    if (photoEntry && photoEntry.size > 0) {
      setIsResizing(true);
      try {
        const resized = await resizeImage(photoEntry);
        formData.set('face_photo', resized, 'avatar.jpg');
        console.log(
          '[ProfileEdit] 画像リサイズ完了:',
          `${(photoEntry.size / 1024).toFixed(0)}KB → ${(resized.size / 1024).toFixed(0)}KB`
        );
      } catch (err) {
        console.warn('[ProfileEdit] リサイズ失敗（元ファイルで送信）:', err);
      } finally {
        setIsResizing(false);
      }
    }

    formDispatch(formData);
  };

  // プレビュー URL のクリーンアップ（blob: URL のみ revoke）
  useEffect(() => {
    return () => { if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview); };
  }, [photoPreview]);
  useEffect(() => {
    return () => { if (logoPreview?.startsWith('blob:')) URL.revokeObjectURL(logoPreview); };
  }, [logoPreview]);

  // 保存成功時は SaveSuccessOverlay を表示（自動リダイレクト）
  if (state.ok) {
    return (
      <SaveSuccessOverlay
        redirectTo="/profile"
        message="あなたの名刺を登録しました"
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">

      {/* ── 1. 顔写真 ───────────────────────────── */}
      <div>
        <SectionHeading icon={<Camera size={16} />} label="顔写真" />
        <SectionCard>
          <div className="flex flex-col items-center gap-3">
            {/* プレビュー */}
            <div
              className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 border-2 border-[#81d8d0] flex items-center justify-center cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoPreview} alt="顔写真プレビュー" className="w-full h-full object-cover" />
              ) : (
                <Camera size={32} className="text-gray-300" />
              )}
            </div>
            {/* ファイル選択ボタン */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-sm text-[#81d8d0] font-medium underline underline-offset-2"
            >
              {photoPreview ? '写真を変更する' : '写真を選択する（任意）'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              name="face_photo"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
            <p className="text-[11px] text-gray-400 text-center">
              JPG / PNG / WebP・最大 10MB
            </p>
          </div>
        </SectionCard>
      </div>

      {/* ── 2. 基本情報 ─────────────────────────── */}
      <div>
        <SectionHeading icon={<Building2 size={16} />} label="基本情報" />
        <SectionCard>
          {/* 会社ロゴ */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-gray-500">会社ロゴ（任意）</label>
            <div className="flex items-center gap-4">
              {/* プレビュー */}
              <div
                className="w-24 h-14 rounded-xl overflow-hidden bg-gray-50 border border-gray-200 flex items-center justify-center cursor-pointer shrink-0"
                onClick={() => logoInputRef.current?.click()}
              >
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoPreview} alt="ロゴプレビュー" className="w-full h-full object-contain p-1" />
                ) : (
                  <Building2 size={20} className="text-gray-300" />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="text-sm text-[#81d8d0] font-medium underline underline-offset-2"
                >
                  {logoPreview ? 'ロゴを変更する' : 'ロゴを選択する'}
                </button>
                <p className="text-[11px] text-gray-400">PNG / JPG・透明背景推奨</p>
              </div>
            </div>
            <input
              ref={logoInputRef}
              type="file"
              name="company_logo"
              accept="image/*"
              className="hidden"
              onChange={handleLogoChange}
            />
          </div>

          <FormField
            label="会社名・屋号"
            name="company_name"
            placeholder="例：株式会社おりづる銀行"
            value={values.company_name}
            onChange={set('company_name')}
          />
          <FormField
            label="会社名（ふりがな）"
            note="※「株式会社」等は不要、入力すると会社名順に並びます"
            name="company_name_reading"
            placeholder="例：おりづるぎんこう"
            value={values.company_name_reading}
            onChange={set('company_name_reading')}
          />
          <FormField
            label="業種"
            note="※入力すると最新ニュースの表示精度が高くなります"
            name="industry"
            placeholder="例：保険代理店・建設業・ITサービス"
            value={values.industry}
            onChange={set('industry')}
          />
          <FormField
            label="営業所・支店"
            name="branch_office"
            placeholder="例：広島本社"
            value={values.branch_office}
            onChange={set('branch_office')}
          />
          <FormField
            label="部署"
            name="department"
            placeholder="例：営業推進部"
            value={values.department}
            onChange={set('department')}
          />
          <FormField
            label="役職"
            name="position"
            placeholder="例：代表取締役"
            value={values.position}
            onChange={set('position')}
          />
        </SectionCard>
      </div>

      {/* ── 3. 担当者情報 ───────────────────────── */}
      <div>
        <SectionHeading icon={<User size={16} />} label="担当者情報" />
        <SectionCard>
          <FormField
            label="名前"
            name="full_name"
            placeholder="例：山田 太郎"
            value={values.full_name}
            onChange={set('full_name')}
          />
          <FormField
            label="名前（ふりがな）"
            name="name_reading"
            placeholder="例：やまだ たろう"
            value={values.name_reading}
            onChange={set('name_reading')}
          />
        </SectionCard>
      </div>

      {/* ── 4. 連絡先 ───────────────────────────── */}
      <div>
        <SectionHeading icon={<Phone size={16} />} label="連絡先" />
        <SectionCard>
          <FormField
            label="郵便番号"
            name="postal_code"
            placeholder="例：739-0046"
            inputMode="numeric"
            value={values.postal_code}
            onChange={set('postal_code')}
          />
          <IconField
            label="住所"
            id="address"
            name="address"
            icon={<MapPin size={15} />}
            placeholder="例：広島県東広島市西条本町..."
            value={values.address}
            onChange={set('address')}
          />
          <IconField
            label="会社電話番号"
            id="company_phone"
            name="company_phone"
            type="tel"
            inputMode="tel"
            icon={<Phone size={15} />}
            placeholder="例：082-000-0000"
            value={values.company_phone}
            onChange={set('company_phone')}
          />
          <IconField
            label="内線番号"
            id="extension"
            name="extension"
            inputMode="numeric"
            icon={<Hash size={15} />}
            placeholder="例：123"
            value={values.extension}
            onChange={set('extension')}
          />
          <IconField
            label="携帯電話番号"
            id="mobile_phone"
            name="mobile_phone"
            type="tel"
            inputMode="tel"
            icon={<Smartphone size={15} />}
            placeholder="例：090-0000-0000"
            value={values.mobile_phone}
            onChange={set('mobile_phone')}
          />
          <IconField
            label="メールアドレス"
            id="email"
            name="email"
            type="email"
            inputMode="email"
            icon={<Mail size={15} />}
            placeholder="例：taro@example.com"
            value={values.email}
            onChange={set('email')}
          />
          <IconField
            label="ウェブサイト URL"
            id="website_url"
            name="website_url"
            type="url"
            inputMode="url"
            icon={<Globe size={15} />}
            placeholder="例：https://example.com"
            value={values.website_url}
            onChange={set('website_url')}
          />
        </SectionCard>
      </div>

      {/* ── 5. SNS・オンライン ──────────────────── */}
      <div>
        <SectionHeading icon={<Globe size={16} />} label="SNS・オンライン" />
        <SectionCard>
          {(
            [
              { label: 'X（旧 Twitter）', name: 'sns_x',         key: 'sns_x',         placeholder: 'https://x.com/username' },
              { label: 'Instagram',       name: 'sns_instagram', key: 'sns_instagram', placeholder: 'https://instagram.com/username' },
              { label: 'Facebook',        name: 'sns_facebook',  key: 'sns_facebook',  placeholder: 'https://facebook.com/username' },
              { label: 'LinkedIn',        name: 'sns_linkedin',  key: 'sns_linkedin',  placeholder: 'https://linkedin.com/in/username' },
              { label: 'LINE',            name: 'sns_line',      key: 'sns_line',      placeholder: 'LINE ID または URL' },
              { label: 'YouTube',         name: 'sns_youtube',   key: 'sns_youtube',   placeholder: 'https://youtube.com/@channel' },
            ] as const
          ).map(({ label, name, key, placeholder }) => (
            <IconField
              key={name}
              label={label}
              id={name}
              name={name}
              type="url"
              inputMode="url"
              icon={<Globe size={15} />}
              placeholder={placeholder}
              value={values[key]}
              onChange={set(key)}
            />
          ))}
        </SectionCard>
      </div>

      {/* ── 6. ビジネス詳細 ─────────────────────── */}
      <div>
        <SectionHeading icon={<Briefcase size={16} />} label="ビジネス詳細" />
        <SectionCard>
          <TextAreaField
            label="事業内容"
            name="business_description"
            placeholder="例：広島県内の中小企業向けに IT 導入支援を行っています。"
            rows={3}
            value={values.business_description}
            onChange={set('business_description')}
          />
          <TextAreaField
            label="営業時間"
            name="business_hours"
            placeholder={"例：平日 9:00〜18:00\n（Enterキーで改行できます）"}
            rows={2}
            value={values.business_hours}
            onChange={set('business_hours')}
          />
          <TextAreaField
            label="定休日"
            name="regular_holiday"
            placeholder="例：土日祝日・年末年始"
            rows={2}
            value={values.regular_holiday}
            onChange={set('regular_holiday')}
          />
          <TextAreaField
            label="メニュー・サービス"
            name="menus"
            placeholder="例：Web 制作 / SEO 対策 / IT 補助金申請サポート"
            rows={3}
            value={values.menus}
            onChange={set('menus')}
          />
        </SectionCard>
      </div>

      {/* ── 7. 所属団体 ─────────────────────────── */}
      <div>
        <SectionHeading icon={<ListOrdered size={16} />} label="所属団体" />
        <SectionCard>
          {(['org_1', 'org_2', 'org_3', 'org_4', 'org_5'] as const).map((key, i) => (
            <FormField
              key={key}
              label={`所属団体 ${i + 1}`}
              name={key}
              placeholder="例：日本おりづる協会"
              value={values[key]}
              onChange={set(key)}
            />
          ))}
        </SectionCard>
      </div>

      {/* ── 8. パーソナル情報 ───────────────────── */}
      <div>
        <SectionHeading icon={<Smile size={16} />} label="パーソナル情報" />
        <SectionCard>
          <FormField
            label="趣味"
            name="hobbies"
            placeholder="例：ゴルフ、映画鑑賞"
            value={values.hobbies}
            onChange={set('hobbies')}
          />
          <FormField
            label="特技"
            name="skills"
            placeholder="例：DIY、ものまね"
            value={values.skills}
            onChange={set('skills')}
          />
          <FormField
            label="座右の銘"
            name="motto"
            placeholder="例：一期一会"
            value={values.motto}
            onChange={set('motto')}
          />
        </SectionCard>
      </div>

      {/* ── エラーメッセージ ─────────────────────── */}
      {state.error && (
        <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">
          {state.error}
        </p>
      )}

      {/* ── 送信ボタン ───────────────────────────── */}
      <SubmitButton isPending={isPending} isNew={!profile || (!profile.full_name && !profile.company_name)} />

      {/* 余白 */}
      <div className="h-4" />
    </form>
  );
}
