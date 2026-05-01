'use client';

/**
 * 音声入力ボタン
 * Web Speech API を使い、認識したテキストを onAppend で返す
 *
 * 表示方針:
 *  - ボタンは「常に表示」（非対応ブラウザでも非表示にしない）
 *  - 非対応 or 未確認の場合: タップ時にアラートで案内
 *  - 対応確認済み: 通常の音声認識フロー
 *  - 録音中: 赤背景 + animate-ping で点滅
 *
 * compact モード:
 *  - 検索バー内など狭い場所向け（w-7 h-7 / Mic 13px）
 *  - 通常は w-9 h-9 / Mic 16px
 */

import { useEffect, useRef, useState } from 'react';
import { Mic } from 'lucide-react';

// ── Web Speech API 型宣言（lib.dom に未収録のため独自定義）──────────
interface SpeechRecognitionResult {
  readonly 0: SpeechRecognitionAlternative;
  readonly length: number;
}
interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}
interface SpeechRecognitionResultList {
  readonly 0: SpeechRecognitionResult;
  readonly length: number;
}
interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}
interface ISpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult:  ((e: SpeechRecognitionEvent)      => void) | null;
  onerror:   ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend:     (() => void) | null;
}
interface ISpeechRecognitionConstructor {
  new(): ISpeechRecognition;
}
declare global {
  interface Window {
    SpeechRecognition?:       ISpeechRecognitionConstructor;
    webkitSpeechRecognition?: ISpeechRecognitionConstructor;
  }
}
// ────────────────────────────────────────────────────────────────────

type Props = {
  onAppend:   (text: string) => void;
  disabled?:  boolean;
  compact?:   boolean; // 検索バー内など狭い場所向け小型モード
};

type SupportState = boolean | null; // null = クライアント判定前

export function VoiceMemoButton({ onAppend, disabled, compact = false }: Props) {
  const [supported,       setSupported]       = useState<SupportState>(null);
  const [listening,       setListening]       = useState(false);
  const [permissionError, setPermissionError] = useState(false);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);

  useEffect(() => {
    // ── デバッグログ（iPhoneでの確認用）─────────────────────────
    console.log('[VoiceMemoButton] SpeechRecognition:',       !!(window.SpeechRecognition));
    console.log('[VoiceMemoButton] webkitSpeechRecognition:', !!(window.webkitSpeechRecognition));
    console.log('[VoiceMemoButton] mediaDevices:',            !!(navigator.mediaDevices));
    console.log('[VoiceMemoButton] isSecureContext:',         window.isSecureContext);
    console.log('[VoiceMemoButton] location.protocol:',       location.protocol);

    const hasSR = !!(window.SpeechRecognition ?? window.webkitSpeechRecognition);
    console.log('[VoiceMemoButton] 音声入力API対応:', hasSR);
    setSupported(hasSR);
  }, []);

  function handleClick() {
    // 非対応 or 判定前（null）の場合はアラートで案内
    if (!supported) {
      alert('お使いのブラウザは音声入力に対応していないか、HTTPS接続が必要です。\nSafariでは設定 → Safari → マイク が有効かご確認ください。');
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) {
      alert('お使いのブラウザは音声入力に対応していないか、HTTPS接続が必要です。');
      return;
    }

    setPermissionError(false);

    const recognition = new SR();
    recognition.lang           = 'ja-JP';
    recognition.continuous     = false;
    recognition.interimResults = false;

    recognition.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript ?? '';
      console.log('[VoiceMemoButton] 認識結果:', transcript);
      if (transcript) onAppend(transcript);
    };

    recognition.onerror = (e) => {
      console.warn('[VoiceMemoButton] 認識エラー:', e.error);
      if (e.error === 'not-allowed') setPermissionError(true);
      setListening(false);
    };

    recognition.onend = () => {
      console.log('[VoiceMemoButton] 認識終了');
      setListening(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  }

  // ── サイズ設定（compact vs 通常）────────────────────────────────
  const btnSize  = compact ? 'w-7 h-7'   : 'w-9 h-9';
  const iconSize = compact ? 13          : 16;
  const radius   = compact ? 'rounded-lg' : 'rounded-full';

  const colorClass = listening
    ? 'bg-red-500 text-white'
    : supported === false
      ? 'bg-gray-200 text-gray-400'
      : 'bg-[#e8f8f7] text-[#81d8d0] hover:bg-[#81d8d0] hover:text-white';

  return (
    <div className={`flex flex-col ${compact ? 'items-center' : 'items-end'} gap-0.5`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-label={listening ? '音声認識を停止する' : '音声でメモを入力する'}
        className={[
          'relative flex items-center justify-center',
          'transition-all touch-manipulation',
          btnSize, radius,
          colorClass,
          'disabled:opacity-40 disabled:cursor-not-allowed',
        ].join(' ')}
      >
        {listening && (
          <span className={`absolute inset-0 ${radius} bg-red-400 animate-ping opacity-60 pointer-events-none`} />
        )}
        <Mic size={iconSize} className="relative z-10" />
      </button>

      {permissionError && (
        <p className="text-[10px] text-red-400 leading-tight text-right whitespace-nowrap">
          マイクを許可してください
        </p>
      )}
    </div>
  );
}
