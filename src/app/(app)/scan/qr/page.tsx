'use client';

/**
 * QRコードスキャンページ
 *
 * BarcodeDetector API（Chrome・Safari iOS 17+）を使って
 * カメラ映像からリアルタイムでQRコードを読み取る。
 *
 * 非対応ブラウザ（Safari iOS 16以下など）向けには
 * ネイティブカメラアプリの使い方を案内する。
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { X, Camera, CheckCircle, ScanLine } from 'lucide-react';

// ── BarcodeDetector 型定義（TypeScript 標準に未含） ──────────
type BarcodeResult = { rawValue: string };
interface BarcodeDetectorI {
  detect(source: HTMLVideoElement): Promise<BarcodeResult[]>;
}
declare const BarcodeDetector: {
  new(opts?: { formats?: string[] }): BarcodeDetectorI;
  getSupportedFormats(): Promise<string[]>;
};

type Phase = 'starting' | 'scanning' | 'detected' | 'error' | 'unsupported';

export default function QrScanPage() {
  const router    = useRouter();
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef    = useRef<number>(0);

  const [phase,          setPhase]          = useState<Phase>('starting');
  const [detectedValue,  setDetectedValue]  = useState('');
  const [errorMsg,       setErrorMsg]       = useState('');
  // 二重検知・二重遷移を防ぐロック
  const navigatedRef = useRef(false);

  // カメラ・スキャンを停止
  const stopScan = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    // BarcodeDetector サポート確認
    if (typeof window === 'undefined' || !('BarcodeDetector' in window)) {
      setPhase('unsupported');
      return;
    }

    let detector: BarcodeDetectorI;
    try {
      detector = new BarcodeDetector({ formats: ['qr_code'] });
    } catch {
      setPhase('unsupported');
      return;
    }

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width:  { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) {
          // videoRef が null = コンポーネントがアンマウントされた
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        // 前のセッションが残っていた場合に備えてリセット
        if (video.srcObject) {
          video.srcObject = null;
        }
        video.srcObject = stream;
        await video.play();
        setPhase('scanning');

        // スキャンループ
        async function scan() {
          const v = videoRef.current;
          if (!v || v.readyState < 2) {
            rafRef.current = requestAnimationFrame(scan);
            return;
          }
          try {
            const codes = await detector.detect(v);
            if (codes.length > 0) {
              if (navigatedRef.current) return; // 二重検知を無視
              navigatedRef.current = true;
              setDetectedValue(codes[0].rawValue);
              setPhase('detected');
              stopScan();
              return; // ループ終了
            }
          } catch { /* 検出エラーは無視して継続 */ }
          rafRef.current = requestAnimationFrame(scan);
        }
        scan();

      } catch (e: unknown) {
        if (e instanceof Error && e.name === 'NotAllowedError') {
          setErrorMsg('カメラへのアクセスが許可されていません。\n設定 › Safari › カメラ で「許可」を選んでください。');
        } else {
          setErrorMsg('カメラの起動に失敗しました。\nブラウザを再起動してもう一度お試しください。');
        }
        setPhase('error');
      }
    }

    startCamera();
    return () => stopScan();
  }, [stopScan]);

  // ── テスト用：自動遷移を無効化（手動ボタンで確認） ────────────
  // ※ 検証後に元の自動遷移に戻す場合は、このブロックを下記に差し替える
  // QR 検出後 → detectedValue から userId を取得するだけ（画面遷移はボタン押下時）
  const detectedUserId = (() => {
    if (!detectedValue) return null;
    try {
      const url = new URL(detectedValue);
      const pathParts = url.pathname.split('/');
      if (pathParts[1] === 'p' && pathParts[2]) return pathParts[2];
    } catch { /* URL でない場合は null */ }
    return null;
  })();

  return (
    <div className="flex flex-col gap-5 px-4 py-5">

      {/* ヘッダー */}
      <header className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => { stopScan(); router.back(); }}
          className="p-1 -ml-1 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="戻る"
        >
          <X size={22} />
        </button>
        <h1 className="flex-1 text-base font-bold text-gray-800 px-1">QRコードスキャン</h1>
      </header>

      {/* ── 起動中 ─────────────────────────────────── */}
      {phase === 'starting' && (
        <div className="flex flex-col items-center gap-4 py-16">
          <div className="w-16 h-16 rounded-full bg-[#81d8d0]/20 flex items-center justify-center animate-pulse">
            <Camera size={28} className="text-[#81d8d0]" />
          </div>
          <p className="text-sm text-gray-500">カメラを起動しています...</p>
        </div>
      )}

      {/*
        ── カメラビュー（常にDOMに存在させる） ────────────────────────
        video 要素を phase 条件の外に置くことで videoRef.current が常に有効になる。
        表示/非表示は hidden クラスで切り替える。
      */}
      <div className={phase === 'scanning' ? 'flex flex-col items-center gap-4' : 'hidden'}>
        <div className="relative w-full max-w-sm aspect-square overflow-hidden rounded-2xl bg-black shadow-lg mx-auto">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          {/* スキャンガイド枠 */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-52 h-52 relative">
              {/* 四隅 */}
              <div className="absolute top-0 left-0  w-8 h-8 border-t-4 border-l-4 border-[#E8B84B] rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#E8B84B] rounded-tr-lg" />
              <div className="absolute bottom-0 left-0  w-8 h-8 border-b-4 border-l-4 border-[#E8B84B] rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#E8B84B] rounded-br-lg" />
              {/* スキャンライン */}
              <div className="absolute left-2 right-2 h-0.5 bg-[#E8B84B]/70 top-1/2 -translate-y-1/2 animate-pulse" />
            </div>
          </div>
        </div>
        <p className="text-sm text-gray-500 text-center">
          QRコードをカメラに向けてください
        </p>
      </div>

      {/* ── 検出完了 ────────────────────────────────── */}
      {phase === 'detected' && (
        <div className="flex flex-col items-center gap-4 py-12">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
            <CheckCircle size={36} className="text-green-500" />
          </div>
          <p className="text-base font-semibold text-gray-800">QRコードを認識しました！</p>
          <p className="text-sm text-gray-400 break-all text-center max-w-xs">{detectedValue}</p>

          {/* 名刺受け取りボタン（/p/{uuid} のみ表示） */}
          {detectedUserId ? (
            <button
              type="button"
              onClick={() => {
                // 新規登録フロー用：スキャンした相手を記憶しておく
                localStorage.setItem('pending_contact_user_id', detectedUserId);
                router.push(`/scan/confirm?userId=${detectedUserId}`);
              }}
              style={{ backgroundColor: '#FCD34D', color: '#374151' }}
              className="
                mt-2 w-full max-w-xs min-h-[58px]
                flex items-center justify-center gap-2
                text-base font-bold rounded-2xl shadow-sm
                hover:opacity-90 active:scale-[0.98] transition-all
              "
            >
              名刺を受け取る
            </button>
          ) : (
            <p className="text-xs text-gray-400">※ C-Note の名刺QRではありません</p>
          )}
        </div>
      )}

      {/* ── エラー ──────────────────────────────────── */}
      {phase === 'error' && (
        <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
            <Camera size={24} className="text-red-400" />
          </div>
          <p className="text-base font-semibold text-gray-700">カメラを起動できません</p>
          <p className="text-sm text-gray-500 leading-relaxed whitespace-pre-line">{errorMsg}</p>
          <button
            type="button"
            onClick={() => { stopScan(); router.back(); }}
            className="mt-1 px-6 py-2.5 rounded-xl bg-gray-100 text-sm font-medium text-gray-600 hover:bg-gray-200 transition-colors"
          >
            戻る
          </button>
        </div>
      )}

      {/* ── 非対応ブラウザ ───────────────────────────── */}
      {phase === 'unsupported' && (
        <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-[#81d8d0]/15 flex items-center justify-center">
            <ScanLine size={26} className="text-[#81d8d0]" />
          </div>
          <p className="text-base font-semibold text-gray-700">QRスキャン非対応のブラウザです</p>
          <div className="w-full bg-gray-50 rounded-xl p-4 text-left flex flex-col gap-3">
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1">📱 iPhone の場合</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                「カメラ」アプリを開いてQRコードに向けると自動で認識されます。または <strong>iOS 17 以上の Safari</strong> をお使いください。
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1">🤖 Android の場合</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                Chrome 最新版をお使いください。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.back()}
            className="mt-1 px-6 py-2.5 rounded-xl bg-gray-100 text-sm font-medium text-gray-600 hover:bg-gray-200 transition-colors"
          >
            戻る
          </button>
        </div>
      )}
    </div>
  );
}
