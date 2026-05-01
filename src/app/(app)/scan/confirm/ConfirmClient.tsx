'use client';

/**
 * デジタル名刺 受け取り確認クライアント
 *
 * ・マウント時に紙吹雪 + 折り鶴アニメーション
 * ・相手のプロフィールカード表示
 * ・フリーメモ入力
 * ・カテゴリー選択（CategorySelector を再利用）
 * ・保存ボタン（タンポポ色 #FCD34D）
 * ・重複時は上書き確認ダイアログを表示
 * ・保存完了後は SaveSuccessOverlay → /dashboard
 *
 * ⚠️ useActionState の form action バインドは使わない。
 *    React 19 が前回の ok: true 状態を復元してしまうため、
 *    サーバーアクションをボタンクリック時に手動で呼び出す方式にしている。
 *
 * ⚠️ 二重クリック防止は useRef（同期）で実装。
 *    useState はバッチ更新のため高速タップで複数回実行されてしまう。
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User, Phone, Smartphone, Mail, Globe, CheckCircle } from 'lucide-react';
import { VoiceMemoButton } from '@/components/ui/VoiceMemoButton';
import type { Profile } from '@/types/profile';
import type { Category } from '@/types/cards';
import CategorySelector from '@/components/cards/CategorySelector';
import { SaveSuccessOverlay } from '@/components/ui/SaveSuccessOverlay';
import { saveDigitalCardAction } from './actions';
import { createClient } from '@/lib/supabase/client';


type DuplicateInfo = {
  id: string;
  full_name: string | null;
  company_name: string | null;
} | null;

type Props = {
  targetProfile: Profile;
  facePhotoUrl: string | null;
  categories: Category[];
  initialDuplicate: DuplicateInfo;
  currentUserId: string;
};

export default function ConfirmClient({
  targetProfile,
  facePhotoUrl,
  categories,
  initialDuplicate,
  currentUserId: _currentUserId,
}: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  // 保存後の演出
  const [showOverlay, setShowOverlay] = useState(false);

  // 保存処理の状態（表示用）
  const [saving,   setSaving]   = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 二重クリック防止ロック（useRef で同期的に管理）
  const savingRef = useRef(false);

  // 業種（相手のプロフィールから初期値をセット、編集可）
  const [industry, setIndustry] = useState(targetProfile.industry ?? '');

  // フリーメモ（音声入力からの追記に対応するためコントロール型で管理）
  const [freeMemo, setFreeMemo] = useState('');

  // 重複ダイアログ
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [overwriteCardId,     setOverwriteCardId]     = useState<string | null>(null);

  // サーバー側の重複判定を初期値として保持。
  // ログイン直後はセッション伝播のタイミングでサーバー側チェックが空振りすることがあるため、
  // マウント後にブラウザ側クライアントで source_user_id による再チェックを実施する。
  const [duplicate, setDuplicate] = useState<DuplicateInfo>(initialDuplicate);

  useEffect(() => {
    // サーバー側で既に重複が検出されていれば再チェック不要
    if (initialDuplicate) return;

    async function recheckDuplicate() {
      const supabase = createClient();

      // getUser() で最新のセッションが確定してから検索する
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // デジタル名刺は source_user_id で照合（名前比較より確実）
      const { data } = await supabase
        .from('cards')
        .select('id, full_name, company_name')
        .eq('source_user_id', targetProfile.id)
        .limit(1)
        .maybeSingle();

      if (data) {
        setDuplicate(data as DuplicateInfo);
      }
    }

    recheckDuplicate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // ── 保存処理（手動呼び出し）─────────────────────────────────
  async function doSave(overwriteId?: string) {
    if (!formRef.current) return;

    // 同期ロックで二重実行を完全防止（useRef は即座に反映される）
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setErrorMsg(null);

    try {
      const formData = new FormData(formRef.current);

      if (overwriteId) {
        formData.set('overwrite_card_id', overwriteId);
      } else {
        formData.delete('overwrite_card_id');
      }

      // デバッグ: 送信するカテゴリーを確認
      const categoryIds = formData.getAll('category_ids');
      const newCatNames = formData.getAll('new_category_name');
      console.log('[ConfirmClient] 保存実行 overwriteId:', overwriteId ?? 'なし');
      console.log('[ConfirmClient] category_ids:', categoryIds);
      console.log('[ConfirmClient] new_category_name:', newCatNames);

      const result = await saveDigitalCardAction({}, formData);
      console.log('[ConfirmClient] 保存結果:', result);

      if (result.ok) {
        setShowOverlay(true);
      } else {
        setErrorMsg(result.error ?? '登録に失敗しました');
        savingRef.current = false;
        setSaving(false);
      }
    } catch (e) {
      console.error('[ConfirmClient] 予期しないエラー:', e);
      setErrorMsg('登録中にエラーが発生しました。もう一度お試しください。');
      savingRef.current = false;
      setSaving(false);
    }
    // 保存成功時は overlay を表示したままにするため finally でリセットしない
  }

  // ── 保存ボタン押下 ────────────────────────────────────────────
  function handleSaveClick() {
    // 重複があり、まだダイアログを出していない場合
    if (duplicate && overwriteCardId === null && !showDuplicateDialog) {
      setShowDuplicateDialog(true);
      return;
    }
    doSave(overwriteCardId ?? undefined);
  }

  // ── 上書き選択 ────────────────────────────────────────────────
  function handleOverwrite() {
    setShowDuplicateDialog(false);
    doSave(duplicate!.id);
  }

  // ── 新規追加選択 ──────────────────────────────────────────────
  function handleAddNew() {
    setShowDuplicateDialog(false);
    doSave(undefined);
  }

  const displayName = targetProfile.full_name ?? targetProfile.company_name ?? 'プロフィール';

  return (
    <>
      {/* 保存完了演出 */}
      {showOverlay && (
        <SaveSuccessOverlay
          redirectTo="/dashboard"
          message={`${displayName}さんとの\nご縁を登録しました✨`}
        />
      )}

      {/* 重複確認ダイアログ */}
      {showDuplicateDialog && duplicate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#e8f8f7] flex items-center justify-center shrink-0">
                <CheckCircle size={20} className="text-[#81d8d0]" />
              </div>
              <p className="text-base font-bold text-gray-800">既に登録があります</p>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              <span className="font-semibold">{duplicate.full_name}</span>
              {duplicate.company_name && (
                <span className="text-gray-400">（{duplicate.company_name}）</span>
              )}
              さんはすでに登録されています。どうしますか？
            </p>
            <p className="text-xs text-gray-400 -mt-1">
              ※ メモとカテゴリーは現在の設定を保持（または追記）します。
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleOverwrite}
                disabled={saving}
                className="w-full py-3 rounded-xl text-sm font-bold text-white
                           hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
                style={{ backgroundColor: '#81d8d0' }}
              >
                上書き保存する
              </button>
              <button
                type="button"
                onClick={handleAddNew}
                disabled={saving}
                className="w-full py-3 rounded-xl text-sm font-medium text-gray-700
                           bg-gray-100 hover:bg-gray-200 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                別の名刺として保存
              </button>
              <button
                type="button"
                onClick={() => setShowDuplicateDialog(false)}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-gray-400
                           hover:text-gray-600 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-5 px-4 py-5">

        {/* ヘッダー */}
        <header className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="p-1 -ml-1 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="戻る"
          >
            <ArrowLeft size={22} />
          </button>
          <h1 className="flex-1 text-base font-bold text-gray-800 px-1">名刺を受け取る</h1>
        </header>

        {/* Success メッセージ */}
        <div className="flex items-center gap-3 bg-[#e8f8f7] rounded-2xl px-4 py-3">
          <div className="w-9 h-9 rounded-full bg-[#81d8d0]/30 flex items-center justify-center shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-crane.svg" alt="" className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#3a9e97]">ご縁がつながりました！内容を確認・追加してから登録してください</p>
          </div>
        </div>

        {/* 相手のプロフィールカード */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="h-1.5 bg-[#81d8d0]" />
          <div className="p-4 flex flex-col gap-3">
            {/* 氏名・役職 */}
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-[#e8f8f7] border-2 border-[#81d8d0]/40 shrink-0 flex items-center justify-center">
                {facePhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={facePhotoUrl} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <User size={24} className="text-[#81d8d0]" />
                )}
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                {targetProfile.full_name && (
                  <p className="text-base font-bold text-gray-800 leading-tight">{targetProfile.full_name}</p>
                )}
                {targetProfile.name_reading && (
                  <p className="text-xs text-gray-400">{targetProfile.name_reading}</p>
                )}
                {targetProfile.position && (
                  <p className="text-sm text-[#81d8d0] font-medium">{targetProfile.position}</p>
                )}
              </div>
            </div>

            {/* 会社情報 */}
            {(targetProfile.company_name || targetProfile.department) && (
              <div className="flex flex-col gap-0.5">
                {targetProfile.company_name && (
                  <p className="text-sm font-semibold text-gray-700">{targetProfile.company_name}</p>
                )}
                {targetProfile.department && (
                  <p className="text-xs text-gray-400">{targetProfile.department}</p>
                )}
              </div>
            )}

            {/* 連絡先 */}
            {(targetProfile.company_phone || targetProfile.mobile_phone || targetProfile.email || targetProfile.website_url) && (
              <div className="flex flex-col gap-1.5 border-t border-gray-100 pt-2">
                {targetProfile.company_phone && (
                  <div className="flex items-center gap-2">
                    <Phone size={13} className="text-[#81d8d0] shrink-0" />
                    <span className="text-xs text-gray-600">{targetProfile.company_phone}</span>
                  </div>
                )}
                {targetProfile.mobile_phone && (
                  <div className="flex items-center gap-2">
                    <Smartphone size={13} className="text-[#81d8d0] shrink-0" />
                    <span className="text-xs text-gray-600">{targetProfile.mobile_phone}</span>
                  </div>
                )}
                {targetProfile.email && (
                  <div className="flex items-center gap-2">
                    <Mail size={13} className="text-[#81d8d0] shrink-0" />
                    <span className="text-xs text-gray-600 break-all">{targetProfile.email}</span>
                  </div>
                )}
                {targetProfile.website_url && (
                  <div className="flex items-center gap-2">
                    <Globe size={13} className="text-[#81d8d0] shrink-0" />
                    <span className="text-xs text-[#81d8d0] break-all">{targetProfile.website_url}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/*
          フォーム（action なし — 手動送信）
          onSubmit で e.preventDefault() を設定し、
          Enter キーや意図しないイベントによるデフォルト送信を完全にブロック
        */}
        <form
          ref={formRef}
          onSubmit={(e) => e.preventDefault()}
        >

          {/* 隠しフィールド */}
          <input type="hidden" name="target_user_id" value={targetProfile.id} />

          {/* 業種 */}
          <div className="flex flex-col gap-2 mb-4">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex flex-wrap items-center gap-x-1.5">
              業種
              <span className="text-[11px] text-gray-400 font-normal normal-case tracking-normal">
                ※入力すると最新ニュースの表示精度が高くなります
              </span>
            </label>
            <input
              name="industry"
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="例：保険代理店・建設業・ITサービス"
              disabled={saving}
              className="
                w-full rounded-xl border border-gray-200 bg-white
                px-3 py-2.5 text-sm text-gray-700
                focus:outline-none focus:ring-2 focus:ring-[#81d8d0]/40 focus:border-[#81d8d0]
                disabled:opacity-60
              "
            />
          </div>

          {/* フリーメモ */}
          <div className="flex flex-col gap-2 mb-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                フリーメモ
              </label>
              <VoiceMemoButton
                onAppend={(text) =>
                  setFreeMemo((prev) => (prev ? prev + '\n' + text : text))
                }
                disabled={saving}
              />
            </div>
            <textarea
              name="free_memo"
              rows={3}
              value={freeMemo}
              onChange={(e) => setFreeMemo(e.target.value)}
              placeholder="交換した場所・印象など自由に記録できます"
              className="
                w-full rounded-xl border border-gray-200 bg-white
                px-3 py-2.5 text-sm text-gray-700
                focus:outline-none focus:ring-2 focus:ring-[#81d8d0]/40 focus:border-[#81d8d0]
                resize-none
              "
            />
          </div>

          {/* カテゴリー選択 */}
          <div className="flex flex-col gap-2 mb-5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              カテゴリー
            </label>
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <CategorySelector
                categories={categories}
                ocrTexts={[
                  targetProfile.business_description ?? '',
                  targetProfile.position ?? '',
                  targetProfile.company_name ?? '',
                ].filter(Boolean)}
              />
            </div>
          </div>

          {/* エラーメッセージ */}
          {errorMsg && (
            <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-2.5 mb-4">
              {errorMsg}
            </p>
          )}

          {/* 保存ボタン（type="button" — form action に紐付けない） */}
          <button
            type="button"
            onClick={handleSaveClick}
            disabled={saving}
            style={{ backgroundColor: '#FCD34D', color: '#374151' }}
            className="
              w-full min-h-[58px] flex items-center justify-center gap-2
              text-base font-bold rounded-2xl shadow-sm
              hover:opacity-90 active:scale-[0.98] transition-all
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            {saving ? '登録中...' : 'この名刺を名刺帳へ登録する'}
          </button>
        </form>

        {/* 余白 */}
        <div className="h-4" />
      </div>
    </>
  );
}
