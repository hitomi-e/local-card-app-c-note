'use client';

/**
 * 新規登録お祝い演出オーバーレイ
 *
 * ログイン後のアプリレイアウトで localStorage の is_new_signup フラグを検出した場合に表示。
 * 演出終了後、pending_contact_user_id があれば /scan/confirm へ遷移する。
 *
 * StrictMode 対策:
 * - タイマーは「visible が true になった」を監視する第2 useEffect に分離。
 *   これにより StrictMode の二重 useEffect 実行でも確実にタイマーが動く。
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function WelcomeOverlay() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  // タイマーコールバックでも常に最新の userId を参照できるように ref でも保持
  const userIdRef = useRef<string | null>(null);

  // localStorage フラグを確認してオーバーレイを表示する
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isNew = localStorage.getItem('is_new_signup');
    if (isNew !== 'true') return;

    const userId = localStorage.getItem('pending_contact_user_id');
    localStorage.removeItem('is_new_signup');

    userIdRef.current = userId;
    setPendingUserId(userId);
    setVisible(true);
    fireWelcomeConfetti();
  }, []);

  // visible=true になってから4秒後に自動遷移（StrictMode でも正しく動作）
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(goNext, 4000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function goNext() {
    const userId = userIdRef.current;
    // オーバーレイを先に非表示にしてから遷移（layout は共有されるため必須）
    setVisible(false);
    // 遷移前に DOM 上の全キャンバスを強制排除（confetti の残留ブロックを確実に除去）
    document.querySelectorAll('canvas').forEach(c => c.remove());
    if (userId) {
      localStorage.removeItem('pending_contact_user_id');
      router.push(`/scan/confirm?userId=${userId}`);
    }
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[500] flex flex-col items-center justify-center gap-6 px-6 text-center"
      style={{ background: 'linear-gradient(160deg, #e8f8f7 0%, #fffbea 100%)' }}
    >
      {/* ロゴ */}
      <div className="flex flex-col items-center gap-3">
        <Image src="/logo-crane.svg" alt="C-Note" width={120} height={120} priority />
        <span className="text-[28px] font-medium tracking-[0.2em] text-[#81d8d0] leading-none">
          C-Note
        </span>
      </div>

      {/* メインメッセージ */}
      <div className="flex flex-col items-center gap-2">
        <p className="text-2xl font-bold text-gray-800 leading-snug">
          C-Noteへようこそ！
        </p>
        <p className="text-lg font-semibold text-[#81d8d0]">
          ご縁に感謝します🌿
        </p>
      </div>

      {/* サブメッセージ */}
      {pendingUserId && (
        <p className="text-sm text-gray-500 leading-relaxed max-w-xs">
          スキャンした相手の名刺を<br />
          そのまま保存できます。
        </p>
      )}

      {/* ボタン */}
      <button
        type="button"
        onClick={goNext}
        style={{ backgroundColor: '#FCD34D', color: '#374151' }}
        className="
          mt-2 w-full max-w-xs min-h-[58px]
          flex items-center justify-center gap-2
          text-base font-bold rounded-2xl shadow-sm
          hover:opacity-90 active:scale-[0.98] transition-all
        "
      >
        {pendingUserId ? '名刺を受け取る →' : 'はじめる →'}
      </button>
    </div>
  );
}

async function fireWelcomeConfetti() {
  const confetti = (await import('canvas-confetti')).default;
  const craneShape = confetti.shapeFromPath({
    path: 'M50,0 L65,35 L100,25 L80,50 L100,75 L65,60 L50,100 L35,60 L0,75 L20,50 L0,25 L35,35 Z',
  });
  const colors = ['#81d8d0', '#c3f0ec', '#FCD34D', '#ffd6a0', '#ffffff', '#ffe4f0'];

  confetti({ particleCount: 100, spread: 120, startVelocity: 60, decay: 0.92, origin: { x: 0.5, y: 0.6 }, colors });
  setTimeout(() => {
    confetti({ particleCount: 20, spread: 140, startVelocity: 45, decay: 0.90, origin: { x: 0.5, y: 0.6 }, shapes: [craneShape], colors: ['#81d8d0', '#FCD34D', '#ffffff'], scalar: 2.6 });
  }, 300);
  setTimeout(() => {
    confetti({ particleCount: 60, spread: 100, startVelocity: 50, decay: 0.93, origin: { x: 0.3, y: 0.5 }, colors });
    confetti({ particleCount: 60, spread: 100, startVelocity: 50, decay: 0.93, origin: { x: 0.7, y: 0.5 }, colors });
  }, 700);

  // グローバル confetti キャンバスはアニメーション終了後も DOM に残るため
  // reset() で明示的に除去し、さらに全キャンバスを強制排除してボタン操作がブロックされないようにする
  setTimeout(() => {
    try { confetti.reset(); } catch (_) { /* ignore */ }
    document.querySelectorAll('canvas').forEach(c => c.remove());
  }, 3000);
}
