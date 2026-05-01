'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';

type Props = {
  redirectTo: string;
  message?: string;
};

export function SaveSuccessOverlay({
  redirectTo,
  message = '新しいご縁を保存しました',
}: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 1.8秒後に自動遷移
  useEffect(() => {
    if (!mounted) return;
    const timer = setTimeout(() => {
      router.push(redirectTo);
    }, 1800);
    return () => clearTimeout(timer);
  }, [mounted, router, redirectTo]);

  if (!mounted) return null;

  return createPortal(
    <>
      {/* !important で背景色を強制上書き（デバッグ用） */}
      <style>{`
        @keyframes cnote-success-in {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1);    }
        }
        .cnote-overlay-bg {
          background: #81d8d0 !important;
          background-color: #81d8d0 !important;
        }
      `}</style>

      <div
        className="cnote-overlay-bg"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 2147483647,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.5rem',
          padding: '2rem',
          animation: 'cnote-success-in 0.4s ease-out both',
        }}
      >
        {/* 折り鶴ロゴ */}
        <div style={{ width: '8rem', height: '8rem' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-white.svg"
            alt="C-Note"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>

        {/* テキスト（デバッグ中は黒で反映確認） */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem', textAlign: 'center' }}>
          <p style={{ fontSize: '2rem', fontWeight: 700, color: '#ffffff', letterSpacing: '0.2em', margin: 0 }}>
            Success!
          </p>
          <p style={{ fontSize: '1.1rem', fontWeight: 600, color: '#ffffff', whiteSpace: 'pre-line', margin: 0 }}>
            {message}
          </p>
        </div>

      </div>
    </>,
    document.body
  );
}