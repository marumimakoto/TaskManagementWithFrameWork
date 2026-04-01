'use client';

import { useRef, useState } from 'react';
import styles from './page.module.css';

/** チュートリアルのステップ定義 */
export interface TutorialStep {
  title: string;
  description: string;
  action: string;
  hint: string;
  targetTab?: string;
  targetSelector?: string;
  triggerAction?: string;
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
    description: '凡例の右にある4つのボタンで、表示形式を切り替えられます。',
    action: '☰（詳細）、≡（コンパクト）、⊞（グリッド）、☰☰（カンバン）のボタンを試してみてください。',
    hint: 'コンパクト表示はタスクが多いときに見やすく、カンバンはステータス別に整理できます。',
    targetTab: 'tasks',
    targetSelector: '[data-tutorial="view-mode-buttons"]',
    triggerAction: 'changeViewMode',
    successMessage: '表示が切り替わりましたね！',
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
    description: 'タスクに集中するためのタイマーが内蔵されています。',
    action: 'タスクカードをクリックして展開し、「🍅 ポモドーロ開始」ボタンを押してみてください。',
    hint: '終了すると、作業時間が自動でそのタスクの実績と作業ログに加算されます。',
    targetTab: 'tasks',
    targetSelector: '[data-tutorial="task-list"]',
  },
  {
    title: '日記を書いてみよう',
    description: 'ハンバーガーメニューから「日記を書く」を選ぶと、日記機能が使えます。',
    action: '下のボタンを押して「日記を書く」ページに移動し、何か書いてみてください。',
    hint: '日記は太字や画像も入れられるリッチテキストエディタです。',
    targetTab: 'diary-write',
  },
  {
    title: '作業記録を振り返ろう',
    description: '日々の作業ログ・完了が時系列で確認できます。',
    action: '下のボタンを押して作業記録ページに移動してみてください。',
    hint: '📊で統計、📈でグラフ、📐でパレート分析ができます。',
    targetTab: 'activity',
  },
  {
    title: '設定をカスタマイズしよう',
    description: 'ダークモード、フォントサイズ、タイムゾーンなどを変更できます。',
    action: '下のボタンを押して設定ページに移動してみてください。',
    hint: '執事のプロンプトやポモドーロの作業/休憩時間も設定で変更できます。',
    targetTab: 'settings',
  },
];

/** ヘルプの章構成 */
interface HelpChapter {
  id: string;
  title: string;
  sections: { id: string; title: string; content: string[] }[];
}

