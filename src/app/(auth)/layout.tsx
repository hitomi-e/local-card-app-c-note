import Image from "next/image";
import { Noto_Sans_JP } from "next/font/google";

/**
 * Noto Sans JP（Google Fonts）
 * 華奢で丸みのある日本語フォント — light / normal の2ウェイトを読み込む
 */
const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  display: "swap",
});

/**
 * 認証ページ（ログイン・サインアップ）共通レイアウト
 * ────────────────────────────────────────────────
 * ・背景  : 極薄ブルーグリーン（#f0fbfa）でロゴエリアを引き立てる
 * ・ヘッダー: ティール角丸ボックスに白抜きロゴ・コピー・サービス名をまとめる
 * ・フォント: Noto Sans JP（font-light / tracking-wider）
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${notoSansJP.className} min-h-screen flex flex-col items-center justify-center bg-[#f0fbfa] px-4 py-10`}
    >
      {/* ─── ロゴエリア（ティール角丸ボックス） ─── */}
      <header className="mb-8 flex flex-col items-center">
        <div
          className="flex flex-col items-center justify-center gap-1
                     bg-[#81d8d0] rounded-[28px] shadow-md
                     w-60 pt-7 pb-6 px-6"
        >
          {/* 白抜きロゴ */}
          <Image
            src="/logo-white.svg"
            alt="C-Note ロゴ"
            width={160}
            height={92}
            priority
            className="drop-shadow-sm"
          />

          {/* ショルダーコピー */}
          <p className="text-white text-sm font-black tracking-widest mt-2">
            つながるデジタル名刺
          </p>

          {/* サービス名 */}
          <p className="text-white text-[32px] font-medium tracking-[0.28em] leading-none mt-0.5">
            C-Note
          </p>
        </div>
      </header>

      {/* ─── 各ページのフォームコンテンツ ─── */}
      <main className="w-full max-w-sm">
        {children}
      </main>
    </div>
  );
}
