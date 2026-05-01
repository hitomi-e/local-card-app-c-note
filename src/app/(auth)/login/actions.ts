"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AuthActionResult } from "@/types/auth";

/**
 * ログイン Server Action
 * メールアドレス・パスワードで Supabase Auth にサインインする
 */
export async function loginAction(
  _prev: AuthActionResult,
  formData: FormData
): Promise<AuthActionResult> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  // 入力値の簡易バリデーション
  if (!email || !password) {
    return { error: "メールアドレスとパスワードを入力してください" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Supabase のエラーコードを日本語メッセージに変換する
    if (
      error.code === "invalid_credentials" ||
      error.message?.includes("Invalid login credentials")
    ) {
      return { error: "メールアドレスまたはパスワードが正しくありません" };
    }
    if (error.message?.includes("Email not confirmed")) {
      return {
        error:
          "メールアドレスの確認が完了していません。確認メールをご確認ください",
      };
    }
    return { error: "ログインに失敗しました。しばらくしてから再試行してください" };
  }

  // ログイン成功 → redirect パラメータがあればそこへ、なければダッシュボードへ
  const redirectParam = formData.get("redirect") as string | null;
  const destination =
    redirectParam && redirectParam.startsWith("/") ? redirectParam : "/dashboard";
  redirect(destination);
}
