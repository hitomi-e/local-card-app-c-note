'use client';

/**
 * スキャン画面
 * 画像選択 → プレビュー（表面 + 任意で裏面）→ OCR + Storage アップロード → /cards/new
 *
 * ── デバイス別UX ────────────────────────────────────────────
 * スマホ: タップでボトムシートを表示 → カメラ / ライブラリを選択
 * PC   : クリックで直接ファイル選択ウィンドウを開く
 *
 * ── レイアウト ──────────────────────────────────────────────
 * 各画像を固定アスペクト比（1.6:1）の枠に収め、
 * 右横に「回転・差替・削除」のサイドボタンを縦に並べる。
 * 回転時も枠サイズは変わらないため、ボタンがズレない。
 *
 * ── 裏面対応 ────────────────────────────────────────────────
 * 表面を選択した後に「裏面も撮影する」ボタンが出現。
 * 両面を選択した場合、OCR は2枚を合わせて解析する。
 */

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Camera,
  Images,
  ScanLine,
  RotateCcw,
  RefreshCw,
  Trash2,
  AlertCircle,
  FlipHorizontal2,
} from 'lucide-react';
import type { CardOcrResult } from '@/lib/ocr/gemini';
import { createClient } from '@/lib/supabase/client';
import { uploadCardImage } from '@/lib/supabase/storage';

export const OCR_SESSION_KEY          = 'ocr_result';
export const SCAN_IMAGE_PATH_KEY      = 'scan_image_path';
export const SCAN_BACK_IMAGE_PATH_KEY = 'scan_back_image_path';

// ────────────────────────────────────────────────────────────
// 折り鶴紙吹雪エフェクト（一時無効化中）
// ────────────────────────────────────────────────────────────
// async function fireConfetti() { ... }

type Status = 'idle' | 'selected' | 'processing' | 'done' | 'error';

