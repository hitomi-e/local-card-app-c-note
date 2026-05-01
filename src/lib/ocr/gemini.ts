/**
 * Gemini API を使った名刺 OCR ユーティリティ
 * 画像（base64）を受け取り、名刺の各項目を抽出して返す
 *
 * ─ SDK: @google/generative-ai（レガシー、2025年8月サポート終了）から
 *         @google/genai（最新 SDK v1.x）に移行済み
 * ─ モデル: gemini-2.5-flash（2026年時点の推奨安定版 Flash モデル）
 */

import { GoogleGenAI, createPartFromBase64, createPartFromText } from '@google/genai';

/** OCR 結果の型（cards テーブルの文字列フィールドと対応） */
export type CardOcrResult = {
  company_name:         string | null;
  company_name_reading: string | null;
  branch_office:        string | null;
  department:           string | null;
  position:             string | null;
  full_name:            string | null;
  name_reading:         string | null;
  postal_code:          string | null;
  address:              string | null;
  company_phone:        string | null;
  extension:            string | null;
  mobile_phone:         string | null;
  email:                string | null;
  website_url:          string | null;
  /** 会社のドメイン名・ロゴ・会社名から推定した業種（10文字以内） */
  industry?:            string | null;
  /** 裏面など、他フィールドに収まらない補足情報（事業内容・キャッチコピーなど） */
  free_memo?:           string | null;
};

/** JSON フィールドの共通定義（表面1枚・両面共用） */
const JSON_SCHEMA = `{
  "company_name": "会社の正式名称（なければnull）",
  "company_name_reading": "会社名のふりがな・ひらがな表記（名刺に記載がなければnull）",
  "branch_office": "支店・営業所・事業所名（なければnull）",
  "department": "部署名（なければnull）",
  "position": "役職名（なければnull）",
  "full_name": "氏名のフルネーム（なければnull）",
  "name_reading": "氏名のふりがな・ひらがな表記（名刺に記載がなければnull）",
  "postal_code": "郵便番号（ハイフン付き。なければnull）",
  "address": "住所（都道府県から番地・建物名まで。なければnull）",
  "company_phone": "会社・代表電話番号（なければnull）",
  "extension": "内線番号（なければnull）",
  "mobile_phone": "携帯電話番号（なければnull）",
  "email": "メールアドレス（なければnull）",
  "website_url": "WebサイトのURL（なければnull）",
  "industry": "業種（例：保険代理店・建設業・ITサービス・飲食業、10文字以内。会社名/ロゴ/ドメイン/事業内容から推定。不明ならnull）",
  "free_memo": "他のフィールドに収まらない有用な情報（キャッチコピー・事業内容・SNSアカウントなど）。なければnull"
}`;

/** 表面1枚用プロンプト */
const OCR_PROMPT_SINGLE = `
この名刺画像を解析し、以下のJSON形式のみで情報を返してください（説明文は不要です）。

${JSON_SCHEMA}

注意：
- 値が見つからない場合は必ず null を使う（空文字列不可）
- 余分なテキストや説明は一切含めず、JSONのみ返す
- 日本語の名刺を想定しているが、英語表記があればそのまま使用する
`.trim();

/** 表面・裏面2枚用プロンプト */
const OCR_PROMPT_DUAL = `
あなたは名刺の情報を正確に読み取るOCRシステムです。
1枚目の画像が名刺の「表面」、2枚目の画像が名刺の「裏面」です。
以下のルールに従ってJSON形式のみで情報を返してください（説明文は不要です）。

【最重要ルール：表面マスター・裏面サブの原則】
- 1枚目（表面）の情報を「マスター」として最優先してください
- 2枚目（裏面）は「サブ情報」です
- company_name / full_name / position / department / company_phone / mobile_phone / email など、
  表面に既に記載されているフィールドは、裏面の文字で絶対に上書きしないでください
- 表面に記載がないフィールド（住所・URLなど）のみ、裏面から補完してください
- 裏面に記載された事業内容・キャッチコピー・SNSアカウント・地図情報・会社説明文など、
  他のフィールドに収まらないすべての情報はfree_memoに集約してください

${JSON_SCHEMA}

注意：
- 値が見つからない場合は必ず null を使う（空文字列不可）
- 余分なテキストや説明は一切含めず、JSONのみ返す
`.trim();

