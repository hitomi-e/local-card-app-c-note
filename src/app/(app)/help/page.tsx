'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft, ChevronDown,
  UserPlus, User, ScanLine, PenLine, QrCode, Newspaper,
} from 'lucide-react';

const CONTACT_FORM_URL = 'https://forms.gle/qjP54hoCXyU79fc78';

// ─── 使い方ステップデータ ─────────────────────────────────

type Method = { title: string; note?: string; steps: string[] };
type UsageStep = {
  icon: React.ElementType;
  title: string;
  methods: Method[];
};

const USAGE_STEPS: UsageStep[] = [
  {
    icon: UserPlus,
    title: '新規登録方法【名刺交換相手のMy QRコードから】',
    methods: [
      {
        title: '',
        note: '※同時に相手のMy名刺を登録できます',
        steps: [
          '相手のMy QRコードを読み取り「My名刺（デジタル名刺）を受け取る」をタップ',
          'メールアドレスとパスワード（英数8文字以上）を入力する',
          'メールが届くので「メールアドレスを認証する」をタップ',
          '手順②で入力したメールアドレスとパスワードを入力してログイン',
          '相手のMy名刺が表示されるので「この名刺を名刺帳へ登録する」をタップ。',
          '「フリーメモ」と「カテゴリー設定」 を入力して「この名刺を名刺帳へ登録する」をタップ',
          '相手のMy名刺が名刺帳へ登録される',
        ],
      },
    ],
  },
  {
    icon: User,
    title: 'My名刺（デジタル名刺）の登録方法',
    methods: [
      {
        title: '',
        steps: [
          'アプリ右下の「My名刺」をタップ',
          '「My名刺を作成する」をタップ',
          '顔写真・会社ロゴ（JPEG/PNG）・必要情報を入力し、「My名刺を登録する」をタップ',
          '編集する場合はアプリ右下の「My名刺」から',
        ],
      },
    ],
  },
  {
    icon: ScanLine,
    title: '名刺帳への登録方法（紙の名刺をスキャン）',
    methods: [
      {
        title: '',
        steps: [
          'アプリ中央の ＋ マークをタップ',
          '「名刺をスキャン」をタップ',
          '「カメラで撮影／ライブラリから選択」をタップ',
          '「カメラで撮影」をタップするとカメラが起動するので名刺をなるべく大きく鮮明に撮影する',
          '回転マークをタップして画像の向きを調整する',
          '裏面をスキャンする場合は「裏面も撮影する」をタップ',
          '回転マークをタップして画像の向きを調整する',
          '「この名刺を読み取る」をタップ',
          'AIが自動で読み取った情報を確認し、修正が必要な場合は直接入力して修正する',
          '「フリーメモ」と「カテゴリー設定」を入力し、「この名刺を名刺帳へ登録する」をタップ',
          '名刺帳へ登録される',
        ],
      },
    ],
  },
  {
    icon: PenLine,
    title: '名刺帳への登録方法（自分で入力）',
    methods: [
      {
        title: '',
        steps: [
          'アプリ中央の ＋ マークをタップ',
          '「自分で入力」をタップ',
          '必要事項・「フリーメモ」・「カテゴリー設定」を入力し、「名刺を登録する」をタップ',
          '名刺帳へ登録される',
        ],
      },
    ],
  },
  {
    icon: QrCode,
    title: 'デジタル名刺で名刺交換する方法',
    methods: [
      {
        title: 'こちらから相手へ名刺を渡す場合',
        steps: [
          'アプリ右下の「My名刺」をタップ、もしくはアプリ右上の自分のアイコンをタップして「My QRコード」を表示する',
          '相手にQRコードを読み取ってもらい「この名刺を名刺帳へ登録する」をタップしてもらう',
          '相手のアプリへ、こちらの「My名刺」が表示されるので「フリーメモ」と「カテゴリー設定」を入力いただいた後に「この名刺を名刺帳へ登録する」をタップしてもらう',
          '相手のアプリの名刺帳へ、こちらのMy名刺が登録される',
        ],
      },
      {
        title: '相手の名刺を受け取る場合',
        steps: [
          'アプリ右上の自分のアイコン「QRコードスキャン」をタップ　※非対応の場合はカメラ撮影',
          '相手のMy名刺が表示されるので「この名刺を名刺帳へ登録する」をタップ。',
          '「フリーメモ」と「カテゴリー設定」を入力し、「この名刺を名刺帳へ登録する」をタップ',
          '相手のMy名刺が名刺帳へ登録される',
        ],
      },
    ],
  },
  {
    icon: Newspaper,
    title: '最新ニュースをチェックする方法',
    methods: [
      {
        title: '',
        steps: [
          'チェックしたい名刺交換相手を名刺帳で検索してタップ',
          '名刺詳細の「最新ニュースをチェック」をタップ',
          'AIが該当する会社や業界のニューストピックスを要約して、会話のきっかけを提案してくれる',
          'ニュースについての詳しい情報が知りたい場合は「参考記事」をタップ',
          'ニュース内容に満足しない場合は「もう一度調べる」をタップ',
        ],
      },
    ],
  },
];

