"use client";

/**
 * アバタードロップダウンメニュー（Client Component）
 * ────────────────────────────────────────────────
 * ・アバターをクリック → メニューを表示
 * ・メニュー外クリック / ページ遷移 → 自動的に閉じる
 */

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, QrCode, ScanLine, BookOpen, Mail } from "lucide-react";

const CONTACT_FORM_URL = 'https://forms.gle/qjP54hoCXyU79fc78';
import { logoutAction } from "@/app/(app)/actions";

type AvatarMenuProps = {
  initial: string;
  email: string;
};

export default function AvatarMenu({ initial, email }: AvatarMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef  = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // ページ遷移時にメニューを閉じる
  useEffect(() => { setIsOpen(false); }, [pathname]);

  // メニュー外クリックで閉じる
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={menuRef} className="relative">

      {/* ─── アバターボタン ────────────────────────────────
          背景: アクセントカラー（#E8B84B）
          文字: text-gray-900（黄色背景でのコントラスト比 ≈ 4.5:1 ✓）
      ──────────────────────────────────────────────────── */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        style={{ backgroundColor: '#FCD34D', color: '#374151' }}
        className="
          w-9 h-9 rounded-full
          bg-[#FCD34D] hover:bg-[#f5c518] active:bg-[#eab308]
          flex items-center justify-center
          text-gray-800 font-bold text-sm
          transition-colors select-none
          focus:outline-none focus:ring-2 focus:ring-[#FCD34D] focus:ring-offset-2
        "
        aria-label="メニューを開く"
        aria-expanded={isOpen}
      >
        {initial}
      </button>

      {/* ─── ドロップダウン ──────────────────────────────── */}
      {isOpen && (
        <div className="
          absolute right-0 top-11 z-50 w-60
          bg-white rounded-2xl shadow-lg border border-gray-100
          py-2 overflow-hidden
        ">

          {/* メールアドレス */}
          <div className="px-4 py-2 border-b border-gray-100">
            <p className="text-xs text-gray-400 mb-0.5">ログイン中</p>
            <p className="text-sm font-medium text-gray-700 truncate">{email}</p>
          </div>

          {/* My QRコード */}
          <Link
            href="/profile/qr"
            className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            <QrCode size={16} className="text-[#E8B84B] shrink-0" />
            <span className="flex-1">My QRコード</span>
            <span className="text-[10px] text-gray-400 whitespace-nowrap">名刺を相手へ渡す</span>
          </Link>

          {/* QRコードスキャン */}
          <Link
            href="/scan/qr"
            className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            <ScanLine size={16} className="text-[#81d8d0] shrink-0" />
            <span className="flex-1">QRコードスキャン</span>
            <span className="text-[10px] text-gray-400 whitespace-nowrap">相手の名刺を受け取る</span>
          </Link>

          {/* C-Note QRコード（鶴ロゴ） */}
          <Link
            href="/qr/app"
            className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            {/* 折り鶴ロゴ（ヘッダーと同じ /logo-crane.svg を再利用） */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-crane.svg" alt="C-Note" className="w-6 h-6 shrink-0" />
            <span className="flex-1">C-Note QRコード</span>
            <span className="text-[10px] text-gray-400 whitespace-nowrap">アプリ紹介</span>
          </Link>

          {/* 区切り線 */}
          <div className="border-t border-gray-100 my-1" />

          {/* 使い方・Q&A */}
          <Link
            href="/help"
            className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            <BookOpen size={16} className="text-[#81d8d0] shrink-0" />
            <span className="flex-1">使い方・Q&A</span>
          </Link>

          {/* お問い合わせ */}
          <a
            href={CONTACT_FORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            <Mail size={16} className="text-gray-400 shrink-0" />
            <span className="flex-1">お問い合わせ</span>
          </a>

          {/* 区切り線 */}
          <div className="border-t border-gray-100 my-1" />

          {/* ログアウト */}
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 font-medium hover:bg-red-50 transition-colors text-left"
            >
              <LogOut size={16} />
              ログアウト
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
