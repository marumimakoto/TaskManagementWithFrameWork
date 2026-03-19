'use client';

import { useState } from 'react';
import styles from './page.module.css';

/** チュートリアルのステップ定義 */
export interface TutorialStep {
  title: string;
  description: string;
  action: string;
  hint: string;
  targetTab?: string;
  targetSelector?: string;
  /** このアクションが発生したら次のステップに進む */
  triggerAction?: string;
  /** アクション完了時のメッセージ */
  successMessage?: string;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: 'タスクを追加しよう',
    description: 'まずは最初のタスクを作成してみましょう。タスクページの上部にある入力フォームを使います。',
    action: '「タスク名」欄に何か入力して「追加」ボタンを押してみてください。例: 「買い物に行く」',
    hint: '予定時間や締切は後から変更できるので、まずはタスク名だけでOKです。',
    targetTab: 'tasks',
    targetSelector: '[data-tutorial="task-title-input"]',
    triggerAction: 'addTodo',
    successMessage: 'タスクを追加できました！次は完了にしてみましょう。',
  },
  {
    title: 'タスクを完了にしよう',
    description: 'タスクが終わったら、チェックボックスで完了にできます。',
    action: 'タスクカードの左にあるチェックボックスをクリックしてみてください。',
    hint: '完了したタスクは緑色になり、リストの下に移動します。間違えても、もう一度クリックで戻せます。',
    targetTab: 'tasks',
    targetSelector: '[data-tutorial="task-list"]',
    triggerAction: 'toggleDone',
    successMessage: '完了にできました！次はカードをクリックして展開してみましょう。',
  },
  {
    title: 'タスクカードをクリックしてみよう',
    description: 'タスクカードをクリックすると展開されて、詳しい操作ができます。',
    action: 'タスクカードの本体部分をクリックしてみてください。',
    hint: '展開すると、ポモドーロタイマー、作業ログの記録、詳細の確認ができます。',
    targetTab: 'tasks',
    targetSelector: '[data-tutorial="task-list"]',
    triggerAction: 'expandCard',
    successMessage: 'カードが展開されました！次はタイトルを編集してみましょう。',
  },
  {
    title: 'タイトルを編集しよう',
    description: 'タスク名はダブルクリックでその場で編集できます。',
    action: 'タスクカードのタイトル部分をダブルクリックしてみてください。',
    hint: 'Enterで確定、Escでキャンセルです。詳細・予定時間・期限もダブルクリックで編集できます。',
    targetTab: 'tasks',
    targetSelector: '[data-tutorial="task-list"]',
    triggerAction: 'inlineEdit',
    successMessage: '編集できました！次は表示モードを切り替えてみましょう。',
  },
  {
    title: '表示モードを切り替えよう',
    description: '凡例の右にある3つのボタンで、表示形式を切り替えられます。',
    action: '☰（詳細）、≡（コンパクト）、⊞（グリッド）のボタンを試してみてください。',
    hint: 'コンパクト表示はタスクが多いときに見やすく、グリッド表示は画面を広く使えます。',
    targetTab: 'tasks',
    targetSelector: '[data-tutorial="view-mode-buttons"]',
    triggerAction: 'changeViewMode',
    successMessage: '表示が切り替わりましたね！次はドラッグ操作を試してみましょう。',
  },
  {
    title: 'ドラッグ&ドロップで並べ替えよう',
    description: 'タスクカードをドラッグして、順番を入れ替えたり階層化できます。',
    action: 'タスクカードを長押ししてドラッグし、別のカードの上や間に落としてみてください。',
    hint: 'カードの上にドロップ→子タスクに。カード間にドロップ→その位置に移動。',
    targetTab: 'tasks',
    targetSelector: '[data-tutorial="task-list"]',
  },
  {
    title: 'ポモドーロタイマーを使おう',
    description: 'タスクに集中するためのタイマーが内蔵されています。25分作業→5分休憩のサイクルです。',
    action: 'タスクカードをクリックして展開し、「🍅 ポモドーロ開始」ボタンを押してみてください。',
    hint: '終了すると、作業時間が自動でそのタスクの実績に加算されます。',
    targetTab: 'tasks',
    targetSelector: '[data-tutorial="task-list"]',
  },
  {
    title: '日記を書いてみよう',
    description: 'ハンバーガーメニューから「日記を書く」を選ぶと、日記機能が使えます。',
    action: '下のボタンを押して「日記を書く」ページに移動し、何か書いてみてください。',
    hint: '日記は太字や画像も入れられるリッチテキストエディタです。公開設定でみんなに共有もできます。',
    targetTab: 'diary-write',
  },
  {
    title: 'アイゼンハワーマトリクスで整理しよう',
    description: '緊急度×重要度の2軸でタスクを視覚的に整理できるページがあります。',
    action: '下のボタンを押してマトリクスページに移動し、タスクを配置してみてください。',
    hint: 'タスクのチップをドラッグしてマトリクス上に配置します。配置は保存できます。',
    targetTab: 'matrix',
  },
  {
    title: '作業記録を振り返ろう',
    description: '日々の作業ログ・タスク作成・完了・削除が時系列で確認できます。',
    action: '下のボタンを押して作業記録ページに移動してみてください。',
    hint: '📊で統計テーブル、📈で作業時間のグラフも見られます。期間フィルターで絞り込みも可能です。',
    targetTab: 'activity',
  },
  {
    title: '設定をカスタマイズしよう',
    description: 'ダークモード、フォントサイズ、フォント種類などを好みに合わせて変更できます。',
    action: '下のボタンを押して設定ページに移動してみてください。',
    hint: '執事のプロンプトや文字数も設定で変更できます。',
    targetTab: 'settings',
  },
];