export default function ScanPage() {
  const router = useRouter();

  // ── 表面 ──────────────────────────────────────────
  const [status,  setStatus]  = useState<Status>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);
  const mimeRef    = useRef<string>('image/jpeg');

  // ── 裏面（任意）──────────────────────────────────
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const backPreviewRef = useRef<string | null>(null);
  const backMimeRef    = useRef<string>('image/jpeg');

  // ── UI 状態 ───────────────────────────────────────
  const [errorMsg,            setErrorMsg]            = useState<string | null>(null);
  const [isMobile,            setIsMobile]            = useState(false);
  const [showBottomSheet,     setShowBottomSheet]     = useState(false);
  const [showBackBottomSheet, setShowBackBottomSheet] = useState(false);

  // ── input refs（表面） ────────────────────────────
  const changeInputRef  = useRef<HTMLInputElement>(null);
  const cameraInputRef  = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  // ── input refs（裏面） ────────────────────────────
  const backChangeInputRef  = useRef<HTMLInputElement>(null);
  const backCameraInputRef  = useRef<HTMLInputElement>(null);
  const backLibraryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  // ── ファイル選択（表面）──────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setShowBottomSheet(false);
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('selected');
    setPreview(null);
    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const d = ev.target?.result;
      if (typeof d === 'string') { previewRef.current = d; mimeRef.current = file.type || 'image/jpeg'; setPreview(d); }
    };
    reader.onerror = () => { setErrorMsg('画像の読み込みに失敗しました。'); setStatus('error'); };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  // ── ファイル選択（裏面）──────────────────────────
  function handleBackFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setShowBackBottomSheet(false);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const d = ev.target?.result;
      if (typeof d === 'string') { backPreviewRef.current = d; backMimeRef.current = file.type || 'image/jpeg'; setBackPreview(d); }
    };
    reader.onerror = () => setErrorMsg('裏面画像の読み込みに失敗しました。');
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  // ── ピッカーを開く ───────────────────────────────
  function openPicker()     { if (isMobile) setShowBottomSheet(true);     else changeInputRef.current?.click(); }
  function openBackPicker() { if (isMobile) setShowBackBottomSheet(true); else backChangeInputRef.current?.click(); }

  // ── 反時計回り90度回転（CCW）────────────────────
  // スマホ撮影は通常 CCW で向きが整うため反時計回りを採用
  function rotateImageCCW90(dataUrl: string, mime: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width  = img.height;
        canvas.height = img.width;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('canvas context unavailable')); return; }
        ctx.translate(0, img.width);
        ctx.rotate(-Math.PI / 2);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL(mime));
      };
      img.onerror = () => reject(new Error('image load failed'));
      img.src = dataUrl;
    });
  }

  async function handleRotate(side: 'front' | 'back') {
    const dataUrl = side === 'front' ? previewRef.current : backPreviewRef.current;
    const mime    = side === 'front' ? mimeRef.current    : backMimeRef.current;
    if (!dataUrl) return;
    try {
      const rotated = await rotateImageCCW90(dataUrl, mime);
      if (side === 'front') { previewRef.current = rotated; setPreview(rotated); }
      else                  { backPreviewRef.current = rotated; setBackPreview(rotated); }
    } catch (e) { console.error('[Scan] 回転エラー:', e); }
  }

  function removeBack() { backPreviewRef.current = null; setBackPreview(null); }

  // ── OCR 実行 ─────────────────────────────────────
  async function handleProcess() {
    const dataUrl = previewRef.current;
    if (!dataUrl) { setErrorMsg('画像データが見つかりません。もう一度選択してください。'); setStatus('error'); return; }

    const base64      = dataUrl.slice(dataUrl.indexOf(',') + 1);
    const mime        = mimeRef.current;
    const backDataUrl = backPreviewRef.current;
    const backBase64  = backDataUrl ? backDataUrl.slice(backDataUrl.indexOf(',') + 1) : undefined;
    const backMime    = backDataUrl ? backMimeRef.current : undefined;

    setStatus('processing');
    setErrorMsg(null);

    try {
      const body: { imageBase64: string; mimeType: string; backImageBase64?: string; backMimeType?: string } =
        { imageBase64: base64, mimeType: mime };
      if (backBase64 && backMime) { body.backImageBase64 = backBase64; body.backMimeType = backMime; }

      const res  = await fetch('/api/ocr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = (await res.json()) as { ok: true; data: CardOcrResult } | { ok: false; error: string };

      if (!json.ok) { setErrorMsg(json.error); setStatus('error'); return; }

      sessionStorage.setItem(OCR_SESSION_KEY, JSON.stringify(json.data));

      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const ext  = mime.split('/')[1] ?? 'jpg';
          const { path, error: upErr } = await uploadCardImage(supabase, user.id, base64ToFile(base64, `card_scan.${ext}`, mime));
          if (upErr) console.warn('[Scan] 表面アップロード失敗:', upErr);
          else if (path) sessionStorage.setItem(SCAN_IMAGE_PATH_KEY, path);

          if (backBase64 && backMime) {
            const backExt = backMime.split('/')[1] ?? 'jpg';
            const { path: bp, error: bErr } = await uploadCardImage(supabase, user.id, base64ToFile(backBase64, `card_scan_back.${backExt}`, backMime));
            if (bErr) console.warn('[Scan] 裏面アップロード失敗:', bErr);
            else if (bp) {
              sessionStorage.setItem(SCAN_BACK_IMAGE_PATH_KEY, bp);
              console.log('[Scan] 裏面アップロード成功:', bp);
            }
          }
        }
      } catch (uploadErr) { console.warn('[Scan] Storageアップロードエラー:', uploadErr); }

      router.replace('/cards/new');

    } catch (err) {
      console.error('[Scan] fetchエラー:', err);
      setErrorMsg('通信エラーが発生しました。もう一度お試しください。');
      setStatus('error');
    }
  }

  // ── レンダリング ─────────────────────────────────
  return (
    <div className="px-4 py-2 flex flex-col gap-4">

      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="w-9 h-9 flex items-center justify-center bg-white rounded-full shadow-sm text-gray-500 hover:text-[#81d8d0] active:scale-95 transition-all" aria-label="ダッシュボードに戻る">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-bold text-gray-800">名刺をスキャン</h1>
      </div>

      {/* ── idle: タップエリア ── */}
      {status === 'idle' && (
        <div className="relative w-full bg-white rounded-2xl flex flex-col items-center justify-center py-10 px-8 gap-4">
          {isMobile ? (
            /* touch-action: manipulation でダブルタップズームとの競合を防ぐ */
            <button
              type="button"
              onClick={() => setShowBottomSheet(true)}
              className="absolute inset-0 w-full h-full z-10"
              style={{ touchAction: 'manipulation' }}
              aria-label="画像を選択"
            />
          ) : (
            <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" style={{ fontSize: 0, color: 'transparent' }} />
          )}
          {/* カメラアイコン */}
          <div className="pointer-events-none w-16 h-16 rounded-full bg-[#81d8d0] flex items-center justify-center shadow-md">
            <Camera size={30} className="text-white" strokeWidth={1.8} />
          </div>
          {/* 操作テキスト（ブランドカラー） */}
          <p className="pointer-events-none text-base font-semibold text-[#3a9e97] text-center">
            {isMobile ? 'カメラで撮影／ライブラリから選択' : 'ファイルを選択'}
          </p>
          {/* 補足テキスト */}
          <p className="pointer-events-none text-lg font-bold text-gray-900 text-center">タップしてください</p>
        </div>
      )}

      {/* ── selected / processing / error: 画像カード + ボタン ── */}
      {(status === 'selected' || status === 'processing' || status === 'error') && (
        <div className="flex flex-col gap-4">

          {/* 表面カード */}
          <ImageCard
            label="表面"
            imageUrl={preview}
            onRotate={() => handleRotate('front')}
            onReplace={openPicker}
          />

          {/* 裏面カード（選択済みの場合） */}
          {backPreview && (
            <ImageCard
              label="裏面"
              imageUrl={backPreview}
              onRotate={() => handleRotate('back')}
              onReplace={openBackPicker}
              onDelete={removeBack}
            />
          )}

          {/* エラーメッセージ */}
          {errorMsg && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
              <p className="text-sm text-red-600">{errorMsg}</p>
            </div>
          )}

          {/* アクションボタン（selected / error のみ） */}
          {(status === 'selected' || status === 'error') && (
            <div className="flex flex-col gap-3">
              {/* 読み取りボタン */}
              <button type="button" onClick={handleProcess}
                className="w-full min-h-[58px] bg-[#81d8d0] hover:bg-[#5bbfb6] active:bg-[#4aafa8] text-white font-bold text-base rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-sm">
                <ScanLine size={20} />
                {backPreview ? '表面・裏面を読み取る' : 'この名刺を読み取る'}
              </button>

              {/* 裏面追加ボタン（裏面未選択時のみ） */}
              {!backPreview && (
                <>
                  <input ref={backChangeInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" onChange={handleBackFileChange}
                    style={{ position: 'fixed', top: '-200px', left: '-200px', width: '1px', height: '1px', opacity: 0 }} />
                  <button type="button" onClick={openBackPicker}
                    className="w-full min-h-[52px] bg-white border-2 border-dashed border-[#81d8d0] rounded-2xl flex items-center justify-center gap-2 text-[#3a9e97] font-semibold text-sm hover:bg-[#f0fbfa] active:scale-95 transition-all">
                    <FlipHorizontal2 size={18} />
                    裏面も撮影する（任意）
                  </button>
                </>
              )}
            </div>
          )}

          {/* 処理中フルスクリーンオーバーレイ（フローティングダイアログ方式） */}
          {status === 'processing' && (
            <>
              {/* 折り鶴ふわふわアニメーション定義 */}
              <style>{`
                @keyframes crane-float {
                  0%, 100% { transform: translateY(0px);  }
                  50%       { transform: translateY(-12px); }
                }
              `}</style>

              {/* 背景：背後の名刺を暗く（中央ボックスを際立たせる） */}
              <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center px-8">

                {/* 白いフローティングカード */}
                <div className="w-full max-w-xs bg-white rounded-3xl shadow-2xl px-8 py-10 flex flex-col items-center gap-5">

                  {/* 折り鶴ロゴ：ふわふわ浮く */}
                  <div
                    className="w-20 h-20"
                    style={{ animation: 'crane-float 2s ease-in-out infinite' }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/logo-crane.svg"
                      alt="読み取り中"
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {/* メッセージ */}
                  <div className="flex flex-col items-center gap-2 text-center">
                    <p className="text-base font-bold text-[#3a9e97] tracking-wide">
                      AI が名刺を読み取り中...
                    </p>
                    {backPreview && (
                      <p className="text-sm text-gray-400">
                        表面・裏面の両方を解析しています
                      </p>
                    )}
                  </div>

                  {/* 点滅インジケーター */}
                  <div className="flex items-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-2 h-2 rounded-full bg-[#81d8d0]"
                        style={{ animation: `crane-float 1.2s ease-in-out ${i * 0.2}s infinite` }}
                      />
                    ))}
                  </div>

                </div>
              </div>
            </>
          )}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">読み取り結果は確認・修正できます。</p>

      {/* 表面 input（画面外配置 — iOS Safari 対策） */}
      <input ref={cameraInputRef}  type="file" accept="image/*" capture="environment" onChange={handleFileChange}     style={{ position: 'fixed', top: '-200px', left: '-200px', width: '1px', height: '1px', opacity: 0 }} />
      <input ref={libraryInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" onChange={handleFileChange} style={{ position: 'fixed', top: '-200px', left: '-200px', width: '1px', height: '1px', opacity: 0 }} />
      <input ref={changeInputRef}  type="file" accept="image/jpeg,image/png,image/webp,image/heic" onChange={handleFileChange} style={{ position: 'fixed', top: '-200px', left: '-200px', width: '1px', height: '1px', opacity: 0 }} />

      {/* 裏面 input（画面外配置） */}
      <input ref={backCameraInputRef}  type="file" accept="image/*" capture="environment" onChange={handleBackFileChange}     style={{ position: 'fixed', top: '-200px', left: '-200px', width: '1px', height: '1px', opacity: 0 }} />
      <input ref={backLibraryInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" onChange={handleBackFileChange} style={{ position: 'fixed', top: '-200px', left: '-200px', width: '1px', height: '1px', opacity: 0 }} />

      {/* ボトムシート（表面）── QRコードで受け取るボタンを追加 */}
      {isMobile && <BottomSheet show={showBottomSheet}     onClose={() => setShowBottomSheet(false)}     title="表面の画像を選択" onCamera={() => cameraInputRef.current?.click()}      onLibrary={() => libraryInputRef.current?.click()} onQrScan={() => { setShowBottomSheet(false); router.push('/scan/qr'); }} />}
      {/* ボトムシート（裏面） */}
      {isMobile && <BottomSheet show={showBackBottomSheet} onClose={() => setShowBackBottomSheet(false)} title="裏面の画像を選択" onCamera={() => backCameraInputRef.current?.click()} onLibrary={() => backLibraryInputRef.current?.click()} />}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 画像カード（固定枠 + 右サイドボタン）
//
// aspectRatio: '1.6/1' の枠を固定し、回転しても枠サイズは不変。
// ボタンはその隣に縦並びで配置するため、位置がズレない。
// ────────────────────────────────────────────────────────────
function ImageCard({
  label,
  imageUrl,
  onRotate,
  onReplace,
  onDelete,
}: {
  label: string;
  imageUrl: string | null;
  onRotate: () => void;
  onReplace: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11px] font-semibold text-gray-400 tracking-wide">{label}</p>
      <div className="flex gap-2.5">

        {/* 固定アスペクト比（1.6:1 = 名刺横向き）の画像枠 */}
        <div
          className="flex-1 relative bg-gray-100 rounded-xl overflow-hidden"
          style={{ aspectRatio: '1.6 / 1' }}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={`${label}の名刺`}
              className="absolute inset-0 w-full h-full object-contain"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-xs text-gray-400 animate-pulse">読み込み中...</p>
            </div>
          )}
        </div>

        {/* 右サイドボタン列（高さは画像枠に自動追従） */}
        <div className="flex flex-col gap-2 justify-center shrink-0">
          <SideIconButton onClick={onRotate}  icon={<RotateCcw size={15} />} label="回転" />
          <SideIconButton onClick={onReplace} icon={<RefreshCw size={15} />} label="差替" />
          {onDelete && (
            <SideIconButton onClick={onDelete} icon={<Trash2 size={15} />} label="削除" danger />
          )}
        </div>

      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// サイドアイコンボタン
// ────────────────────────────────────────────────────────────
function SideIconButton({
  onClick,
  icon,
  label,
  danger = false,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-12 flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl
        border shadow-sm transition-all active:scale-95
        ${danger
          ? 'text-red-400 border-red-100 bg-white hover:bg-red-50 hover:border-red-300'
          : 'text-gray-500 border-gray-100 bg-white hover:text-[#3a9e97] hover:border-[#81d8d0]'}
      `}
    >
      {icon}
      <span className="text-[9px] font-medium leading-none">{label}</span>
    </button>
  );
}

// ────────────────────────────────────────────────────────────
// ボトムシート（表面・裏面で共用）
// ────────────────────────────────────────────────────────────
function BottomSheet({
  show, onClose, title, onCamera, onLibrary, onQrScan,
}: {
  show: boolean; onClose: () => void; title: string;
  onCamera: () => void; onLibrary: () => void;
  /** QRコードで受け取るボタン（省略時は非表示） */
  onQrScan?: () => void;
}) {
  return (
    <div className={`fixed inset-0 z-50 transition-opacity duration-300 ${show ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl px-4 pt-5 transition-transform duration-300 ease-out ${show ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        <p className="text-sm font-semibold text-gray-500 text-center mb-4">{title}</p>
        <div className="flex flex-col gap-3">
          <button type="button" onClick={onCamera}  className="w-full min-h-[62px] bg-[#81d8d0] hover:bg-[#5bbfb6] active:bg-[#4aafa8] text-white font-bold text-base rounded-2xl flex items-center justify-center gap-3 transition-colors shadow-sm"><Camera size={22} />カメラで撮影</button>
          <button type="button" onClick={onLibrary} className="w-full min-h-[62px] bg-white border-2 border-[#81d8d0] rounded-2xl flex items-center justify-center gap-3 text-[#3a9e97] font-semibold text-base hover:bg-[#e8f8f7] active:scale-95 transition-all"><Images size={22} />フォトライブラリを開く</button>
          {/* QRコードで受け取る（任意表示） */}
          {onQrScan && (
            <button type="button" onClick={onQrScan} className="w-full min-h-[62px] bg-[#E8B84B] hover:bg-[#d4a43a] active:bg-[#c09332] text-gray-900 font-bold text-base rounded-2xl flex items-center justify-center gap-3 transition-colors shadow-sm"><ScanLine size={22} />相手の名刺をQRコードで受け取る</button>
          )}
        </div>
        {/* スペーサー: iPhone ホームインジケーター + ボトムナビを完全に避けるための余白 */}
        <div style={{ height: 120 }} aria-hidden="true" />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// base64 → File 変換ヘルパー
// ────────────────────────────────────────────────────────────
function base64ToFile(base64: string, filename: string, mime: string): File {
  const bin   = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}