/**
 * 名刺画像を Gemini で解析し、各フィールドの値を返す
 *
 * @param imageBase64     - 表面画像の base64（data: プレフィックスなし）
 * @param mimeType        - 表面画像の MIME タイプ
 * @param backImageBase64 - 裏面画像の base64（省略可）
 * @param backMimeType    - 裏面画像の MIME タイプ（省略可）
 */
export async function parseBusinessCard(
  imageBase64: string,
  mimeType: string,
  backImageBase64?: string,
  backMimeType?: string
): Promise<CardOcrResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY が設定されていません。.env.local を確認してください。');
  }

  // 新 SDK でクライアントを初期化
  const ai = new GoogleGenAI({ apiKey });

  // 裏面画像がある場合は2枚用プロンプトを使用
  const hasDual  = !!backImageBase64 && !!backMimeType;
  const prompt   = hasDual ? OCR_PROMPT_DUAL : OCR_PROMPT_SINGLE;
  const parts    = hasDual
    ? [
        createPartFromBase64(imageBase64, mimeType),
        createPartFromBase64(backImageBase64!, backMimeType!),
        createPartFromText(prompt),
      ]
    : [
        createPartFromBase64(imageBase64, mimeType),
        createPartFromText(prompt),
      ];

  let responseText: string;
  try {
    const response = await ai.models.generateContent(
      {
        // gemini-2.5-flash: 2026年推奨の最新安定版マルチモーダル Flash モデル
        model: 'gemini-2.5-flash',
        contents: [{ parts }],
      },
      { timeout: 60_000 } // 60秒タイムアウト（AI処理待ちに対応）
    );

    responseText = response.text ?? '';
  } catch (err: unknown) {
    // API エラーを具体的なメッセージに変換して再スロー
    const msg = err instanceof Error ? err.message : String(err);

    if (msg.includes('not found') || msg.includes('404')) {
      throw new Error(
        `モデルが見つかりません。APIキーが対応していないモデルを指定している可能性があります（${msg}）`
      );
    }
    if (msg.includes('no longer available')) {
      throw new Error(
        `指定したモデルはこのAPIキーでは使用できません。Google AI Studio でキーを再発行してください（${msg}）`
      );
    }
    if (msg.includes('API_KEY_INVALID') || msg.includes('401') || msg.includes('403')) {
      throw new Error(
        `APIキーが無効です。.env.local の GEMINI_API_KEY を確認してください（${msg}）`
      );
    }
    // 503: サービス過負荷（混雑）
    if (
      msg.includes('503') ||
      msg.includes('overloaded') ||
      msg.includes('UNAVAILABLE') ||
      msg.includes('Service Unavailable')
    ) {
      throw new Error(
        'AIが混み合っています。少し時間を置いてもう一度お試しください。'
      );
    }
    // 429: レート制限・クォータ超過
    if (
      msg.includes('429') ||
      msg.includes('RESOURCE_EXHAUSTED') ||
      msg.includes('quota') ||
      msg.includes('Too Many Requests')
    ) {
      throw new Error(
        'AI の利用上限に達しました。しばらく時間を置いてからお試しください。'
      );
    }
    // 500: API 内部エラー
    if (msg.includes('500') || msg.includes('INTERNAL')) {
      throw new Error(
        'AI 内部でエラーが発生しました。しばらくしてからもう一度お試しください。'
      );
    }
    throw new Error(`Gemini API エラー: ${msg}`);
  }

  // Gemini が ```json ... ``` で囲んで返す場合も対応
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(
      `AIからの応答をJSONとして解析できませんでした。応答内容: ${responseText.slice(0, 200)}`
    );
  }

  const parsed = JSON.parse(jsonMatch[0]) as CardOcrResult;
  return parsed;
}
