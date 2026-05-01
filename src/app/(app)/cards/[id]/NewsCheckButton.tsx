'use client';

/**
 * 最新ニュースをチェックボタン
 * - 住所・URLを活用したハイブリッド検索 → Gemini がアドバイス口調のトピック3件を生成
 * - 結果は framer-motion でふわっと表示
 */

import { useState } from 'react';
import { Newspaper, Loader2, ChevronRight, ExternalLink, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type NewsSuccess = {
  ok: true;
  topics: string[];
  isIndustryFallback: boolean;
  sources: { title: string; url: string }[];
};

type NewsError = {
  ok: false;
  error: string;
};

type NewsResult = NewsSuccess | NewsError;

type Props = {
  companyName: string | null;
  address?: string | null;
  websiteUrl?: string | null;
  industry?: string | null;
};

export function NewsCheckButton({ companyName, address, websiteUrl, industry }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NewsResult | null>(null);

  async function handleClick() {
    if (loading || !companyName) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, address, websiteUrl, industry }),
      });
      const data: NewsResult = await res.json();
      setResult(data);
    } catch {
      setResult({ ok: false, error: '通信エラーが発生しました。もう一度お試しください。' });
    } finally {
      setLoading(false);
    }
  }

  if (!companyName) return null;

  return (
    <div className="flex flex-col gap-3">
      {/* ─── ボタン本体 ─── */}
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        style={{ backgroundColor: '#e3adc1' }}
        className="
          relative w-full min-h-[58px]
          flex items-center justify-center gap-2
          pl-5 pr-16
          text-white text-base font-bold rounded-2xl
          transition-all active:scale-[0.97] hover:brightness-105
          disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100
        "
      >
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin shrink-0" />
            {/* whitespace-nowrap でボタン内の改行を防ぐ */}
            <span className="whitespace-nowrap text-sm">AIが最新情報を調べています...</span>
          </>
        ) : (
          <>
            <Newspaper size={18} className="shrink-0" />
            <span>{result ? 'もう一度調べる' : '最新ニュースをチェック'}</span>
          </>
        )}

        {/* 右端の白丸バッジ */}
        <div
          className="
            absolute right-3.5 top-1/2 -translate-y-1/2
            w-9 h-9 rounded-full bg-white
            flex items-center justify-center shrink-0
            shadow-sm
          "
          aria-hidden="true"
        >
          {result && !loading ? (
            <RefreshCw size={15} strokeWidth={2.5} style={{ color: '#e3adc1' }} />
          ) : (
            <ChevronRight size={17} strokeWidth={2.5} style={{ color: '#e3adc1' }} />
          )}
        </div>
      </button>

      {/* ─── 結果カード ─── */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="rounded-2xl overflow-hidden shadow-md border border-pink-100"
          >
            {result.ok ? (
              <>
                {/* ヘッダー */}
                <div
                  style={{ backgroundColor: '#e3adc1' }}
                  className="px-4 py-2.5 flex items-center gap-2"
                >
                  <Newspaper size={15} className="text-white shrink-0" />
                  <span className="text-white text-sm font-bold">
                    AIが提案する会話の<br />きっかけ
                  </span>
                  {result.isIndustryFallback && (
                    /* 白背景に濃いピンク文字でコントラストを確保 */
                    <span
                      className="ml-auto text-xs font-bold rounded-full px-3 py-0.5 shrink-0 bg-white whitespace-nowrap"
                      style={{ color: '#e3adc1' }}
                    >
                      同業種トピックス
                    </span>
                  )}
                </div>

                {/* トピック一覧 */}
                <div className="bg-white px-4 py-3 flex flex-col gap-3">
                  {result.topics.map((topic, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span
                        className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold text-white"
                        style={{ backgroundColor: '#e3adc1' }}
                      >
                        {i + 1}
                      </span>
                      <p className="text-sm text-gray-700 leading-snug">{topic}</p>
                    </div>
                  ))}
                </div>

                {/* 参考記事リンク */}
                {result.sources.length > 0 && (
                  <div className="bg-gray-50 px-4 py-3 border-t border-pink-100 flex flex-col gap-3">
                    <p className="text-[10px] text-gray-400 font-medium">参考記事</p>
                    {result.sources.map((source, i) => (
                      <a
                        key={i}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-gray-500 hover:text-[#e3adc1] transition-colors"
                      >
                        <ExternalLink size={12} className="shrink-0" />
                        <span className="truncate">{source.title}</span>
                      </a>
                    ))}
                  </div>
                )}

                {/* 免責注釈 */}
                <div className="bg-gray-50 px-4 py-2 border-t border-gray-100">
                  <p className="text-[10px] text-gray-400 leading-relaxed">
                    AIが検索・要約した情報です。正確な内容は参考記事をご確認ください。
                  </p>
                </div>
              </>
            ) : (
              /* エラー表示 */
              <div className="bg-white px-4 py-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-pink-50 flex items-center justify-center shrink-0">
                  <Newspaper size={15} style={{ color: '#e3adc1' }} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-600 mb-0.5">
                    情報を取得できませんでした
                  </p>
                  <p className="text-xs text-gray-400">{result.error}</p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
