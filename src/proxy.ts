import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 Proxy（全リクエストに適用）
 * ※ Next.js 16 では middleware.ts → proxy.ts に名称変更された
 *
 * ────────────────────────────────────────────────────────────────
 * 役割:
 *   1. Supabase の Access Token を毎リクエストで自動更新（最重要）
 *      → これがないと iOS Safari でセッションが頻繁に切れる
 *   2. 未認証ユーザーを /login へリダイレクト
 *   3. 認証済みユーザーが /login・/signup にアクセスした場合 /dashboard へ転送
 *
 * iOS Safari 対策:
 *   - ITP（Intelligent Tracking Prevention）により Cookie が失われやすい
 *   - Access Token の有効期限（デフォルト 1 時間）を超える前に
 *     Refresh Token で更新することでセッションを維持する
 *   - この更新処理は proxy で getUser() を呼ぶことで自動実行される
 *   - リダイレクト時も更新済み Cookie を引き継ぐ（iOS 対策）
 */
export async function proxy(request: NextRequest) {
  // Cookie を更新できるようレスポンスを可変で保持する（Supabase SSR 公式パターン）
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // リクエストとレスポンス両方に Cookie をセットしてセッションを維持する
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // ⚠️ getUser() を必ず呼ぶ。これが Access Token の自動更新をトリガーする。
  // getSession() では更新されないため、必ず getUser() を使うこと。
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // 認証なしでもアクセスできるページ（公開ページ）
  // /p/ は未ログイン・ログイン済みどちらでも表示する公開プロフィールなので含める
  const isPublicPage =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/p/");

  // ログイン・新規登録フォームのみ（認証済みユーザーをダッシュボードへ転送する対象）
  // /p/ は認証済みユーザーもそのまま表示するため含めない
  const isAuthFormPage =
    pathname === "/login" ||
    pathname === "/signup";

  // 未認証ユーザーがアプリ本体にアクセス → /login へ（元のURLを redirect パラメータで保持）
  if (!user && !isPublicPage) {
    const originalPath = request.nextUrl.pathname + request.nextUrl.search;
    console.log(`[Proxy] 未認証 → /login へリダイレクト (path: ${originalPath})`);
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirect", originalPath);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    // 更新された Cookie をリダイレクトレスポンスにも引き継ぐ（iOS Safari 対策）
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, {
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite as "lax" | "strict" | "none" | undefined,
        path: cookie.path,
        maxAge: cookie.maxAge,
      });
    });
    return redirectResponse;
  }

  // 認証済みユーザーが /login・/signup にアクセス → /dashboard へ
  if (user && isAuthFormPage) {
    console.log(`[Proxy] 認証済み → /dashboard へリダイレクト (path: ${pathname})`);
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // 通常のリクエスト：更新済み Cookie 付きのレスポンスを返す
  return supabaseResponse;
}

export const config = {
  matcher: [
    // Next.js 内部パス・静的ファイル・画像最適化パスを除くすべてのルートに適用
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
