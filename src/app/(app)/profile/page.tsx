import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Building2,
  User,
  Phone,
  Mail,
  Globe,
  Smartphone,
  MapPin,
  Hash,
  Clock,
  CalendarOff,
  Pencil,
  QrCode,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchProfile } from '@/lib/supabase/profile';
import { getCardImageSignedUrl } from '@/lib/supabase/storage';
import CopyButton from '@/components/ui/CopyButton';
import { SnsColorIcon, SNS_LABEL } from '@/components/ui/SnsColorIcon';

// ─────────────────────────────────────────────────────────────
// ユーティリティ関数
// ─────────────────────────────────────────────────────────────

/**
 * URL が http(s):// で始まらない場合に https:// を補完する
 * LINE ID や短縮 URL も <a> タグで正しく開けるようにする
 */
function toHref(url: string): string {
  if (!url) return '#';
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

/**
 * 電話番号をハイフン区切り形式に整形する
 * 名刺詳細ページ（cards/[id]/page.tsx）と同一ロジックで統一
 *
 * 10桁: 03/06始まり → 2-4-4、0120/0570/0800 → 4-3-4、その他 → 3-3-4
 * 11桁: 090/080/070/050始まり → 3-4-4、その他 → 4-4-3
 * 上記以外: そのまま返す
 */
function formatPhoneNumber(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');

  if (digits.length === 10) {
    if (/^(0120|0570|0800)/.test(digits))
      return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
    if (/^(03|06)/.test(digits))
      return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11) {
    if (/^(090|080|070|050)/.test(digits))
      return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}`;
  }

  return raw;
}

// ─────────────────────────────────────────────────────────────
// ページ本体
// ─────────────────────────────────────────────────────────────

/**
 * My名刺 表示ページ（Server Component）
 *
 * - 未登録 → 空状態 + 「My名刺を作成する」ボタン
 * - 登録済み → 名刺スタイルの表示 + 「編集する」ボタン
 */
export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { profile, error } = await fetchProfile(supabase, user.id);

  // エラー時
  if (error) {
    return (
      <div className="px-4 py-5">
        <p className="text-sm text-red-500">データの取得に失敗しました: {error}</p>
      </div>
    );
  }

  // 未登録状態
  const isEmpty = !profile || (!profile.full_name && !profile.company_name);
  if (isEmpty) {
    return (
      <div className="px-4 py-5 flex flex-col gap-5">
        <header className="flex items-center gap-2">
          <h1 className="flex-1 text-base font-bold text-gray-800 px-1">My名刺</h1>
        </header>
        <div className="bg-white rounded-2xl shadow-sm p-8 flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-[#81d8d0]/20 flex items-center justify-center">
            <User size={28} className="text-[#81d8d0]" />
          </div>
          <p className="text-base font-semibold text-gray-700">まだ登録されていません</p>
          <p className="text-sm text-gray-400">
            あなた自身の情報を登録して<br />デジタル名刺を作成しましょう
          </p>
          <Link
            href="/profile/edit"
            className="
              mt-2 w-full min-h-[58px] flex items-center justify-center
              bg-[#81d8d0] text-white text-base font-bold
              rounded-2xl transition-colors
              hover:bg-[#5bbfb6] active:bg-[#4aafa8]
            "
          >
            My名刺を作成する
          </Link>
        </div>
      </div>
    );
  }

  // 顔写真・ロゴの署名付き URL を並列取得
  const [facePhotoResult, logoResult] = await Promise.all([
    profile.face_photo_path
      ? getCardImageSignedUrl(supabase, profile.face_photo_path)
      : Promise.resolve({ url: null }),
    profile.company_logo_path
      ? getCardImageSignedUrl(supabase, profile.company_logo_path)
      : Promise.resolve({ url: null }),
  ]);
  const facePhotoUrl = facePhotoResult.url;
  const logoUrl      = logoResult.url;

  // 電話番号の整形済み表示テキスト
  const companyPhoneDisplay  = formatPhoneNumber(profile.company_phone)  ?? profile.company_phone  ?? '';
  const mobilePhoneDisplay   = formatPhoneNumber(profile.mobile_phone)   ?? profile.mobile_phone   ?? '';

  return (
    <div className="px-4 py-5 flex flex-col gap-5">
      {/* ヘッダー */}
      <header className="flex items-center gap-2">
        <h1 className="flex-1 text-base font-bold text-gray-800 px-1">My名刺</h1>
      </header>

      {/* 名刺カード（メイン表示） */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">

        {/* 上部カラーバー */}
        <div className="h-2 bg-[#81d8d0]" />

        <div className="p-5 flex flex-col gap-4">

          {/* 顔写真 + 氏名・役職 */}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 border-2 border-[#81d8d0] shrink-0 flex items-center justify-center">
              {facePhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={facePhotoUrl}
                  alt={profile.full_name ?? '顔写真'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <User size={28} className="text-gray-300" />
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
          {(profile.company_logo_path || profile.company_name || profile.industry || profile.department || profile.branch_office) && (
            <div className="flex flex-col gap-1.5">
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="会社ロゴ" className="max-h-10 object-contain self-start" />
              )}
              {profile.company_name && (
                <p className="text-base font-semibold text-gray-800">{profile.company_name}</p>
              )}
              {/* 業種タグ */}
              {profile.industry && (
                <span
                  className="self-start text-xs font-semibold px-3 py-1 rounded-full"
                  style={{ backgroundColor: '#fce9f1', color: '#c97aaa' }}
                >
                  {profile.industry}
                </span>
              )}
              {profile.branch_office && (
                <p className="text-sm text-gray-500">{profile.branch_office}</p>
              )}
              {profile.department && (
                <p className="text-sm text-gray-500">{profile.department}</p>
              )}
            </div>
          )}

          {/* 区切り線 */}
          <hr className="border-gray-100" />

          {/* 連絡先（アクションリンク + コピーボタン） */}
          <div className="flex flex-col gap-3">

            {/* 住所 → Google マップで検索 */}
            {profile.address && (
              <div className="flex items-start gap-2">
                <MapPin size={15} className="text-[#81d8d0] mt-0.5 shrink-0" />
                <a
                  href={`https://maps.google.com/maps?q=${encodeURIComponent(profile.address)}`}
                  className="text-sm text-gray-700 flex-1 leading-relaxed"
                >
                  {profile.address}
                </a>
                <CopyButton text={profile.address} />
              </div>
            )}

            {/* 会社電話 → tel: 発信 */}
            {profile.company_phone && (
              <div className="flex items-center gap-2">
                <Phone size={15} className="text-[#81d8d0] shrink-0" />
                <a
                  href={`tel:${profile.company_phone.replace(/\D/g, '')}`}
                  className="text-sm text-gray-700 flex-1"
                >
                  {companyPhoneDisplay}
                </a>
                {profile.extension && (
                  <span className="text-xs text-gray-400 flex items-center gap-1 shrink-0">
                    <Hash size={11} />内線 {profile.extension}
                  </span>
                )}
                <CopyButton text={companyPhoneDisplay} />
              </div>
            )}

            {/* 携帯 → tel: 発信 */}
            {profile.mobile_phone && (
              <div className="flex items-center gap-2">
                <Smartphone size={15} className="text-[#81d8d0] shrink-0" />
                <a
                  href={`tel:${profile.mobile_phone.replace(/\D/g, '')}`}
                  className="text-sm text-gray-700 flex-1"
                >
                  {mobilePhoneDisplay}
                </a>
                <CopyButton text={mobilePhoneDisplay} />
              </div>
            )}

            {/* メール → mailto: 起動 */}
            {profile.email && (
              <div className="flex items-center gap-2">
                <Mail size={15} className="text-[#81d8d0] shrink-0" />
                <a
                  href={`mailto:${profile.email}`}
                  className="text-sm text-gray-700 break-all flex-1"
                >
                  {profile.email}
                </a>
                <CopyButton text={profile.email} />
              </div>
            )}

            {/* ウェブサイト → 別タブで開く */}
            {profile.website_url && (
              <div className="flex items-center gap-2">
                <Globe size={15} className="text-[#81d8d0] shrink-0" />
                <a
                  href={toHref(profile.website_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#81d8d0] underline underline-offset-2 break-all flex-1"
                >
                  {profile.website_url}
                </a>
                <CopyButton text={profile.website_url} />
              </div>
            )}
          </div>

          {/* SNS リンク */}
          {profile.sns_links.length > 0 && (
            <>
              <hr className="border-gray-100" />
              <div className="flex flex-col gap-2.5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">SNS</p>
                {profile.sns_links.map((sns, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <SnsColorIcon type={sns.type} size={28} />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-[10px] text-gray-400">{SNS_LABEL[sns.type] ?? sns.type}</span>
                      <a
                        href={toHref(sns.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[#81d8d0] underline underline-offset-2 break-all leading-tight"
                      >
                        {sns.url}
                      </a>
                    </div>
                    <CopyButton text={sns.url} />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ビジネス詳細 */}
          {(profile.business_description || profile.business_hours || profile.regular_holiday || profile.menus) && (
            <>
              <hr className="border-gray-100" />
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">ビジネス詳細</p>
                {profile.business_description && (
                  <div className="flex items-start gap-2">
                    <Building2 size={14} className="text-[#81d8d0] mt-0.5 shrink-0" />
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{profile.business_description}</p>
                  </div>
                )}
                {profile.business_hours && (
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-[#81d8d0] shrink-0" />
                    <span className="text-sm text-gray-700">{profile.business_hours}</span>
                  </div>
                )}
                {profile.regular_holiday && (
                  <div className="flex items-center gap-2">
                    <CalendarOff size={14} className="text-[#81d8d0] shrink-0" />
                    <span className="text-sm text-gray-700">{profile.regular_holiday}</span>
                  </div>
                )}
                {profile.menus && (
                  <>
                    <p className="text-xs font-semibold text-gray-400 tracking-wide mt-1">
                      メニュー・サービス
                    </p>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{profile.menus}</p>
                  </>
                )}
              </div>
            </>
          )}

          {/* 所属団体 */}
          {profile.organizations.length > 0 && (
            <>
              <hr className="border-gray-100" />
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">所属団体</p>
                <ul className="flex flex-col gap-1">
                  {profile.organizations.map((org, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#81d8d0] shrink-0" />
                      {org}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {/* パーソナル情報 */}
          {(profile.hobbies || profile.skills || profile.motto) && (
            <>
              <hr className="border-gray-100" />
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">パーソナル</p>
                {profile.hobbies && (
                  <div className="flex gap-2">
                    <span className="text-xs text-gray-400 w-12 shrink-0">趣味</span>
                    <span className="text-sm text-gray-700">{profile.hobbies}</span>
                  </div>
                )}
                {profile.skills && (
                  <div className="flex gap-2">
                    <span className="text-xs text-gray-400 w-12 shrink-0">特技</span>
                    <span className="text-sm text-gray-700">{profile.skills}</span>
                  </div>
                )}
                {profile.motto && (
                  <div className="flex gap-2">
                    <span className="text-xs text-gray-400 w-12 shrink-0">座右の銘</span>
                    <span className="text-sm text-gray-700">{profile.motto}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 編集ボタン */}
      <Link
        href="/profile/edit"
        className="
          w-full min-h-[58px] flex items-center justify-center gap-2
          bg-[#81d8d0] text-white text-base font-bold
          rounded-2xl transition-colors
          hover:bg-[#5bbfb6] active:bg-[#4aafa8]
        "
      >
        <Pencil size={18} strokeWidth={2.5} />
        My名刺を編集する
      </Link>

      {/* QR コードボタン（アクセントカラー：黄金色） */}
      <Link
        href="/profile/qr"
        style={{ backgroundColor: '#FCD34D', color: '#374151' }}
        className="
          w-full min-h-[58px] flex items-center justify-center gap-2
          bg-[#FCD34D] hover:bg-[#f5c518] active:bg-[#eab308]
          text-gray-800 text-base font-bold
          rounded-2xl transition-colors shadow-sm
        "
      >
        <QrCode size={20} strokeWidth={2.8} />
        My QRコードで相手へ渡す
      </Link>

      {/* 余白 */}
      <div className="h-4" />
    </div>
  );
}
