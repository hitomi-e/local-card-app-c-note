-- ============================================================
-- 地域密着デジタル名刺アプリ：Supabase スキーマ定義
-- 使い方：Supabase ダッシュボード > SQL Editor に貼り付けて実行
-- ============================================================

-- ============================================================
-- 1. profiles テーブル（自分のデジタル名刺）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  face_photo_url      TEXT,
  company_logo_url    TEXT,
  company_name        TEXT,
  branch_office       TEXT,
  department          TEXT,
  position            TEXT,
  full_name           TEXT,
  name_reading        TEXT,                    -- 氏名読み（ルビ）
  postal_code         TEXT,
  address             TEXT,
  company_phone       TEXT,
  extension           TEXT,                    -- 内線番号
  mobile_phone        TEXT,
  email               TEXT,
  website_url         TEXT,
  sns_links           JSONB DEFAULT '[]'::jsonb,  -- 例: [{"type":"X","url":"https://..."}]
  business_description TEXT,
  organizations       TEXT[] DEFAULT '{}',     -- 所属団体（配列）
  hobbies             TEXT,
  skills              TEXT,
  motto               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- updated_at を自動更新するトリガー
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 2. cards テーブル（登録した名刺帳）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 会社情報
  company_name          TEXT,
  company_name_reading  TEXT,        -- 会社名（ふりがな）
  branch_office         TEXT,        -- 営業所
  department            TEXT,        -- 部署
  position              TEXT,        -- 役職

  -- 個人情報
  full_name       TEXT,              -- 名前
  name_reading    TEXT,              -- 名前（ふりがな）

  -- 連絡先
  postal_code     TEXT,              -- 郵便番号
  address         TEXT,              -- 住所
  company_phone   TEXT,              -- 会社電話番号
  extension       TEXT,              -- 内線番号
  mobile_phone    TEXT,              -- 携帯電話番号
  email           TEXT,              -- メールアドレス
  website_url     TEXT,              -- WebサイトURL

  -- メモ
  free_memo       TEXT,              -- フリーメモ（趣味・出会いのきっかけなど）

  -- タイムスタンプ
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- updated_at 自動更新トリガー（共通の handle_updated_at 関数を再利用）
CREATE OR REPLACE TRIGGER cards_updated_at
  BEFORE UPDATE ON public.cards
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ⚠️ 既存テーブルへの列追加は以下を Supabase SQL Editor で実行してください：
-- ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS company_name_reading TEXT;
-- ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS free_memo TEXT;
-- ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS image_path TEXT; -- 名刺画像の Storage パス

-- 検索用インデックス
CREATE INDEX IF NOT EXISTS cards_user_id_idx ON public.cards(user_id);
CREATE INDEX IF NOT EXISTS cards_company_name_idx ON public.cards(company_name);
CREATE INDEX IF NOT EXISTS cards_full_name_idx ON public.cards(full_name);

-- ============================================================
-- 3. categories テーブル（カテゴリーマスター）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT DEFAULT '#81d8d0',  -- デフォルトはプライマリカラー
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS categories_user_id_idx ON public.categories(user_id);

-- ============================================================
-- 4. cards_categories テーブル（名刺↔カテゴリー 中間テーブル）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cards_categories (
  card_id      UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  category_id  UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, category_id)
);

-- ============================================================
-- 5. ai_news_cache テーブル（AIニュース要約キャッシュ）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_news_cache (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name  TEXT NOT NULL,
  news_summary  TEXT NOT NULL,
  fetched_at    TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS ai_news_cache_company_idx ON public.ai_news_cache(company_name);
CREATE INDEX IF NOT EXISTS ai_news_cache_expires_idx ON public.ai_news_cache(expires_at);

-- ============================================================
-- RLS（行レベルセキュリティ）設定
-- ============================================================

-- profiles：自分のレコードのみ操作可能
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: 自分のみ参照" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles: 自分のみ挿入" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles: 自分のみ更新" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- cards：自分が登録したレコードのみ操作可能
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cards: 自分のみ参照" ON public.cards
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "cards: 自分のみ挿入" ON public.cards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cards: 自分のみ更新" ON public.cards
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "cards: 自分のみ削除" ON public.cards
  FOR DELETE USING (auth.uid() = user_id);

-- categories：自分が owner のレコードのみ操作可能
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories: 自分のみ参照" ON public.categories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "categories: 自分のみ挿入" ON public.categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "categories: 自分のみ更新" ON public.categories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "categories: 自分のみ削除" ON public.categories
  FOR DELETE USING (auth.uid() = user_id);

-- cards_categories：紐付いた card の user のみ操作可能
ALTER TABLE public.cards_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cards_categories: 自分のみ参照" ON public.cards_categories
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.cards
      WHERE cards.id = cards_categories.card_id
      AND cards.user_id = auth.uid()
    )
  );

CREATE POLICY "cards_categories: 自分のみ挿入" ON public.cards_categories
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cards
      WHERE cards.id = cards_categories.card_id
      AND cards.user_id = auth.uid()
    )
  );

CREATE POLICY "cards_categories: 自分のみ削除" ON public.cards_categories
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.cards
      WHERE cards.id = cards_categories.card_id
      AND cards.user_id = auth.uid()
    )
  );

-- ai_news_cache：全ユーザーが参照可（書き込みはサービスロールのみ）
ALTER TABLE public.ai_news_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_news_cache: 全員参照可" ON public.ai_news_cache
  FOR SELECT USING (true);

-- ============================================================
-- ユーザー登録時に profiles レコードを自動作成するトリガー
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Storage バケット作成
-- （Supabase ダッシュボード > Storage でも作成できます）
-- ============================================================

-- avatars（顔写真：公開）
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- logos（会社ロゴ：公開）
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- business-cards（名刺画像：非公開）
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-cards', 'business-cards', false)
ON CONFLICT (id) DO NOTHING;

-- voice-memos（音声メモ：非公開）
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-memos', 'voice-memos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS ポリシー（自分のファイルのみ操作可能）
CREATE POLICY "avatars: 自分のみアップロード" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "avatars: 全員参照可" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "business-cards: 自分のみ操作" ON storage.objects
  FOR ALL USING (bucket_id = 'business-cards' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "voice-memos: 自分のみ操作" ON storage.objects
  FOR ALL USING (bucket_id = 'voice-memos' AND auth.uid()::text = (storage.foldername(name))[1]);
