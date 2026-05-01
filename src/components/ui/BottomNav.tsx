'use client';

/**
 * BottomNav — ボトムナビゲーション（Client Component）
 *
 * 中央の ＋ ボタンをタップすると下からボトムシートが出現し、
 * 「名刺をスキャン」「手入力で登録」の 2 択を選べる。
 *
 * layout.tsx は Server Component のため、クライアント状態（シート開閉）を
 * 持てない。そのためボトムナビ全体をこの Client Component に切り出した。
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Plus, User, ScanLine, PenLine, X } from 'lucide-react';

export default function BottomNav() {
  const pathname              = usePathname();
  const [showSheet, setShowSheet] = useState(false);

  // ページ遷移時にシートを自動で閉じる
  useEffect(() => {
    setShowSheet(false);
  }, [pathname]);

  // シート表示中は body スクロールをロック
  useEffect(() => {
    document.body.style.overflow = showSheet ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showSheet]);

  return (
    <>
      {/* ─── ナビゲーションバー ──────────────────────── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-[100] bg-white border-t border-gray-100 shadow-[0_-1px_8px_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-xl mx-auto flex items-stretch justify-around h-16">

          {/* 左: 名刺一覧 */}
          <NavItem
            href="/dashboard"
            icon={<LayoutGrid size={22} />}
            label="名刺帳"
            active={pathname === '/dashboard'}
          />

          {/* 中央: 登録ボタン（ボトムシートを開く）*/}
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setShowSheet(true)}
              aria-label="名刺を登録"
              className="
                flex flex-col items-center justify-center
                w-14 h-14 -mt-5 rounded-full
                bg-[#81d8d0] text-white shadow-lg
                hover:bg-[#5bbfb6] active:bg-[#4aafa8] active:scale-95
                touch-manipulation transition-all
              "
            >
              <Plus size={26} strokeWidth={2.5} />
            </button>
          </div>

          {/* 右: 自分の名刺 */}
          <NavItem
            href="/profile"
            icon={<User size={22} />}
            label="My名刺"
            active={pathname === '/profile'}
          />
        </div>
      </nav>

      {/* ─── ボトムシート（登録方法を選択）───────────── */}

      {/* 背景オーバーレイ（シート非表示時は DOM から完全除去してタッチをブロックしない） */}
      {showSheet && (
        <div
          className="fixed inset-0 z-[150] bg-black/40"
          onClick={() => setShowSheet(false)}
          aria-hidden="true"
        />
      )}

      {/* シート本体 */}
      <div
        className={`
          fixed bottom-0 left-0 right-0 z-[200]
          bg-white rounded-t-3xl shadow-2xl
          transition-transform duration-300 ease-out
          ${showSheet ? 'translate-y-0' : 'translate-y-full'}
        `}
        role="dialog"
        aria-modal="true"
        aria-label="名刺を登録"
      >
        {/* ハンドルバー */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* タイトル + 閉じるボタン */}
        <div className="flex items-center justify-between px-6 pb-3">
          <p className="text-base font-bold text-gray-800">名刺を追加登録</p>
          <button
            type="button"
            onClick={() => setShowSheet(false)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
            aria-label="閉じる"
          >
            <X size={16} />
          </button>
        </div>

        {/* 選択肢 */}
        <div
          className="px-4 flex flex-col gap-3"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}
        >

          {/* スキャンで登録 */}
          <Link
            href="/scan"
            className="
              flex items-center gap-4 min-h-[72px] px-5
              bg-[#e8f8f7] rounded-2xl
              hover:bg-[#d0f0ee] active:scale-[0.98] transition-all
            "
          >
            <div className="w-11 h-11 rounded-full bg-[#81d8d0] flex items-center justify-center text-white shadow-sm shrink-0">
              <ScanLine size={22} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">名刺をスキャン</p>
              <p className="text-xs text-gray-500 mt-0.5">自動入力：カメラで撮影／ライブラリから選択</p>
            </div>
          </Link>

          {/* 手入力で登録 */}
          <Link
            href="/cards/new"
            className="
              flex items-center gap-4 min-h-[72px] px-5
              bg-gray-50 rounded-2xl
              hover:bg-gray-100 active:scale-[0.98] transition-all
            "
          >
            <div className="w-11 h-11 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 shadow-sm shrink-0">
              <PenLine size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">自分で入力</p>
              <p className="text-xs text-gray-500 mt-0.5">直接入力：名刺登録フォーム</p>
            </div>
          </Link>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────
// ナビアイテム（左・右）
// ─────────────────────────────────────────────────
function NavItem({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`
        flex flex-col items-center justify-center gap-0.5 min-w-[72px] flex-1
        touch-manipulation transition-colors
        ${active ? 'text-[#81d8d0]' : 'text-gray-400 hover:text-[#81d8d0]'}
      `}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}