// ─── Q&Aデータ ───────────────────────────────────────────

type QaItem = { q: string; a: string };

// グループ定義（タイトルとアイテムの配列）
type QaGroup = { title: string; items: QaItem[] };

const QA_GROUPS: QaGroup[] = [
  {
    title: '新規登録・My名刺について',
    items: [
      {
        q: '新規登録のメールアドレス認証メールが届かない',
        a: '迷惑メールフォルダをご確認ください。それでも届かない場合は、メールアドレスに誤りがないかご確認のうえ、お問い合わせフォームよりご連絡ください。',
      },
      {
        q: 'My名刺の顔写真をきれいにアップロードできない',
        a: '画像は中央に大きくトリミングされます。アップロードできるファイルサイズは10MBまでです。あらかじめ画像の切り抜きや色補正を行ってからアップロードしてください。',
      },
      {
        q: '会社ロゴをアップロードするときの規定は？',
        a: 'JPEGまたはPNGデータを推奨します。縦組みロゴの場合は小さく表示されますので、横組みロゴの使用を推奨します。',
      },
    ],
  },
  {
    title: '名刺の登録・スキャンについて',
    items: [
      {
        q: '名刺をスキャンするとエラーメッセージが出ます',
        a: 'AIが混み合ってスキャンに失敗したときにエラーメッセージが出ます。しばらく時間を置いてから再度「この名刺を読み取る」をタップしてください。',
      },
      {
        q: '名刺のスキャン後に読み取りが間違っている',
        a: '読み取り直後の画面でAIが自動読み取りした内容をご確認ください。間違っている部分を修正してから「名刺を登録する」をタップしてください。登録後の変更・追加は、名刺詳細の「名刺を編集する」から何度でも編集できます。',
      },
      {
        q: '登録済の相手が異動になり、新しい名刺をもらった',
        a: '「名刺をスキャン」をタップして登録してください。同じ会社名・同じ名前の名刺は登録後に「既に登録があります」というポップアップが表示されます。「上書き保存する」をタップしてください。以前入力した「フリーメモ」と「カテゴリー設定」は上書き後も引き継がれます。上書きしたくない場合は「別の名刺として保存」をタップしてください。',
      },
    ],
  },
  {
    title: '操作と整理（メモ・カテゴリー）',
    items: [
      {
        q: '「フリーメモ」の使い方は？',
        a: '名刺交換した相手に関する情報を自由に記録できます。例：「A社新年会で挨拶」「趣味はガーデニング」「B社からの紹介」。マイクのマークをタップすると音声入力も可能です。',
      },
      {
        q: 'カテゴリー設定の使い方は？',
        a: '相手の業種・所属団体など、ユーザーが自由にカテゴリーの名前と色を設定できます。例：「取引先」「クライアント」「銀行」「商工会議所」「ライオンズクラブ」。検索機能と連動しているため、設定しておくと便利です。カテゴリーの色を変更する場合は、カテゴリー名の横にある色付きの丸をタップしてください。',
      },
      {
        q: '名刺帳の並び順がバラバラです',
        a: '名刺帳は、法人の種類（株式会社・合同会社・医療法人など）を除いた会社名をアルファベット→カタカナ→ひらがな・漢字の順に並びます。編集画面で「会社名（ふりがな）」を登録すると、正確な順番に並び替えることができます。',
      },
      {
        q: 'デジタル名刺のメリットは何？',
        a: 'メリット1. 紙の名刺サイズでは記載できない多くの情報（顔写真・会社ロゴ・SNS・所属団体・趣味・特技・座右の銘など）を登録できます。\nメリット2. My名刺を更新（編集）すると、登録先の相手全員のアプリでも自動的にアップデートされます。名刺交換は1度だけでOKです。\nメリット3. 名刺制作費がゼロになるため、会社の経費削減につながります。',
      },
    ],
  },
  {
    title: '便利な機能（連絡・ニュース・共有）',
    items: [
      {
        q: '登録先へ連絡するときの便利な機能は？',
        a: '住所をタップするとマップが立ち上がります。会社電話番号・携帯電話番号をタップするとすぐに電話をかけられます。メールアドレスをタップするとメールソフトが立ち上がります。WebサイトURLをタップするとブラウザが立ち上がります。デジタル名刺の場合、SNSもタップひとつでチェックできます。',
      },
      {
        q: '「最新ニュースをチェック」で表示されるニュースはいつの情報？',
        a: '利用日から過去1年間のニュースをGoogle検索（会社名×名刺の都道府県×業種）した結果が要約して表示されます。',
      },
      {
        q: '「最新ニュースをチェック」はどう活用すれば良い？',
        a: '相手との会話のきっかけをAIが想定した口調でニュースを表示します。会社名に関するニュースがヒットしなかった場合は「同業種トピックス」が表示され、業界全体のニュースが表示されます。AIの検索結果を参考にしながらお相手と会話してみましょう。さらに詳しい情報が知りたい場合は「参考記事」をタップすると情報元のブラウザが開きます。',
      },
      {
        q: '「最新ニュースをチェック」をタップしても満足した結果が得られない',
        a: '「もう一度調べる」をタップするとAIが再度ニュースを検索し直します。業種にズレがある場合、業種欄が空欄でAIが正確な業種を検索できていない可能性があります。編集画面で業種を追加・保存してから再度「最新ニュースをチェック」をタップしてみてください。',
      },
      {
        q: '「最新ニュースをチェック」をタップするとエラーメッセージが出ます',
        a: 'AIが混み合ってニュース取得に失敗したときにエラーメッセージが出ます。しばらく時間を置いてから再度「最新ニュースをチェック」をタップしてください。',
      },
      {
        q: '特定の名刺情報を他の人に教えたい',
        a: '名刺詳細の連絡先にコピーのマークがあります。タップするとコピーができますので、メールやLINEなどにペースト（貼り付け）してスムーズに情報を共有できます。',
      },
      {
        q: 'My名刺の情報を他の人に教えたい',
        a: 'アプリ右上の自分のアイコンをタップして「My QRコード」の下に表示される「リンクをコピー」をタップするとURLをコピーできます。また、スマートフォンの機種によっては「シェア」をタップすると、さまざまな方法で他の方へ転送することが可能です。',
      },
    ],
  },
  {
    title: 'その他（PC・機種変更・不具合）',
    items: [
      {
        q: 'パソコンやタブレットでも利用できる？',
        a: '利用可能です。パソコンの場合はブラウザからアクセスしてご利用ください。タブレットの場合はC-Note QRコードを読み取ってログインしてください。',
      },
      {
        q: 'CSV出力でデータをダウンロードしたい',
        a: '「名刺帳」右上の「CSV出力」からダウンロードが可能です。年賀状ソフト・顧客管理システム（CRM）・他社名刺管理サービスへの移行を効率よく行っていただけます。',
      },
      {
        q: '機種変更したときはどうすれば良い？',
        a: '同じメールアドレスとパスワードでログインすれば、これまでのデータをそのままご利用いただけます。',
      },
      {
        q: 'このアプリを仲間に紹介したい',
        a: 'アプリ右下の「My名刺」をタップ、もしくはアプリ右上の自分のアイコンをタップして「My QRコード」を画面に表示させ、相手に読み取らせると新規登録画面が開きます（続けてMy名刺の登録も案内できます）。また、右上アイコンの「C-Note QRコード」から新規登録のみ案内することもできます。',
      },
      {
        q: '不具合があった場合は？',
        a: 'お問い合わせフォームよりご連絡をお願いします。',
      },
    ],
  },
];

