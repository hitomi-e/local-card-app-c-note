/**
 * 最新ニュースチェック API — ハイブリッド検索版
 *
 * 1. Gemini が会社を分析：業種・全国/地域判定・最適クエリ3本を生成
 * 2. クエリを順番に試し（会社特定 → 業種代替 → 地域×業種FB）、最初にヒットしたものを採用
 * 3. Gemini がアドバイス口調のトピック3件を生成
 */

import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';

// ────────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────────

type SerperNewsItem = {
  title: string;
  link: string;
  snippet?: string;
  date?: string;
  source?: string;
};

type SerperResponse = {
  news?: SerperNewsItem[];
};

type CompanyAnalysis = {
  industry: string;
  isNational: boolean;
  queries: [string, string, string];
};

// ────────────────────────────────────────────────
// Gemini：会社分析 + 検索クエリ生成
// ────────────────────────────────────────────────

async function analyzeCompany(
  companyName: string,
  address: string | null,
  websiteUrl: string | null,
  confirmedIndustry: string | null,
  ai: GoogleGenAI
): Promise<CompanyAnalysis> {
  // 住所から都道府県を抽出
  const prefMatch = address?.match(/^(東京都|北海道|(?:大阪|京都)府|[一-龥]{2,3}県)/);
  const prefecture = prefMatch ? prefMatch[1].replace(/都|道|府|県/, '') : '広島';

  // 確認済み業種がある場合は Gemini 推定をスキップして直接クエリ生成
  if (confirmedIndustry) {
    return {
      industry: confirmedIndustry,
      isNational: false,
      queries: [
        `${companyName} ${confirmedIndustry} 最新ニュース`,
        `${companyName} ${confirmedIndustry} プレスリリース 動向`,
        `${prefecture} ${confirmedIndustry} 業界 最新動向`,
      ],
    };
  }

  // URLからドメインを抽出
  let domain: string | null = null;
  if (websiteUrl) {
    try {
      const url = websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`;
      domain = new URL(url).hostname;
    } catch { /* 無効なURLは無視 */ }
  }

  const addressHint = address  ? `\n住所: ${address}`         : '';
  const domainHint  = domain   ? `\nドメイン: ${domain}`       : '';

  const prompt = `
会社情報を分析し、ニュース検索に使う最適なGoogle検索クエリを生成してください。

会社名: ${companyName}${addressHint}${domainHint}

以下のJSONのみ返してください（余分な説明は一切不要）:
{
  "industry": "推定業種（10文字以内、例：保険代理店・建設業・IT企業）",
  "isNational": false,
  "queries": [
    "クエリ①：会社の実態確認クエリ（「{会社名} 事業内容」「{会社名} サービス」を含めて業種誤認を防ぐ）",
    "クエリ②：確定した業種＋会社名の最新ニュース検索クエリ",
    "クエリ③：${prefecture}の業界トレンドのフォールバッククエリ"
  ]
}

【業種判定の優先順位 — 最重要】
1. ドメイン名（最優先）: ドメイン名は業種を特定する最強の手がかりです。
   ドメインの単語から連想される事業内容を優先してください。
   例: apex-west → 「apex」「west」から地域インフラ・サービス業の可能性を検討（広告業と即断しない）
   例: hoken-center → 保険代理店、construction → 建設業、など文字通りに読む
2. 住所（次点）: 地方都市なら地域密着の中小企業の可能性が高い
3. 会社名（補助）: 会社名だけでは誤判定しやすいため最後の参考に留める

その他のルール:
- isNational: 全国展開の上場大企業ならtrue、地域密着の中小企業ならfalse
- isNational=true → 全国ニュース・プレスリリース優先のクエリ
- isNational=false → ${prefecture}のローカルニュース・地元メディアを優先するクエリ
- クエリ①に「事業内容」「サービス」を含め業種を確認してから次のクエリに活かす
- ドメイン(${domain ?? 'なし'})がある場合、クエリ②に site:${domain} を活用しても良い
- 直近1年以内のニュースが見つかりやすいクエリにすること
- 各クエリは30文字以内
`.trim();

  try {
    const res = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ parts: [{ text: prompt }] }],
    });
    const text = res.text ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('no JSON');
    const parsed = JSON.parse(jsonMatch[0]) as Partial<CompanyAnalysis> & { queries?: string[] };
    if (
      !parsed.industry ||
      !Array.isArray(parsed.queries) ||
      parsed.queries.length < 3
    ) throw new Error('invalid shape');

    return {
      industry: String(parsed.industry).slice(0, 15),
      isNational: !!parsed.isNational,
      queries: [
        String(parsed.queries[0]),
        String(parsed.queries[1]),
        String(parsed.queries[2]),
      ],
    };
  } catch {
    // 分析失敗時のシンプルなフォールバック
    return {
      industry: 'その他',
      isNational: false,
      queries: [
        `${companyName} 最新 ニュース ${prefecture}`,
        `${companyName} 業界情報 プレスリリース`,
        `${prefecture} ビジネス 業界 最新動向`,
      ],
    };
  }
}

// ────────────────────────────────────────────────
// Serper.dev ニュース検索（直近1年以内）
// ────────────────────────────────────────────────

async function searchSerper(query: string): Promise<SerperNewsItem[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) throw new Error('SERPER_API_KEY が設定されていません。');

  const res = await fetch('https://google.serper.dev/news', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query, gl: 'jp', hl: 'ja', num: 5, tbs: 'qdr:y' }),
  });

  if (!res.ok) throw new Error(`Serper API エラー: ${res.status}`);
  const data: SerperResponse = await res.json();
  return data.news ?? [];
}

// ────────────────────────────────────────────────
// Gemini：アドバイス口調のトピック生成
// ────────────────────────────────────────────────

async function generateTopics(
  companyName: string,
  industry: string,
  prefecture: string,
  articles: SerperNewsItem[],
  isIndustryFallback: boolean,
  ai: GoogleGenAI
): Promise<{ topics: string[], detectedFallback: boolean }> {
  // 記事が見つからなかった場合は業界トピックを直接生成
  if (isIndustryFallback) {
    const prompt = `
あなたはビジネスパーソンの営業アシスタントです。
「${companyName}」（推定業種：${industry}）の直近ニュースは見つかりませんでした。

代わりに、${industry}業界または${prefecture}のビジネスシーンで現在話題になっているトピックスを3つ提案してください。

【出力ルール】
- 「・」で始める箇条書き3行のみ返す
- 「〜が話題です。〇〇についてお話しされてみてはいかがでしょうか？」というアドバイス口調
- 1つあたり40〜80文字
- 日本語のみ・前置き説明不要
`.trim();

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ parts: [{ text: prompt }] }],
    });
    const topics = parseTopicsFromText(response.text ?? '');
    return { topics, detectedFallback: true };
  }

  // 記事が見つかった場合は JSON 形式で「自社ニュースか否か」を同時判定
  const summary = articles
    .slice(0, 5)
    .map((a, i) => `[${i + 1}] ${a.title}\n${a.snippet ?? ''}`)
    .join('\n\n');

  const prompt = `
あなたはビジネスパーソンの営業アシスタントです。
以下は「${companyName}」（推定業種：${industry}）に関する検索結果です。

${summary}

以下のJSONのみ返してください（余分な説明は一切不要）:
{
  "isIndustryFallback": false,
  "topics": ["トピック①", "トピック②", "トピック③"]
}

【isIndustryFallback の判定基準】
- false: 記事の主語が「${companyName}」本体・支社・子会社であり、同社に関する固有の内容
- true: 記事が主に他社・競合・業界全体の話題であり「${companyName}」固有の内容でない
  （例: 保険代理店を検索したが大手保険会社の記事しか出なかった場合 → true）

【isIndustryFallback=false のトピック生成ルール】
- 「〜というニュースがあります。〇〇についてお聞きしてみてはいかがでしょうか？」というアドバイス口調
- 相手を尊重した前向きなトーン
- 1つあたり40〜80文字

【isIndustryFallback=true のトピック生成ルール】
- ${industry}業界または${prefecture}のビジネストレンドを3つ提案
- 「〜が話題です。〇〇についてお話しされてみてはいかがでしょうか？」というアドバイス口調
- 1つあたり40〜80文字
`.trim();

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ parts: [{ text: prompt }] }],
  });
  const text = response.text ?? '';

  // JSON パース（失敗時はテキスト解析にフォールバック）
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { isIndustryFallback?: boolean; topics?: unknown[] };
      if (Array.isArray(parsed.topics) && parsed.topics.length > 0) {
        return {
          topics: parsed.topics.slice(0, 3).map(String).filter(t => t.length > 0),
          detectedFallback: !!parsed.isIndustryFallback,
        };
      }
    } catch { /* JSON 解析失敗 → テキスト解析へ */ }
  }

  return { topics: parseTopicsFromText(text), detectedFallback: false };
}

/** 箇条書きテキストからトピック配列を抽出するヘルパー */
function parseTopicsFromText(text: string): string[] {
  const topics = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => /^[・•\-▸*]/.test(l))
    .map(l => l.replace(/^[・•\-▸*]\s*/, '').trim())
    .filter(l => l.length > 0)
    .slice(0, 3);
  if (topics.length === 0) {
    return text.split('\n').map(l => l.trim()).filter(l => l.length > 10).slice(0, 3);
  }
  return topics;
}

// ────────────────────────────────────────────────
// エンドポイント
// ────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      companyName?: string;
      address?: string | null;
      websiteUrl?: string | null;
      industry?: string | null;
    };
    const { companyName, address = null, websiteUrl = null, industry: confirmedIndustry = null } = body;

    if (!companyName || typeof companyName !== 'string') {
      return NextResponse.json({ ok: false, error: '会社名が指定されていません。' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: 'GEMINI_API_KEY が設定されていません。' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Step 1: Gemini で会社分析（業種・全国/地域・最適クエリ3本）
    // confirmedIndustry がある場合は Gemini 推定をスキップ
    const { industry, queries } = await analyzeCompany(companyName, address, websiteUrl, confirmedIndustry, ai);

    // 住所から都道府県を再抽出（フォールバックプロンプト用）
    const prefMatch = address?.match(/^(東京都|北海道|(?:大阪|京都)府|[一-龥]{2,3}県)/);
    const prefecture = prefMatch ? prefMatch[1].replace(/都|道|府|県/, '') : '広島';

    // Step 2: クエリ①（会社特定）で検索
    let articles = await searchSerper(queries[0]);

    // Step 3: ヒットなし → クエリ②（業種+会社名）で再検索
    if (articles.length === 0) {
      articles = await searchSerper(queries[1]);
    }

    // Step 4: まだヒットなし → クエリ③（地域×業種フォールバック）
    let isIndustryFallback = false;
    if (articles.length === 0) {
      articles = await searchSerper(queries[2]);
      isIndustryFallback = articles.length === 0;
    }

    // Step 5: Gemini でトピック生成（自社ニュース判定も同時実施）
    const { topics, detectedFallback } = await generateTopics(
      companyName, industry, prefecture, articles, isIndustryFallback, ai
    );
    const finalIsIndustryFallback = isIndustryFallback || detectedFallback;

    const sources = articles.slice(0, 2).map(a => ({ title: a.title, url: a.link }));

    return NextResponse.json({ ok: true, topics, isIndustryFallback: finalIsIndustryFallback, sources });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '予期しないエラーが発生しました。';
    // 503 / High demand エラーを日本語で案内
    const isOverloaded =
      message.includes('503') ||
      message.toLowerCase().includes('high demand') ||
      message.toLowerCase().includes('overloaded') ||
      message.toLowerCase().includes('resource_exhausted');
    const friendlyMessage = isOverloaded
      ? 'AIが混み合っています。少し時間を置いてもう一度お試しください。'
      : message;
    return NextResponse.json({ ok: false, error: friendlyMessage }, { status: 500 });
  }
}