/** 機能一覧の定義 */
interface FeatureSection {
  title: string;
  items: string[];
}

const FEATURE_SECTIONS: FeatureSection[] = [
  {
    title: 'はじめに — タスクを作ってみよう',
    items: [
      '画面の上にあるフォームに、やりたいことを入力して「追加」を押すだけでタスクが作れます',
      '例えば「レポートを書く」「買い物リストを作る」など、何でもOK。まずは1つ試してみてください',
      '予定時間や締切は後からいつでも変えられるので、最初はタスク名だけで大丈夫です',
    ],
  },
  {
    title: 'タスクを終わらせる・編集する',
    items: [
      'タスクが終わったら、カードの左にあるチェックボックスをポチッと押すと「完了」になります',
      '間違えて完了にしてしまっても、もう一度押せば元に戻せるので安心です',
      'タスク名や期限を変えたいときは、変えたい部分をダブルクリックするとその場で書き換えられます。ホバーすると青い点線が出て「ここは編集できる」と分かります',
      'たまったタスクを片付けたいときは「完了を消去」ボタンでまとめて消せます。消したタスクは「削除したタスク」ページから復元もできます（最大100件）',
    ],
  },
  {
    title: 'タスクを整理する — ドラッグと移動ボタン',
    items: [
      'カード左の ⠿ マーク（ドラッグハンドル）をつかんでドラッグすると、並べ替えや階層化ができます',
      'カードの上1/3にドロップすると前に移動（緑の線）、中央にドロップすると子タスクに（青い枠）、下1/3にドロップすると後ろに移動です',
      'ドラッグが難しければ、カードをクリックして展開すると「▲上 ▼下 ▶階層化 ◀階層戻す」のボタンでも同じ操作ができます',
      '凡例の右にある ☰ ≡ ⊞ のボタンで、詳細・コンパクト・グリッドの3つの表示モードを切り替えられます',
    ],
  },
  {
    title: '集中して作業する — ポモドーロタイマー',
    items: [
      'タスクカードをクリックして展開すると「🍅 ポモドーロ開始」ボタンがあります',
      '押すと25分のタイマーが全画面で始まります。25分作業したら5分休憩、のリズムで集中できます',
      'タイマーが終わるとアラーム音が鳴り、作業した時間がそのタスクの実績に自動で加算されます',
    ],
  },
  {
    title: 'タスクセット — テンプレートで効率化',
    items: [
      'タスクページの上にある「タスクセット」タブで、よく使うタスクのテンプレートを登録できます',
      'セット名を入力して「作成」→ タスクを追加していきます。セット内のタスクも階層化・並べ替え・編集ができます',
      '「タスクに追加」ボタンで、セット内のタスクをワンクリックでまとめてタスクページに追加できます',
      '「みんなのセット」タブで他の人が公開しているセットを閲覧・インポートできます。いいね機能もあります',
      '「エクスポート」でJSONファイルとして保存、「インポート」でJSONファイルから読み込みもできます',
    ],
  },
  {
    title: '繰り返しタスク — 自動でタスクを生成',
    items: [
      'タスク追加時に繰り返し設定（毎日・毎週・毎月など）を選ぶと、その日になったら自動でタスクが作成されます',
      'カスタム設定では「2週ごとの月・水・金」「毎月15日」「第2水曜日」のような細かい指定もできます',
      'タスクページの「繰り返し」タブで、繰り返し設定のあるタスクを一覧で確認・変更・解除できます',
      'その日初めてログインすると、完了タスクは自動でアーカイブされ、繰り返しタスクは自動で追加されます',
    ],
  },
  {
    title: '日記をつける',
    items: [
      '日記ページの「書く」タブで、その日の出来事を記録できます。太字や画像も入れられるリッチエディタです',
      '「履歴」タブで過去の日記を検索・期間絞り込みで振り返れます',
      '日記を「公開」にすると「みんなの日記」に表示され、他のユーザーからいいねやリプライがもらえます',
      '同じ日に2回書くと、既存の日記に追記されます（メッセージで通知されます）',
    ],
  },
  {
    title: '優先順位をつける — アイゼンハワーマトリクス',
    items: [
      'メニューの「アイゼンハワーマトリクス」を開くと、「緊急か？」「重要か？」の2軸のマトリクスが表示されます',
      '画面上部にあるタスクのチップを、マトリクス上の好きな場所にドラッグして配置します',
      '右上に置けば「緊急で重要」、左下なら「緊急でも重要でもない」。視覚的にやるべきことが見えてきます',
      '「保存」で配置を記録でき、保存名はダブルクリックで変更できます。複数パターンを保存可能です',
    ],
  },
  {
    title: '振り返る — 作業記録',
    items: [
      '作業記録ページで、作業ログ・タスク作成・完了・削除が日付ごとに一覧で確認できます',
      '種別フィルター（作業ログ/新規/完了/削除）と期間フィルターで絞り込めます',
      '📊 で日別の統計テーブル、📈 で作業時間の折れ線グラフが見られます',
      '📐 でパレート分析ができます。全タスクの中で上位20%がどれだけの作業時間を占めているかを可視化し、重要なタスクに集中する判断に役立ちます',
    ],
  },
  {
    title: 'もっと便利に使うヒント',
    items: [
      '右下にいる執事（🎩）をクリックするとメッセージが更新されます。ドラッグで移動、吹き出しの「−」で吹き出しだけ閉じ、「×」で完全に非表示にできます',
      '「マイページ」で名前・アイコン・パスワードの変更ができます',
      '「設定」でダークモード・フォントサイズ・フォント種類を変更できます',
      '削除したタスクは「削除したタスク」ページに最大100件アーカイブされ、「復元する」ボタンで戻せます',
      '不具合を見つけたら「バグ報告」から報告してください。管理者から返信が届きます',
    ],
  },
];

