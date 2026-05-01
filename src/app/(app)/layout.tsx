import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Noto_Sans_JP } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import AvatarMenu from "@/components/ui/AvatarMenu";
import BottomNav from "@/components/ui/BottomNav";
import WelcomeOverlay from "@/components/ui/WelcomeOverlay";

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

/**
 * 認証済みエリア共通レイアウト
 * ────────────────────────────────────────────────
 * ・サーバー側でセッションを確認し、未ログインなら /login へリダイレクト
 * ・ヘッダー（ロゴ + ユーザーアバター）
 * ・ボトムナビゲーション（名刺一覧 / スキャン / プロフィール）
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ── セッション確認 ──────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 未ログインはログイン画面へ（二重ガード：proxy.ts に加えてサーバーでも確認）
  if (!user) {
    redirect("/login");
  }

  // ── メールアドレスからアバター用イニシャルを生成 ──
  const initial = user.email?.charAt(0).toUpperCase() ?? "U";
  const email = user.email ?? "";

  return (
    <div className={`${notoSansJP.className} min-h-screen flex flex-col bg-[#f0fbfa]`}>

      {/* ─── ヘッダー ─────────────────────────────── */}
      <header className="sticky top-0 z-[100] bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* ロゴ + サービス名 */}
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src="/logo-crane.svg"
              alt="C-Note ロゴ"
              width={44}
              height={44}
              priority
            />
            <span className="text-[22px] font-medium tracking-[0.2em] text-[#81d8d0] leading-none">
              C-Note
            </span>
          </Link>

          {/* ユーザーアバター → クリックでドロップダウンメニュー */}
          <AvatarMenu initial={initial} email={email} />
        </div>
      </header>

      {/* ─── メインコンテンツ ─────────────────────── */}
      {/* ボトムナビ分の padding-bottom を確保 */}
      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-5 pb-24">
        {children}
      </main>

      {/* ─── ボトムナビゲーション（Client Component）── */}
      <BottomNav />

      {/* ─── 新規登録ウェルカム演出（localStorage フラグがある場合のみ表示）── */}
      <WelcomeOverlay />
    </div>
  );
}
