'use client';

/**
 * SNS ブランドカラーアイコン
 * Simple Icons (v16) の公式 SVG パスを使用してブランドロゴを表示する
 * LinkedIn は v16 未収録のためテキストフォールバック
 */

import { siX, siInstagram, siFacebook, siLine, siYoutube } from 'simple-icons';

type IconConfig = {
  label: string;
  bg: string | string[];
  svgPath?: string;
  text?: string;
};

const CONFIG: Record<string, IconConfig> = {
  X: {
    label: 'X',
    bg: '#000000',
    svgPath: siX.path,
  },
  Instagram: {
    label: 'Instagram',
    bg: ['#f09433', '#e6683c', '#dc2743', '#cc2366', '#bc1888'],
    svgPath: siInstagram.path,
  },
  Facebook: {
    label: 'Facebook',
    bg: '#1877F2',
    svgPath: siFacebook.path,
  },
  LinkedIn: {
    label: 'LinkedIn',
    bg: '#0A66C2',
    text: 'in',
  },
  LINE: {
    label: 'LINE',
    bg: '#06C755',
    svgPath: siLine.path,
  },
  YouTube: {
    label: 'YouTube',
    bg: '#FF0000',
    svgPath: siYoutube.path,
  },
  other: {
    label: 'リンク',
    bg: '#81d8d0',
    text: '🔗',
  },
};

export function SnsColorIcon({ type, size = 28 }: { type: string; size?: number }) {
  const cfg = CONFIG[type] ?? CONFIG.other;
  const bg = Array.isArray(cfg.bg)
    ? `linear-gradient(45deg, ${cfg.bg.join(',')})`
    : cfg.bg;

  const innerSize = Math.round(size * 0.60);

  return (
    <div
      aria-label={cfg.label}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {cfg.svgPath ? (
        <svg
          viewBox="0 0 24 24"
          fill="white"
          width={innerSize}
          height={innerSize}
          aria-hidden="true"
        >
          <path d={cfg.svgPath} />
        </svg>
      ) : (
        <span
          style={{
            color: '#fff',
            fontSize: type === 'LinkedIn' ? size * 0.30 : size * 0.40,
            fontWeight: 700,
            letterSpacing: type === 'LinkedIn' ? '-0.5px' : undefined,
            lineHeight: 1,
          }}
        >
          {cfg.text}
        </span>
      )}
    </div>
  );
}

export const SNS_LABEL: Record<string, string> = {
  X:         'X（旧Twitter）',
  Instagram: 'Instagram',
  Facebook:  'Facebook',
  LinkedIn:  'LinkedIn',
  LINE:      'LINE',
  YouTube:   'YouTube',
};