const HELP_CHAPTERS: HelpChapter[] = [
  {
    id: 'home',
    title: 'ホーム画面（タスク管理）',
    sections: [
      {
        id: 'home-add',
        title: 'タスクを追加する',
        content: [
          '画面上部のフォームにタスク名を入力して「追加」を押します。',
          '予定時間・締切・カテゴリ・繰り返し設定は追加時に指定できますが、後から変更も可能です。',
          'カテゴリはpillボタンで選択します。タスクの分類に使い、作業記録のフィルターにも反映されます。',
        ],
      },
      {
        id: 'home-done',
        title: '完了・未完了の切り替え',
        content: [
          'カード左のチェックボックスをクリックすると完了/未完了が切り替わります。',
          '完了したタスクは緑色になり、リストの下に移動します。もう一度クリックで戻せます。',
          '「完了を消去」ボタンで完了タスクをまとめてアーカイブできます（「削除したタスク」から復元可能）。',
        ],
      },
      {
        id: 'home-edit',
        title: 'インライン編集',
        content: [
          'タスクカードをクリックすると展開されます。',
          '展開中にタイトル・詳細・予定時間・実績・期限をダブルクリックすると、その場で編集できます。',
          'Enterで確定、Escでキャンセルです。',
        ],
      },
      {
        id: 'home-actual',
        title: '実績時間の記録',
        content: [
          'カード右側の「+分」欄に数字を入力して実績ボタンを押すと、作業時間が加算されます。',
          '日付を指定して過去の実績を入力することもできます。',
          '記録は作業ログにも自動で追加され、作業記録ページのグラフに反映されます。',
        ],
      },
      {
        id: 'home-drag',
        title: 'ドラッグ&ドロップ（並べ替え・階層化）',
        content: [
          'カード左の ⠿ マーク（ドラッグハンドル）をつかんでドラッグします。',
          'カードの間にドロップ → その位置に移動（緑の線が目印）。',
          'カードの上にドロップ → 子タスクに（青い枠が目印）。',
          'スマホでは長押し（500ms）でドラッグモードに入り、左右スワイプで階層操作ができます。',
          'ドラッグが難しい場合は、展開時の「▲ ▼ ▶ ◀」ボタンでも同じ操作ができます。',
        ],
      },
      {
        id: 'home-view',
        title: '表示モード',
        content: [
          '☰ 詳細 — 全情報を表示するデフォルトモード。',
          '≡ コンパクト — タスク名と期限だけのシンプル表示。タスクが多い時に便利。',
          '⊞ グリッド — 画面を広く使える2列表示（PC版のみ）。',
          '☰☰ カンバン — 未着手/着手済み/完了の3列ボード（PC版のみ）。',
        ],
      },
      {
        id: 'home-sort',
        title: 'ソート・フィルター',
        content: [
          'ソートは「手動順」「作成日 新→古」「作成日 古→新」「期限 近→遠」「期限 遠→近」から選べます。',
          '手動順以外でドラッグ移動すると、自動的に手動順に切り替わります。',
          '凡例（未着手/着手済み/完了）をクリックするとステータスでフィルターできます。',
          'カテゴリボタンでカテゴリフィルターもできます。',
        ],
      },
      {
        id: 'home-color',
        title: 'カードの色',
        content: [
          '赤（未着手）— 今日まだ作業していないタスク。',
          '青（着手済み）— 今日作業実績を記録したタスク。',
          '緑（完了）— チェックボックスで完了にしたタスク。',
          '期限が過ぎているタスクは、期限の日付が赤字で表示されます。',
          '日次リフレッシュ（毎日）で全タスクの着手状態がリセットされ、赤に戻ります。',
        ],
      },
    ],
  },
  {
    id: 'today',
    title: '今日やること',
    sections: [
      {
        id: 'today-select',
        title: 'タスクを選ぶ',
        content: [
          '未完了タスクの中から今日やるものを「＋」ボタンで選択します。',
          '選択したタスクは上部に表示され、予定合計・本日実績・残り時間がリアルタイムで更新されます。',
          '選択状態はページ移動やリロードしても保持されます。',
        ],
      },
    ],
  },
  {
    id: 'calendar',
    title: 'カレンダー',
    sections: [
      {
        id: 'calendar-view',
        title: '月間カレンダー',
        content: [
          '期限のあるタスクが月間カレンダーに表示されます。',
          '日付をクリックすると、その日が期限のタスク一覧が表示されます。',
          '「繰り返しタスクを表示」チェックボックスで、繰り返しルールの将来の期限も表示できます（デフォルトOFF）。',
        ],
      },
    ],
  },
  {
    id: 'pomodoro',
    title: 'ポモドーロタイマー',
    sections: [
      {
        id: 'pomodoro-use',
        title: '使い方',
        content: [
          'タスクカードを展開して「🍅 ポモドーロ開始」を押すと、全画面タイマーが起動します。',
          '作業時間（デフォルト25分）が終わるとアラームが鳴り続けます。',
          '「アラーム停止 → 休憩へ」で休憩フェーズ（デフォルト5分）に入ります。',
          '休憩が終わってもアラームが鳴り、「アラーム停止 → 作業へ」で次の作業に戻れます。',
          '「終了して戻る」を押すと、作業フェーズの経過時間だけが実績と作業ログに自動加算されます（休憩時間は含まれません）。',
          '作業時間・休憩時間は設定ページで変更できます。',
        ],
      },
    ],
  },
  {
    id: 'recurring',
    title: '繰り返しタスク',
    sections: [
      {
        id: 'recurring-setup',
        title: '設定方法',
        content: [
          'タスク追加時に繰り返し設定を選びます（毎日/毎週平日/毎週X曜/毎月/毎年/カスタム）。',
          'カスタム設定では「2週ごとの月・水・金」「毎月15日」「第2水曜日」なども指定できます。',
          '既存タスクの繰り返し設定は、カード展開時の繰り返しプルダウンから変更できます。',
        ],
      },
      {
        id: 'recurring-manage',
        title: '管理画面',
        content: [
          '「繰り返し」タブでルール一覧・達成率・累計時間の3つのビューがあります。',
          'ルール一覧ではカテゴリの変更、繰り返し頻度の変更、ルールの解除ができます。',
          '「今日追加」ボタンで手動でタスクを即座に追加することもできます。',
        ],
      },
      {
        id: 'recurring-daily',
        title: '日次リフレッシュ',
        content: [
          '毎日のログイン時（またはCronジョブ）に自動で以下が実行されます：',
          '1. 繰り返しルールに基づき、該当日のタスクを自動生成（同名の未完了タスクがあればスキップ）。',
          '2. 完了タスクをアーカイブに移動して削除。',
          '3. 未完了タスクの着手状態をリセット（実績時間は累計なのでリセットされません）。',
        ],
      },
    ],
  },
  {
    id: 'tasksets',
    title: 'タスクセット',
    sections: [
      {
        id: 'tasksets-create',
        title: '作成と管理',
        content: [
          'セット名を入力して「作成」→ タスクを追加していきます。',
          'セット内のタスクも階層化・並べ替え・編集ができます。',
          '「タスクに追加」ボタンで、セット内のタスクをまとめてホーム画面に追加できます。',
        ],
      },
      {
        id: 'tasksets-public',
        title: 'みんなのセット',
        content: [
          '「みんなのセット」タブで他の人が公開しているセットを閲覧・インポートできます。',
          'いいね機能もあります。自分のセットを公開するにはセットの公開設定をONにします。',
        ],
      },
    ],
  },
  {
    id: 'activity',
    title: '作業記録',
    sections: [
      {
        id: 'activity-list',
        title: '一覧モード（☰）',
        content: [
          '作業ログと完了記録が日付降順で表示されます。',
          '種別フィルター（作業ログ/完了）とカテゴリフィルターで絞り込みできます。',
          '期間フィルターで特定の日付範囲に絞ることもできます。',
        ],
      },
      {
        id: 'activity-stats',
        title: '統計モード（📊）',
        content: [
          '日別の作業ログ数・完了数・作業時間をテーブルで確認できます。',
          '最下部に合計行が表示されます。',
        ],
      },
      {
        id: 'activity-chart',
        title: 'グラフモード（📈）',
        content: [
          '棒グラフ — カテゴリ別の累計作業時間。',
          '折れ線 — 日別の作業時間推移。カテゴリ別のフィルターもできます。',
          'データソースは作業ログ（work_logs）なので、日次リフレッシュの影響を受けません。',
        ],
      },
      {
        id: 'activity-pareto',
        title: 'パレート分析（📐）',
        content: [
          '全タスクの中で上位20%がどれだけの作業時間を占めているかを可視化します。',
          '重要なタスクに集中する判断に役立ちます（プロ版機能）。',
        ],
      },
      {
        id: 'activity-export',
        title: 'エクスポート',
        content: [
          '各モードで「エクスポート（TXT）」ボタンからタブ区切りテキストをダウンロードできます。',
          'モードごとにヘッダーとデータ内容が異なります。',
        ],
      },
    ],
  },
  {
    id: 'diary',
    title: '日記',
    sections: [
      {
        id: 'diary-write',
        title: '日記を書く',
        content: [
          'リッチテキストエディタで太字・箇条書き・画像などを含む日記が書けます。',
          '同じ日に2回書くと、既存の日記に追記されます。',
          '「公開」にチェックを入れると「みんなの日記」に表示されます。',
        ],
      },
      {
        id: 'diary-view',
        title: '日記を見る',
        content: [
          '過去の日記を日付降順で一覧表示します。検索や期間フィルターで絞り込みできます。',
        ],
      },
    ],
  },
  {
    id: 'matrix',
    title: 'アイゼンハワーマトリクス',
    sections: [
      {
        id: 'matrix-use',
        title: '使い方',
        content: [
          '緊急度×重要度の2軸でタスクを視覚的に整理できます（プロ版機能）。',
          '画面上部のタスクチップをマトリクス上にドラッグして配置します。',
          '「保存」で配置を記録でき、複数パターンを保存可能です。',
        ],
      },
    ],
  },
  {
    id: 'settings',
    title: '設定',
    sections: [
      {
        id: 'settings-display',
        title: '表示設定',
        content: [
          'ダークモードのON/OFF、文字の大きさ（小/中/大）、フォント種類を変更できます。',
          '変更は即座に反映され、自動保存されます。',
        ],
      },
      {
        id: 'settings-butler',
        title: '執事キャラクター',
        content: [
          '右下の執事（🎩）の表示ON/OFF、アイコン画像の変更、励ましの指示、吹き出し最大文字数を設定できます。',
        ],
      },
      {
        id: 'settings-pomodoro',
        title: 'ポモドーロタイマー',
        content: [
          '作業時間（5〜60分）と休憩時間（1〜30分）をスライダーで調整できます。',
        ],
      },
      {
        id: 'settings-welcome',
        title: 'Welcomeメッセージ',
        content: [
          'ログイン時に表示されるメッセージのトーン（豆知識/美容/マインドセット/生産性/歴史）を選べます。',
        ],
      },
      {
        id: 'settings-timezone',
        title: 'タイムゾーン',
        content: [
          '日付の基準タイムゾーンを設定できます。日次リフレッシュや作業ログの日付に影響します。',
          'デフォルトは日本時間（JST）です。',
        ],
      },
    ],
  },
  {
    id: 'other',
    title: 'その他の機能',
    sections: [
      {
        id: 'other-bucket',
        title: 'やりたいことリスト',
        content: [
          '人生でやりたいことを「やりたいことリスト」ページで管理できます。',
          'カテゴリ分け、達成チェック、共有リンクの発行ができます。',
        ],
      },
      {
        id: 'other-archive',
        title: '削除したタスク',
        content: [
          '削除・完了消去したタスクは最大100件アーカイブされます。',
          '「復元する」ボタンでホーム画面に戻せます。',
        ],
      },
      {
        id: 'other-mypage',
        title: 'マイページ',
        content: [
          '名前・アイコン・パスワードの変更ができます。',
        ],
      },
      {
        id: 'other-bug',
        title: 'バグ報告',
        content: [
          '不具合を見つけたら「バグ報告」から報告してください。管理者から返信が届きます。',
        ],
      },
    ],
  },
];

