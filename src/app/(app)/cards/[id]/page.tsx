import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  Pencil,
  Building2,
  User,
  Phone,
  Mail,
  Globe,
  Smartphone,
  MapPin,
  NotebookPen,
  Tag,
  Share2,
} from 'lucide-react';
import { SnsColorIcon, SNS_LABEL } from '@/components/ui/SnsColorIcon';
import type { SnsLink } from '@/types/profile';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { fetchCategories } from '@/lib/supabase/categories';
import { getCardImageSignedUrl, getCanonicalProfilePhotoPath, getJpegAlternativePath, getCardImagePublicUrl, CARD_IMAGES_BUCKET } from '@/lib/supabase/storage';
import type { Card, Category } from '@/types/cards';
import DeleteButton from './DeleteButton';
import CopyButton from './CopyButton';
import { NewsCheckButton } from './NewsCheckButton';

/**
 * 名刺詳細ページ（Server Component）
 *
 * 取得内容:
 *   - 名刺データ（cards テーブル + cards_categories 結合）
 *   - ユーザーのカテゴリー一覧
 *   - 名刺画像の署名付き URL（image_path がある場合）
 */
export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // ── 名刺取得（カテゴリー ID を結合）──────────────
  const { data: cardRaw, error: cardError } = await supabase
    .from('cards')
    .select('*, cards_categories(category_id)')
    .eq('id', id)
    .single();

  if (cardError || !cardRaw) {
    console.warn('[CardDetail] 名刺が見つかりません id:', id, cardError?.message);
    notFound();
  }

  const card = cardRaw as Card & { cards_categories: { category_id: string }[] };

  // ── カテゴリー一覧 & 紐付け ───────────────────────
  const { categories: allCategories } = await fetchCategories(supabase);
  const cardCategoryIds = card.cards_categories.map((cc) => cc.category_id);
  const cardCategories  = allCategories.filter((c) => cardCategoryIds.includes(c.id));

  // ── 名刺画像の署名付き URL ───────────────────────
  // serviceClient を使い RLS をバイパスする
  // （デジタル名刺の顔写真は profiles/{userId}/avatar.jpg パスで RLS が弾く）
  const serviceClient = createServiceClient();

  let imageUrl: string | null = null;
  if (card.image_path || (card.source === 'digital' && card.source_user_id)) {
    // 万能探索: 新形式.jpg → 新形式.jpeg → 旧形式DB保存パス → 旧形式拡張子代替 の順で試す
    const candidates: string[] = [];
    if (card.source === 'digital' && card.source_user_id) {
      const uid = card.source_user_id;
      candidates.push(`profiles/${uid}/avatar.jpg`);    // 新形式 .jpg（正規）
      candidates.push(`profiles/${uid}/avatar.jpeg`);   // 新形式 .jpeg
      if (card.image_path) {
        if (!candidates.includes(card.image_path)) candidates.push(card.image_path);  // 旧形式 DB 保存パス
        const alt = getJpegAlternativePath(card.image_path);
        if (alt && !candidates.includes(alt)) candidates.push(alt);
      }
    } else if (card.image_path) {
      candidates.push(card.image_path);
      const alt = getJpegAlternativePath(card.image_path);
      if (alt) candidates.push(alt);
    }

    console.log(`[CardDetail][Debug] 探索パス候補: [${candidates.join(', ')}]`);

    for (const path of candidates) {
      const { url, error: pathErr } = await getCardImageSignedUrl(serviceClient, path);
      if (url) {
        imageUrl = url;
        console.log(`[CardDetail] 画像URL取得成功: "${path}"`);
        break;
      }
      console.log(`[CardDetail][Debug] パス不在: "${path}" (${pathErr})`);
    }

    if (!imageUrl) {
      console.warn(`[CardDetail] 全候補で失敗: [${candidates.join(', ')}]`);
      // 最終フォールバック: 公開URL（バケットが Public の場合のみ機能）
      const fallbackPath = candidates[0];
      if (fallbackPath) {
        imageUrl = getCardImagePublicUrl(serviceClient, fallbackPath);
        console.log(`[CardDetail] 公開URLフォールバック: "${fallbackPath}" → "${imageUrl}"`);
      }
    }
  }

  // ── 裏面画像の署名付き URL ────────────────────────
  let backImageUrl: string | null = null;
  if (card.back_image_path) {
    const { url, error: backErr } = await getCardImageSignedUrl(serviceClient, card.back_image_path);
    if (backErr) console.warn('[CardDetail] 裏面画像URL取得エラー:', backErr, 'path:', card.back_image_path);
    backImageUrl = url;
  }

  // デジタル名刺: ロゴ + SNSリンクをプロフィールからライブ取得
  // ※ cardsテーブルにsns_linksカラムがないため、source_user_idでprofilesを参照する
  let logoUrl: string | null = null;
  let profileSnsLinks: SnsLink[] = [];
  if (card.source === 'digital' && card.source_user_id) {
    const { data: digitalProfile } = await serviceClient
      .from('profiles')
      .select('company_logo_path, sns_links')
      .eq('id', card.source_user_id)
      .single();
    if (digitalProfile?.company_logo_path) {
      const { url } = await getCardImageSignedUrl(serviceClient, digitalProfile.company_logo_path);
      logoUrl = url;
    }
    if (Array.isArray(digitalProfile?.sns_links) && digitalProfile.sns_links.length > 0) {
      profileSnsLinks = digitalProfile.sns_links as SnsLink[];
    }
  }

  // アバター用イニシャルと背景色
  const initial     = (card.company_name || card.full_name || '?').charAt(0);
  const avatarColor = getAvatarColor(card.company_name || card.full_name || card.id);

  return (
    <div className="flex flex-col gap-5 px-4 py-5 pb-10">

      {/* ── ヘッダー ── */}
      <header className="flex items-center gap-2">
        <h1 className="flex-1 text-base font-bold text-gray-800 truncate px-1">名刺詳細</h1>
      </header>

      {/* ── 名刺画像（表面） ──────────────────────── */}
      <div className="flex flex-col gap-1.5">
        {backImageUrl && (
          <p className="text-[11px] font-semibold text-gray-400 tracking-wide">表面</p>
        )}
        <div
          className="w-full rounded-2xl overflow-hidden shadow-sm"
          style={{
            aspectRatio: '4 / 3',
            backgroundColor: imageUrl ? '#f9fafb' : `${avatarColor}22`,
          }}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={`${card.company_name ?? ''} ${card.full_name ?? ''}の名刺（表面）`}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-md"
                style={{ backgroundColor: avatarColor }}
              >
                {initial}
              </div>
              <p className="text-xs text-gray-400">画像は登録されていません</p>
            </div>
          )}
        </div>
      </div>

      {/* ── 名刺画像（裏面）── back_image_path がある場合のみ表示 ── */}
      {backImageUrl && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-semibold text-gray-400 tracking-wide">裏面</p>
          <div
            className="w-full rounded-2xl overflow-hidden shadow-sm bg-gray-50"
            style={{ aspectRatio: '4 / 3' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={backImageUrl}
              alt={`${card.company_name ?? ''} ${card.full_name ?? ''}の名刺（裏面）`}
              className="w-full h-full object-contain"
            />
          </div>
        </div>
      )}

      {/* ── アクションボタン（編集・削除）────────── */}
      <div className="flex flex-col gap-3">
        {/* 編集ボタン：ブランドカラー・横幅いっぱい */}
        <Link
          href={`/cards/${id}/edit`}
          className="
            w-full flex items-center justify-center gap-2
            min-h-[58px]
            bg-[#81d8d0] hover:bg-[#5bbfb6] active:bg-[#4aafa8]
            text-white font-bold text-base
            rounded-2xl shadow-sm transition-all active:scale-[0.98]
          "
        >
          <Pencil size={18} strokeWidth={2.5} />
          名刺を編集する
        </Link>

        {/* 削除ボタン：控えめな赤アウトライン・横幅いっぱい */}
        <DeleteButton cardId={id} variant="full" />
      </div>

      {/* ── 最新ニュース（会社名がある場合のみ表示）─── */}
      {card.company_name && (
        <NewsCheckButton
            companyName={card.company_name}
            address={card.address}
            websiteUrl={card.website_url}
            industry={card.industry}
          />
      )}

      {/* ── 会社情報 ──────────────────────────────── */}
      {(card.company_name || card.company_name_reading || card.industry || card.branch_office || card.department || card.position || logoUrl) && (
        <DetailSection icon={<Building2 size={15} />} label="会社情報">
          {/* 会社ロゴ（デジタル名刺のみ） */}
          {logoUrl && (
            <div className="py-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt="会社ロゴ" className="max-h-10 object-contain" />
            </div>
          )}
          <DetailRow label="会社名"   value={card.company_name} />
          <DetailRow label="ふりがな" value={card.company_name_reading} />
          {/* 業種タグ */}
          {card.industry && (
            <div className="py-3 flex items-start gap-3">
              <span className="text-xs text-gray-400 w-20 shrink-0 pt-0.5">業種</span>
              <span
                className="text-xs font-semibold px-3 py-1 rounded-full"
                style={{ backgroundColor: '#fce9f1', color: '#c97aaa' }}
              >
                {card.industry}
              </span>
            </div>
          )}
          <DetailRow label="営業所" value={card.branch_office} />
          <DetailRow label="部署"   value={card.department} />
          <DetailRow label="役職"   value={card.position} />
        </DetailSection>
      )}

      {/* ── 担当者情報 ────────────────────────────── */}
      {(card.full_name || card.name_reading) && (
        <DetailSection icon={<User size={15} />} label="担当者情報">
          <DetailRow label="名前"         value={card.full_name} />
          <DetailRow label="ふりがな"     value={card.name_reading} />
        </DetailSection>
      )}

      {/* ── 連絡先 ────────────────────────────────── */}
      {(card.postal_code || card.address || card.company_phone || card.mobile_phone || card.email || card.website_url) && (
        <DetailSection icon={<Phone size={15} />} label="連絡先">
          {/* 郵便番号（3桁-4桁 に整形） */}
          {card.postal_code && (
            <DetailRow label="郵便番号" value={`〒 ${formatPostalCode(card.postal_code)}`} />
          )}
          {/* 住所 → タップでGoogleマップ起動 */}
          {card.address && (
            <DetailRowLink
              label="住所"
              value={card.address}
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(card.address)}`}
              icon={<MapPin size={13} />}
              external
            />
          )}
          {/* 会社電話番号 + 内線（ハイフン整形）
              内線付きの場合、コピーは電話番号のみ（内線テキストを除外） */}
          {card.company_phone && (
            <DetailRowLink
              label="会社電話"
              value={
                card.extension
                  ? `${formatPhoneNumber(card.company_phone)}（内線：${card.extension}）`
                  : formatPhoneNumber(card.company_phone)
              }
              href={`tel:${card.company_phone}`}
              icon={<Phone size={13} />}
              copyText={formatPhoneNumber(card.company_phone) ?? card.company_phone}
            />
          )}
          {/* 携帯電話（ハイフン整形） */}
          {card.mobile_phone && (
            <DetailRowLink
              label="携帯電話"
              value={formatPhoneNumber(card.mobile_phone)}
              href={`tel:${card.mobile_phone}`}
              icon={<Smartphone size={13} />}
            />
          )}
          {/* メール */}
          {card.email && (
            <DetailRowLink
              label="メール"
              value={card.email}
              href={`mailto:${card.email}`}
              icon={<Mail size={13} />}
            />
          )}
          {/* WebサイトURL */}
          {card.website_url && (
            <DetailRowLink
              label="Webサイト"
              value={card.website_url}
              href={card.website_url}
              icon={<Globe size={13} />}
              external
            />
          )}
        </DetailSection>
      )}

      {/* ── SNS（デジタル名刺のみ: プロフィールからライブ取得）── */}
      {profileSnsLinks.length > 0 && (
        <DetailSection icon={<Share2 size={15} />} label="SNS">
          <div className="py-2 flex flex-col gap-3">
            {profileSnsLinks.map((sns, i) => (
              <div key={i} className="flex items-center gap-3">
                <SnsColorIcon type={sns.type} size={28} />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[10px] text-gray-400">{SNS_LABEL[sns.type] ?? sns.type}</span>
                  <a
                    href={sns.url.startsWith('http') ? sns.url : `https://${sns.url}`}
                    className="text-sm text-[#81d8d0] break-all leading-tight"
                  >
                    {sns.url}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </DetailSection>
      )}

      {/* ── カテゴリー ────────────────────────────── */}
      {cardCategories.length > 0 && (
        <DetailSection icon={<Tag size={15} />} label="カテゴリー">
          <div className="flex flex-wrap gap-2 pt-1">
            {cardCategories.map((cat) => (
              <span
                key={cat.id}
                className="px-3 py-1 rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: cat.color }}
              >
                {cat.name}
              </span>
            ))}
          </div>
        </DetailSection>
      )}

      {/* ── フリーメモ ────────────────────────────── */}
      {card.free_memo && (
        <DetailSection icon={<NotebookPen size={15} />} label="メモ">
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {card.free_memo}
          </p>
        </DetailSection>
      )}

      {/* ── 登録日 ────────────────────────────────── */}
      <p className="text-xs text-gray-400 text-center mt-2">
        登録日: {new Date(card.created_at).toLocaleDateString('ja-JP')}
      </p>

    </div>
  );
}

// ─────────────────────────────────────────────────
// セクションコンポーネント
// ─────────────────────────────────────────────────
function DetailSection({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      {/* 見出し */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[#81d8d0]">{icon}</span>
        <h2 className="text-xs font-semibold text-gray-500 tracking-wide">{label}</h2>
      </div>
      {/* カード */}
      <div className="bg-white rounded-2xl shadow-sm px-5 py-1 divide-y divide-gray-50">
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// 情報行（テキストのみ）
// ─────────────────────────────────────────────────
function DetailRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="py-3 flex items-start gap-3">
      <span className="text-xs text-gray-400 w-20 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-800 flex-1 break-all">{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────
// 情報行（アイコン + テキスト）
// ─────────────────────────────────────────────────

// ─────────────────────────────────────────────────
// 情報行（タップでアクション実行: tel / mailto / url）
// copyText: クリップボードにコピーするテキスト（省略時は value をコピー）
//           電話+内線の場合、表示は "082-xxx（内線:1）" だがコピーは番号のみ、など
// ─────────────────────────────────────────────────
function DetailRowLink({
  label,
  value,
  href,
  icon,
  external = false,
  copyText,
}: {
  label: string;
  value: string | null;
  href: string;
  icon: React.ReactNode;
  external?: boolean;
  copyText?: string;
}) {
  if (!value) return null;
  return (
    <div className="py-3 flex items-start gap-3">
      <span className="text-xs text-gray-400 w-20 shrink-0 pt-0.5">{label}</span>
      {/* リンク + コピーボタンを横並びに */}
      <div className="flex items-start gap-1.5 flex-1 min-w-0">
        <a
          href={href}
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          className="flex items-start gap-1.5 flex-1 min-w-0 text-[#3a9e97] hover:underline active:opacity-70 transition-opacity"
        >
          <span className="mt-0.5 shrink-0 text-[#81d8d0]">{icon}</span>
          <span className="text-sm break-all">{value}</span>
        </a>
        <CopyButton text={copyText ?? value} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// 郵便番号フォーマット
// 数字のみ抽出して 3桁-4桁 に整形。7桁以外はそのまま返す。
// ─────────────────────────────────────────────────
function formatPostalCode(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return raw;
}

// ─────────────────────────────────────────────────
// 電話番号フォーマット
// 数字のみ抽出して桁数・先頭番号に応じてハイフンを挿入。
//
// 10桁:
//   03/06 始まり（東京・大阪）→ 2-4-4
//   0120/0570/0800 始まり    → 4-3-3（フリーダイヤル等）
//   その他                   → 3-3-4
// 11桁:
//   090/080/070/050 始まり   → 3-4-4（携帯・IP）
//   その他                   → 4-4-3
// 上記以外: そのまま返す
// ─────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────
// アバター背景色（seed → 固定色）
// ─────────────────────────────────────────────────
const AVATAR_COLORS = [
  '#81d8d0', '#E8B84B', '#7DB5E8', '#E87D7D', '#9AE87D', '#B87DE8',
];
function getAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
