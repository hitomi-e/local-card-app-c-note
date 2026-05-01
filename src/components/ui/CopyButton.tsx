'use client';

/**
 * クリップボードコピーボタン（共有コンポーネント）
 *
 * - タップでテキストをコピー
 * - 成功後: アイコンが Check に変わり、画面下部にトーストを表示
 * - 2 秒後に自動リセット
 * - navigator.clipboard が使えない環境は execCommand にフォールバック
 */

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // フォールバック（古いブラウザ・HTTP 環境）
        const el = document.createElement('textarea');
        el.value = text;
        el.style.cssText = 'position:fixed;top:-100px;left:-100px;opacity:0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('[CopyButton] コピー失敗:', e);
    }
  }

  return (
    <>
      {/* コピーアイコンボタン */}
      <button
        type="button"
        onClick={handleCopy}
        className={`
          shrink-0 w-7 h-7
          flex items-center justify-center
          rounded-lg transition-all duration-150
          ${copied
            ? 'text-[#81d8d0] bg-[#e8f8f7]'
            : 'text-gray-300 hover:text-[#81d8d0] hover:bg-[#e8f8f7] active:scale-90'
          }
        `}
        aria-label={`コピー: ${text}`}
      >
        {copied
          ? <Check size={13} strokeWidth={2.5} />
          : <Copy  size={13} strokeWidth={2}   />
        }
      </button>

      {/* 画面下部トースト（fixed 配置） */}
      {copied && (
        <div
          className="
            fixed bottom-24 left-1/2 -translate-x-1/2 z-[100]
            flex items-center gap-1.5
            bg-gray-800/90 text-white text-xs font-medium
            px-4 py-2.5 rounded-xl shadow-lg
            pointer-events-none
            whitespace-nowrap
          "
          role="status"
          aria-live="polite"
        >
          <Check size={12} strokeWidth={3} className="text-[#81d8d0]" />
          コピーしました！
        </div>
      )}
    </>
  );
}