/**
 * ヘルプページ
 * 目次付きの機能ガイド + ハンズオンチュートリアル
 */
export default function HelpPanel({ onNavigate }: { onNavigate: (tab: string, hint?: string, targetSelector?: string, stepIndex?: number) => void }): React.ReactElement {
  const [mode, setMode] = useState<'overview' | 'tutorial'>('overview');
  const [stepIndex, setStepIndex] = useState<number>(0);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const currentStep: TutorialStep = TUTORIAL_STEPS[stepIndex];
  const progress: number = Math.round(((stepIndex + 1) / TUTORIAL_STEPS.length) * 100);

  function scrollToSection(sectionId: string): void {
    const el: HTMLElement | null = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  return (
    <div className={styles.helpPanel}>
      {/* モード切替 */}
      <div className={styles.helpModeBar}>
        <button
          type="button"
          className={`${styles.viewModeBtn} ${mode === 'overview' ? styles.viewModeBtnActive : ''}`}
          onClick={() => setMode('overview')}
        >
          ヘルプガイド
        </button>
        <button
          type="button"
          className={`${styles.viewModeBtn} ${mode === 'tutorial' ? styles.viewModeBtnActive : ''}`}
          onClick={() => { setMode('tutorial'); setStepIndex(0); }}
        >
          ハンズオン
        </button>
      </div>

      {/* ヘルプガイドモード */}
      {mode === 'overview' && (
        <div className={styles.helpOverview} ref={contentRef}>
          {/* 目次 */}
          <div style={{ padding: '16px 20px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>目次</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              {HELP_CHAPTERS.map((chapter: HelpChapter) => (
                <div key={chapter.id}>
                  <button
                    type="button"
                    onClick={() => scrollToSection(chapter.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#3b82f6', padding: 0, textAlign: 'left' }}
                  >
                    {chapter.title}
                  </button>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2, paddingLeft: 12 }}>
                    {chapter.sections.map((sec) => (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => scrollToSection(sec.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--muted)', padding: '1px 0', textAlign: 'left' }}
                      >
                        {sec.title}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 各章 */}
          {HELP_CHAPTERS.map((chapter: HelpChapter) => (
            <div key={chapter.id} id={chapter.id} style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, borderBottom: '2px solid #3b82f6', paddingBottom: 6, marginBottom: 16 }}>
                {chapter.title}
              </h2>
              {chapter.sections.map((sec) => (
                <div key={sec.id} id={sec.id} className={styles.helpSection} style={{ marginBottom: 16 }}>
                  <h3 className={styles.helpSectionTitle} style={{ fontSize: 15, fontWeight: 600 }}>{sec.title}</h3>
                  <ul className={styles.helpFeatureList}>
                    {sec.content.map((item: string, i: number) => (
                      <li key={i} className={styles.helpFeatureItem}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
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
