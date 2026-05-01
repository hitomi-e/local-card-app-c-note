"use client";

import React, { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Loader2, Mail, Lock, MailCheck, Eye, EyeOff } from "lucide-react";
import type { SignupActionResult } from "@/types/auth";

// ─────────────────────────────────────────────
// 登録ボタン（useFormStatus でローディング制御）
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
          登録中...
        </>
      ) : (
        "アカウントを作成"
      )}
    </button>
  );
}

// ─────────────────────────────────────────────
// 確認メール送信完了カード
// ─────────────────────────────────────────────
function SuccessCard({ email }: { email: string }) {
  return (
    <div className="bg-white rounded-3xl shadow-sm px-6 py-10 flex flex-col items-center text-center gap-4">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-[#e8f8f7]">
        <MailCheck size={32} className="text-[#81d8d0]" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-1">
          確認メールを送信しました
        </h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          <span className="font-medium text-gray-700 block break-all">{email}</span>
          に確認メールを送信しました。
        </p>
        <p className="text-sm text-gray-500 leading-relaxed">
          メール内のリンクをクリックして<br />
          アカウントを有効化してください。
        </p>
      </div>
      <p className="text-xs text-gray-400 mt-2 break-keep">
        メールが届かない場合は<br />
        迷惑メールフォルダをご確認ください。
      </p>
      <Link
        href="/login"
        className="mt-2 text-sm text-[#81d8d0] font-semibold hover:text-[#5bbfb6] transition-colors"
      >
        ログイン画面に戻る
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────
// サインアップフォーム本体（Client Component）
// ─────────────────────────────────────────────
type SignupFormProps = {
  action: (
    prev: SignupActionResult,
    formData: FormData
  ) => Promise<SignupActionResult>;
  redirect?: string;
};

export default function SignupForm({ action, redirect }: SignupFormProps) {
  const router = useRouter();
  // 送信時のメールアドレスを保持し、完了カードで表示する
  const emailRef = React.useRef<string>("");
  // パスワード表示 / 非表示の切り替え
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const wrappedAction = async (
    prev: SignupActionResult,
    formData: FormData
  ): Promise<SignupActionResult> => {
    emailRef.current = (formData.get("email") as string) ?? "";
    const result = await action(prev, formData);

    if (result.success) {
      // QR招待URLに userId が含まれる場合、ウェルカム演出後の遷移先を保存
      if (redirect) {
        const match = redirect.match(/[?&]userId=([^&]+)/);
        if (match) {
          localStorage.setItem("pending_contact_user_id", match[1]);
        }
      }

      // メール確認不要設定（Supabaseが即座にセッション作成）→ ダッシュボードへ直接遷移
      if (result.sessionCreated) {
        localStorage.setItem("is_new_signup", "true");
        router.push("/dashboard");
      }
    }

    return result;
  };

  const [state, formAction] = useActionState<SignupActionResult, FormData>(
    wrappedAction,
    {}
  );

  // メール確認が必要な場合のみ SuccessCard を表示する
  // sessionCreated の場合はダッシュボードへ遷移中のため表示不要
  if (state.success && !state.sessionCreated) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('is_new_signup', 'true');
    }
    return <SuccessCard email={emailRef.current} />;
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm px-6 py-8">
      <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">
        新規登録
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
          <label
            htmlFor="password"
            className="text-sm font-medium text-gray-600"
          >
            パスワード
          </label>
          <div className="relative">
            <Lock
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              placeholder="英数字8文字以上で入力"
              className="w-full min-h-[50px] pl-10 pr-11 rounded-xl border border-gray-200
                         text-base text-gray-800 placeholder:text-gray-400
                         focus:outline-none focus:ring-2 focus:ring-[#81d8d0] focus:border-transparent
                         transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <p className="text-xs text-gray-400">※ 英数字8文字以上で設定してください</p>
        </div>

        {/* パスワード確認 */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="confirmPassword"
            className="text-sm font-medium text-gray-600"
          >
            パスワード（確認）
          </label>
          <div className="relative">
            <Lock
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              required
              placeholder="もう一度入力してください"
              className="w-full min-h-[50px] pl-10 pr-11 rounded-xl border border-gray-200
                         text-base text-gray-800 placeholder:text-gray-400
                         focus:outline-none focus:ring-2 focus:ring-[#81d8d0] focus:border-transparent
                         transition"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((prev) => !prev)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label={showConfirm ? "パスワードを隠す" : "パスワードを表示"}
            >
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* 登録ボタン */}
        <div className="mt-2">
          <SubmitButton />
        </div>
      </form>

      {/* ログインへのリンク */}
      <p className="mt-6 text-center text-sm text-gray-500">
        すでにアカウントをお持ちの方は{" "}
        <Link
          href="/login"
          className="text-[#81d8d0] font-semibold hover:text-[#5bbfb6] transition-colors"
        >
          ログイン
        </Link>
      </p>
    </div>
  );
}