// ─── サブコンポーネント ───────────────────────────────────

function StepCard({ step }: { step: UsageStep }) {
  const Icon = step.icon;
  const hasSubtitle = step.methods.length > 1 || step.methods[0].title !== '';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 px-4 py-3.5 bg-[#e8f4f3]">
        <div className="w-10 h-10 rounded-full bg-[#40a096] flex items-center justify-center text-white shrink-0 shadow-sm">
          <Icon size={20} />
        </div>
        <p className="text-sm font-bold text-gray-800 leading-snug">{step.title}</p>
      </div>

      {/* ステップ本文 */}
      <div className="px-4 py-4 space-y-5">
        {step.methods.map((method, mi) => (
          <div key={mi}>
            {hasSubtitle && method.title && (
              <p className="text-xs font-bold text-[#40a096] mb-3">【{method.title}】</p>
            )}
            {method.note && (
              <p className="text-xs text-gray-500 mb-3">{method.note}</p>
            )}
            <ol className="space-y-3">
              {method.steps.map((s, si) => (
                <li key={si} className="flex gap-3 text-sm text-gray-700">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-[#40a096]/10 flex items-center justify-center text-[10px] font-bold text-[#40a096] mt-0.5">
                    {si + 1}
                  </span>
                  <span className="leading-relaxed">{s}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}

function GroupHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="w-1 h-5 rounded-full bg-[#40a096]" />
      <h2 className="text-sm font-bold text-gray-700">{title}</h2>
    </div>
  );
}

function AccordionItem({ item, itemKey, isOpen, onToggle, showContactLink }: {
  item: QaItem;
  itemKey: string;
  isOpen: boolean;
  onToggle: () => void;
  showContactLink?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-start gap-3 px-4 py-4 text-left"
        aria-expanded={isOpen}
      >
        <span className="shrink-0 text-xs font-bold text-[#40a096] mt-0.5 w-5 leading-relaxed">Q</span>
        <span className="flex-1 text-sm font-medium text-gray-800 leading-relaxed">{item.q}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-gray-400 mt-1 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="px-4 pb-5 border-t border-gray-50">
          <div className="flex gap-3 pt-3.5">
            <span className="shrink-0 text-xs font-bold text-[#E8B84B] mt-0.5 w-5 leading-relaxed">A</span>
            <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
              {item.a}
              {showContactLink && (
                <a
                  href={CONTACT_FORM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mt-3 text-[#40a096] underline font-medium"
                >
                  お問い合わせフォームを開く →
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── メインページ ────────────────────────────────────────

export default function HelpPage() {
  const [activeTab, setActiveTab] = useState<'usage' | 'qa'>('usage');
  const [openKey, setOpenKey] = useState<string | null>(null);

  function toggleAccordion(key: string) {
    setOpenKey(prev => (prev === key ? null : key));
  }

  const lastGroupIdx = QA_GROUPS.length - 1;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">

      {/* ヘッダー */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500"
          >
            <ChevronLeft size={22} />
          </Link>
          <h1 className="text-base font-bold text-gray-800">使い方 ＆ Q&A</h1>
        </div>
      </div>

      {/* タブ切り替え */}
      <div className="sticky top-14 z-10 bg-white border-b border-gray-100">
        <div className="max-w-xl mx-auto flex">
          <button
            type="button"
            onClick={() => setActiveTab('usage')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === 'usage'
                ? 'text-[#40a096] border-[#40a096]'
                : 'text-gray-400 border-transparent hover:text-gray-600'
            }`}
          >
            使い方
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('qa')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === 'qa'
                ? 'text-[#40a096] border-[#40a096]'
                : 'text-gray-400 border-transparent hover:text-gray-600'
            }`}
          >
            よくある質問
          </button>
        </div>
      </div>

      {/* コンテンツ */}
      <div className="flex-1 max-w-xl mx-auto w-full px-4 pt-5 pb-28">

        {activeTab === 'usage' && (
          <div className="flex flex-col gap-8">
            <p className="text-xs text-gray-500 px-1">
              C-Noteを使い始める前に、以下の手順をご確認ください。
            </p>
            {USAGE_STEPS.map((step, i) => (
              <StepCard key={i} step={step} />
            ))}
          </div>
        )}

        {activeTab === 'qa' && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-gray-500 px-1 mb-1">
              よくあるご質問をまとめました。解決しない場合はお問い合わせください。
            </p>
            {QA_GROUPS.map((group, gi) => (
              <div key={gi} className="flex flex-col gap-3">
                <GroupHeader title={group.title} />
                {group.items.map((item, ii) => {
                  const key = `${gi}-${ii}`;
                  const isLastItem = gi === lastGroupIdx && ii === group.items.length - 1;
                  return (
                    <AccordionItem
                      key={key}
                      item={item}
                      itemKey={key}
                      isOpen={openKey === key}
                      onToggle={() => toggleAccordion(key)}
                      showContactLink={isLastItem}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
