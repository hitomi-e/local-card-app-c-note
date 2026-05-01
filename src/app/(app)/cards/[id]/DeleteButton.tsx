'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, AlertTriangle } from 'lucide-react';
import { deleteCardAction } from './actions';

export default function DeleteButton({
  cardId,
  variant = 'icon',
}: {
  cardId: string;
  variant?: 'icon' | 'full';
}) {
  const router = useRouter();
  const [open,      setOpen]      = useState(false);
  const [errorMsg,  setErrorMsg]  = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      setErrorMsg(null);
      const result = await deleteCardAction(cardId);
      if ('error' in result) {
        setErrorMsg(result.error);
        return;
      }
      router.push('/dashboard');
    });
  }

  return (
    <>
      {variant === 'full' ? (
        <button
          type="button"
          onClick={() => { setErrorMsg(null); setOpen(true); }}
          className="
            w-full flex items-center justify-center gap-2
            min-h-[58px]
            rounded-2xl
            border-2 border-red-300 bg-white text-red-500
            hover:bg-red-50 active:scale-[0.98]
            font-bold text-base
            transition-all touch-manipulation
          "
          aria-label="名刺を削除"
        >
          <Trash2 size={18} strokeWidth={2} />
          この名刺を削除
        </button>
      ) : (
        <button
          type="button"
          onClick={() => { setErrorMsg(null); setOpen(true); }}
          className="
            w-9 h-9 flex items-center justify-center
            rounded-full bg-red-50 text-red-400
            hover:bg-red-100 active:scale-95 transition-all touch-manipulation
          "
          aria-label="名刺を削除"
        >
          <Trash2 size={17} />
        </button>
      )}

      {/* 削除確認モーダル */}
      {open && (
        <div
          className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/40 px-4"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
          onClick={() => { if (!isPending) setOpen(false); }}
        >
          <div
            className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center px-6 pt-7 pb-5 gap-3">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                <AlertTriangle size={26} className="text-red-400" />
              </div>
              <p className="text-base font-bold text-gray-800">この名刺を削除しますか？</p>
              <p className="text-sm text-gray-500 text-center leading-relaxed">
                削除すると元に戻せません。<br />名刺の画像もあわせて削除されます。
              </p>
              {errorMsg && (
                <p className="text-sm text-red-500 text-center">{errorMsg}</p>
              )}
            </div>

            <div className="flex flex-col gap-2 px-5 pb-5">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="
                  w-full min-h-[54px] rounded-2xl
                  bg-red-500 hover:bg-red-600 active:bg-red-700
                  text-white font-bold text-base
                  disabled:opacity-60 disabled:cursor-not-allowed
                  transition-colors
                "
              >
                {isPending ? '削除中...' : '削除する'}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="
                  w-full min-h-[54px] rounded-2xl
                  border border-gray-200 bg-white
                  text-gray-600 font-medium text-base
                  hover:bg-gray-50 active:scale-95
                  transition-all
                "
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
