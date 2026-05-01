import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  User, Phone, Smartphone, Mail, Globe, MapPin, Building2, Clock, CalendarOff,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { fetchProfile } from '@/lib/supabase/profile';
import { getCardImageSignedUrl, getCanonicalProfilePhotoPath, getJpegAlternativePath } from '@/lib/supabase/storage';
import { SnsColorIcon, SNS_LABEL } from '@/components/ui/SnsColorIcon';

/**
 * 公開プロフィールページ（魔法の招待状）
 *
 * ・認証不要でアクセス可能
 * ・ログイン済みユーザー → 「この名刺を受け取る」ボタン（/scan/confirm へ）
 * ・未ログインユーザー → 「C-Noteに参加してご縁をつなぐ」招待ボタン
 */
export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  // サービスロールでプロフィール取得（RLSバイパス・公開アクセス対応）
  const serviceClient = createServiceClient();
  const { profile, error } = await fetchProfile(serviceClient, userId);

  if (error || !profile) notFound();

  // 顔写真の署名付きURL（正規パスで導出、.jpeg フォールバックあり）
  let facePhotoUrl: string | null = null;
  {
    const canonicalPath = getCanonicalProfilePhotoPath(userId);
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

  // 会社ロゴの署名付きURL
  let logoUrl: string | null = null;
  if (profile.company_logo_path) {
    const { url } = await getCardImageSignedUrl(serviceClient, profile.company_logo_path);
    logoUrl = url;
  }

  // ログイン状態を確認
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isSelf = user?.id === userId;

  const displayName = profile.full_name ?? profile.company_name ?? 'プロフィール';

  return (
    <div className="min-h-screen bg-[#f0fbfa] flex flex-col">

      {/* ヘッダー */}
      <header className="px-4 pt-8 pb-4 flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-color.svg" alt="C-Note" className="h-8 object-contain" />
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 px-4 pb-8 flex flex-col gap-5 max-w-lg mx-auto w-full">

        {/* サブタイトル */}
        <p className="text-center text-sm text-[#81d8d0] font-medium">
          デジタル名刺をお届けします
        </p>

        {/* プロフィールカード */}
        <div className="bg-white rounded-3xl shadow-md overflow-hidden">
          <div className="h-2 bg-[#81d8d0]" />

          <div className="p-5 flex flex-col gap-4">

            {/* 顔写真 + 氏名 */}
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-[#e8f8f7] border-2 border-[#81d8d0]/40 shrink-0 flex items-center justify-center">
                {facePhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={facePhotoUrl} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <User size={30} className="text-[#81d8d0]" />
                )}
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                {profile.full_name && (
                  <p className="text-lg font-bold text-gray-800 leading-tight">{profile.full_name}</p>
                )}
                {profile.name_reading && (
                  <p className="text-xs text-gray-400">{profile.name_reading}</p>
                )}
                {profile.position && (
                  <p className="text-sm text-[#81d8d0] font-medium mt-0.5">{profile.position}</p>
                )}
              </div>
            </div>

            {/* 会社ロゴ + 会社情報 */}
            {(logoUrl || profile.company_name || profile.department || profile.branch_office) && (
              <div className="flex flex-col gap-1.5">
                {logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="会社ロゴ" className="max-h-10 object-contain self-start" />
                )}
                {profile.company_name && (
                  <p className="text-base font-semibold text-gray-800">{profile.company_name}</p>
                )}
                {profile.branch_office && (
                  <p className="text-sm text-gray-500">{profile.branch_office}</p>
                )}
                {profile.department && (
                  <p className="text-sm text-gray-500">{profile.department}</p>
                )}
              </div>
            )}

            {/* 連絡先 */}
            {(profile.address || profile.company_phone || profile.mobile_phone || profile.email || profile.website_url) && (
              <>
                <hr className="border-gray-100" />
                <div className="flex flex-col gap-2">
                  {profile.address && (
                    <div className="flex items-start gap-2">
                      <MapPin size={14} className="text-[#81d8d0] mt-0.5 shrink-0" />
                      <span className="text-sm text-gray-600 leading-relaxed">{profile.address}</span>
                    </div>
                  )}
                  {profile.company_phone && (
                    <div className="flex items-center gap-2">
                      <Phone size={14} className="text-[#81d8d0] shrink-0" />
                      <a href={`tel:${profile.company_phone}`} className="text-sm text-gray-600">
                        {profile.company_phone}
                      </a>
                    </div>
                  )}
                  {profile.mobile_phone && (
                    <div className="flex items-center gap-2">
                      <Smartphone size={14} className="text-[#81d8d0] shrink-0" />
                      <a href={`tel:${profile.mobile_phone}`} className="text-sm text-gray-600">
                        {profile.mobile_phone}
                      </a>
                    </div>
                  )}
                  {profile.email && (
                    <div className="flex items-center gap-2">
                      <Mail size={14} className="text-[#81d8d0] shrink-0" />
                      <a href={`mailto:${profile.email}`} className="text-sm text-gray-600 break-all">
                        {profile.email}
                      </a>
                    </div>
                  )}
                  {profile.website_url && (
                    <div className="flex items-center gap-2">
                      <Globe size={14} className="text-[#81d8d0] shrink-0" />
                      <a
                        href={profile.website_url.startsWith('http') ? profile.website_url : `https://${profile.website_url}`}
                        className="text-sm text-[#81d8d0] underline underline-offset-2 break-all"
                      >
                        {profile.website_url}
                      </a>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* SNS リンク */}
            {profile.sns_links && profile.sns_links.length > 0 && (
              <>
                <hr className="border-gray-100" />
                <div className="flex flex-col gap-2.5">
                  {profile.sns_links.map((sns, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <SnsColorIcon type={sns.type} size={26} />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[10px] text-gray-400">{SNS_LABEL[sns.type] ?? sns.type}</span>
                        <a
                          href={sns.url.startsWith('http') ? sns.url : `https://${sns.url}`}
                          className="text-sm text-[#81d8d0] underline underline-offset-2 break-all leading-tight"
                        >
                          {sns.url}
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ビジネス情報 */}
            {(profile.business_description || profile.business_hours || profile.regular_holiday) && (
              <>
                <hr className="border-gray-100" />
                <div className="flex flex-col gap-2">
                  {profile.business_description && (
                    <div className="flex items-start gap-2">
                      <Building2 size={13} className="text-[#81d8d0] mt-0.5 shrink-0" />
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">{profile.business_description}</p>
                    </div>
                  )}
                  {profile.business_hours && (
                    <div className="flex items-center gap-2">
                      <Clock size={13} className="text-[#81d8d0] shrink-0" />
                      <span className="text-sm text-gray-600">{profile.business_hours}</span>
                    </div>
                  )}
                  {profile.regular_holiday && (
                    <div className="flex items-center gap-2">
                      <CalendarOff size={13} className="text-[#81d8d0] shrink-0" />
                      <span className="text-sm text-gray-600">{profile.regular_holiday}</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* アクションボタン */}
        <div className="flex flex-col gap-3">
          {isSelf ? (
            // 自分自身のページ → My名刺確認
            <Link
              href="/profile"
              className="w-full min-h-[58px] flex items-center justify-center gap-2
                         bg-white border border-[#81d8d0] text-[#81d8d0] text-base font-bold
                         rounded-2xl transition-colors hover:bg-[#e8f8f7]"
            >
              My名刺を確認する
            </Link>
          ) : (
            // ログイン済み → 直接登録画面へ、未ログイン → middleware が /login へ転送
            <Link
              href={`/scan/confirm?userId=${userId}`}
              style={{ backgroundColor: '#FCD34D', color: '#374151' }}
              className="w-full min-h-[58px] flex items-center justify-center gap-2
                         text-base font-bold
                         rounded-2xl shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
            >
              My名刺（デジタル名刺）を受け取る
            </Link>
          )}
        </div>

        {/* フッター */}
        <p className="text-center text-[11px] text-gray-400 mt-2">
          C-Note — デジタル名刺でご縁をつなぐ
        </p>
      </main>
    </div>
  );
}