/**
 * ヘルプページ
 * 機能一覧とハンズオンチュートリアルを提供する
 */
export default function HelpPanel({ onNavigate }: { onNavigate: (tab: string, hint?: string, targetSelector?: string, stepIndex?: number) => void }): React.ReactElement {
  const [mode, setMode] = useState<'overview' | 'tutorial'>('overview');
  const [stepIndex, setStepIndex] = useState<number>(0);

  const currentStep: TutorialStep = TUTORIAL_STEPS[stepIndex];
  const progress: number = Math.round(((stepIndex + 1) / TUTORIAL_STEPS.length) * 100);

  return (
    <div className={styles.helpPanel}>
      {/* モード切替 */}
      <div className={styles.helpModeBar}>
        <button
          type="button"
          className={`${styles.viewModeBtn} ${mode === 'overview' ? styles.viewModeBtnActive : ''}`}
          onClick={() => setMode('overview')}
        >
          機能一覧
        </button>
        <button
          type="button"
          className={`${styles.viewModeBtn} ${mode === 'tutorial' ? styles.viewModeBtnActive : ''}`}
          onClick={() => { setMode('tutorial'); setStepIndex(0); }}
        >
          ハンズオン
        </button>
      </div>

      {/* 機能一覧モード */}
      {mode === 'overview' && (
        <div className={styles.helpOverview}>
          {FEATURE_SECTIONS.map((section: FeatureSection) => (
            <div key={section.title} className={styles.helpSection}>
              <h3 className={styles.helpSectionTitle}>{section.title}</h3>
              <ul className={styles.helpFeatureList}>
                {section.items.map((item: string, i: number) => (
                  <li key={i} className={styles.helpFeatureItem}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* ハンズオンチュートリアルモード */}
      {mode === 'tutorial' && (
        <div className={styles.helpTutorial}>
          {/* プログレスバー */}
          <div className={styles.helpProgressBar}>
            <div
              className={styles.helpProgressFill}
              style={{ width: progress + '%' }}
            />
          </div>
          <p className={styles.helpProgressText}>
            ステップ {stepIndex + 1} / {TUTORIAL_STEPS.length}
          </p>

          {/* ステップカード */}
          <div className={styles.helpStepCard}>
            <div className={styles.helpStepNumber}>
              {stepIndex + 1}
            </div>
            <h3 className={styles.helpStepTitle}>{currentStep.title}</h3>
            <p className={styles.helpStepDescription}>{currentStep.description}</p>

            <div className={styles.helpStepAction}>
              <span className={styles.helpStepActionLabel}>やってみよう</span>
              <p className={styles.helpStepActionText}>{currentStep.action}</p>
              {currentStep.targetTab && (
                <button
                  type="button"
                  className={styles.helpGoBtn}
                  onClick={() => onNavigate(
                    currentStep.targetTab!,
                    `${currentStep.action}`,
                    currentStep.targetSelector,
                    stepIndex,
                  )}
                >
                  そのページへ移動する →
                </button>
              )}
            </div>

            <div className={styles.helpStepHint}>
              <span className={styles.helpStepHintLabel}>ヒント</span>
              <p className={styles.helpStepHintText}>{currentStep.hint}</p>
            </div>
          </div>

          {/* ナビゲーション */}
          <div className={styles.helpStepNav}>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
              disabled={stepIndex === 0}
            >
              ← 前へ
            </button>
            <div className={styles.helpStepDots}>
              {TUTORIAL_STEPS.map((_: TutorialStep, i: number) => (
                <button
                  key={i}
                  type="button"
                  className={`${styles.helpStepDot} ${i === stepIndex ? styles.helpStepDotActive : ''} ${i < stepIndex ? styles.helpStepDotDone : ''}`}
                  onClick={() => setStepIndex(i)}
                  title={TUTORIAL_STEPS[i].title}
                />
              ))}
            </div>
            {stepIndex < TUTORIAL_STEPS.length - 1 ? (
              <button
                type="button"
                className={styles.primaryBtn}
                style={{ fontSize: '13px', padding: '6px 14px' }}
                onClick={() => setStepIndex((prev) => prev + 1)}
              >
                次へ →
              </button>
            ) : (
              <button
                type="button"
                className={styles.primaryBtn}
                style={{ fontSize: '13px', padding: '6px 14px' }}
                onClick={() => setMode('overview')}
              >
                完了!
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
