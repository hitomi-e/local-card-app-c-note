import { headers } from 'next/headers';
import QrDisplay from '@/app/(app)/profile/qr/QrDisplay';

/**
 * C-Note アプリ紹介 QR ページ（Server Component）
 *
 * このアプリ自体の URL を QR コード化して表示する。
 * 「友達にアプリを紹介したい」「インストールを促したい」場面で使用。
 */
export default async function AppQrPage() {
  // アプリのルート URL を QR に埋め込む
  const headersList = await headers();
  const host  = headersList.get('host') ?? 'localhost:3000';
  const proto = host.startsWith('localhost') ? 'http' : 'https';
  const appUrl = `${proto}://${host}`;

  return (
    <div className="px-4 py-5 flex flex-col gap-6">
      {/* ヘッダー */}
      <header className="flex items-center gap-2">
        <h1 className="flex-1 text-base font-bold text-gray-800 px-1">C-Note QRコード</h1>
      </header>

      {/* 説明文 */}
      <p className="text-sm text-gray-500 text-center -mt-2">
        スキャンすると C-Note のトップページが開きます<br />
        友人・知人へのアプリ紹介にご利用ください
      </p>

      {/* QR 表示 + アクションボタン（QrDisplay を再利用） */}
      <QrDisplay profileUrl={appUrl} displayName="C-Note" />

      {/* 余白 */}
      <div className="h-4" />
    </div>
  );
}
