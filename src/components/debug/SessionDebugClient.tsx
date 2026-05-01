'use client';

/**
 * SessionDebugClient
 * ──────────────────────────────────────────────────────
 * iOS Safari でセッション状態と遷移元URLをコンソールに出力する
 * デバッグ専用コンポーネント。本番では削除または無効化する。
 *
 * 出力内容:
 *   1. Supabase セッションが生きているか（クライアント側で再確認）
 *   2. アクセス元 URL（document.referrer）
 *   3. 現在の pathname
 *   4. sessionStorage に残っている OCR / 画像パスキー
 */

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function SessionDebugClient() {
  useEffect(() => {
    (async () => {
      const supabase = createClient();

      // ① Supabase セッション確認（クライアント側）
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      console.group('[SessionDebug] ─── ダッシュボード到着時のセッション確認 ───');

      if (sessionError) {
        console.warn('[SessionDebug] getSession() エラー:', sessionError.message);
      }

      if (session) {
        const expiresAt = new Date(session.expires_at! * 1000).toLocaleString('ja-JP');
        console.log('[SessionDebug] ✓ セッション 生存中');
        console.log('[SessionDebug]   user.email   :', session.user.email);
        console.log('[SessionDebug]   expires_at   :', expiresAt);
        console.log('[SessionDebug]   access_token :', session.access_token.slice(0, 20) + '…');
      } else {
        console.warn('[SessionDebug] ✗ セッションなし（未認証状態でダッシュボードに到達）');
      }

      // ② 遷移元 URL
      console.log('[SessionDebug] document.referrer :', document.referrer || '（なし）');
      console.log('[SessionDebug] location.pathname :', location.pathname);

      // ③ sessionStorage の残留キー確認
      const ocrKey  = sessionStorage.getItem('ocr_result');
      const imgKey  = sessionStorage.getItem('scan_image_path');
      console.log('[SessionDebug] sessionStorage ocr_result      :', ocrKey  ? '残留あり' : 'なし');
      console.log('[SessionDebug] sessionStorage scan_image_path :', imgKey  ? '残留あり' : 'なし');

      // ④ User-Agent（iOSかどうか確認用）
      console.log('[SessionDebug] userAgent :', navigator.userAgent);

      console.groupEnd();
    })();
  }, []);

  // UI は描画しない（ログのみ）
  return null;
}
