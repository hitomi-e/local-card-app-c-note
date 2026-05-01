"use server";

import { createClient } from "@/lib/supabase/server";
import type { SignupActionResult } from "@/types/auth";

/**
 * サインアップ Server Action
 * メール・パスワードで Supabase Auth に新規登録し、確認メールを送信する
 */
export async function signupAction(
  _prev: SignupActionResult,
  formData: FormData
): Promise<SignupActionResult> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  // 入力値の簡易バリデーション
  if (!email || !password || !confirmPassword) {
    return { error: "すべての項目を入力してください" };
  }

  // パスワード一致チェック
  if (password !== confirmPassword) {
    return { error: "パスワードが一致しません。もう一度ご確認ください" };
  }

  // パスワード強度チェック（英数字8文字以上）
  if (password.length < 8) {
    return { error: "パスワードは英数字8文字以上で設定してください" };
  }

  // redirect パラメータを取得し、メール確認後の遷移先に埋め込む
  const redirectParam = formData.get("redirect") as string | null;
  const safeRedirect =
    redirectParam && redirectParam.startsWith("/") ? redirectParam : null;
  const emailRedirectTo = safeRedirect
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(safeRedirect)}`
    : `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // メール確認後のリダイレクト先（QRスキャン経由の場合は確認画面へ直接飛ぶ）
      emailRedirectTo,
    },
  });

  if (error) {
    // ★デバッグ用: サーバーログにSupabaseの生エラーを出力（原因特定後に削除）
    console.error("[signupAction] Supabase Auth エラー:", {
      code: error.code,
      message: error.message,
      status: error.status,
      name: error.name,
    });

    if (
      error.code === "user_already_exists" ||
      error.message?.includes("already registered")
    ) {
      return { error: "このメールアドレスはすでに登録されています" };
    }
    if (
      error.code === "weak_password" ||
      error.message?.toLowerCase().includes("password")
    ) {
      return { error: "パスワードの要件を満たしていません。英数字8文字以上で再設定してください" };
    }
    // 原因特定のため一時的にエラー内容をそのまま返す（本番リリース前に必ず汎用メッセージに戻すこと）
    return { error: `登録に失敗しました（${error.message ?? error.code ?? "不明なエラー"}）` };
  }

  // data.session が非 null = Supabase の「メール確認不要」設定でセッションが即座に作成された
  const sessionCreated = !!data.session;
  console.log("[signupAction] 登録成功 sessionCreated:", sessionCreated);

  return { success: true, sessionCreated };
}
