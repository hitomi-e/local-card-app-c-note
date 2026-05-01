import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchProfile } from '@/lib/supabase/profile';
import { getCardImageSignedUrl } from '@/lib/supabase/storage';
import ProfileEditForm from './ProfileEditForm';

/**
 * My名刺 編集ページ（Server Component）
 *
 * 既存プロフィールを取得して ProfileEditForm に渡す。
 * 顔写真が登録済みの場合は署名付き URL を取得してプレビュー用に渡す。
 * 未登録の場合は空の初期値でフォームを表示（新規登録モード）。
 */
export default async function ProfileEditPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { profile } = await fetchProfile(supabase, user.id);

  // 既存の顔写真・ロゴがあれば署名付き URL を取得（プレビュー表示用）
  const [facePhotoResult, logoResult] = await Promise.all([
    profile?.face_photo_path
      ? getCardImageSignedUrl(supabase, profile.face_photo_path)
      : Promise.resolve({ url: null }),
    profile?.company_logo_path
      ? getCardImageSignedUrl(supabase, profile.company_logo_path)
      : Promise.resolve({ url: null }),
  ]);

  return (
    <div className="px-4 py-5 flex flex-col gap-5">
      {/* ヘッダー */}
      <header className="flex items-center gap-2">
        <h1 className="flex-1 text-base font-bold text-gray-800 truncate px-1">
          {profile ? 'My名刺を編集' : 'My名刺を作成'}
        </h1>
      </header>

      <ProfileEditForm
        profile={profile}
        facePhotoUrl={facePhotoResult.url}
        logoUrl={logoResult.url}
      />
    </div>
  );
}
