import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { fetchProfile } from '@/lib/supabase/profile';
import QrDisplay from './QrDisplay';

/**
 * My QRコード ページ（Server Component）
 *
 * ・ログインユーザーの ID を使ってプロフィール共有 URL を構築
 * ・QrDisplay（Client Component）に URL と名前を渡して描画
 *
 * 共有 URL 形式: {protocol}://{host}/p/{userId}
 * ※ /p/[userId] は今後実装予定のパブリックプロフィールページ
 */
export default async function ProfileQrPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { profile } = await fetchProfile(supabase, user.id);

  // ホスト情報からプロフィール共有 URL を組み立てる
  const headersList = await headers();
  const host  = headersList.get('host') ?? 'localhost:3000';

  // ローカル開発時: iPhone から到達できるよう PC の IP アドレスに変換する
  // → localhost は iPhone 自身を指すため QR を読んでもエラーになる
  // 本番（Vercel 等）では host がそのまま使われる
  const effectiveHost = host.startsWith('localhost') ? '192.168.0.10:3000' : host;
  const proto = effectiveHost.startsWith('192.168.') ? 'http' : 'https';
  const profileUrl = `${proto}://${effectiveHost}/p/${user.id}`;

  // 表示名: 登録済みの氏名 → メールのローカルパート → フォールバック
  const displayName =
    profile?.full_name ??
    user.email?.split('@')[0] ??
    'Unknown';

  return (
    <div className="px-4 py-5 flex flex-col gap-6">
      {/* ヘッダー */}
      <header className="flex items-center gap-2">
        <h1 className="flex-1 text-base font-bold text-gray-800 px-1">My QRコード</h1>
      </header>

      {/* 説明文 */}
      <p className="text-sm text-gray-500 text-center -mt-2">
        相手にスキャンしてもらうと<br />あなたのデジタル名刺が開きます
      </p>

      {/* QR 表示 + アクションボタン */}
      <QrDisplay profileUrl={profileUrl} displayName={displayName} />

      {/* 余白 */}
      <div className="h-4" />
    </div>
  );
}
