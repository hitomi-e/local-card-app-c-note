'use server';

import { createClient } from '@/lib/supabase/server';
import { upsertProfile } from '@/lib/supabase/profile';
import { uploadProfilePhoto, uploadCompanyLogo } from '@/lib/supabase/storage';
import type { SnsLink } from '@/types/profile';

export type ProfileFormState = {
  error?: string;
  ok?: boolean;
};

/** 空文字 → null に変換 */
function toNull(v: FormDataEntryValue | null): string | null {
  if (!v || String(v).trim() === '') return null;
  return String(v).trim();
}

export async function upsertProfileAction(
  _prev: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'ログインが必要です。' };

  // ── 顔写真アップロード ───────────────────────────────
  let facePhotoPath: string | null = null;
  const photoFile = formData.get('face_photo') as File | null;
  if (photoFile && photoFile.size > 0) {
    const { path, error } = await uploadProfilePhoto(supabase, user.id, photoFile);
    if (error) return { error };
    facePhotoPath = path;
  }

  // ── 会社ロゴアップロード ─────────────────────────────
  let companyLogoPath: string | null = null;
  const logoFile = formData.get('company_logo') as File | null;
  if (logoFile && logoFile.size > 0) {
    const { path, error } = await uploadCompanyLogo(supabase, user.id, logoFile);
    if (error) return { error };
    companyLogoPath = path;
  }

  // ── SNS リンクを配列に変換（URL が空の項目は除外）───
  const SNS_KEYS: Array<[SnsLink['type'], string]> = [
    ['X',         'sns_x'],
    ['Instagram', 'sns_instagram'],
    ['Facebook',  'sns_facebook'],
    ['LinkedIn',  'sns_linkedin'],
    ['LINE',      'sns_line'],
    ['YouTube',   'sns_youtube'],
  ];
  const snsLinks: SnsLink[] = SNS_KEYS
    .map(([type, key]) => ({ type, url: toNull(formData.get(key)) ?? '' }))
    .filter((s) => s.url !== '');

  // ── 所属団体（空文字除外）────────────────────────────
  const organizations = ['org_1', 'org_2', 'org_3', 'org_4', 'org_5']
    .map((k) => toNull(formData.get(k)) ?? '')
    .filter(Boolean);

  // ── プロフィール upsert ──────────────────────────────
  const data = {
    ...(facePhotoPath    ? { face_photo_path:    facePhotoPath    } : {}),
    ...(companyLogoPath  ? { company_logo_path:  companyLogoPath  } : {}),
    company_name:         toNull(formData.get('company_name')),
    company_name_reading: toNull(formData.get('company_name_reading')),
    industry:             toNull(formData.get('industry')),
    branch_office:        toNull(formData.get('branch_office')),
    department:           toNull(formData.get('department')),
    position:             toNull(formData.get('position')),
    full_name:            toNull(formData.get('full_name')),
    name_reading:         toNull(formData.get('name_reading')),
    postal_code:          toNull(formData.get('postal_code')),
    address:              toNull(formData.get('address')),
    company_phone:        toNull(formData.get('company_phone')),
    extension:            toNull(formData.get('extension')),
    mobile_phone:         toNull(formData.get('mobile_phone')),
    email:                toNull(formData.get('email')),
    website_url:          toNull(formData.get('website_url')),
    sns_links:            snsLinks,
    business_description: toNull(formData.get('business_description')),
    business_hours:       toNull(formData.get('business_hours')),
    regular_holiday:      toNull(formData.get('regular_holiday')),
    menus:                toNull(formData.get('menus')),
    organizations,
    hobbies: toNull(formData.get('hobbies')),
    skills:  toNull(formData.get('skills')),
    motto:   toNull(formData.get('motto')),
  };

  const { error } = await upsertProfile(supabase, user.id, data);
  if (error) return { error: `保存に失敗しました: ${error}` };

  return { ok: true };
}
