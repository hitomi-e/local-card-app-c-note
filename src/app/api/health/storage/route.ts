/**
 * Storage 接続確認 API
 * GET /api/health/storage
 *
 * 開発時の疎通確認用エンドポイント。
 * business-cards バケットにアクセスできるかチェックする。
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkStorageConnection } from '@/lib/supabase/storage';

export async function GET() {
  const supabase = await createClient();

  // 認証ユーザーを確認
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { ok: false, message: 'ログインが必要です' },
      { status: 401 }
    );
  }

  // バケット接続確認
  const result = await checkStorageConnection(supabase);

  return NextResponse.json(
    {
      ok: result.ok,
      message: result.message,
      bucket: 'business-cards',
      userId: user.id,
    },
    { status: result.ok ? 200 : 500 }
  );
}
