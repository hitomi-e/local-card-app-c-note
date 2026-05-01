/**
 * 名刺 OCR API ルート
 * POST /api/ocr
 *
 * リクエスト: JSON { imageBase64: string, mimeType: string }
 * レスポンス: { ok: true, data: CardOcrResult } | { ok: false, error: string }
 *
 * ※ iOS Safari のリマウント対策で、クライアント側で base64 変換済みの
 *    データを受け取る設計に変更した（multipart/form-data から移行）
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseBusinessCard } from '@/lib/ocr/gemini';

/** 許可する画像 MIME タイプ */
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export async function POST(request: NextRequest) {
  // ── 認証確認 ──────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ ok: false, error: 'ログインが必要です' }, { status: 401 });
  }

  // ── JSON ボディ取得 ───────────────────────────────
  let imageBase64: string;
  let mimeType: string;
  let backImageBase64: string | undefined;
  let backMimeType: string | undefined;
  try {
    const body = await request.json() as {
      imageBase64?: unknown;
      mimeType?: unknown;
      backImageBase64?: unknown;
      backMimeType?: unknown;
    };
    if (typeof body.imageBase64 !== 'string' || !body.imageBase64) {
      return NextResponse.json({ ok: false, error: '画像データがありません' }, { status: 400 });
    }
    if (typeof body.mimeType !== 'string' || !body.mimeType) {
      return NextResponse.json({ ok: false, error: '画像形式が指定されていません' }, { status: 400 });
    }
    imageBase64 = body.imageBase64;
    mimeType    = body.mimeType;
    // 裏面画像（任意）
    if (typeof body.backImageBase64 === 'string' && body.backImageBase64) {
      backImageBase64 = body.backImageBase64;
    }
    if (typeof body.backMimeType === 'string' && body.backMimeType) {
      backMimeType = body.backMimeType;
    }
  } catch {
    return NextResponse.json({ ok: false, error: 'リクエストの読み込みに失敗しました' }, { status: 400 });
  }

  // ── MIME タイプ検証 ───────────────────────────────
  if (!ALLOWED_TYPES.includes(mimeType)) {
    return NextResponse.json(
      { ok: false, error: '対応していない画像形式です（JPEG / PNG / WebP / HEIC）' },
      { status: 400 }
    );
  }
  if (backMimeType && !ALLOWED_TYPES.includes(backMimeType)) {
    return NextResponse.json(
      { ok: false, error: '裏面画像の形式が対応していません（JPEG / PNG / WebP / HEIC）' },
      { status: 400 }
    );
  }

  // ── Gemini OCR（表面 + 裏面）─────────────────────
  try {
    const ocrResult = await parseBusinessCard(imageBase64, mimeType, backImageBase64, backMimeType);
    console.log('[OCR] 解析完了 / 裏面:', !!backImageBase64);
    return NextResponse.json({ ok: true, data: ocrResult });
  } catch (err) {
    const message = err instanceof Error ? err.message : '不明なエラーが発生しました';
    // エラー詳細をターミナルに出力（原因切り分け用）
    console.error('[OCR] ❌ エラー発生:');
    console.error('  メッセージ:', message);
    if (err instanceof Error && err.stack) {
      console.error('  スタック:', err.stack.split('\n').slice(1, 4).join('\n'));
    }
    return NextResponse.json({ ok: false, error: `OCR に失敗しました: ${message}` }, { status: 500 });
  }
}
