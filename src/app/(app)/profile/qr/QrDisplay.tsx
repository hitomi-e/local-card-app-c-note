'use client';

/**
 * My QRコード 表示・操作コンポーネント（Client Component）
 *
 * ・中央に大きな QRコード（react-qr-code）
 * ・QRの下に名前と共有URL
 * ・下部に「シェア」「リンクをコピー」「保存」の3ボタン
 *
 * 保存ボタンの動作:
 *   1. SVG → Canvas → PNG に変換
 *   2. navigator.share({ files }) が使える場合 → iOS 共有シートで「写真に保存」が可能
 *   3. 使えない場合 → 新しいタブで PNG を開き「長押しで保存」を案内
 */

import { useRef, useState } from 'react';
import QRCode from 'react-qr-code';
import { Share2, Copy, Download, Check, Image as ImageIcon } from 'lucide-react';

type Props = {
  profileUrl: string;
  displayName: string;
};

export default function QrDisplay({ profileUrl, displayName }: Props) {
  const qrRef  = useRef<HTMLDivElement>(null);
  const [copied,  setCopied]  = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  }

  // ── SVG → PNG 変換（共通処理）─────────────────────────────
  async function svgToPngBlob(): Promise<Blob | null> {
    const svgEl = qrRef.current?.querySelector('svg');
    if (!svgEl) return null;

    const size    = 640;
    const padding = 48;

    const canvas = document.createElement('canvas');
    canvas.width  = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const svgData = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl  = URL.createObjectURL(svgBlob);

    return new Promise<Blob | null>((resolve) => {
      const img = new Image();
      img.onload = () => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, padding, padding, size - padding * 2, size - padding * 2);
        URL.revokeObjectURL(svgUrl);
        canvas.toBlob((blob) => resolve(blob), 'image/png');
      };
      img.onerror = () => { URL.revokeObjectURL(svgUrl); resolve(null); };
      img.src = svgUrl;
    });
  }

  // ── シェアボタン ──────────────────────────────────────────
  const handleShare = async () => {
    // HTTPS または localhost でのみ navigator.share が動作する
    const canNativeShare = typeof navigator.share === 'function';

    if (canNativeShare) {
      try {
        await navigator.share({
          title: `${displayName}のデジタル名刺`,
          text:  `${displayName}のデジタル名刺はこちら`,
          url:   profileUrl,
        });
        return;
      } catch (e: unknown) {
        // ユーザーがキャンセルした場合（AbortError）は何もしない
        if (e instanceof Error && e.name === 'AbortError') return;
        // share 失敗 → フォールバックへ
      }
    }

    // フォールバック: クリップボードコピー
    try {
      await navigator.clipboard.writeText(profileUrl);
      showToast('リンクをコピーしました！');
    } catch {
      // clipboard も使えない場合（HTTP 環境等）→ URL をトーストで表示
      showToast(`URL: ${profileUrl}`);
    }
  };

  // ── リンクをコピー ────────────────────────────────────────
  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(profileUrl);
      } else {
        const el = document.createElement('textarea');
        el.value = profileUrl;
        el.style.cssText = 'position:fixed;top:-100px;left:-100px;opacity:0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      showToast('コピーしました！');
    } catch {
      showToast('コピーに失敗しました');
    }
  };

  // ── 保存ボタン ────────────────────────────────────────────
  const handleSave = async () => {
    if (saving) return;
    setSaving(true);

    try {
      const blob = await svgToPngBlob();
      if (!blob) { showToast('変換に失敗しました'); return; }

      const file = new File([blob], 'my-qrcode.png', { type: 'image/png' });

      // iOS Safari: navigator.share({ files }) → 写真アプリへ保存できる
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'My QRコード',
        });
        return;
      }

      // その他のブラウザ: <a download> で PNG を直接ダウンロード（新タブは開かない）
      const pngUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href     = pngUrl;
      a.download = 'my-qrcode.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') {
        showToast('保存に失敗しました');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 pb-4">

      {/* ── QRコードカード ─────────────────────────── */}
      <div
        ref={qrRef}
        className="
          bg-white rounded-3xl
          shadow-[0_4px_24px_rgba(0,0,0,0.10)]
          flex flex-col items-center
          w-full max-w-[300px]
          overflow-hidden
        "
      >
        {/* アクセントバー */}
        <div className="w-full h-2 bg-[#E8B84B]" />

        <div className="px-6 pt-5 pb-5 flex flex-col items-center gap-5">
          {/* QR コード本体 */}
          <div className="p-1 bg-white">
            <QRCode
              value={profileUrl}
              size={180}
              bgColor="#ffffff"
              fgColor="#1f2937"
              style={{ display: 'block' }}
            />
          </div>

          {/* 名前・URL */}
          <div className="flex flex-col items-center gap-1.5 text-center">
            <p className="text-lg font-bold text-gray-800 tracking-wide">
              @{displayName}
            </p>
            <p className="text-[11px] text-gray-400 break-all leading-relaxed max-w-[210px]">
              {profileUrl}
            </p>
          </div>
        </div>
      </div>

      {/* ── アクションボタン 3つ ──────────────────── */}
      <div className="flex gap-3 w-full max-w-[300px]">

        {/* シェア */}
        <button
          type="button"
          onClick={handleShare}
          className="
            flex-1 flex flex-col items-center gap-2
            bg-white rounded-2xl shadow-sm py-4 px-2
            hover:bg-gray-50 active:scale-95 transition-all
          "
        >
          <Share2 size={22} className="text-[#81d8d0]" />
          <span className="text-xs font-semibold text-gray-600">シェア</span>
        </button>

        {/* リンクをコピー */}
        <button
          type="button"
          onClick={handleCopyLink}
          className="
            flex-1 flex flex-col items-center gap-2
            bg-white rounded-2xl shadow-sm py-4 px-2
            hover:bg-gray-50 active:scale-95 transition-all
          "
        >
          {copied
            ? <Check size={22} className="text-[#81d8d0]" />
            : <Copy  size={22} className="text-gray-400" />
          }
          <span className="text-xs font-semibold text-gray-600">
            {copied ? 'コピー済み' : 'リンクをコピー'}
          </span>
        </button>

        {/* 保存 */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="
            flex-1 flex flex-col items-center gap-2
            bg-white rounded-2xl shadow-sm py-4 px-2
            hover:bg-gray-50 active:scale-95 transition-all
            disabled:opacity-50
          "
        >
          {saving
            ? <ImageIcon size={22} className="text-gray-300 animate-pulse" />
            : <Download  size={22} className="text-gray-400" />
          }
          <span className="text-xs font-semibold text-gray-600">
            {saving ? '処理中...' : '保存'}
          </span>
        </button>
      </div>

      {/* トースト通知 */}
      {toastMsg && (
        <div
          className="
            fixed bottom-24 left-4 right-4 z-[100]
            flex items-start gap-1.5
            bg-gray-800/90 text-white text-xs font-medium
            px-4 py-2.5 rounded-xl shadow-lg
            pointer-events-none
          "
          role="status"
          aria-live="polite"
        >
          <Check size={12} strokeWidth={3} className="text-[#81d8d0] mt-0.5 shrink-0" />
          <span className="break-all">{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
