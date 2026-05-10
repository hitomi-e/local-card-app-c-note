"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AlertCircle, Loader2, Mail, Lock, Eye, EyeOff } from "lucide-react";
import type { AuthActionResult } from "@/types/auth";

// ─────────────────────────────────────────────
// ログインボタン
// ─────────────────────────────────────────────
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full min-h-[58px] flex items-center justify-center gap-2
                 rounded-2xl bg-[#81d8d0] text-white font-semibold text-base
                 hover:bg-[#5bbfb6] active:bg-[#4aafa8] transition-colors
                 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {pending ? (
        <>
          <Loader2 size={20} className="animate-spin" />
          ログイン中...
        </>
      ) : (
        "ログイン"
      )}
    </button>
  );
}

// ─────────────────────────────────────────────
// ログインフォーム本体
// ─────────────────────────────────────────────
type LoginFormProps = {
  action: (prev: AuthActionResult, formData: FormData) => Promise<AuthActionResult>;
  redirect?: string;
};

export default function LoginForm({ action, redirect }: LoginFormProps) {
  const [state, formAction] = useActionState<AuthActionResult, FormData>(
    action,
    {}
  );
  const [showPassword, setShowPassword] = useState(false);

  function togglePassword() {
    console.log('[Login] 目玉ボタン押下, 現在 showPassword:', showPassword);
    setShowPassword((prev) => !prev);
    console.log('[Login] setShowPassword 呼び出し完了');
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm px-6 py-8">
      <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">
        ログイン
      </h2>

      <form action={formAction} className="flex flex-col gap-4">
        {/* QRスキャン等からの遷移先を引き継ぐ */}
        {redirect && <input type="hidden" name="redirect" value={redirect} />}

        {/* エラーメッセージ */}
        {state.error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{state.error}</span>
          </div>
        )}

        {/* メールアドレス */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-gray-600">
            メールアドレス
          </label>
          <div className="relative">
            <Mail
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="example@email.com"
              className="w-full min-h-[50px] pl-10 pr-4 rounded-xl border border-gray-200
                         text-base text-gray-800 placeholder:text-gray-400
                         focus:outline-none focus:ring-2 focus:ring-[#81d8d0] focus:border-transparent
                         transition"
            />
          </div>
        </div>

        {/* パスワード */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium text-gray-600">
            パスワード
          </label>
          <div className="flex items-stretch gap-2">
            {/* 入力欄 */}
            <div className="relative flex-1">
              <Lock
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                placeholder="パスワードを入力"
                className="pw-input w-full min-h-[50px] pl-10 pr-4 rounded-xl border border-gray-200
                           text-base text-gray-800 placeholder:text-gray-400
                           focus:outline-none focus:ring-2 focus:ring-[#81d8d0] focus:border-transparent
                           transition"
              />
            </div>

            {/*
              目玉ボタン（入力欄の外側に配置）
              ─ Chrome/Edge はパスワード入力欄の右端にネイティブの「表示」ボタンを
                描画する。globals.css の .pw-input pseudo-element 指定でそれを非表示にし、
                このカスタムボタンだけが見えるようにしている。
              ─ onClick のみ使用（標準的な実装）。
            */}
            <button
              type="button"
              onClick={togglePassword}
              className="w-12 flex-shrink-0 min-h-[50px] flex items-center justify-center
                         rounded-xl border border-gray-200
                         text-gray-400 active:bg-gray-50 transition-colors"
              aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* パスワード注釈 */}
        <p className="text-xs text-gray-400 -mt-1">※ 英数字 6 文字以上</p>

        {/* ログインボタン */}
        <div className="mt-2">
          <SubmitButton />
        </div>
      </form>

      {/* サインアップへのリンク */}
      <p className="mt-6 text-center text-sm text-gray-500">
        アカウントをお持ちでない方は{" "}
        <Link
          href={redirect ? `/signup?redirect=${encodeURIComponent(redirect)}` : "/signup"}
          className="text-[#81d8d0] font-semibold hover:text-[#5bbfb6] transition-colors"
        >
          新規登録
        </Link>
      </p>
    </div>
  );
}
