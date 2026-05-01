import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// ──────────────────────────────────────────────────────────────
// URL お掃除ユーティリティ
// 前後スペース・末尾スラッシュを除去して正規化する。
// 例: "https://xxx.supabase.co/ " → "https://xxx.supabase.co"
// ──────────────────────────────────────────────────────────────
function cleanSupabaseUrl(raw: string | undefined): string {
  if (!raw) return '';
  return raw.trim().replace(/\/+$/, '');
}

// ──────────────────────────────────────────────────────────────
// 起動時1回の接続テスト（プロセス内フラグで重複実行を防ぐ）
// ──────────────────────────────────────────────────────────────
let _testScheduled = false;

function scheduleConnectionTest(
  url: string,
  rawUrl: string | undefined,
  anonKey: string | undefined,
  serviceKey: string | undefined
) {
  if (_testScheduled) return;
  _testScheduled = true;

  // 非同期で実行（リクエストをブロックしない）
  (async () => {
    console.log('\n\x1b[36m[Supabase] ══ 起動時 接続テスト ══════════════════════════\x1b[0m');

    // ── URL の「ナマの姿」を可視化（括弧で囲む）──
    console.log(`[Supabase] URL（元値）   : [${rawUrl ?? '未設定'}]`);
    console.log(`[Supabase] URL（清掃後）: [${url}]`);
    if (rawUrl && url !== rawUrl.trim()) {
      console.warn('\x1b[33m[Supabase] ⚠️  URL に余分な文字（スペース・末尾スラッシュ）を検出 → 自動除去しました\x1b[0m');
    }
    if (!url) {
      console.error('\x1b[31m[Supabase] NEXT_PUBLIC_SUPABASE_URL が空です！\x1b[0m');
      return;
    }

    // ── 匿名クライアント（Auth 疎通確認）──
    if (!anonKey) {
      console.error('\x1b[31m[Supabase] NEXT_PUBLIC_SUPABASE_ANON_KEY が未設定\x1b[0m');
    } else {
      try {
        const anon = createSupabaseClient(url, anonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { error } = await anon.auth.getSession();
        if (error) {
          console.error(`\x1b[31m[Supabase] 匿名Auth  NG: ${error.message} (status=${error.status})\x1b[0m`);
        } else {
          console.log('\x1b[32m[Supabase] 匿名Auth  OK ✓\x1b[0m');
        }
      } catch (e) {
        console.error(`\x1b[31m[Supabase] 匿名Auth  EXCEPTION: ${e}\x1b[0m`);
      }
    }

    // ── サービスクライアント（Storage バケット一覧で疎通確認）──
    if (!serviceKey) {
      console.error('\x1b[31m[Supabase] SUPABASE_SERVICE_ROLE_KEY が未設定\x1b[0m');
    } else if (!serviceKey.startsWith('eyJ')) {
      console.warn('\x1b[33m[Supabase] SERVICE_ROLE_KEY が JWT 形式（eyJ...）ではありません。誤ったキーの可能性あり\x1b[0m');
    } else {
      try {
        const svc = createSupabaseClient(url, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: buckets, error } = await svc.storage.listBuckets();
        if (error) {
          console.error(`\x1b[31m[Supabase] Storage   NG: ${error.message}\x1b[0m`);
        } else {
          const names = (buckets ?? []).map(b => b.name).join(', ');
          console.log(`\x1b[32m[Supabase] Storage   OK ✓ バケット=[${names || '（空）'}]\x1b[0m`);
        }
      } catch (e) {
        console.error(`\x1b[31m[Supabase] Storage   EXCEPTION: ${e}\x1b[0m`);
      }
    }

    console.log('\x1b[36m[Supabase] ══════════════════════════════════════════════\x1b[0m\n');
  })().catch(e => console.error('[Supabase] 接続テスト予期せぬ例外:', e));
}

// ──────────────────────────────────────────────────────────────
// 通常クライアント（Cookie ベースの認証）
// ──────────────────────────────────────────────────────────────
export async function createClient() {
  const rawUrl   = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const url      = cleanSupabaseUrl(rawUrl);
  const anonKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const svcKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // 起動時1回のみ接続テストを実施
  scheduleConnectionTest(url, rawUrl, anonKey, svcKey);

  const cookieStore = await cookies();

  return createServerClient(
    url,
    anonKey!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component からの呼び出し時は Cookie 書き込み不可のため無視
          }
        },
      },
    }
  );
}

// ──────────────────────────────────────────────────────────────
// サービスロールクライアント（RLS をバイパス）
// @supabase/supabase-js を直接使い、SSR の Cookie 干渉を排除する。
// ──────────────────────────────────────────────────────────────
export function createServiceClient() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const url    = cleanSupabaseUrl(rawUrl);
  const key    = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 起動時1回のみ接続テストを実施
  scheduleConnectionTest(url, rawUrl, anonKey, key);

  return createSupabaseClient(url, key!, {
    auth: {
      persistSession:   false,
      autoRefreshToken: false,
    },
  });
}
