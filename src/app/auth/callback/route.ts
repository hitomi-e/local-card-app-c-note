import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * メール確認コールバック Route Handler
 * ─────────────────────────────────────────────────────────────
 * Supabase がメール確認リンクをクリックした際にリダイレクトされるエンドポイント。
 * URL に含まれる `code` パラメータをサーバーサイドでセッションに交換する。
 *
 * 成功: /dashboard へリダイレクト
 * 失敗: /login?error=auth_callback_failed へリダイレクト
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // 0.0.0.0 バインド時でも正しいホストを返すよう環境変数を優先する
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const code = searchParams.get("code");
  // next パラメータを取得（外部URLへのオープンリダイレクトを防ぐため / 始まりのみ許可）
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next = rawNext.startsWith("/") ? rawNext : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // セッション交換成功 → アプリへ転送する
      return NextResponse.redirect(`${siteUrl}${next}`);
    }
  }

  // code がない、またはセッション交換失敗 → ログイン画面にエラー付きで転送する
  return NextResponse.redirect(
    `${siteUrl}/login?error=auth_callback_failed`
  );
}
