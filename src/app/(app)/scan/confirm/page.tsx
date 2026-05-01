import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { fetchProfile } from '@/lib/supabase/profile';
import { fetchCategories } from '@/lib/supabase/categories';
import { getCardImageSignedUrl, getCanonicalProfilePhotoPath, getJpegAlternativePath } from '@/lib/supabase/storage';
import { checkDuplicateCard } from '@/lib/supabase/cards';
import ConfirmClient from './ConfirmClient';

/**
 * デジタル名刺 受け取り確認ページ（Server Component）
 *
 * QRスキャン（/scan/qr）が /p/{userId} を検出した場合にリダイレクトされる。
 * ?userId= で相手のユーザーIDを受け取り、プロフィールを表示して保存を促す。
 */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>;
}) {
  const { userId: targetUserId } = await searchParams;

  if (!targetUserId) redirect('/scan');

  // ログイン確認
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 自分自身のQRは受け取り不可
  if (targetUserId === user.id) redirect('/profile');

  // サービスロールで相手のプロフィールを取得（RLSバイパス）
  const serviceClient = createServiceClient();
  const { profile: targetProfile, error: profileError } = await fetchProfile(serviceClient, targetUserId);

  if (profileError || !targetProfile) notFound();

  // 顔写真の署名付きURL取得（正規パスで導出、.jpeg フォールバックあり）
  let facePhotoUrl: string | null = null;
  {
    const canonicalPath = getCanonicalProfilePhotoPath(targetUserId);
    const { url } = await getCardImageSignedUrl(serviceClient, canonicalPath);
    if (url) {
      facePhotoUrl = url;
    } else {
      const altPath = getJpegAlternativePath(canonicalPath);
      if (altPath) {
        const { url: altUrl } = await getCardImageSignedUrl(serviceClient, altPath);
        facePhotoUrl = altUrl;
      }
    }
  }

  // カテゴリー一覧取得（ログインユーザーのもの）
  const { categories } = await fetchCategories(supabase);

  // 重複チェック（同じ会社名 ＋ 同じ氏名の組み合わせが存在するか）
  const initialDuplicate = await checkDuplicateCard(
    supabase,
    user.id,
    targetProfile.full_name ?? null,
    targetProfile.company_name ?? null
  );

  return (
    <ConfirmClient
      targetProfile={targetProfile}
      facePhotoUrl={facePhotoUrl}
      categories={categories}
      initialDuplicate={initialDuplicate}
      currentUserId={user.id}
    />
  );
}
