'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppUser, Todo, Recurrence, UndoToast, UserSettings, WorkLog } from './types';
import { DEFAULT_SETTINGS } from './types';
import {
  log,
  uid,
  minutesToText,
  parseDeadline,
  toInputDeadline,
  formatDeadline,
  cardBgClass,
  loadSession,
  saveSession,
  clearSession,
} from './utils';
import styles from './page.module.css';
import DiaryWritePanel from './DiaryWritePanel';
import DiaryViewPanel from './DiaryViewPanel';
import PublicDiaryPanel from './PublicDiaryPanel';
import MyPage from './MyPage';
import SettingsPanel from './SettingsPanel';
import TaskSetPanel from './TaskSetPanel';
import ButlerAvatar from './ButlerAvatar';
import PomodoroTimer from './PomodoroTimer';
import MatrixPanel from './MatrixPanel';
import ActivityPanel from './ActivityPanel';
import ArchivedTodosPanel from './ArchivedTodosPanel';
import RecurringPanel from './RecurringPanel';
import { DragHandle, MoveButtonBar, DeleteButton } from './SharedComponents';
import HelpPanel, { TUTORIAL_STEPS } from './HelpPanel';
import BugReportPanel from './BugReportPanel';
import AdminPanel from './AdminPanel';
import { useIsMobile } from './useIsMobile';

/**
 * ページのルートコンポーネント
 * ログイン状態を管理し、未ログインならログイン/登録画面、ログイン済みならTodoAppを表示する
 */
/** Welcomeページで表示する執事のメッセージ一覧 */
const WELCOME_MESSAGES: string[] = [
  '朝に太陽光を浴びると体内時計が整う。5分でも外に出ると、集中力が上がりやすい',
  'やる気は行動の後に出る。脳は動いた後に「やる気」を作る仕組みになっている',
  '人は最初の3分を乗り越えると作業が続きやすい。まず3分だけやると決める',
  '朝に水を一杯飲むと代謝が上がる。寝起きのぼんやりも改善しやすい',
  'タスクは細かく分けるほど着手しやすい。「5分でできる形」にすると進む',
  '目標を書くと達成率が上がる。言語化で脳が優先度を認識するため',
  '姿勢を正すだけで集中力は上がる。脳への血流が改善されるから',
  '前日にやることを1つ決めると迷わない。朝の意思決定を減らせる',
  '軽い運動はストレスを減らす。10分の散歩でも気分がリセットされる',
  'スマホ通知を減らすと集中力が回復する。注意の分断を防げる',
  'タコの心臓は3つある。うち2つはエラに血を送るための専用ポンプとして働く',
  'バナナは果物ではなく草の一種。木に見えるが、実は巨大な草本植物である',
  '人間の体内には約37兆個の細胞がある。日々入れ替わりながら生命を維持する',
  '雷の温度は太陽の表面より高い。瞬間的に約3万度にも達するとされる',
  'ペンギンは寒さに強いが暑さに弱い。種類によっては温暖な地域にも生息する',
  'シャチはイルカの仲間。見た目はクジラに近いが、分類上はイルカ科に属する',
  '蜂蜜は腐らない食品として知られる。水分が少なく、菌が繁殖しにくい',
  'エベレストは毎年数ミリずつ高くなる。プレートの動きで少しずつ隆起する',
  '人は寝ている間にコップ一杯分の汗をかく。体温調整のため無意識に行われる',
  '宇宙では音は伝わらない。空気がないため、振動を伝える媒体が存在しない',
  'クジラは意識的に呼吸する。眠っても完全に眠らず、片脳ずつ休ませる',
  '人間の脳は約60％が脂肪でできている。体の中でも特に脂質の多い器官',
  'カメレオンは背景に合わせて色を変えるだけでなく、感情でも色が変わる',
  'サメには骨がない。体はすべて軟骨でできており、軽くてしなやかに動ける',
  '北極と南極では気温が大きく違う。南極の方がはるかに寒い環境である',
  '人は1日に約2万回呼吸する。意識しなくても体は常に働き続けている',
  '鉛筆の芯は鉛ではない。黒鉛と粘土を混ぜたものが使われている',
  '蝶は足で味を感じる。花に止まると同時に味を確認している',
  '富士山は今も活火山である。最後の噴火は1707年の宝永噴火',
  '水は4度のとき最も重くなる。この性質が湖の生態系を守っている',
  '人の血管をすべてつなぐと約10万kmになる。地球を2周以上できる長さ',
  'キリンの首の骨は7個。人間と同じ数だが、一つ一つが非常に長い',
  '月は毎年少しずつ地球から遠ざかる。年間で約3.8センチ離れている',
  'ゴリラは風邪をひくことがある。人間と似たウイルスに感染するため',
  '砂糖はもともと薬として使われていた。昔は非常に高価で貴重な存在',
  'タツノオトシゴはオスが出産する。メスから卵を受け取り体内で育てる',
  '人は夢を一晩に何度も見る。覚えていないだけで複数回経験している',
  '火星の夕焼けは青い。大気中の塵の影響で地球とは逆の色になる',
  'カラスは非常に知能が高い。道具を使ったり、人の顔を覚えたりできる',
  '人間は海水を飲めないが、魚は飲んでいる。体内で塩分を排出する仕組みがある',
  '朝に最優先タスクを1つ終えると、その日全体の達成感が高まりやすい',
  '集中力は25分が目安。短く区切ると疲れにくく、作業効率も維持できる',
  '作業前に机を整えると、注意散漫を防げる。環境は思考に直結する',
  '「やらないこと」を決めると、重要な作業に時間を使いやすくなる',
  '同じ時間に起きると生活リズムが安定する。休日も大きく崩さない',
  'タスクは紙に書くと記憶に残る。視覚化で抜け漏れも防ぎやすい',
  '小さく始めると継続しやすい。ハードルを下げるのが習慣化のコツ',
  'こまめな休憩は集中力を回復させる。長時間の連続作業は逆効果',
  '決断の回数を減らすと疲れにくい。服や昼食を固定化するのも有効',
  '一日の終わりに振り返ると改善が進む。次にやることも明確になる',
  '玉ねぎは繊維に沿って切ると食感が残る。逆に切ると甘みが出やすい',
  '肉は焼く30分前に常温に戻すと、火が均一に通りやすくなる',
  'パスタは塩をしっかり入れると味が締まる。海水程度が目安',
  '野菜は切ってから洗わない。栄養や旨味が水に流れやすくなる',
  '卵は常温の方がきれいに焼ける。冷たいままだと焼きムラが出やすい',
  'フライパンは十分に熱してから油を入れると、食材がくっつきにくい',
  '味見は途中で何度もする。最後だけだと調整が難しくなる',
  '魚は焼く前に水分を拭くと臭みが減り、皮もパリッと仕上がる',
  '煮物は一度冷ますと味が染みる。温度が下がるときに吸収が進む',
  'にんにくは焦がすと苦くなる。弱火で香りを出すのがポイント',
];

export default function Page(): React.ReactElement {
  const [user, setUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [showWelcome, setShowWelcome] = useState<boolean>(false);
  const [welcomeFading, setWelcomeFading] = useState<boolean>(false);
  const [welcomeMessage, setWelcomeMessage] = useState<string>('');

  // SSR時にはlocalStorageにアクセスできないので、useEffectでクライアント側のみセッションを復元する
  const welcomeTriggeredRef = useRef<boolean>(false);

  useEffect(() => {
    const saved: AppUser | null = loadSession();
    if (saved) {
      setUser(saved);
      if (!welcomeTriggeredRef.current) {
        welcomeTriggeredRef.current = true;
        const msg: string = WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
        setWelcomeMessage(msg);
        setShowWelcome(true);
        setTimeout(() => setWelcomeFading(true), 2000);
        setTimeout(() => { setShowWelcome(false); setWelcomeFading(false); }, 2800);
      }
    }
    setAuthLoading(false);
  }, []);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [authError, setAuthError] = useState('');

  /** メールアドレスとパスワードでAPIにログインリクエストを送る */
  async function handleLogin(): Promise<void> {
    setAuthError('');
    try {
      const res: Response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data: { user?: AppUser; error?: string } = await res.json();
      if (!res.ok || !data.user) {
        setAuthError(data.error ?? 'ログインに失敗しました');
        return;
      }
      saveSession(data.user);
      setUser(data.user);
      triggerWelcome();
      log('login', { userId: data.user.id });
    } catch {
      setAuthError('サーバーに接続できませんでした');
    }
  }

  /** Welcome画面を表示してタイマーで自動フェードアウトする */
  function triggerWelcome(): void {
    const msg: string = WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
    setWelcomeMessage(msg);
    setShowWelcome(true);
    setWelcomeFading(false);
    setTimeout(() => {
      setWelcomeFading(true);
    }, 2000);
    setTimeout(() => {
      setShowWelcome(false);
      setWelcomeFading(false);
    }, 2800);
  }

  /** 名前・メールアドレス・パスワードでAPIに登録リクエストを送る */
  async function handleRegister(): Promise<void> {
    setAuthError('');
    try {
      const res: Response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: registerName, email: registerEmail, password: registerPassword }),
      });
      const data: { user?: AppUser; error?: string } = await res.json();
      if (!res.ok || !data.user) {
        setAuthError(data.error ?? '登録に失敗しました');
        return;
      }
      saveSession(data.user);
      setUser(data.user);
      triggerWelcome();
      log('register', { userId: data.user.id });
    } catch {
      setAuthError('サーバーに接続できませんでした');
    }
  }

  /** セッションを削除してログアウトする */
  function handleLogout(): void {
    clearSession();
    setUser(null);
    log('logout');
  }

  /** ログイン/登録モードを切り替え、エラーをリセットする */
  function switchAuthMode(): void {
    setAuthMode(authMode === 'login' ? 'register' : 'login');
    setAuthError('');
  }

  if (authLoading) {
    return (
      <div className={styles.loginWrapper}>
        <p>読み込み中...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.loginWrapper}>
        <div className={styles.loginCard}>
          <h1 className={styles.loginTitle}>Daily ToDo</h1>

          {authMode === 'login' ? (
            <div className={styles.loginForm}>
              <input
                type="email"
                placeholder="メールアドレス"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className={styles.input}
              />
              <input
                type="password"
                placeholder="パスワード"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className={styles.input}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleLogin();
                  }
                }}
              />
              {authError && <p className={styles.loginError}>{authError}</p>}
              <button type="button" onClick={handleLogin} className={styles.primaryBtn}>
                ログイン
              </button>
            </div>
          ) : (
            <div className={styles.loginForm}>
              <input
                type="text"
                placeholder="名前"
                value={registerName}
                onChange={(e) => setRegisterName(e.target.value)}
                className={styles.input}
              />
              <input
                type="email"
                placeholder="メールアドレス"
                value={registerEmail}
                onChange={(e) => setRegisterEmail(e.target.value)}
                className={styles.input}
              />
              <input
                type="password"
                placeholder="パスワード（6文字以上）"
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
                className={styles.input}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleRegister();
                  }
                }}
              />
              {authError && <p className={styles.loginError}>{authError}</p>}
              <button type="button" onClick={handleRegister} className={styles.primaryBtn}>
                登録
              </button>
            </div>
          )}

          <p className={styles.loginHint}>
            <button type="button" onClick={switchAuthMode} className={styles.linkBtn}>
              {authMode === 'login' ? 'アカウントを作成する' : 'ログインに戻る'}
            </button>
          </p>
        </div>
      </div>
    );
  }

  if (showWelcome) {
    return (
      <div className={`${styles.welcomeOverlay} ${welcomeFading ? styles.welcomeFadeOut : ''}`}>
        <div className={styles.welcomeContent}>
          <p className={styles.welcomeDate}>
            {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </p>
          <div className={styles.welcomeAvatar}>🎩</div>
          <p className={styles.welcomeMessage}>{welcomeMessage}</p>
        </div>
      </div>
    );
  }

  return <TodoApp user={user} onLogout={handleLogout} onUserUpdate={(updated: AppUser) => setUser(updated)} />;
}

/**
 * ログイン後に表示されるToDoアプリ本体
 * タスクの一覧表示・追加・編集・削除・完了切り替えを行う
 * @param user - ログイン中のユーザー情報
 * @param onLogout - ログアウト時のコールバック
 */
