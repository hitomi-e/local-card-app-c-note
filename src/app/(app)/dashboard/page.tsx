import { createClient, createServiceClient } from "@/lib/supabase/server";
import { fetchCategories } from "@/lib/supabase/categories";
import CardListClient from "@/components/cards/CardListClient";
import CsvExportButton from "@/components/cards/CsvExportButton";
import type { CardWithCategories } from "@/types/cards";
import type { Profile } from "@/types/profile";
import { CARD_IMAGES_BUCKET, getCanonicalProfilePhotoPath, getJpegAlternativePath, getCardImagePublicUrl } from "@/lib/supabase/storage";

// 常に最新データを返す動的ページとして宣言。
// バックグラウンドでの自動再検証（ISR）を無効にし、
// iPhone 放置中の不要な GET /dashboard を防ぐ。
export const dynamic = 'force-dynamic';

/**
 * ダッシュボードページ（名刺帳）
 *
 * デジタル名刺の同期ルール:
 *   1. source_user_id あり → profiles テーブルから最新データを取得して上書き
 *   2. source_user_id なし（旧データ）→ email が一致するプロフィールでフォールバック同期
 * マージ時は profile 値が null の場合は card の既存値を保持する（null 上書き防止）
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const serviceClient = createServiceClient();

  // ── 名刺一覧（カテゴリー情報を join して取得） ─
  const { data: cardsData, error: cardsError } = await supabase
    .from("cards")
    .select("*, cards_categories(category_id)")
    .order("created_at", { ascending: false });

  if (cardsError) {
    console.error("[Dashboard] cards 取得エラー:", cardsError.message);
  }

  const cards: CardWithCategories[] = (cardsData ?? []) as CardWithCategories[];
  console.log(`[Dashboard] 名刺取得: ${cards.length}件`);

  // ── デジタル名刺を分類 ─────────────────────────
  const digitalWithId    = cards.filter(c => c.source === "digital" && c.source_user_id);
  const digitalWithoutId = cards.filter(c => c.source === "digital" && !c.source_user_id);
  console.log(`[Dashboard] デジタル名刺: source_user_idあり=${digitalWithId.length}件, なし=${digitalWithoutId.length}件`);

  // ── プロフィールを一括取得 ─────────────────────
  const profileMap = new Map<string, Profile>(); // profileId → Profile

  // ① source_user_id で取得
  const sourceUserIds = [...new Set(digitalWithId.map(c => c.source_user_id as string))];
  if (sourceUserIds.length > 0) {
    const { data: profiles, error: pe } = await serviceClient
      .from("profiles").select("*").in("id", sourceUserIds);
    if (pe) {
      console.error("[Dashboard] プロフィール取得エラー (source_user_id):", pe.message);
    } else {
      for (const p of (profiles ?? []) as Profile[]) profileMap.set(p.id, p);
      console.log(`[Dashboard] プロフィール取得 (source_user_id): ${profiles?.length ?? 0}件`);
    }
  }

  // ② メールフォールバック（旧データ向け）
  const emailToProfileId = new Map<string, string>(); // email → profileId
  const fallbackEmails = [
    ...new Set(digitalWithoutId.map(c => c.email).filter((e): e is string => !!e)),
  ];
  if (fallbackEmails.length > 0) {
    const { data: byEmail, error: ee } = await serviceClient
      .from("profiles").select("*").in("email", fallbackEmails);
    if (ee) {
      console.error("[Dashboard] プロフィール取得エラー (email fallback):", ee.message);
    } else {
      for (const p of (byEmail ?? []) as Profile[]) {
        profileMap.set(p.id, p);
        if (p.email) emailToProfileId.set(p.email, p.id);
      }
      console.log(`[Dashboard] プロフィール取得 (email fallback): ${byEmail?.length ?? 0}件`);
    }
  }

  // ── デジタル名刺のデータを最新プロフィールで同期 ─

  // 自動修復用に DB の元パスを保存しておく
  const originalImagePaths = new Map<string, string | null>(
    cards.map(c => [c.id, c.image_path ?? null])
  );

  for (const card of cards) {
    if (card.source !== "digital") continue;

    // どのプロフィールで同期するか決定
    let profile: Profile | undefined;
    let syncMethod = "";

    if (card.source_user_id) {
      profile = profileMap.get(card.source_user_id);
      syncMethod = `source_user_id=${card.source_user_id}`;
    } else if (card.email) {
      const pid = emailToProfileId.get(card.email);
      if (pid) {
        profile = profileMap.get(pid);
        syncMethod = `email fallback (${card.email}) → profileId=${pid}`;
      }
    }

    if (!profile) {
      console.warn(`[Dashboard] 同期スキップ: card=${card.id} (${syncMethod || "マッチなし"})`);
      continue;
    }

    // null-safe マージ: profile 値が null/undefined の場合は既存の card データを保持
    card.full_name            = profile.full_name            ?? card.full_name;
    card.name_reading         = profile.name_reading         ?? card.name_reading;
    card.company_name         = profile.company_name         ?? card.company_name;
    card.company_name_reading = profile.company_name_reading ?? card.company_name_reading;
    card.industry             = profile.industry             ?? card.industry;
    card.branch_office        = profile.branch_office        ?? card.branch_office;
    card.department           = profile.department           ?? card.department;
    card.position             = profile.position             ?? card.position;
    card.postal_code          = profile.postal_code          ?? card.postal_code;
    card.address              = profile.address              ?? card.address;
    card.company_phone        = profile.company_phone        ?? card.company_phone;
    card.mobile_phone         = profile.mobile_phone         ?? card.mobile_phone;
    card.email                = profile.email                ?? card.email;
    card.website_url          = profile.website_url          ?? card.website_url;

    // image_path は source_user_id から正規パスを導出（face_photo_path の古い形式を無視）
    card.image_path = getCanonicalProfilePhotoPath(profile.id);

    console.log(
      `[Dashboard] 同期完了: card=${card.id} [${syncMethod}]` +
      ` company="${card.company_name}" image_path="${card.image_path}"`
    );
  }

  // ── 古い image_path を DB で自動修復 ─────────────────
  const pathFixes = cards.filter(c =>
    c.source === "digital" &&
    c.source_user_id &&
    c.image_path &&
    originalImagePaths.get(c.id) !== c.image_path
  );
  if (pathFixes.length > 0) {
    console.log(`[Dashboard] image_path 自動修復: ${pathFixes.length}件`);
    for (const card of pathFixes) {
      const { error: fixErr } = await supabase
        .from("cards")
        .update({ image_path: card.image_path })
        .eq("id", card.id);
      if (fixErr) {
        console.warn(`[Dashboard] 修復失敗 card=${card.id}:`, fixErr.message);
      } else {
        console.log(`[Dashboard] 修復完了 card=${card.id} → "${card.image_path}"`);
      }
    }
  }

  // ── カテゴリー一覧 ───────────────────────────
  const { categories, error: catError } = await fetchCategories(supabase);
  if (catError) console.error("[Dashboard] categories 取得エラー:", catError);

  // ── 万能画像URL探索 ──────────────────────────────
  // 各カードについて「優先順位付き候補パス」を構築し、まとめて署名付きURL取得する
  // 優先順: 新形式.jpg → 新形式.jpeg → 旧形式DB保存パス → 旧形式拡張子代替
  const cardImageCandidates = new Map<string, string[]>(); // card.id → パス候補リスト

  for (const card of cards) {
    const candidates: string[] = [];

    if (card.source === "digital" && card.source_user_id) {
      const uid = card.source_user_id;
      candidates.push(`profiles/${uid}/avatar.jpg`);    // 新形式 .jpg（正規）
      candidates.push(`profiles/${uid}/avatar.jpeg`);   // 新形式 .jpeg
      // DB 元パス（旧形式: {uid}/{timestamp}.jpeg 等）
      const orig = originalImagePaths.get(card.id);
      if (orig && !candidates.includes(orig)) candidates.push(orig);
      if (orig) {
        const alt = getJpegAlternativePath(orig);
        if (alt && !candidates.includes(alt)) candidates.push(alt);
      }
    } else if (card.image_path) {
      candidates.push(card.image_path);
      const alt = getJpegAlternativePath(card.image_path);
      if (alt) candidates.push(alt);
    }

    if (candidates.length > 0) cardImageCandidates.set(card.id, candidates);
  }

  const allImagePaths = [...new Set([...cardImageCandidates.values()].flat())];
  console.log(`[Dashboard] 署名付きURL 取得対象: ${allImagePaths.length}件`, allImagePaths);

  const imageUrls: Record<string, string> = {};

  if (allImagePaths.length > 0) {
    const { data: signedData, error: signedError } = await serviceClient.storage
      .from(CARD_IMAGES_BUCKET)
      .createSignedUrls(allImagePaths, 3600);

    if (signedError) {
      console.error("[Dashboard] 署名付きURL一括生成エラー:", signedError.message);
    } else {
      const pathToUrl: Record<string, string> = {};
      for (const item of signedData ?? []) {
        if (item.error) {
          // 複数パスを試すため "Object not found" は通常の動作
          console.log(`[Dashboard][Debug] パス不在: "${item.path}"`);
        } else if (item.signedUrl && item.path) {
          pathToUrl[item.path] = item.signedUrl;
        }
      }
      console.log(`[Dashboard] 署名付きURL取得成功: ${Object.keys(pathToUrl).length}件 / ${allImagePaths.length}件`);

      // 各カードの優先順でURLを選択
      for (const card of cards) {
        const candidates = cardImageCandidates.get(card.id) ?? [];
        for (const path of candidates) {
          const url = pathToUrl[path];
          if (url) {
            imageUrls[card.id] = url;
            console.log(`[Dashboard] 画像URL割り当て: card=${card.id} path="${path}"`);
            break;
          }
        }
        if (!imageUrls[card.id] && candidates.length > 0) {
          console.warn(`[Dashboard] 画像URLなし: card=${card.id} tried=[${candidates.join(", ")}]`);
        }
      }
    }
  }

  // ── 最終フォールバック: 公開URL（バケットが Public 設定の場合のみ機能） ─
  // 署名付きURL が全て取れなかったカードに対して公開URLを試みる
  const missingImageCards = cards.filter(c =>
    !imageUrls[c.id] && cardImageCandidates.has(c.id)
  );
  if (missingImageCards.length > 0) {
    console.log(`[Dashboard] 公開URLフォールバック開始: ${missingImageCards.length}件`);
    for (const card of missingImageCards) {
      const candidates = cardImageCandidates.get(card.id) ?? [];
      const primaryPath = candidates[0]; // 新形式 .jpg（正規）を優先
      if (!primaryPath) continue;
      const publicUrl = getCardImagePublicUrl(serviceClient, primaryPath);
      imageUrls[card.id] = publicUrl;
      console.log(`[Dashboard] 公開URL設定: card=${card.id} path="${primaryPath}" → "${publicUrl}"`);
    }
  }

  // ── ロゴURL取得（デジタル名刺のみ）──────────────────
  const logoUrls: Record<string, string> = {};
  {
    const cardToLogoPath = new Map<string, string>(); // card.id → logo storage path
    for (const card of cards) {
      if (card.source !== 'digital' || !card.source_user_id) continue;
      const profile = profileMap.get(card.source_user_id);
      if (profile?.company_logo_path) {
        cardToLogoPath.set(card.id, profile.company_logo_path);
      }
    }

    if (cardToLogoPath.size > 0) {
      const uniquePaths = [...new Set(cardToLogoPath.values())];
      const { data: logoSignedData } = await serviceClient.storage
        .from(CARD_IMAGES_BUCKET)
        .createSignedUrls(uniquePaths, 3600);

      const pathToLogoUrl: Record<string, string> = {};
      for (const item of logoSignedData ?? []) {
        if (item.signedUrl && item.path) pathToLogoUrl[item.path] = item.signedUrl;
      }
      for (const [cardId, path] of cardToLogoPath) {
        if (pathToLogoUrl[path]) logoUrls[cardId] = pathToLogoUrl[path];
      }
    }
  }

  console.log(`[Dashboard] 完了 — 名刺=${cards.length}件, 画像URL=${Object.keys(imageUrls).length}件, ロゴURL=${Object.keys(logoUrls).length}件`);

  return (
    <div className="flex flex-col gap-4 px-4 py-5">

      {/* ─── ページヘッダー ───────────────────────────── */}
      <div className="flex items-center justify-between">
        <h1 className="text-base font-bold text-gray-800">名刺帳</h1>
        <CsvExportButton />
      </div>

      {/* ─── 名刺帳（検索・フィルターはコンポーネント内）── */}
      <CardListClient
        cards={cards}
        categories={categories}
        cardCount={cards.length}
        imageUrls={imageUrls}
        logoUrls={logoUrls}
      />
    </div>
  );
}