/** 曜日のキーと日本語名のマッピング */
const DAY_KEYS: string[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_NAMES: string[] = ['日', '月', '火', '水', '木', '金', '土'];

function TodoApp({ user, onLogout, onUserUpdate }: { user: AppUser; onLogout: () => void; onUserUpdate: (updated: AppUser) => void }): React.ReactElement {
  const isMobile: boolean = useIsMobile();
  const [showMobileAddForm, setShowMobileAddForm] = useState<boolean>(false);

  /** 今日の曜日に基づいた繰り返し選択肢 */
  const todayDayIndex: number = new Date().getDay();
  const todayDayKey: string = DAY_KEYS[todayDayIndex];
  const todayDayName: string = DAY_NAMES[todayDayIndex];
  const [activeTab, setActiveTab] = useState<'tasks' | 'task-sets' | 'matrix' | 'activity' | 'archived' | 'recurring' | 'diary-write' | 'diary-view' | 'diary-public' | 'mypage' | 'settings' | 'help' | 'bug-report' | 'admin'>('tasks');
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [diaryMenuOpen, setDiaryMenuOpen] = useState<boolean>(false);
  const [taskMenuOpen, setTaskMenuOpen] = useState<boolean>(false);
  const [tutorialHint, setTutorialHint] = useState<string | null>(null);
  const [tutorialTarget, setTutorialTarget] = useState<string | null>(null);
  const [tutorialPos, setTutorialPos] = useState<{ top: number; left: number } | null>(null);
  const [tutorialStepIndex, setTutorialStepIndex] = useState<number | null>(null);

  // プロ版の状態管理
  const [isPro, setIsPro] = useState<boolean>(false);
  const [showProModal, setShowProModal] = useState<boolean>(false);
  const [proPurchasing, setProPurchasing] = useState<boolean>(false);

  /** プロ版の状態を取得 */
  useEffect(() => {
    async function checkPro(): Promise<void> {
      try {
        const res: Response = await fetch('/api/purchase?userId=' + user.id);
        const data = await res.json();
        setIsPro(data.isPro === true);
      } catch {
        setIsPro(false);
      }
    }
    checkPro();
  }, [user.id]);

  /** 決済成功後のコールバック処理 */
  useEffect(() => {
    const params: URLSearchParams = new URLSearchParams(window.location.search);
    const purchaseStatus: string | null = params.get('purchase');
    const sessionId: string | null = params.get('session_id');
    if (purchaseStatus === 'success' && sessionId) {
      // Stripeの決済完了を確認してDBに記録
      fetch('/api/purchase/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, userId: user.id }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.isPro) {
            setIsPro(true);
          }
        })
        .catch(() => {});
      // URLからクエリパラメータを除去
      window.history.replaceState({}, '', '/');
    }
  }, [user.id]);

  /** プロ機能のタブ一覧 */
  const PRO_TABS: Set<string> = new Set(['matrix', 'diary-public']);

  /**
   * タブを切り替える。プロ機能の場合は購入チェック
   */
  function switchTab(tab: typeof activeTab): void {
    if (PRO_TABS.has(tab) && !isPro) {
      setShowProModal(true);
      return;
    }
    setActiveTab(tab);
    setMenuOpen(false);
  }

  /**
   * プロ版購入フローを開始する
   */
  async function startPurchase(): Promise<void> {
    setProPurchasing(true);
    try {
      const res: Response = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || '購入処理に失敗しました');
      }
    } catch {
      alert('購入処理に失敗しました');
    } finally {
      setProPurchasing(false);
    }
  }

  /**
   * チュートリアルのアクションが発生したときに呼ぶ
   * 現在のステップのtriggerActionと一致すれば、成功メッセージを表示して次のステップに進む
   */
  function notifyTutorialAction(action: string): void {
    if (tutorialStepIndex === null || !tutorialHint) {
      return;
    }
    const step = TUTORIAL_STEPS[tutorialStepIndex];
    if (!step || step.triggerAction !== action) {
      return;
    }
    // 成功メッセージを表示
    const successMsg: string = step.successMessage ?? '完了しました！';
    setTutorialHint(successMsg);
    setTutorialTarget(null);
    setTutorialPos(null);

    // 2秒後に次のステップへ
    const nextIndex: number = tutorialStepIndex + 1;
    if (nextIndex < TUTORIAL_STEPS.length) {
      setTimeout(() => {
        const nextStep = TUTORIAL_STEPS[nextIndex];
        setTutorialStepIndex(nextIndex);
        setTutorialHint(nextStep.action);
        if (nextStep.targetTab && nextStep.targetTab !== activeTab) {
          setActiveTab(nextStep.targetTab as typeof activeTab);
        }
        // DOM描画待ちして位置計算
        setTimeout(() => {
          if (nextStep.targetSelector) {
            const el: Element | null = document.querySelector(nextStep.targetSelector);
            if (el) {
              const rect: DOMRect = el.getBoundingClientRect();
              setTutorialPos({
                top: rect.bottom + window.scrollY + 8,
                left: Math.max(16, Math.min(window.innerWidth - 340, rect.left + window.scrollX)),
              });
              setTutorialTarget(nextStep.targetSelector);
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
        }, 300);
      }, 2000);
    } else {
      // 全ステップ完了
      setTimeout(() => {
        setTutorialHint('全ステップ完了です！お疲れさまでした。');
        setTimeout(() => {
          setTutorialHint(null);
          setTutorialPos(null);
          setTutorialTarget(null);
          setTutorialStepIndex(null);
        }, 3000);
      }, 2000);
    }
  }
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [undoToasts, setUndoToasts] = useState<UndoToast[]>([]);
  const deleteOnceRef = useRef<Record<string, number>>({});

  /** APIからログインユーザーのタスク一覧を取得してstateに反映する */
  const fetchTodos = useCallback(async (): Promise<void> => {
    try {
      const url: string = '/api/todos?userId=' + user.id;
      log('fetch:start', { url });
      const res: Response = await fetch(url);
      log('fetch:status', { status: res.status });
      const data: Todo[] = await res.json();
      log('fetch:data', { count: data.length, sample: data.slice(0, 2).map((t) => t.title) });
      // sortOrderに重複がある場合は連番で振り直してDBにも反映
      const orders: number[] = data.map((t) => t.sortOrder);
      const hasDuplicates: boolean = new Set(orders).size < orders.length;
      if (hasDuplicates && data.length > 0) {
        const initialized: Todo[] = data.map((t, i) => ({ ...t, sortOrder: i * 10 }));
        setTodos(initialized);
        // DBにも反映（バックグラウンド）
        for (const t of initialized) {
          fetch('/api/todos/' + t.id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates: { sortOrder: t.sortOrder } }),
          });
        }
      } else {
        setTodos(data);
      }
      log('fetch:ok', { count: data.length });
    } catch (e) {
      console.warn('Failed to fetch todos', e);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    /** 初回表示時に日次リフレッシュを実行してからタスクを取得する */
    async function initTodos(): Promise<void> {
      try {
        const refreshRes: Response = await fetch('/api/todos/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        });
        const refreshData: { refreshed: boolean; archivedCount?: number; addedCount?: number } = await refreshRes.json();
        if (refreshData.refreshed) {
          log('refresh', { archived: refreshData.archivedCount, added: refreshData.addedCount });
        }
      } catch (e) {
        console.warn('Failed to refresh todos', e);
      }
      fetchTodos();
    }
    initTodos();
  }, [fetchTodos, user.id]);

  /** APIからユーザーの表示設定を取得する */
  useEffect(() => {
    fetch('/api/settings?userId=' + user.id)
      .then((res) => res.json())
      .then((data: UserSettings) => setSettings(data))
      .catch(() => {});
  }, [user.id]);

  /** 設定をCSS変数としてdocumentに適用する */
  useEffect(() => {
    const root: HTMLElement = document.documentElement;
    root.style.setProperty('--app-font-size', settings.fontSize + 'px');
    root.style.setProperty('--app-font-family', settings.fontFamily);
    if (settings.darkMode) {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }
  }, [settings]);

  /**
   * Undoトーストを表示する。同じtodoIdのトーストがあれば差し替える
   * 3秒後に自動的に消える
   * @param toast - 表示するトーストのデータ
   */
  function showUndoToast(toast: UndoToast): void {
    setUndoToasts((prev) => {
      const filtered = prev.filter((t) => t.todoId !== toast.todoId);
      return [toast, ...filtered];
    });
    window.setTimeout(() => {
      setUndoToasts((prev) => prev.filter((t) => t.toastId !== toast.toastId));
    }, 3000);
  }

  const [actualInputs, setActualInputs] = useState<Record<string, string>>({});
  const [actualDateInputs, setActualDateInputs] = useState<Record<string, string>>({});

  // Add form
  const [title, setTitle] = useState('');
  const [detailText, setDetailText] = useState('');
  const [estText, setEstText] = useState('30');
  const [mode, setMode] = useState<Recurrence>('carry');
  const [customInterval, setCustomInterval] = useState<string>('1');
  const [customUnit, setCustomUnit] = useState<string>('week');
  const [customWeekDays, setCustomWeekDays] = useState<string[]>(['mon']);
  const [customMonthMode, setCustomMonthMode] = useState<'date' | 'weekday'>('date');
  const [customMonthDay, setCustomMonthDay] = useState<string>('1');
  const [customMonthNth, setCustomMonthNth] = useState<string>('1');
  const [customMonthNthDay, setCustomMonthNthDay] = useState<string>('mon');
  /** 直前のカスタム繰り返し設定文字列（プリセットに切り替えた後に戻すため） */
  const lastCustomRecurrenceRef = useRef<string>('');
  const [deadlineText, setDeadlineText] = useState('');

  // 表示モード
  const [viewMode, setViewMode] = useState<'detail' | 'compact' | 'grid'>('detail');

  // カード展開
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // カード展開を検知してチュートリアルに通知
  const prevExpandedRef = useRef<string | null>(null);
  useEffect(() => {
    if (expandedId && !prevExpandedRef.current) {
      notifyTutorialAction('expandCard');
    }
    prevExpandedRef.current = expandedId;
  });

  // 作業ログ
  const [workLogs, setWorkLogs] = useState<Record<string, WorkLog[]>>({});
  const [logInput, setLogInput] = useState<string>('');
  const [showLogId, setShowLogId] = useState<string | null>(null);

  // Inline edit（フィールド単位で編集）
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'title' | 'detail' | 'est' | 'actual' | 'deadline' | 'recurrence' | null>(null);
  const [editValue, setEditValue] = useState('');

  // ドラッグ&ドロップ
  const [dragId, setDragId] = useState<string | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const [pomodoroTodo, setPomodoroTodo] = useState<Todo | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverMode, setDragOverMode] = useState<'child' | 'between' | null>(null);
  const [dropBetweenIndex, setDropBetweenIndex] = useState<number | null>(null);

  const sorted: Todo[] = useMemo((): Todo[] => {
    const copied: Todo[] = [...todos];
    const s: Todo[] = copied.sort((a: Todo, b: Todo): number => {
      const aIsRoot: boolean = !a.parentId;
      const bIsRoot: boolean = !b.parentId;

      // ルートタスク同士の場合、カード色の順で並べる
      // リスク(cardDanger)=0 → 進行中(cardInProgress)=1 → 完了(cardDone)=2
      if (aIsRoot && bIsRoot) {
        const colorOrder: Record<string, number> = {
          cardDanger: 0,
          cardInProgress: 1,
          cardDone: 2,
        };
        const aOrder: number = colorOrder[cardBgClass(a)] ?? 1;
        const bOrder: number = colorOrder[cardBgClass(b)] ?? 1;
        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }
      }
      // 同カテゴリ内はsortOrderの小さい方が上
      return a.sortOrder - b.sortOrder;
    });
    log('sort', { count: s.length });
    return s;
  }, [todos]);

  /** 凡例用：各カテゴリのタスク件数 */
  const legendCounts: { danger: number; inProgress: number; done: number } = useMemo((): { danger: number; inProgress: number; done: number } => {
    let danger: number = 0;
    let inProgress: number = 0;
    let done: number = 0;
    for (const t of todos) {
      const bg: 'cardDone' | 'cardDanger' | 'cardInProgress' = cardBgClass(t);
      if (bg === 'cardDanger') {
        danger++;
      } else if (bg === 'cardInProgress') {
        inProgress++;
      } else {
        done++;
      }
    }
    return { danger, inProgress, done };
  }, [todos]);

  /**
   * ソート済みタスクを階層構造のフラットリストに変換する
   * 親タスクの直後に子タスクがインデント付きで並ぶ
   */
  /**
   * ソート済みタスクからフラットリスト（todo + depth）を直接構築する
   * 親が存在しないタスクはルート（depth=0）として扱う
   */
  const treeList: { todo: Todo; depth: number }[] = useMemo((): { todo: Todo; depth: number }[] => {
    // 全IDセット
    const allIds: Set<string> = new Set(sorted.map((t) => t.id));

    // 親→子のマッピングを構築
    const childrenMap: Record<string, Todo[]> = {};
    for (const t of sorted) {
      const hasValidParent: boolean = Boolean(t.parentId) && allIds.has(t.parentId!);
      const parentKey: string = hasValidParent ? t.parentId! : '__root__';
      if (!childrenMap[parentKey]) {
        childrenMap[parentKey] = [];
      }
      childrenMap[parentKey].push(t);
    }

    // 再帰的にフラットリストを構築（循環参照を検出して断ち切る）
    const result: { todo: Todo; depth: number }[] = [];
    const visited: Set<string> = new Set();
    function walk(parentId: string, depth: number): void {
      const children: Todo[] = childrenMap[parentId] ?? [];
      for (const child of children) {
        if (visited.has(child.id)) {
          continue;
        }
        visited.add(child.id);
        result.push({ todo: child, depth });
        walk(child.id, depth + 1);
      }
    }
    walk('__root__', 0);

    // ルートから辿れなかったタスクをルートとして追加（循環参照の断ち切り）
    for (const t of sorted) {
      if (!visited.has(t.id)) {
        visited.add(t.id);
        result.push({ todo: t, depth: 0 });
        walk(t.id, 1);
      }
    }

    log('treeList', {
      total: result.length,
      todosCount: todos.length,
      sortedCount: sorted.length,
      rootCount: (childrenMap['__root__'] ?? []).length,
    });

    return result;
  }, [sorted, todos.length]);

  /** キーボードで選択タスクを操作する（↑↓=移動、→=階層深く、←=階層浅く、Esc=選択解除） */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (!selectedId || activeTab !== 'tasks') {
        return;
      }
      const tag: string = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveTodo(selectedId, 'up');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveTodo(selectedId, 'down');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const idx: number = treeList.findIndex((item) => item.todo.id === selectedId);
        if (idx > 0) {
          const prevTodo: Todo = treeList[idx - 1].todo;
          const currentTodo: Todo | undefined = todos.find((t) => t.id === selectedId);
          if (currentTodo && (currentTodo.parentId ?? null) === (prevTodo.parentId ?? null)) {
            changeParent(selectedId, prevTodo.id);
          }
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const currentTodo: Todo | undefined = todos.find((t) => t.id === selectedId);
        if (currentTodo && currentTodo.parentId) {
          const parentTodo: Todo | undefined = todos.find((t) => t.id === currentTodo.parentId);
          changeParent(selectedId, parentTodo?.parentId ?? null);
        }
      } else if (e.key === 'Escape') {
        setSelectedId(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, activeTab, treeList, todos]);

  /**
   * ドラッグしたタスクをドロップ先タスクの子として設定する
   * @param childId - ドラッグ中のタスクID
   * @param newParentId - ドロップ先のタスクID（ルートに戻す場合はnull）
   */
  async function changeParent(childId: string, newParentId: string | null): Promise<void> {
    // 自分自身を親にはできない
    if (childId === newParentId) {
      return;
    }
    // 循環参照チェック：newParentIdがchildIdの子孫であればキャンセル
    if (newParentId) {
      const descendants: string[] = getDescendantIds(childId, todos);
      if (descendants.includes(newParentId)) {
        return;
      }
    }
    // 元の親を保存（Undo用）
    const oldTodo: Todo | undefined = todos.find((t) => t.id === childId);
    const oldParentId: string | null = oldTodo?.parentId ?? null;

    setTodos((prev) =>
      prev.map((t) => (t.id === childId ? { ...t, parentId: newParentId ?? undefined } : t)),
    );
    log('changeParent', { childId, newParentId });

    const res: Response = await fetch('/api/todos/' + childId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: { parentId: newParentId } }),
    });

    if (!res.ok) {
      // API失敗時はロールバック
      setTodos((prev) =>
        prev.map((t) => (t.id === childId ? { ...t, parentId: oldParentId ?? undefined } : t)),
      );
      return;
    }

    // Undoトースト（3秒で自動消滅）
    const taskName: string = oldTodo?.title ?? '';
    const toastId: string = 'move-' + Date.now();
    const undoAction = async (): Promise<void> => {
      setTodos((prev) =>
        prev.map((t) => (t.id === childId ? { ...t, parentId: oldParentId ?? undefined } : t)),
      );
      await fetch('/api/todos/' + childId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: { parentId: oldParentId } }),
      });
    };
    setUndoToasts((prev) => [
      ...prev,
      { toastId, todoId: childId, message: `「${taskName}」の階層を変更しました`, undo: undoAction },
    ]);
    setTimeout(() => {
      setUndoToasts((prev) => prev.filter((t) => t.toastId !== toastId));
    }, 3000);
  }

  /**
   * treeList内でタスクを上下に移動する
   * 同じ親を持つ兄弟間でsortOrderを入れ替える
   * @param todoId - 移動するタスクのID
   * @param direction - 'up' で上に、'down' で下に
   */
  async function moveTodo(todoId: string, direction: 'up' | 'down'): Promise<void> {
    const target: Todo | undefined = todos.find((t) => t.id === todoId);
    if (!target) {
      return;
    }

    // 同じ親を持つ兄弟をsortOrder順で取得
    const siblings: Todo[] = sorted.filter((t) => (t.parentId ?? undefined) === (target.parentId ?? undefined));
    const idx: number = siblings.findIndex((t) => t.id === todoId);
    if (idx === -1) {
      return;
    }

    const swapIdx: number = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) {
      return;
    }

    const swapTarget: Todo = siblings[swapIdx];
    const newOrder: number = swapTarget.sortOrder;
    const swapOrder: number = target.sortOrder;

    // 同じsortOrderの場合は差をつける
    const orderA: number = newOrder === swapOrder && direction === 'up' ? swapOrder - 1 : newOrder;
    const orderB: number = newOrder === swapOrder && direction === 'down' ? swapOrder + 1 : swapOrder;

    setTodos((prev) =>
      prev.map((t) => {
        if (t.id === todoId) {
          return { ...t, sortOrder: orderA };
        }
        if (t.id === swapTarget.id) {
          return { ...t, sortOrder: orderB };
        }
        return t;
      }),
    );

    await Promise.all([
      fetch('/api/todos/' + todoId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: { sortOrder: orderA } }),
      }),
      fetch('/api/todos/' + swapTarget.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: { sortOrder: orderB } }),
      }),
    ]);

    log('moveTodo', { todoId, direction });
  }

  /**
   * 入力フォームの内容から新しいタスクを作成し、画面とDBに追加する
   * タイトルが空の場合は追加しない。締切の形式が不正ならアラートを出す
   */
  async function addTodo(): Promise<void> {
    const t: string = title.trim();
    const est: number = Math.max(1, parseInt(estText || '0', 10));
    if (!t) {
      log('addTodo:blocked', { reason: 'empty title' });
      return;
    }

    const d: number | undefined = parseDeadline(deadlineText);
    if (deadlineText.trim() && d === undefined) {
      alert('締切は「YYYY-MM-DD」形式。例: 2026-02-11');
      log('addTodo:blocked', { reason: 'deadline parse failed', deadlineText });
      return;
    }

    const det: string | undefined = detailText.trim() || undefined;

    // カスタム繰り返しの場合、詳細を文字列にエンコードする
    let finalRecurrence: string = mode;
    if (mode === 'custom') {
      if (customUnit === 'day') {
        finalRecurrence = `custom:${customInterval}:day`;
      } else if (customUnit === 'week') {
        finalRecurrence = `custom:${customInterval}:week:${customWeekDays.join(',')}`;
      } else if (customUnit === 'month') {
        if (customMonthMode === 'date') {
          finalRecurrence = `custom:${customInterval}:month:date:${customMonthDay}`;
        } else {
          finalRecurrence = `custom:${customInterval}:month:nth:${customMonthNth}:${customMonthNthDay}`;
        }
      } else if (customUnit === 'year') {
        finalRecurrence = `custom:${customInterval}:year`;
      }
    }

    // 新しいタスクは最小sortOrder - 1 で先頭に追加
    const minOrder: number = todos.length > 0 ? Math.min(...todos.map((t) => t.sortOrder)) : 0;
    const todo: Todo = {
      id: uid(),
      title: t,
      detail: det,
      estMin: est,
      actualMin: 0,
      stuckHours: 0,
      lastWorkedAt: undefined,
      deadline: d,
      recurrence: finalRecurrence,
      started: false,
      done: false,
      sortOrder: minOrder - 1,
    };

    setTodos((prev) => [todo, ...prev]);
    log('addTodo:ok', todo);
    notifyTutorialAction('addTodo');

    setTitle('');
    setDetailText('');
    setEstText('30');
    setDeadlineText('');
    setMode('carry');

    await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, todo }),
    });
  }

  /**
   * 指定タスクに実績時間を加算し、作業日時を更新する
   * 日付が指定されていればその日の23:59:59を、未指定なら現在時刻を使う
   * @param id - 対象タスクのID
   */
  async function addLog(id: string): Promise<void> {
    const text: string = actualInputs[id] ?? '0';
    const addMin: number = Math.max(0, parseInt(text || '0', 10));
    if (addMin <= 0) {
      log('addLog:blocked', { id });
      return;
    }

    const target: Todo | undefined = todos.find((t) => t.id === id);
    if (!target) {
      return;
    }

    // 日付入力があればその日の23:59:59、なければ現在時刻
    const dateStr: string = actualDateInputs[id] ?? '';
    let workedAt: number;
    if (dateStr) {
      const parts: string[] = dateStr.split('-');
      const d: Date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 23, 59, 59);
      workedAt = d.getTime();
    } else {
      workedAt = Date.now();
    }

    const newActual: number = target.actualMin + addMin;

    setTodos((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, actualMin: newActual, lastWorkedAt: workedAt }
          : t,
      ),
    );
    setActualInputs((prev) => ({ ...prev, [id]: '' }));
    setActualDateInputs((prev) => ({ ...prev, [id]: '' }));
    log('addLog:ok', { id, addMin, dateStr });

    await fetch('/api/todos/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: { actualMin: newActual, lastWorkedAt: workedAt } }),
    });
  }

  /**
   * 指定タスクの全子孫IDを再帰的に取得する
   * @param parentId - 親タスクのID
   * @param allTodos - 全タスク配列
   * @returns 子孫タスクのID配列
   */
  function getDescendantIds(parentId: string, allTodos: Todo[]): string[] {
    const children: Todo[] = allTodos.filter((t) => t.parentId === parentId);
    const ids: string[] = [];
    for (const child of children) {
      ids.push(child.id);
      ids.push(...getDescendantIds(child.id, allTodos));
    }
    return ids;
  }

  /**
   * タスクの完了/未完了を切り替える
   * 親タスク完了時は子も全て完了にする。親を未完了に戻したら子も全て未完了に戻す
   * 子タスクの切り替えは親に影響しない
   * @param id - 対象タスクのID
   */
  async function toggleDone(id: string): Promise<void> {
    const target: Todo | undefined = todos.find((t) => t.id === id);
    if (!target) {
      return;
    }

    const wasDone: boolean = target.done;
    const newDone: boolean = !wasDone;
    const now: number = Date.now();

    // 子孫タスクのIDを取得
    const descendantIds: string[] = getDescendantIds(id, todos);
    // 変更対象のID一覧（自分 + 子孫）
    const affectedIds: Set<string> = new Set([id, ...descendantIds]);

    // 元の状態を保存（Undo用）
    const originalStates: Record<string, { done: boolean; lastWorkedAt?: number }> = {};
    for (const t of todos) {
      if (affectedIds.has(t.id)) {
        originalStates[t.id] = { done: t.done, lastWorkedAt: t.lastWorkedAt };
      }
    }

    setTodos((prev) =>
      prev.map((t) => {
        if (affectedIds.has(t.id)) {
          return { ...t, done: newDone, lastWorkedAt: now };
        }
        return t;
      }),
    );

    const affectedCount: number = affectedIds.size;
    const message: string = wasDone
      ? `「${target.title}」を未完了に戻しました` + (affectedCount > 1 ? `（子タスク${affectedCount - 1}件も）` : '')
      : `「${target.title}」を完了にしました` + (affectedCount > 1 ? `（子タスク${affectedCount - 1}件も）` : '');

    showUndoToast({
      toastId: uid(),
      todoId: id,
      message,
      undoLabel: '取り消す',
      undo: () => {
        setTodos((cur) =>
          cur.map((t) => {
            if (originalStates[t.id]) {
              return { ...t, done: originalStates[t.id].done, lastWorkedAt: originalStates[t.id].lastWorkedAt };
            }
            return t;
          }),
        );
        setUndoToasts((prev) => prev.filter((t) => t.todoId !== id));
        // 全てのaffectedを元に戻すAPIコール
        for (const affId of affectedIds) {
          fetch('/api/todos/' + affId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates: { done: originalStates[affId].done, lastWorkedAt: originalStates[affId].lastWorkedAt } }),
          });
        }
      },
    });

    log('toggleDone', { id, affectedCount });
    notifyTutorialAction('toggleDone');

    // 全てのaffectedをAPIで更新
    const updatePromises: Promise<Response>[] = Array.from(affectedIds).map((affId) =>
      fetch('/api/todos/' + affId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: { done: newDone, lastWorkedAt: now } }),
      }),
    );
    await Promise.all(updatePromises);
  }

  /**
   * タスクを削除し、Undoトーストを表示する
   * 300ms以内の連続クリックを無視するデバウンス付き
   * @param id - 削除対象タスクのID
   */
  async function removeTodoWithUndo(id: string): Promise<void> {
    const now: number = Date.now();
    const last: number = deleteOnceRef.current[id] ?? 0;
    if (now - last < 300) {
      log('removeTodoWithUndo:blocked', { id });
      return;
    }
    deleteOnceRef.current[id] = now;

    const idx: number = todos.findIndex((t) => t.id === id);
    if (idx === -1) {
      return;
    }

    const removed: Todo = todos[idx];
    setTodos((prev) => prev.filter((t) => t.id !== id));

    const toastId: string = uid();
    showUndoToast({
      toastId,
      todoId: id,
      message: `「${removed.title}」を削除しました`,
      undoLabel: '取り消す',
      undo: () => {
        setTodos((cur) => {
          if (cur.some((t) => t.id === removed.id)) {
            return cur;
          }
          const restored = [...cur];
          restored.splice(Math.min(idx, restored.length), 0, removed);
          return restored;
        });
        setUndoToasts((prev) => prev.filter((t) => t.toastId !== toastId));
        fetch('/api/todos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, todo: removed }),
        });
      },
    });

    log('removeTodoWithUndo', { id });

    await fetch('/api/todos/' + id, {
      method: 'DELETE',
    });
  }

  /**
   * 完了済みタスクを全て削除する
   */
  async function removeAllDone(): Promise<void> {
    const doneTodos: Todo[] = todos.filter((t) => t.done);
    if (doneTodos.length === 0) {
      return;
    }
    if (!window.confirm(`完了済み${doneTodos.length}件を全て削除しますか？`)) {
      return;
    }
    setTodos((prev) => prev.filter((t) => !t.done));
    for (const t of doneTodos) {
      await fetch('/api/todos/' + t.id, { method: 'DELETE' });
    }
    log('removeAllDone', { count: doneTodos.length });
  }

  /**
   * 全タスクを削除する
   */
  async function removeAllTodos(): Promise<void> {
    if (todos.length === 0) {
      return;
    }
    if (!window.confirm(`全${todos.length}件のタスクを削除しますか？この操作は取り消せません。\n（削除したタスクはアーカイブに保存されます）`)) {
      return;
    }
    const allTodos: Todo[] = [...todos];
    setTodos([]);
    for (const t of allTodos) {
      await fetch('/api/todos/' + t.id, { method: 'DELETE' });
    }
    log('removeAllTodos', { count: allTodos.length });
  }

  /** sortOrderの更新をAPIに送信し、失敗時はロールバック */
  function persistSortOrders(updates: { id: string; sortOrder: number }[], rollback: Todo[]): void {
    Promise.all(
      updates.map((u) =>
        fetch('/api/todos/' + u.id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: { sortOrder: u.sortOrder } }),
        })
      )
    ).then((results) => {
      const failed: boolean = results.some((r) => !r.ok);
      if (failed) {
        setTodos(rollback);
        log('sortOrder:rollback', { reason: 'API failed' });
      }
    }).catch(() => {
      setTodos(rollback);
      log('sortOrder:rollback', { reason: 'network error' });
    });
  }

  /**
   * タスクを1つ上に移動する（同じ階層内で前のタスクと入れ替え）
   */
  function moveUp(todoId: string): void {
    setTodos((prev) => {
      const list: Todo[] = [...prev].sort((a, b) => a.sortOrder - b.sortOrder);
      const current: Todo | undefined = list.find((t) => t.id === todoId);
      if (!current) {
        return prev;
      }
      const siblings: Todo[] = list.filter((t) => (t.parentId ?? null) === (current.parentId ?? null));
      const sibIdx: number = siblings.findIndex((t) => t.id === todoId);
      if (sibIdx <= 0) {
        return prev;
      }
      const target: Todo = siblings[sibIdx - 1];
      let currentOrder: number = current.sortOrder;
      let targetOrder: number = target.sortOrder;
      if (currentOrder === targetOrder) {
        targetOrder = currentOrder - 1;
      }
      const diffCurrent: number = targetOrder - currentOrder;
      const diffTarget: number = currentOrder - targetOrder;
      const currentDescendants: Set<string> = new Set(getDescendantIds(current.id, prev));
      const targetDescendants: Set<string> = new Set(getDescendantIds(target.id, prev));
      const updates: { id: string; sortOrder: number }[] = [];
      const result: Todo[] = prev.map((todo) => {
        if (todo.id === current.id || currentDescendants.has(todo.id)) {
          const newOrder: number = todo.sortOrder + diffCurrent;
          updates.push({ id: todo.id, sortOrder: newOrder });
          return { ...todo, sortOrder: newOrder };
        }
        if (todo.id === target.id || targetDescendants.has(todo.id)) {
          const newOrder: number = todo.sortOrder + diffTarget;
          updates.push({ id: todo.id, sortOrder: newOrder });
          return { ...todo, sortOrder: newOrder };
        }
        return todo;
      });
      persistSortOrders(updates, prev);
      return result;
    });
  }

  /**
   * タスクを1つ下に移動する（同じ階層内で次のタスクと入れ替え）
   */
  function moveDown(todoId: string): void {
    setTodos((prev) => {
      const list: Todo[] = [...prev].sort((a, b) => a.sortOrder - b.sortOrder);
      const current: Todo | undefined = list.find((t) => t.id === todoId);
      if (!current) {
        return prev;
      }
      const siblings: Todo[] = list.filter((t) => (t.parentId ?? null) === (current.parentId ?? null));
      const sibIdx: number = siblings.findIndex((t) => t.id === todoId);
      if (sibIdx < 0 || sibIdx >= siblings.length - 1) {
        return prev;
      }
      const target: Todo = siblings[sibIdx + 1];
      let currentOrder: number = current.sortOrder;
      let targetOrder: number = target.sortOrder;
      if (currentOrder === targetOrder) {
        targetOrder = currentOrder + 1;
      }
      const diffCurrent: number = targetOrder - currentOrder;
      const diffTarget: number = currentOrder - targetOrder;
      const currentDescendants: Set<string> = new Set(getDescendantIds(current.id, prev));
      const targetDescendants: Set<string> = new Set(getDescendantIds(target.id, prev));
      const updates: { id: string; sortOrder: number }[] = [];
      const result: Todo[] = prev.map((todo) => {
        if (todo.id === current.id || currentDescendants.has(todo.id)) {
          const newOrder: number = todo.sortOrder + diffCurrent;
          updates.push({ id: todo.id, sortOrder: newOrder });
          return { ...todo, sortOrder: newOrder };
        }
        if (todo.id === target.id || targetDescendants.has(todo.id)) {
          const newOrder: number = todo.sortOrder + diffTarget;
          updates.push({ id: todo.id, sortOrder: newOrder });
          return { ...todo, sortOrder: newOrder };
        }
        return todo;
      });
      persistSortOrders(updates, prev);
      return result;
    });
  }

  /** タスクの階層の深さを計算する */
  function getDepth(todoId: string): number {
    let depth: number = 0;
    let current: Todo | undefined = todos.find((t) => t.id === todoId);
    while (current?.parentId) {
      depth++;
      current = todos.find((t) => t.id === current!.parentId);
    }
    return depth;
  }

  /** 階層の深さ制限 */
  const MAX_DEPTH: number = 5;

  /**
   * タスクを右に移動する（表示順で直前のタスクの子にする）
   * 最大5段まで
   */
  function moveRight(todoId: string): void {
    // 深さ制限チェック
    if (getDepth(todoId) >= MAX_DEPTH - 1) {
      return;
    }
    // treeList（表示順）で1つ上のタスクを探す
    const idx: number = treeList.findIndex((item) => item.todo.id === todoId);
    if (idx <= 0) {
      return;
    }
    const prevTodo: Todo = treeList[idx - 1].todo;
    // 自分の子孫を親にはできない
    const descendants: string[] = getDescendantIds(todoId, todos);
    if (descendants.includes(prevTodo.id)) {
      return;
    }
    changeParent(todoId, prevTodo.id);
  }

  /**
   * タスクを左に移動する（親の階層に戻す）
   */
  function moveLeft(todoId: string): void {
    const current: Todo | undefined = todos.find((t) => t.id === todoId);
    if (!current || !current.parentId) {
      return;
    }
    const parent: Todo | undefined = todos.find((t) => t.id === current.parentId);
    changeParent(todoId, parent?.parentId ?? null);
  }

  /**
   * タスクをGoogleカレンダーにイベントとして追加するURLを生成する
   * @param t - 対象タスク
   * @returns Googleカレンダーのイベント作成URL
   */
  function buildGoogleCalendarUrl(t: Todo): string {
    const title: string = encodeURIComponent(t.title);
    const details: string = encodeURIComponent(t.detail ?? '');
    // 開始時刻: 現在時刻、終了時刻: 予定時間分後
    const now: Date = new Date();
    const end: Date = new Date(now.getTime() + t.estMin * 60 * 1000);
    const pad = (n: number): string => String(n).padStart(2, '0');
    function toGoogleDate(d: Date): string {
      return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
    }
    const dates: string = `${toGoogleDate(now)}/${toGoogleDate(end)}`;
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${dates}`;
  }

  /** カスタム繰り返し文字列をパースしてstateに復元する */
  function restoreCustomRecurrence(rec: string): void {
    const parts: string[] = rec.split(':');
    setCustomInterval(parts[1] || '1');
    setCustomUnit(parts[2] || 'week');
    if (parts[2] === 'week' && parts[3]) {
      setCustomWeekDays(parts[3].split(','));
    }
    if (parts[2] === 'month') {
      if (parts[3] === 'date') {
        setCustomMonthMode('date');
        setCustomMonthDay(parts[4] || '1');
      } else if (parts[3] === 'nth') {
        setCustomMonthMode('weekday');
        setCustomMonthNth(parts[4] || '1');
        setCustomMonthNthDay(parts[5] || 'mon');
      }
    }
  }

  /**
   * タスク展開時の共通UIを描画する
   * detail/compact両モードから呼び出される
   */
  /** 繰り返し設定を日本語表示に変換する */
  function recurrenceLabel(rec: string): string {
    if (!rec || rec === 'carry') {
      return '繰り返しなし';
    }
    if (rec === 'day') {
      return '毎日';
    }
    if (rec === 'week:weekday') {
      return '毎週平日（月〜金）';
    }
    if (rec.startsWith('week:')) {
      const dayKey: string = rec.replace('week:', '');
      const idx: number = DAY_KEYS.indexOf(dayKey);
      if (idx >= 0) {
        return `毎週${DAY_NAMES[idx]}曜日`;
      }
      return `毎週（${dayKey}）`;
    }
    if (rec === 'month:same-date') {
      return '毎月同じ日';
    }
    if (rec === 'year') {
      return '毎年同じ日';
    }
    if (rec.startsWith('custom:')) {
      // custom:N:unit:details の形式を解読
      const parts: string[] = rec.split(':');
      const interval: string = parts[1] || '1';
      const unit: string = parts[2] || '';
      const unitLabel: Record<string, string> = { day: '日', week: '週', month: '月', year: '年' };
      const unitName: string = unitLabel[unit] || unit;
      let detail: string = `${interval}${unitName}ごと`;

      if (unit === 'week' && parts[3]) {
        const days: string[] = parts[3].split(',');
        const dayLabels: string = days.map((d) => {
          const idx: number = DAY_KEYS.indexOf(d);
          return idx >= 0 ? DAY_NAMES[idx] : d;
        }).join('・');
        detail += `（${dayLabels}曜日）`;
      } else if (unit === 'month') {
        if (parts[3] === 'date' && parts[4]) {
          detail += `（毎月${parts[4]}日）`;
        } else if (parts[3] === 'nth' && parts[4] && parts[5]) {
          const nthDay: number = DAY_KEYS.indexOf(parts[5]);
          const nthDayName: string = nthDay >= 0 ? DAY_NAMES[nthDay] : parts[5];
          detail += `（第${parts[4]}${nthDayName}曜日）`;
        }
      }

      return detail;
    }
    return rec;
  }

  function renderExpandedContent(t: Todo): React.ReactElement {
    return (
      <div className={styles.workLogArea} onClick={(e) => e.stopPropagation()}>
        {/* 繰り返し設定（常にプルダウン表示） */}
        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: '13px' }}>
          <span>🔁</span>
          <select
            value={t.recurrence.startsWith('custom:') ? 'custom' : t.recurrence}
            onChange={(e) => {
              const v: string = e.target.value;
              if (v === 'custom') {
                setEditingId(t.id);
                setEditingField('recurrence');
                setEditValue('custom');
                // 直前のカスタム設定 → 現在のタスクのカスタム → デフォルトの順で復元
                if (lastCustomRecurrenceRef.current) {
                  restoreCustomRecurrence(lastCustomRecurrenceRef.current);
                } else if (t.recurrence.startsWith('custom:')) {
                  restoreCustomRecurrence(t.recurrence);
                } else {
                  setCustomUnit('week');
                  setCustomInterval('1');
                  setCustomWeekDays(['mon']);
                }
              } else {
                // プリセット：即保存
                setTodos((prev) => prev.map((todo) => (todo.id === t.id ? { ...todo, recurrence: v } : todo)));
                fetch('/api/todos/' + t.id, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ updates: { recurrence: v } }),
                });
                // カスタム編集中だったら閉じる
                if (editingId === t.id && editingField === 'recurrence') {
                  setEditingId(null);
                  setEditingField(null);
                }
              }
            }}
            onClick={() => {
              // 既にカスタムが設定されている場合、クリックでカスタムUIを開く
              if (t.recurrence.startsWith('custom:') && editingField !== 'recurrence') {
                setEditingId(t.id);
                setEditingField('recurrence');
                setEditValue(t.recurrence);
                restoreCustomRecurrence(t.recurrence);
              }
            }}
            className={styles.input}
            style={{ fontSize: '13px', width: 'auto', minWidth: '140px', padding: '4px 8px' }}
          >
            <option value="carry">繰り返さない</option>
            <option value="day">毎日</option>
            <option value="week:weekday">毎週平日（月〜金）</option>
            <option value={`week:${todayDayKey}`}>毎週{todayDayName}曜日</option>
            <option value="month:same-date">毎月同じ日</option>
            <option value="year">毎年同じ日</option>
            <option value="custom">カスタム...</option>
          </select>
          {t.recurrence.startsWith('custom:') && editingField !== 'recurrence' && (
            <span style={{ color: 'var(--text-secondary, #666)' }}>{recurrenceLabel(t.recurrence)}</span>
          )}
        </div>
        {/* カスタム編集UI */}
        {editingId === t.id && editingField === 'recurrence' && (
          <div
            style={{ display: 'grid', gap: 6, marginBottom: 8, padding: 10, border: '1px solid var(--input-border)', borderRadius: 8, background: 'var(--background)' }}
            onBlur={(e) => {
              // フォーカスがこのdivの外に出たら自動保存
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                let built: string = 'carry';
                if (customUnit === 'day') { built = `custom:${customInterval}:day`; }
                else if (customUnit === 'week') { built = `custom:${customInterval}:week:${customWeekDays.join(',')}`; }
                else if (customUnit === 'month') {
                  if (customMonthMode === 'date') { built = `custom:${customInterval}:month:date:${customMonthDay}`; }
                  else { built = `custom:${customInterval}:month:nth:${customMonthNth}:${customMonthNthDay}`; }
                }
                else if (customUnit === 'year') { built = `custom:${customInterval}:year`; }
                lastCustomRecurrenceRef.current = built;
                setTodos((prev) => prev.map((todo) => (todo.id === t.id ? { ...todo, recurrence: built } : todo)));
                fetch('/api/todos/' + t.id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updates: { recurrence: built } }) });
                setEditingId(null);
                setEditingField(null);
              }
            }}
          >
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span>繰り返す間隔:</span>
              <input type="number" min="1" value={customInterval} onChange={(e) => setCustomInterval(e.target.value)} className={styles.inputNarrow} style={{ width: 50 }} />
              <select value={customUnit} onChange={(e) => setCustomUnit(e.target.value)} className={styles.input} style={{ width: 80 }}>
                <option value="day">日</option>
                <option value="week">週</option>
                <option value="month">月</option>
                <option value="year">年</option>
              </select>
              <span>ごと</span>
            </div>
            {customUnit === 'week' && (
              <div>
                <label className={styles.fieldLabel}>曜日</label>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {[
                    { key: 'mon', label: '月' }, { key: 'tue', label: '火' }, { key: 'wed', label: '水' },
                    { key: 'thu', label: '木' }, { key: 'fri', label: '金' }, { key: 'sat', label: '土' }, { key: 'sun', label: '日' },
                  ].map((d) => {
                    const selected: boolean = customWeekDays.includes(d.key);
                    return (
                      <button key={d.key} type="button" className={selected ? styles.primaryBtn : styles.iconBtn}
                        style={{ width: 36, height: 36, padding: 0, fontSize: 13, borderRadius: '50%' }}
                        onClick={() => {
                          if (selected) { if (customWeekDays.length > 1) { setCustomWeekDays(customWeekDays.filter((k) => k !== d.key)); } }
                          else { setCustomWeekDays([...customWeekDays, d.key]); }
                        }}
                      >{d.label}</button>
                    );
                  })}
                </div>
              </div>
            )}
            {customUnit === 'month' && (
              <div style={{ display: 'grid', gap: 8 }}>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                  <input type="radio" checked={customMonthMode === 'date'} onChange={() => setCustomMonthMode('date')} />
                  毎月
                  <input type="number" min="1" max="31" value={customMonthDay} onChange={(e) => setCustomMonthDay(e.target.value)} className={styles.inputNarrow} style={{ width: 50 }} />
                  日
                </label>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer', flexWrap: 'wrap' }}>
                  <input type="radio" checked={customMonthMode === 'weekday'} onChange={() => setCustomMonthMode('weekday')} />
                  第
                  <select value={customMonthNth} onChange={(e) => setCustomMonthNth(e.target.value)} className={styles.input} style={{ width: 55 }}>
                    <option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option>
                  </select>
                  <select value={customMonthNthDay} onChange={(e) => setCustomMonthNthDay(e.target.value)} className={styles.input} style={{ width: 90 }}>
                    <option value="mon">月曜日</option><option value="tue">火曜日</option><option value="wed">水曜日</option>
                    <option value="thu">木曜日</option><option value="fri">金曜日</option><option value="sat">土曜日</option><option value="sun">日曜日</option>
                  </select>
                </label>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4 }}>
              <button type="button" className={styles.primaryBtn} style={{ fontSize: '14px', padding: '6px 14px' }}
                onClick={() => {
                  let built: string = 'carry';
                  if (customUnit === 'day') { built = `custom:${customInterval}:day`; }
                  else if (customUnit === 'week') { built = `custom:${customInterval}:week:${customWeekDays.join(',')}`; }
                  else if (customUnit === 'month') {
                    if (customMonthMode === 'date') { built = `custom:${customInterval}:month:date:${customMonthDay}`; }
                    else { built = `custom:${customInterval}:month:nth:${customMonthNth}:${customMonthNthDay}`; }
                  }
                  else if (customUnit === 'year') { built = `custom:${customInterval}:year`; }
                  lastCustomRecurrenceRef.current = built;
                  setTodos((prev) => prev.map((todo) => (todo.id === t.id ? { ...todo, recurrence: built } : todo)));
                  fetch('/api/todos/' + t.id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updates: { recurrence: built } }) });
                  setEditingId(null);
                  setEditingField(null);
                }}
              >保存</button>
            </div>
          </div>
        )}

        {/* 移動操作ボタン */}
        <MoveButtonBar
          onUp={() => moveUp(t.id)}
          onDown={() => moveDown(t.id)}
          onNest={() => moveRight(t.id)}
          onUnnest={() => moveLeft(t.id)}
          hasParent={!!t.parentId}
        />

        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button
            type="button"
            className={styles.primaryBtn}
            style={{ fontSize: '13px', padding: '6px 14px' }}
            onClick={() => setPomodoroTodo(t)}
          >
            🍅 ポモドーロ開始
          </button>
          {t.parentId && (
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => changeParent(t.id, null)}
            >
              ↑ ルートに戻す
            </button>
          )}
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => setShowLogId(showLogId === t.id ? null : t.id)}
          >
            {showLogId === t.id ? '作業ログを閉じる' : 'これまでの作業ログを見る'}
          </button>
          <a
            href={buildGoogleCalendarUrl(t)}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.iconBtn}
            style={{ textDecoration: 'none', fontSize: '13px' }}
            title="Googleカレンダーに追加"
          >
            📅 カレンダーに追加
          </a>
        </div>
        <div className={styles.workLogInputRow}>
          <input
            type="date"
            value={actualDateInputs[t.id] ?? ''}
            onChange={(e) =>
              setActualDateInputs((prev) => ({ ...prev, [t.id]: e.target.value }))
            }
            className={styles.inputDate}
          />
          <input
            type="text"
            placeholder="やったことを記録..."
            value={logInput}
            onChange={(e) => setLogInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                addWorkLog(t.id);
              }
            }}
            className={styles.input}
          />
          <button
            type="button"
            onClick={() => addWorkLog(t.id)}
            className={styles.iconBtn}
          >
            記録
          </button>
        </div>
        {showLogId === t.id && (
          (workLogs[t.id] ?? []).length > 0 ? (
            <ul className={styles.workLogList}>
              {(workLogs[t.id] ?? []).map((wl: WorkLog) => (
                <li key={wl.id} className={styles.workLogItem}>
                  <span className={styles.workLogDate}>{wl.date}</span>
                  <span className={styles.workLogContent}>{wl.content}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.workLogEmpty}>作業記録はまだありません</p>
          )
        )}
      </div>
    );
  }

  /**
   * 指定フィールドのインライン編集を開始する
   * @param t - 編集対象のタスク
   * @param field - 編集するフィールド名
   */
  function startFieldEdit(t: Todo, field: 'title' | 'detail' | 'est' | 'actual' | 'deadline'): void {
    log('edit:start', { id: t.id, field });
    setEditingId(t.id);
    setEditingField(field);
    notifyTutorialAction('inlineEdit');
    if (field === 'title') {
      setEditValue(t.title);
    } else if (field === 'detail') {
      setEditValue(t.detail ?? '');
    } else if (field === 'est') {
      setEditValue(String(t.estMin));
    } else if (field === 'actual') {
      setEditValue(String(t.actualMin));
    } else if (field === 'deadline') {
      setEditValue(t.deadline ? toInputDeadline(t.deadline) : '');
    }
  }

  /** インライン編集をキャンセルする */
  function cancelFieldEdit(): void {
    log('edit:cancel', { id: editingId, field: editingField });
    setEditingId(null);
    setEditingField(null);
  }

  /**
   * 編集中のフィールドを保存し、画面とDBに反映する
   * @param id - 編集対象タスクのID
   */
  async function saveFieldEdit(id: string): Promise<void> {
    if (!editingField) {
      return;
    }

    const updates: Record<string, unknown> = {};

    if (editingField === 'title') {
      const trimmed: string = editValue.trim();
      if (!trimmed) {
        alert('タイトルは必須');
        return;
      }
      updates.title = trimmed;
      setTodos((prev) =>
        prev.map((todo) => (todo.id === id ? { ...todo, title: trimmed } : todo)),
      );
    } else if (editingField === 'detail') {
      const trimmed: string | undefined = editValue.trim() || undefined;
      updates.detail = trimmed ?? '';
      setTodos((prev) =>
        prev.map((todo) => (todo.id === id ? { ...todo, detail: trimmed } : todo)),
      );
    } else if (editingField === 'est') {
      const est: number = Math.max(1, parseInt(editValue || '0', 10));
      updates.estMin = est;
      setTodos((prev) =>
        prev.map((todo) => (todo.id === id ? { ...todo, estMin: est } : todo)),
      );
    } else if (editingField === 'actual') {
      const actual: number = Math.max(0, parseInt(editValue || '0', 10));
      updates.actualMin = actual;
      updates.lastWorkedAt = Date.now();
      setTodos((prev) =>
        prev.map((todo) => (todo.id === id ? { ...todo, actualMin: actual, lastWorkedAt: Date.now() } : todo)),
      );
    } else if (editingField === 'deadline') {
      const deadline: number | undefined = parseDeadline(editValue);
      if (editValue.trim() && deadline === undefined) {
        alert('締切は YYYY-MM-DD 形式');
        return;
      }
      updates.deadline = deadline;
      setTodos((prev) =>
        prev.map((todo) => (todo.id === id ? { ...todo, deadline } : todo)),
      );
    } else if (editingField === 'recurrence') {
      const newRec: string = editValue || 'carry';
      updates.recurrence = newRec;
      setTodos((prev) =>
        prev.map((todo) => (todo.id === id ? { ...todo, recurrence: newRec } : todo)),
      );
    }

    log('edit:save:ok', { id, field: editingField, value: editValue });
    setEditingId(null);
    setEditingField(null);

    await fetch('/api/todos/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    });
  }

  /**
   * カードの展開/折り畳みをトグルする
   * 展開時にそのタスクの作業ログをAPIから取得する
   * @param todoId - 対象タスクのID
   */
  async function toggleExpand(todoId: string): Promise<void> {
    if (expandedId === todoId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(todoId);
    const res: Response = await fetch('/api/todos/' + todoId + '/logs');
    const data: WorkLog[] = await res.json();
    setWorkLogs((prev) => ({ ...prev, [todoId]: data }));
  }

  /**
   * 展開中のタスクに作業ログを追加する
   * @param todoId - 対象タスクのID
   */
  async function addWorkLog(todoId: string): Promise<void> {
    const content: string = logInput.trim();
    if (!content) {
      return;
    }
    const dateOverride: string = actualDateInputs[todoId] ?? '';
    const res: Response = await fetch('/api/todos/' + todoId + '/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, date: dateOverride || undefined }),
    });
    const newLog: WorkLog = await res.json();
    setWorkLogs((prev) => ({
      ...prev,
      [todoId]: [newLog, ...(prev[todoId] ?? [])],
    }));
    setLogInput('');
    setActualDateInputs((prev) => ({ ...prev, [todoId]: '' }));
    log('workLog:add', { todoId, content });
  }

  // --- Render ---

  if (loading) {
    return (
      <main className={styles.main}>
        <p>読み込み中...</p>
      </main>
    );
  }

  return (
    <main className={`${styles.main} ${isMobile ? styles.mobileContent : ''}`}>
      <header className={styles.topBar}>
        <h1 className={styles.headerTitle}>
          {activeTab === 'tasks' ? 'タスク' : activeTab === 'task-sets' ? 'タスクセット' : activeTab === 'matrix' ? 'アイゼンハワーマトリクス' : activeTab === 'activity' ? '作業記録' : activeTab === 'archived' ? '削除したタスク' : activeTab === 'diary-write' ? '日記を書く' : activeTab === 'diary-view' ? '日記を見る' : activeTab === 'diary-public' ? 'みんなの日記' : activeTab === 'mypage' ? 'マイページ' : activeTab === 'help' ? 'ヘルプ' : activeTab === 'bug-report' ? 'バグ報告' : activeTab === 'admin' ? '管理' : activeTab === 'recurring' ? '繰り返しタスク' : '設定'}
        </h1>
        <div className={styles.userBar}>
          <span className={styles.userName}>{user.name}</span>
          <button type="button" onClick={onLogout} className={styles.iconBtn}>
            ログアウト
          </button>
        </div>
        <button
          type="button"
          className={styles.hamburgerBtn}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="メニュー"
        >
          <span className={styles.hamburgerLine} />
          <span className={styles.hamburgerLine} />
          <span className={styles.hamburgerLine} />
        </button>
      </header>

      {/* ハンバーガーメニュー */}
      {menuOpen && (
        <div className={styles.menuOverlay} onClick={() => setMenuOpen(false)}>
          <nav className={styles.menuPanel} onClick={(e) => e.stopPropagation()}>
            {/* --- タスク管理グループ --- */}
            <div className={styles.menuGroupLabel}>タスク管理</div>
            <button
              type="button"
              className={`${styles.menuItem} ${activeTab === 'tasks' ? styles.menuItemActive : ''}`}
              onClick={() => { setActiveTab('tasks'); setMenuOpen(false); }}
            >
              タスク
            </button>
            <button
              type="button"
              className={styles.menuItem}
              onClick={() => setTaskMenuOpen(!taskMenuOpen)}
            >
              その他 {taskMenuOpen ? '▾' : '▸'}
            </button>
            {taskMenuOpen && (
              <>
                <button
                  type="button"
                  className={`${styles.menuSubItem} ${activeTab === 'task-sets' ? styles.menuItemActive : ''}`}
                  onClick={() => { setActiveTab('task-sets'); setMenuOpen(false); }}
                >
                  タスクセット
                </button>
                <button
                  type="button"
                  className={`${styles.menuSubItem} ${activeTab === 'matrix' ? styles.menuItemActive : ''}`}
                  onClick={() => { switchTab('matrix'); }}
                >
                  アイゼンハワーマトリクス {!isPro && '🔒'}
                </button>
                <button
                  type="button"
                  className={`${styles.menuSubItem} ${activeTab === 'recurring' ? styles.menuItemActive : ''}`}
                  onClick={() => { setActiveTab('recurring'); setMenuOpen(false); }}
                >
                  繰り返しタスク
                </button>
                <button
                  type="button"
                  className={`${styles.menuSubItem} ${activeTab === 'archived' ? styles.menuItemActive : ''}`}
                  onClick={() => { setActiveTab('archived'); setMenuOpen(false); }}
                >
                  削除したタスク
                </button>
              </>
            )}

            {/* --- 記録グループ --- */}
            <div className={styles.menuGroupLabel}>記録</div>
            <button
              type="button"
              className={styles.menuItem}
              onClick={() => setDiaryMenuOpen(!diaryMenuOpen)}
            >
              日記 {diaryMenuOpen ? '▾' : '▸'}
            </button>
            {diaryMenuOpen && (
              <>
                <button
                  type="button"
                  className={`${styles.menuSubItem} ${activeTab === 'diary-write' ? styles.menuItemActive : ''}`}
                  onClick={() => { setActiveTab('diary-write'); setMenuOpen(false); }}
                >
                  書く
                </button>
                <button
                  type="button"
                  className={`${styles.menuSubItem} ${activeTab === 'diary-view' ? styles.menuItemActive : ''}`}
                  onClick={() => { setActiveTab('diary-view'); setMenuOpen(false); }}
                >
                  履歴
                </button>
                <button
                  type="button"
                  className={`${styles.menuSubItem} ${activeTab === 'diary-public' ? styles.menuItemActive : ''}`}
                  onClick={() => { switchTab('diary-public'); }}
                >
                  みんなの日記 {!isPro && '🔒'}
                </button>
              </>
            )}
            <button
              type="button"
              className={`${styles.menuItem} ${activeTab === 'activity' ? styles.menuItemActive : ''}`}
              onClick={() => { setActiveTab('activity'); setMenuOpen(false); }}
            >
              作業記録
            </button>

            {/* --- アカウントグループ --- */}
            <div className={styles.menuGroupLabel}>アカウント</div>
            <button
              type="button"
              className={`${styles.menuItem} ${activeTab === 'mypage' ? styles.menuItemActive : ''}`}
              onClick={() => { setActiveTab('mypage'); setMenuOpen(false); }}
            >
              マイページ
            </button>
            <button
              type="button"
              className={`${styles.menuItem} ${activeTab === 'settings' ? styles.menuItemActive : ''}`}
              onClick={() => { setActiveTab('settings'); setMenuOpen(false); }}
            >
              設定
            </button>

            {/* --- サポートグループ --- */}
            <div className={styles.menuGroupLabel}>サポート</div>
            <button
              type="button"
              className={`${styles.menuItem} ${activeTab === 'help' ? styles.menuItemActive : ''}`}
              onClick={() => { setActiveTab('help'); setMenuOpen(false); }}
            >
              ヘルプ
            </button>
            <button
              type="button"
              className={`${styles.menuItem} ${activeTab === 'bug-report' ? styles.menuItemActive : ''}`}
              onClick={() => { setActiveTab('bug-report'); setMenuOpen(false); }}
            >
              バグ報告
            </button>
            {user.role === 'admin' && (
              <button
                type="button"
                className={`${styles.menuItem} ${activeTab === 'admin' ? styles.menuItemActive : ''}`}
                onClick={() => { setActiveTab('admin'); setMenuOpen(false); }}
              >
                管理
              </button>
            )}
          </nav>
        </div>
      )}

      {(activeTab === 'tasks' || activeTab === 'task-sets' || activeTab === 'recurring') && (
      <>
      <div className={styles.diaryModeBar}>
        <button
          type="button"
          className={`${styles.diaryModeBtn} ${activeTab === 'tasks' ? styles.diaryModeBtnActive : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          タスク
        </button>
        <button
          type="button"
          className={`${styles.diaryModeBtn} ${activeTab === 'task-sets' ? styles.diaryModeBtnActive : ''}`}
          onClick={() => setActiveTab('task-sets')}
        >
          タスクセット
        </button>
        <button
          type="button"
          className={`${styles.diaryModeBtn} ${activeTab === 'recurring' ? styles.diaryModeBtnActive : ''}`}
          onClick={() => setActiveTab('recurring')}
        >
          繰り返し
        </button>
      </div>
      </>
      )}

      {activeTab === 'tasks' && (
      <div onClickCapture={(e) => {
        // カード内部のクリックでなければ展開を閉じる
        const target = e.target as HTMLElement;
        if (!target.closest('article') && !dragId && !isDraggingRef.current) {
          setExpandedId(null);
        }
      }}>
      {/* Add form — スマホでは非表示、FAB+モーダルで表示 */}
      <section className={styles.addForm} style={isMobile ? { display: 'none' } : undefined}>
        <label className={styles.fieldLabel}>タスク名</label>
        <input
          data-tutorial="task-title-input"
          placeholder="例: レポートを書く"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={styles.input}
        />
        <label className={styles.fieldLabel}>詳細（任意）</label>
        <textarea
          placeholder="例: 第3章の結論部分を仕上げる"
          value={detailText}
          onChange={(e) => setDetailText(e.target.value)}
          className={styles.textarea}
          rows={2}
        />
        <div className={styles.addFormRow}>
          <div>
            <label className={styles.fieldLabel}>予定時間（分）</label>
            <input
              placeholder="例: 60"
              value={estText}
              onChange={(e) => setEstText(e.target.value)}
              className={styles.input}
            />
          </div>
          <div>
            <label className={styles.fieldLabel}>繰り返し</label>
            <select
              value={mode}
              onChange={(e) => {
                const v: string = e.target.value;
                setMode(v);
                if (v === 'custom') {
                  setCustomUnit('week');
                  setCustomInterval('1');
                  setCustomWeekDays(['mon']);
                }
              }}
              className={styles.input}
            >
              <option value="carry">繰り返さない</option>
              <option value="day">毎日</option>
              <option value="week:weekday">毎週平日（月〜金）</option>
              <option value={`week:${todayDayKey}`}>毎週{todayDayName}曜日</option>
              <option value="month:same-date">毎月同じ日</option>
              <option value="year">毎年同じ日</option>
              <option value="custom">カスタム...</option>
            </select>
            {mode === 'custom' && (
              <div style={{ display: 'grid', gap: 6, marginTop: 6, padding: 10, border: '1px solid var(--input-border)', borderRadius: 8, background: 'var(--background)' }}>
                {/* n ごと */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span>繰り返す間隔:</span>
                  <input
                    type="number"
                    min="1"
                    value={customInterval}
                    onChange={(e) => setCustomInterval(e.target.value)}
                    className={styles.inputNarrow}
                    style={{ width: 50 }}
                  />
                  <select
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value)}
                    className={styles.input}
                    style={{ width: 80 }}
                  >
                    <option value="day">日</option>
                    <option value="week">週</option>
                    <option value="month">月</option>
                    <option value="year">年</option>
                  </select>
                  <span>ごと</span>
                </div>

                {/* 週の場合：曜日複数選択 */}
                {customUnit === 'week' && (
                  <div>
                    <label className={styles.fieldLabel}>曜日</label>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {[
                        { key: 'mon', label: '月' },
                        { key: 'tue', label: '火' },
                        { key: 'wed', label: '水' },
                        { key: 'thu', label: '木' },
                        { key: 'fri', label: '金' },
                        { key: 'sat', label: '土' },
                        { key: 'sun', label: '日' },
                      ].map((d) => {
                        const selected: boolean = customWeekDays.includes(d.key);
                        return (
                          <button
                            key={d.key}
                            type="button"
                            className={selected ? styles.primaryBtn : styles.iconBtn}
                            style={{ width: 36, height: 36, padding: 0, fontSize: 13, borderRadius: '50%' }}
                            onClick={() => {
                              if (selected) {
                                if (customWeekDays.length > 1) {
                                  setCustomWeekDays(customWeekDays.filter((k) => k !== d.key));
                                }
                              } else {
                                setCustomWeekDays([...customWeekDays, d.key]);
                              }
                            }}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 月の場合：毎月n日 or 第ny曜日 */}
                {customUnit === 'month' && (
                  <div style={{ display: 'grid', gap: 6 }}>
                    <select
                      value={customMonthMode}
                      onChange={(e) => setCustomMonthMode(e.target.value as 'date' | 'weekday')}
                      className={styles.input}
                      style={{ width: 200 }}
                    >
                      <option value="date">毎月○日</option>
                      <option value="weekday">毎月第○曜日</option>
                    </select>
                    {customMonthMode === 'date' && (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <span>毎月</span>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={customMonthDay}
                          onChange={(e) => setCustomMonthDay(e.target.value)}
                          className={styles.inputNarrow}
                          style={{ width: 50 }}
                        />
                        <span>日</span>
                      </div>
                    )}
                    {customMonthMode === 'weekday' && (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <span>第</span>
                        <select
                          value={customMonthNth}
                          onChange={(e) => setCustomMonthNth(e.target.value)}
                          className={styles.input}
                          style={{ width: 50 }}
                        >
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                          <option value="4">4</option>
                        </select>
                        <select
                          value={customMonthNthDay}
                          onChange={(e) => setCustomMonthNthDay(e.target.value)}
                          className={styles.input}
                          style={{ width: 80 }}
                        >
                          <option value="mon">月曜日</option>
                          <option value="tue">火曜日</option>
                          <option value="wed">水曜日</option>
                          <option value="thu">木曜日</option>
                          <option value="fri">金曜日</option>
                          <option value="sat">土曜日</option>
                          <option value="sun">日曜日</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <div>
            <label className={styles.fieldLabel}>締切（任意）</label>
            <input
              type="date"
              value={deadlineText}
              onChange={(e) => setDeadlineText(e.target.value)}
              className={styles.input}
            />
          </div>
        </div>
        <button data-tutorial="task-add-btn" type="button" onClick={addTodo} className={styles.primaryBtn}>
          追加
        </button>
      </section>

      {/* スマホ用：FABボタン */}
      {isMobile && activeTab === 'tasks' && (
        <button
          type="button"
          className={styles.fab}
          onClick={() => setShowMobileAddForm(true)}
        >
          ＋
        </button>
      )}

      {/* スマホ用：タスク追加モーダル */}
      {isMobile && showMobileAddForm && (
        <div className={styles.mobileAddModal} onClick={() => setShowMobileAddForm(false)}>
          <div className={styles.mobileAddSheet} onClick={(e) => e.stopPropagation()}>
            <div className={styles.mobileAddHeader}>
              <h3>タスク追加</h3>
              <button type="button" className={styles.mobileAddClose} onClick={() => setShowMobileAddForm(false)}>×</button>
            </div>
            <label className={styles.fieldLabel}>タスク名</label>
            <input
              placeholder="例: レポートを書く"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={styles.input}
              autoFocus
            />
            <label className={styles.fieldLabel} style={{ marginTop: 12 }}>詳細（任意）</label>
            <textarea
              placeholder="例: 第3章の結論部分を仕上げる"
              value={detailText}
              onChange={(e) => setDetailText(e.target.value)}
              className={styles.textarea}
              rows={2}
            />
            <label className={styles.fieldLabel} style={{ marginTop: 12 }}>予定時間（分）</label>
            <input
              placeholder="例: 60"
              value={estText}
              onChange={(e) => setEstText(e.target.value)}
              className={styles.input}
            />
            <label className={styles.fieldLabel} style={{ marginTop: 12 }}>繰り返し</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className={styles.input}
            >
              <option value="carry">繰り返さない</option>
              <option value="day">毎日</option>
              <option value="week:weekday">毎週平日（月〜金）</option>
              <option value={`week:${todayDayKey}`}>毎週{todayDayName}曜日</option>
              <option value="month:same-date">毎月同じ日</option>
              <option value="year">毎年同じ日</option>
            </select>
            <label className={styles.fieldLabel} style={{ marginTop: 12 }}>締切（任意）</label>
            <input
              type="date"
              value={deadlineText}
              onChange={(e) => setDeadlineText(e.target.value)}
              className={styles.input}
            />
            <button
              type="button"
              onClick={() => { addTodo(); setShowMobileAddForm(false); }}
              className={styles.primaryBtn}
              style={{ marginTop: 16, width: '100%' }}
            >
              追加
            </button>
          </div>
        </div>
      )}

      {/* 凡例 + 表示切替 */}
      <div className={styles.legendRow}>
        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: '#ef4444' }} />
            リスクあり({legendCounts.danger})
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: '#3b82f6' }} />
            進行中({legendCounts.inProgress})
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: '#22c55e' }} />
            完了({legendCounts.done})
          </span>
        </div>
        <div data-tutorial="view-mode-buttons" className={styles.viewModeButtons}>
          {legendCounts.done > 0 && (
            <button
              type="button"
              className={styles.dangerIconBtn}
              onClick={removeAllDone}
              title="完了タスクを全消去"
              style={{ fontSize: '12px', padding: '4px 8px' }}
            >
              完了を消去
            </button>
          )}
          {todos.length > 0 && (
            <button
              type="button"
              className={styles.dangerIconBtn}
              onClick={removeAllTodos}
              title="全タスクを削除"
              style={{ fontSize: '12px', padding: '4px 8px', marginRight: '8px' }}
            >
              全削除
            </button>
          )}
          <button
            type="button"
            className={`${styles.viewModeBtn} ${viewMode === 'detail' ? styles.viewModeBtnActive : ''}`}
            onClick={() => { setViewMode('detail'); notifyTutorialAction('changeViewMode'); }}
            title="詳細表示"
          >
            ☰
          </button>
          <button
            type="button"
            className={`${styles.viewModeBtn} ${viewMode === 'compact' ? styles.viewModeBtnActive : ''}`}
            onClick={() => { setViewMode('compact'); notifyTutorialAction('changeViewMode'); }}
            title="コンパクト表示"
          >
            ≡
          </button>
          <button
            type="button"
            className={`${styles.viewModeBtn} ${viewMode === 'grid' ? styles.viewModeBtnActive : ''}`}
            onClick={() => { setViewMode('grid'); notifyTutorialAction('changeViewMode'); }}
            title="グリッド表示"
          >
            ⊞
          </button>
        </div>
      </div>

      {/* ルートに戻すドロップゾーン（常にDOMに存在、ドラッグ中のみ表示） */}
      <div
        className={styles.rootDropZone}
        style={{ display: dragId ? 'block' : 'none', background: dragOverId === '__root__' ? '#3b82f6' : undefined }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOverId('__root__');
          setDragOverMode('between');
        }}
        onDragLeave={() => {
          if (dragOverId === '__root__') {
            setDragOverId(null);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (dragId) {
            changeParent(dragId, null);
          }
          isDraggingRef.current = false;
          setDragId(null);
          setDragOverId(null);
          setDragOverMode(null);
        }}
      >
        親との階層化を解除
      </div>

      {/* Todo list — detail (既存の詳細表示) */}
      {viewMode === 'detail' && <section data-tutorial="task-list" className={`${styles.todoList} ${dragId ? styles.todoListDragging : ''}`}>
        {treeList.map(({ todo: t, depth }, idx) => {
          const bgClass: 'cardDone' | 'cardDanger' | 'cardInProgress' = cardBgClass(t);
          const isEditingThis: boolean = editingId === t.id;
          const isExpanded: boolean = expandedId === t.id;
          const isDragOverChild: boolean = dragOverId === t.id && dragOverMode === 'child' && dragId !== t.id;
          // カード間ドロップゾーンのハイライト（カードの上の隙間 = idx、下の隙間 = idx+1）
          const isBetweenActive: boolean = dropBetweenIndex === idx && dragId !== t.id;
          const isAfterActive: boolean = dropBetweenIndex === (idx + 1) && dragId !== t.id;

          return (
            <div key={t.id}>
              {/* カード間ドロップゾーン（常にDOMに存在） */}
              <div
                className={`${styles.dropZone} ${isBetweenActive ? styles.dropZoneActive : ''}`}
                style={{ marginLeft: depth > 0 ? 21 : 0, display: dragId ? 'block' : 'none' }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDropBetweenIndex(idx);
                  setDragOverId(null);
                  setDragOverMode('between');
                }}
                onDragLeave={() => {
                  if (dropBetweenIndex === idx) {
                    setDropBetweenIndex(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (dragId) {
                    const newParentId: string | null = t.parentId ?? null;
                    const newOrder: number = t.sortOrder - 1;
                    setTodos((prev) =>
                      prev.map((todo) => (todo.id === dragId
                        ? { ...todo, parentId: newParentId ?? undefined, sortOrder: newOrder }
                        : todo)),
                    );
                    fetch('/api/todos/' + dragId, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ updates: { parentId: newParentId, sortOrder: newOrder } }),
                    });
                  }
                  isDraggingRef.current = false;
                  setDragId(null);
                  setDragOverId(null);
                  setDragOverMode(null);
                  setDropBetweenIndex(null);
                }}
              />
            <div className={`${styles.cardRow} ${depth > 0 ? styles.cardRowNested : ''}`} style={depth > 0 ? { marginLeft: depth * 16 } : {}}>
              {/* 左ドロップゾーン（常にDOMに存在、ドラッグ中かつ子タスクのみ表示） */}
              <div
                className={`${styles.unparentDropZone} ${dragOverId === ('unparent-' + t.id) ? styles.unparentDropZoneActive : ''}`}
                style={{ display: (dragId && dragId !== t.id && depth > 0) ? 'flex' : 'none' }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOverId('unparent-' + t.id);
                  setDragOverMode('between');
                }}
                onDragLeave={() => {
                  if (dragOverId === ('unparent-' + t.id)) {
                    setDragOverId(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (dragId) {
                    const thisTask: Todo | undefined = todos.find((todo) => todo.id === t.id);
                    const parentTask: Todo | undefined = thisTask?.parentId ? todos.find((todo) => todo.id === thisTask.parentId) : undefined;
                    const grandParentId: string | null = parentTask?.parentId ?? null;
                    changeParent(dragId, grandParentId);
                  }
                  isDraggingRef.current = false;
                  setDragId(null);
                  setDragOverId(null);
                  setDragOverMode(null);
                }}
                title="階層を上げる"
              >
                ←
              </div>
            <article
              className={`${styles.card} ${styles[bgClass]} ${isExpanded ? styles.cardExpanded : ''} ${isDragOverChild ? styles.cardDragOverChild : ''} ${dragOverMode === 'between' && dropBetweenIndex === idx && dragId !== t.id ? styles.cardDragOverTop : ''} ${dragOverMode === 'between' && dropBetweenIndex === idx + 1 && dragId !== t.id ? styles.cardDragOverBottom : ''} ${selectedId === t.id ? styles.cardSelected : ''} ${dragId === t.id ? styles.cardDragging : ''}`}
              style={{ fontSize: Math.pow(0.9, depth) + 'em', flex: 1 }}
              onClick={() => {
                if (!isDraggingRef.current) {
                  setSelectedId(t.id);
                  toggleExpand(t.id);
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (!dragId || dragId === t.id) {
                  return;
                }
                const rect: DOMRect = e.currentTarget.getBoundingClientRect();
                const half: number = rect.height / 2;
                const relY: number = e.clientY - rect.top;
                setDragOverId(null);
                setDragOverMode('between');
                if (relY < half) {
                  setDropBetweenIndex(idx);
                } else {
                  setDropBetweenIndex(idx + 1);
                }
              }}
              onDragLeave={() => {
                if (dragOverId === t.id) {
                  setDragOverId(null);
                  setDragOverMode(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId && dragId !== t.id) {
                  // 前後のタスクのsortOrderの中間値を計算
                  const isBefore: boolean = dropBetweenIndex === idx;
                  const targetIdx: number = isBefore ? idx : idx + 1;
                  const prevItem: { todo: Todo } | undefined = treeList[targetIdx - 1];
                  const nextItem: { todo: Todo } | undefined = treeList[targetIdx];
                  let newOrder: number;
                  if (prevItem && nextItem) {
                    newOrder = (prevItem.todo.sortOrder + nextItem.todo.sortOrder) / 2;
                  } else if (prevItem) {
                    newOrder = prevItem.todo.sortOrder + 10;
                  } else if (nextItem) {
                    newOrder = nextItem.todo.sortOrder - 10;
                  } else {
                    newOrder = 0;
                  }
                  // 子孫のsortOrderも親との相対差を保って一緒に移動
                  const draggedTodo: Todo | undefined = todos.find((todo) => todo.id === dragId);
                  const oldOrder: number = draggedTodo?.sortOrder ?? 0;
                  const diff: number = newOrder - oldOrder;
                  const descendantIds: string[] = getDescendantIds(dragId, todos);
                  const movedIds: Set<string> = new Set([dragId, ...descendantIds]);
                  const rollback: Todo[] = todos;
                  const updates: { id: string; sortOrder: number }[] = [];
                  setTodos((prev) =>
                    prev.map((todo) => {
                      if (movedIds.has(todo.id)) {
                        const updatedOrder: number = todo.sortOrder + diff;
                        updates.push({ id: todo.id, sortOrder: updatedOrder });
                        return { ...todo, sortOrder: updatedOrder };
                      }
                      return todo;
                    }),
                  );
                  persistSortOrders(updates, rollback);
                }
                isDraggingRef.current = false;
                setDragId(null);
                setDragOverId(null);
                setDragOverMode(null);
                setDropBetweenIndex(null);
              }}
              onDragEnd={() => {
                isDraggingRef.current = false;
                setDragId(null);
                setDragOverId(null);
                setDragOverMode(null);
                setDropBetweenIndex(null);
              }}
            >
              {/* ドラッグハンドル */}
              <DragHandle
                onDragStart={(e) => {
                  isDraggingRef.current = true;
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', t.id);
                  requestAnimationFrame(() => {
                    setDragId(t.id);
                  });
                }}
                onDragEnd={() => {
                  isDraggingRef.current = false;
                  setDragId(null);
                  setDragOverId(null);
                  setDragOverMode(null);
                  setDropBetweenIndex(null);
                }}
              />
              {/* 階層化ボタン（常時表示） */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginRight: 2 }}>
                <button
                  type="button"
                  className={styles.iconBtn}
                  style={{ fontSize: '15px', padding: '2px 6px', lineHeight: 1, minHeight: 'auto', minWidth: 'auto', opacity: 0.7 }}
                  title="すぐ上のタスクの子にする"
                  onClick={(e) => { e.stopPropagation(); moveRight(t.id); }}
                >▶</button>
                {t.parentId && (
                  <button
                    type="button"
                    className={styles.iconBtn}
                    style={{ fontSize: '15px', padding: '2px 6px', lineHeight: 1, minHeight: 'auto', minWidth: 'auto', opacity: 0.7 }}
                    title="階層を1つ上げる"
                    onClick={(e) => { e.stopPropagation(); moveLeft(t.id); }}
                  >◀</button>
                )}
              </div>
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={t.done}
                onChange={() => toggleDone(t.id)}
                onClick={(e) => e.stopPropagation()}
                title={t.done ? '完了を取り消す' : '完了にする'}
                className={styles.checkbox}
              />

              {/* Title & progress */}
              <div className={styles.cardLeft}>
                {/* タイトル */}
                {isEditingThis && editingField === 'title' ? (
                  <input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        saveFieldEdit(t.id);
                      }
                      if (e.key === 'Escape') {
                        cancelFieldEdit();
                      }
                    }}
                    onBlur={() => saveFieldEdit(t.id)}
                    className={styles.inlineInput}
                    autoFocus
                  />
                ) : (
                  <div
                    className={`${styles.taskTitle} ${t.done ? styles.taskTitleDone : ''}`}
                    onDoubleClick={(e) => { e.stopPropagation(); startFieldEdit(t, 'title'); }}
                    title="ダブルクリックで編集"
                  >
                    {t.title}
                  </div>
                )}

                {/* 詳細 */}
                {isEditingThis && editingField === 'detail' ? (
                  <textarea
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        cancelFieldEdit();
                      }
                    }}
                    onBlur={() => saveFieldEdit(t.id)}
                    className={styles.textarea}
                    rows={2}
                    autoFocus
                  />
                ) : (
                  <div
                    className={`${styles.taskDetail} ${isExpanded ? styles.taskDetailExpanded : ''}`}
                    onDoubleClick={(e) => { e.stopPropagation(); startFieldEdit(t, 'detail'); }}
                    title="ダブルクリックで編集"
                  >
                    {t.detail || '詳細なし'}
                  </div>
                )}

                {/* 予定 / 実績 */}
                <div className={`${styles.taskProgress} ${t.done ? styles.taskProgressDone : ''}`}>
                  {isEditingThis && editingField === 'est' ? (
                    <span>
                      予定{' '}
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            saveFieldEdit(t.id);
                          }
                          if (e.key === 'Escape') {
                            cancelFieldEdit();
                          }
                        }}
                        onBlur={() => saveFieldEdit(t.id)}
                        className={styles.inlineInputNarrow}
                        autoFocus
                      />
                      分
                    </span>
                  ) : (
                    <span onDoubleClick={(e) => { e.stopPropagation(); startFieldEdit(t, 'est'); }} title="ダブルクリックで予定を編集">
                      予定 {minutesToText(t.estMin)}
                    </span>
                  )}
                  {' / '}
                  {isEditingThis && editingField === 'actual' ? (
                    <span>
                      実績{' '}
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            saveFieldEdit(t.id);
                          }
                          if (e.key === 'Escape') {
                            cancelFieldEdit();
                          }
                        }}
                        onBlur={() => saveFieldEdit(t.id)}
                        className={styles.inlineInputNarrow}
                        autoFocus
                      />
                      分
                    </span>
                  ) : (
                    <span onDoubleClick={(e) => { e.stopPropagation(); startFieldEdit(t, 'actual'); }} title="ダブルクリックで実績を編集">
                      実績 {minutesToText(t.actualMin)}
                    </span>
                  )}
                </div>

              </div>

              {/* 期限 */}
              {isEditingThis && editingField === 'deadline' ? (
                <div className={styles.taskDeadlineBig} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="date"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => saveFieldEdit(t.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        saveFieldEdit(t.id);
                      }
                      if (e.key === 'Escape') {
                        cancelFieldEdit();
                      }
                    }}
                    className={styles.inputDate}
                    autoFocus
                  />
                </div>
              ) : (
                <div
                  className={styles.taskDeadlineBig}
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => { e.stopPropagation(); startFieldEdit(t, 'deadline'); }}
                  title="ダブルクリックで期限を編集"
                >
                  ⏰ {formatDeadline(t.deadline)}
                </div>
              )}

              {/* 着手/未着手バッジ（クリックで切り替え） */}
              {!t.done && (
                <span
                  className={t.started ? styles.badgeOk : styles.badgeNg}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    const newStarted: boolean = !t.started;
                    setTodos((prev) =>
                      prev.map((todo) => (todo.id === t.id ? { ...todo, started: newStarted } : todo)),
                    );
                    fetch('/api/todos/' + t.id, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ updates: { started: newStarted } }),
                    });
                  }}
                >
                  {t.started ? '着手' : '未着手'}
                </span>
              )}

              {/* Right: actions */}
              <div className={styles.actions}>
                <div className={styles.actionField}>
                  <label className={styles.fieldLabel}>実績(分)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="分"
                    value={actualInputs[t.id] ?? ''}
                    onChange={(e) =>
                      setActualInputs((prev) => ({ ...prev, [t.id]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !t.done) {
                        e.preventDefault();
                        addLog(t.id);
                      }
                    }}
                    className={styles.inputNarrow}
                    disabled={t.done}
                  />
                </div>
                <button onClick={() => addLog(t.id)} className={styles.iconBtn} disabled={t.done}>
                  実績
                </button>
                {t.parentId && (
                  <button
                    onClick={(e) => { e.stopPropagation(); changeParent(t.id, null); }}
                    className={styles.iconBtn}
                    title="ルートに戻す"
                  >
                    ↑
                  </button>
                )}
                <DeleteButton onClick={() => removeTodoWithUndo(t.id)} />
              </div>

              {/* 展開時のアクション */}
              {isExpanded && renderExpandedContent(t)}
            </article>
            </div>
              {/* カード下のドロップゾーン */}
              <div
                className={`${styles.dropZone} ${isAfterActive ? styles.dropZoneActive : ''}`}
                style={{ marginLeft: depth > 0 ? 21 : 0, display: dragId ? 'block' : 'none' }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDropBetweenIndex(idx + 1);
                  setDragOverId(null);
                  setDragOverMode('between');
                }}
                onDragLeave={() => {
                  if (dropBetweenIndex === idx + 1) {
                    setDropBetweenIndex(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (dragId) {
                    const newParentId: string | null = t.parentId ?? null;
                    const newOrder: number = t.sortOrder + 1;
                    setTodos((prev) =>
                      prev.map((todo) => (todo.id === dragId
                        ? { ...todo, parentId: newParentId ?? undefined, sortOrder: newOrder }
                        : todo)),
                    );
                    fetch('/api/todos/' + dragId, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ updates: { parentId: newParentId, sortOrder: newOrder } }),
                    });
                  }
                  isDraggingRef.current = false;
                  setDragId(null);
                  setDragOverId(null);
                  setDragOverMode(null);
                  setDropBetweenIndex(null);
                }}
              />
            </div>
          );
        })}
      </section>}

      {/* Todo list — compact（タスク名+期限+階層+詳細展開） */}
      {viewMode === 'compact' && (
        <section className={styles.todoListCompact}>
          {treeList.map(({ todo: t, depth }) => {
            const bgClass: 'cardDone' | 'cardDanger' | 'cardInProgress' = cardBgClass(t);
            const isExpanded: boolean = expandedId === t.id;
            const isEditingDeadline: boolean = editingId === t.id && editingField === 'deadline';
            return (
              <div
                key={t.id}
                className={`${styles.compactCard} ${styles[bgClass]} ${isExpanded ? styles.compactCardExpanded : ''}`}
                style={{ paddingLeft: depth * 24 + 8 }}
                onClick={() => {
                  if (expandedId === t.id) {
                    setExpandedId(null);
                  } else {
                    setExpandedId(t.id);
                  }
                }}
              >
                <div className={styles.compactCardRow}>
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={() => toggleDone(t.id)}
                    onClick={(e) => e.stopPropagation()}
                    className={styles.checkbox}
                  />
                  <span className={styles.compactTitle}>{t.title}</span>
                  {isEditingDeadline ? (
                    <input
                      type="date"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => {
                        saveFieldEdit(t.id);
                        setEditingId(null);
                        setEditingField(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          saveFieldEdit(t.id);
                          setEditingId(null);
                          setEditingField(null);
                        } else if (e.key === 'Escape') {
                          setEditingId(null);
                          setEditingField(null);
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className={styles.inputNarrow}
                      autoFocus
                    />
                  ) : (
                    <span
                      className={styles.compactDeadline}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(t.id);
                        setEditingField('deadline');
                        setEditValue(t.deadline ? toInputDeadline(t.deadline) : '');
                      }}
                      title="クリックで期限を変更"
                    >
                      {t.deadline ? formatDeadline(t.deadline) : '—'}
                    </span>
                  )}
                  <DeleteButton onClick={() => removeTodoWithUndo(t.id)} />
                </div>
                {isExpanded && renderExpandedContent(t)}
              </div>
            );
          })}
        </section>
      )}

      {/* Todo list — grid（コンパクト+横2列） */}
      {viewMode === 'grid' && (
        <section className={styles.todoListGrid}>
          {treeList.map(({ todo: t, depth }) => {
            const bgClass: 'cardDone' | 'cardDanger' | 'cardInProgress' = cardBgClass(t);
            const isEditingDeadline: boolean = editingId === t.id && editingField === 'deadline';
            return (
              <div
                key={t.id}
                className={`${styles.compactCard} ${styles[bgClass]}`}
                style={{ paddingLeft: depth * 16 + 8 }}
              >
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => toggleDone(t.id)}
                  className={styles.checkbox}
                />
                <span className={styles.compactTitle}>{t.title}</span>
                {isEditingDeadline ? (
                  <input
                    type="date"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => {
                      saveFieldEdit(t.id);
                      setEditingId(null);
                      setEditingField(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        saveFieldEdit(t.id);
                        setEditingId(null);
                        setEditingField(null);
                      } else if (e.key === 'Escape') {
                        setEditingId(null);
                        setEditingField(null);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className={styles.inputNarrow}
                    autoFocus
                  />
                ) : (
                  <span
                    className={styles.compactDeadline}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(t.id);
                      setEditingField('deadline');
                      setEditValue(t.deadline ? toInputDeadline(t.deadline) : '');
                    }}
                    title="クリックで期限を変更"
                  >
                    {t.deadline ? formatDeadline(t.deadline) : '—'}
                  </span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); removeTodoWithUndo(t.id); }}
                  className={styles.dangerIconBtn}
                  title="削除"
                >
                  🗑
                </button>
              </div>
            );
          })}
        </section>
      )}

      {/* Undo toasts */}
      <div className={styles.toastContainer}>
        {undoToasts.map((t) => (
          <div key={t.toastId} className={styles.toast}>
            <div className={styles.toastMessage}>{t.message}</div>
            <button onClick={t.undo} className={styles.iconBtn}>
              {t.undoLabel ?? '取り消す'}
            </button>
          </div>
        ))}
      </div>
      </div>
      )}

      {activeTab === 'task-sets' && (
        <TaskSetPanel
          user={user}
          onApply={async (items) => {
            const minOrder: number = todos.length > 0 ? Math.min(...todos.map((t) => t.sortOrder)) : 0;
            for (let i: number = 0; i < items.length; i++) {
              const deadlineTs: number | undefined = items[i].deadline ? new Date(items[i].deadline + 'T23:59:59').getTime() : undefined;
              const todo = {
                id: uid(),
                title: items[i].title,
                detail: items[i].detail,
                estMin: items[i].estMin,
                actualMin: 0,
                stuckHours: 0,
                deadline: deadlineTs,
                recurrence: items[i].recurrence as string,
                started: false,
                done: false,
                sortOrder: minOrder - items.length + i,
              };
              setTodos((prev) => [...prev, todo]);
              await fetch('/api/todos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, todo }),
              });
            }
            setActiveTab('tasks');
            log('taskSet:applied', { count: items.length });
          }}
        />
      )}

      {activeTab === 'matrix' && (
        <MatrixPanel todos={todos} user={user} />
      )}

      {activeTab === 'activity' && (
        <ActivityPanel user={user} isPro={isPro} onShowProModal={() => setShowProModal(true)} />
      )}

      {activeTab === 'archived' && (
        <ArchivedTodosPanel user={user} onRestore={fetchTodos} />
      )}

      {activeTab === 'recurring' && (
        <RecurringPanel user={user} onRefresh={fetchTodos} />
      )}

      {(activeTab === 'diary-write' || activeTab === 'diary-view' || activeTab === 'diary-public') && (
        <>
          <div className={styles.diaryModeBar}>
            <button
              type="button"
              className={`${styles.diaryModeBtn} ${activeTab === 'diary-write' ? styles.diaryModeBtnActive : ''}`}
              onClick={() => setActiveTab('diary-write')}
            >
              書く
            </button>
            <button
              type="button"
              className={`${styles.diaryModeBtn} ${activeTab === 'diary-view' ? styles.diaryModeBtnActive : ''}`}
              onClick={() => setActiveTab('diary-view')}
            >
              履歴
            </button>
            <button
              type="button"
              className={`${styles.diaryModeBtn} ${activeTab === 'diary-public' ? styles.diaryModeBtnActive : ''}`}
              onClick={() => switchTab('diary-public')}
            >
              みんなの日記 {!isPro && '🔒'}
            </button>
          </div>
          {activeTab === 'diary-write' && <DiaryWritePanel user={user} />}
          {activeTab === 'diary-view' && <DiaryViewPanel user={user} />}
          {activeTab === 'diary-public' && <PublicDiaryPanel user={user} />}
        </>
      )}

      {activeTab === 'mypage' && (
        <MyPage user={user} onUserUpdate={onUserUpdate} />
      )}

      {activeTab === 'settings' && (
        <SettingsPanel
          settings={settings}
          onUpdate={(updated: UserSettings) => setSettings(updated)}
          userId={user.id}
        />
      )}

      {activeTab === 'help' && (
        <HelpPanel onNavigate={(tab: string, hint?: string, targetSelector?: string, stepIndex?: number) => {
          setActiveTab(tab as typeof activeTab);
          if (hint) {
            setTutorialHint(hint);
            setTutorialTarget(targetSelector ?? null);
            setTutorialPos(null);
            setTutorialStepIndex(stepIndex ?? null);
            setTimeout(() => {
              if (targetSelector) {
                const el: Element | null = document.querySelector(targetSelector);
                if (el) {
                  const rect: DOMRect = el.getBoundingClientRect();
                  setTutorialPos({
                    top: rect.bottom + window.scrollY + 8,
                    left: Math.max(16, Math.min(window.innerWidth - 340, rect.left + window.scrollX)),
                  });
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }
            }, 300);
          }
        }} />
      )}

      {activeTab === 'bug-report' && (
        <BugReportPanel user={user} />
      )}

      {activeTab === 'admin' && (
        <AdminPanel user={user} />
      )}

      {pomodoroTodo && (
        <PomodoroTimer
          todo={pomodoroTodo}
          onClose={() => setPomodoroTodo(null)}
          onAddMinutes={(minutes: number) => {
            const id: string = pomodoroTodo.id;
            const target: Todo | undefined = todos.find((t) => t.id === id);
            if (!target) {
              return;
            }
            const newActual: number = target.actualMin + minutes;
            setTodos((prev) =>
              prev.map((t) => (t.id === id ? { ...t, actualMin: newActual, lastWorkedAt: Date.now() } : t)),
            );
            fetch('/api/todos/' + id, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ updates: { actualMin: newActual, lastWorkedAt: Date.now() } }),
            });
          }}
        />
      )}

      <ButlerAvatar todos={todos} settings={settings} />

      {/* ハンズオン補助吹き出し */}
      {tutorialHint && (
        <>
          {/* ターゲット要素のハイライト */}
          {tutorialTarget && tutorialPos && (
            <div
              className={styles.tutorialHighlight}
              style={{
                top: (tutorialPos.top - 8) - (document.querySelector(tutorialTarget)?.getBoundingClientRect().height ?? 0) - 8,
                left: document.querySelector(tutorialTarget)?.getBoundingClientRect().left ?? 0,
                width: document.querySelector(tutorialTarget)?.getBoundingClientRect().width ?? 0,
                height: document.querySelector(tutorialTarget)?.getBoundingClientRect().height ?? 0,
              }}
            />
          )}
          {/* 吹き出し */}
          <div
            className={styles.tutorialHintBubble}
            style={tutorialPos ? {
              position: 'absolute',
              top: tutorialPos.top,
              left: tutorialPos.left,
            } : {
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className={styles.tutorialHintArrow} />
            <button
              type="button"
              className={styles.tutorialHintClose}
              onClick={() => { setTutorialHint(null); setTutorialPos(null); setTutorialTarget(null); }}
            >
              ×
            </button>
            <div className={styles.tutorialHintIcon}>🎩</div>
            <p className={styles.tutorialHintText}>{tutorialHint}</p>
            <button
              type="button"
              className={styles.iconBtn}
              style={{ fontSize: '12px', marginTop: 8 }}
              onClick={() => { setTutorialHint(null); setTutorialPos(null); setTutorialTarget(null); setActiveTab('help'); }}
            >
              ← ハンズオンに戻る
            </button>
          </div>
        </>
      )}

      {/* プロ版購入モーダル */}
      {showProModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowProModal(false)}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '400px', textAlign: 'center' }}
          >
            <h2 style={{ margin: '0 0 16px 0', fontSize: '20px' }}>プロ版にアップグレード</h2>
            <p style={{ margin: '0 0 12px 0', color: '#666' }}>
              以下の機能が解放されます：
            </p>
            <ul style={{ textAlign: 'left', margin: '0 0 16px 0', padding: '0 0 0 20px', lineHeight: '2' }}>
              <li>アイゼンハワーマトリクス</li>
              <li>パレート分析（作業記録）</li>
              <li>みんなの日記（公開・閲覧）</li>
            </ul>
            <p style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 16px 0' }}>
              ¥300（税込・買い切り）
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => { setShowProModal(false); startPurchase(); }}
                disabled={proPurchasing}
              >
                {proPurchasing ? '処理中...' : '購入する'}
              </button>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => setShowProModal(false)}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* スマホ用：下タブバー */}
      {isMobile && (
        <nav className={styles.bottomTabBar}>
          <button
            type="button"
            className={`${styles.bottomTab} ${activeTab === 'tasks' || activeTab === 'task-sets' || activeTab === 'recurring' ? styles.bottomTabActive : ''}`}
            onClick={() => setActiveTab('tasks')}
          >
            <span>📋</span>
            <span>タスク</span>
          </button>
          <button
            type="button"
            className={`${styles.bottomTab} ${activeTab === 'diary-write' || activeTab === 'diary-view' || activeTab === 'diary-public' ? styles.bottomTabActive : ''}`}
            onClick={() => setActiveTab('diary-write')}
          >
            <span>📔</span>
            <span>日記</span>
          </button>
          <button
            type="button"
            className={`${styles.bottomTab} ${activeTab === 'activity' ? styles.bottomTabActive : ''}`}
            onClick={() => setActiveTab('activity')}
          >
            <span>📊</span>
            <span>記録</span>
          </button>
          <button
            type="button"
            className={`${styles.bottomTab} ${activeTab === 'mypage' ? styles.bottomTabActive : ''}`}
            onClick={() => setActiveTab('mypage')}
          >
            <span>👤</span>
            <span>マイページ</span>
          </button>
          <button
            type="button"
            className={`${styles.bottomTab} ${activeTab === 'settings' || activeTab === 'help' ? styles.bottomTabActive : ''}`}
            onClick={() => setMenuOpen(true)}
          >
            <span>☰</span>
            <span>その他</span>
          </button>
        </nav>
      )}
    </main>
  );
}
