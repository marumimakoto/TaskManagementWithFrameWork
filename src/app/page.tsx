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
  formatDateShort,
  cardBgClass,
  loadSession,
  saveSession,
  clearSession,
} from './utils';
import styles from './page.module.css';
import dynamic from 'next/dynamic';
import ButlerAvatar from './ButlerAvatar';
import AppHeader from './AppHeader';
import type { TabType } from './AppHeader';
import PomodoroTimer from './PomodoroTimer';
import { DragHandle, MoveButtonBar, DeleteButton } from './SharedComponents';
import { TUTORIAL_STEPS } from './HelpPanel';
import { useIsMobile } from './useIsMobile';

// 遅延読み込み: タブ切替時に初めてロードされる
const DiaryWritePanel = dynamic(() => import('./DiaryWritePanel'));
const DiaryViewPanel = dynamic(() => import('./DiaryViewPanel'));
const PublicDiaryPanel = dynamic(() => import('./PublicDiaryPanel'));
const MyPage = dynamic(() => import('./MyPage'));
const SettingsPanel = dynamic(() => import('./SettingsPanel'));
const TaskSetPanel = dynamic(() => import('./TaskSetPanel'));
const BucketListPanel = dynamic(() => import('./BucketListPanel'));
const MatrixPanel = dynamic(() => import('./MatrixPanel'));
const ActivityPanel = dynamic(() => import('./ActivityPanel'));
const ArchivedTodosPanel = dynamic(() => import('./ArchivedTodosPanel'));
const RecurringPanel = dynamic(() => import('./RecurringPanel'));
const HelpPanel = dynamic(() => import('./HelpPanel'));
const BugReportPanel = dynamic(() => import('./BugReportPanel'));
const AdminPanel = dynamic(() => import('./AdminPanel'));
const TodayPanel = dynamic(() => import('./TodayPanel'));
const CalendarPanel = dynamic(() => import('./CalendarPanel'));
const CategoryStatsPanel = dynamic(() => import('./CategoryStatsPanel'));

/**
 * ページのルートコンポーネント
 * ログイン状態を管理し、未ログインならログイン/登録画面、ログイン済みならTodoAppを表示する
 */
import { WELCOME_MESSAGES } from './welcomeMessages';

/** Welcomeメッセージをトーン設定に基づいて取得する */
function pickWelcomeMessage(tone: string): string {
  const messages: string[] = WELCOME_MESSAGES[tone] ?? WELCOME_MESSAGES['trivia'] ?? [];
  if (messages.length === 0) {
    return '今日も頑張りましょう！';
  }
  return messages[Math.floor(Math.random() * messages.length)];
}

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
        // settingsはTodoApp内のstateなのでlocalStorageから直接取得
        let tone: string = 'trivia';
        try {
          const cachedSettings: string | null = localStorage.getItem('kiroku:settings:' + saved.id);
          if (cachedSettings) {
            const parsed = JSON.parse(cachedSettings);
            tone = parsed.welcomeTone ?? 'trivia';
          }
        } catch { /* ignore */ }
        const msg: string = pickWelcomeMessage(tone);
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
    const msg: string = pickWelcomeMessage('trivia');
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
          <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: 4, marginBottom: 8 }}>Kiroku</h1>
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
  const VALID_TABS: Set<string> = new Set(['tasks', 'today', 'calendar', 'task-sets', 'matrix', 'activity', 'category-stats', 'archived', 'recurring', 'diary-write', 'diary-view', 'diary-public', 'bucket-list', 'mypage', 'settings', 'help', 'bug-report', 'admin']);
  const [activeTab, setActiveTabRaw] = useState<TabType>(() => {
    try {
      const saved: string | null = localStorage.getItem('kiroku:activeTab');
      if (saved && VALID_TABS.has(saved)) {
        return saved as TabType;
      }
    } catch { /* ignore */ }
    return 'tasks';
  });
  function setActiveTab(tab: TabType): void {
    setActiveTabRaw(tab);
    try { localStorage.setItem('kiroku:activeTab', tab); } catch { /* ignore */ }
  }
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [diaryMenuOpen, setDiaryMenuOpen] = useState<boolean>(false);
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
  // localStorageキャッシュから初期値を復元（即表示用）
  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      const cached: string | null = localStorage.getItem('kiroku:settings:' + user.id);
      if (cached) {
        return JSON.parse(cached) as UserSettings;
      }
    } catch { /* ignore */ }
    return DEFAULT_SETTINGS;
  });
  const [todos, setTodos] = useState<Todo[]>(() => {
    try {
      const cached: string | null = localStorage.getItem('kiroku:todos:' + user.id);
      if (cached) {
        return JSON.parse(cached) as Todo[];
      }
    } catch { /* ignore */ }
    return [];
  });
  const [loading, setLoading] = useState(() => {
    // キャッシュがあれば初期ローディングをスキップ
    try {
      return !localStorage.getItem('kiroku:todos:' + user.id);
    } catch {
      return true;
    }
  });
  const [undoToasts, setUndoToasts] = useState<UndoToast[]>([]);
  const deleteOnceRef = useRef<Record<string, number>>({});

  // todosが変わるたびにlocalStorageキャッシュを更新
  useEffect(() => {
    if (todos.length > 0) {
      try { localStorage.setItem('kiroku:todos:' + user.id, JSON.stringify(todos)); } catch { /* ignore */ }
    }
  }, [todos, user.id]);

  /** FLIPアニメーション用: 各カードのDOM要素を保持 */
  const cardRefsMap = useRef<Record<string, HTMLElement | null>>({});
  /** FLIPアニメーション用: ソート前の各カードの位置を保持 */
  const prevPositions = useRef<Record<string, DOMRect>>({});

  /** ソート前にカードの位置を記録する */
  function snapshotCardPositions(): void {
    const positions: Record<string, DOMRect> = {};
    for (const [id, el] of Object.entries(cardRefsMap.current)) {
      if (el) {
        positions[id] = el.getBoundingClientRect();
      }
    }
    prevPositions.current = positions;
  }

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
      // キャッシュを更新
      try {
        localStorage.setItem('kiroku:todos:' + user.id, JSON.stringify(data));
      } catch { /* ignore */ }
    } catch (e) {
      console.warn('Failed to fetch todos', e);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  /** 初回表示: 日次リフレッシュ → 一括データ取得（todos + settings + isPro） */
  useEffect(() => {
    async function initAll(): Promise<void> {
      // 日次リフレッシュ（完了タスク削除・繰り返しタスク生成）
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

      // 一括取得（3回のAPI呼び出しを1回に統合）
      try {
        const res: Response = await fetch('/api/init?userId=' + user.id);
        const data: { todos: Todo[]; settings: UserSettings | null; isPro: boolean; todayMin?: Record<string, number> } = await res.json();

        // タスク
        const fetchedTodos: Todo[] = data.todos;
        // 孤立子タスク（親が削除されたもの）のparentIdをクリーンアップ
        const todoIds: Set<string> = new Set(fetchedTodos.map((t) => t.id));
        for (const t of fetchedTodos) {
          if (t.parentId && !todoIds.has(t.parentId)) {
            t.parentId = undefined;
            // DBも更新（バックグラウンド）
            fetch('/api/todos/' + t.id, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ updates: { parentId: null } }),
            });
          }
        }

        const orders: number[] = fetchedTodos.map((t) => t.sortOrder);
        const hasDuplicates: boolean = new Set(orders).size < orders.length;
        if (hasDuplicates && fetchedTodos.length > 0) {
          const initialized: Todo[] = fetchedTodos.map((t, i) => ({ ...t, sortOrder: i * 10 }));
          setTodos(initialized);
          for (const t of initialized) {
            fetch('/api/todos/' + t.id, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ updates: { sortOrder: t.sortOrder } }),
            });
          }
        } else {
          setTodos(fetchedTodos);
        }
        try { localStorage.setItem('kiroku:todos:' + user.id, JSON.stringify(fetchedTodos)); } catch { /* ignore */ }

        // 設定
        if (data.settings) {
          setSettings(data.settings);
          try { localStorage.setItem('kiroku:settings:' + user.id, JSON.stringify(data.settings)); } catch { /* ignore */ }
        }

        // 今日の作業時間
        if (data.todayMin) {
          setTodayMinMap(data.todayMin);
        }

        // プロ版
        setIsPro(data.isPro);
      } catch (e) {
        console.warn('Failed to init', e);
        // フォールバック: 個別取得
        fetchTodos();
      }
      setLoading(false);
    }
    initAll();
    // カテゴリ一覧を取得
    fetch('/api/todo-categories?userId=' + user.id)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTodoCategories(data);
        }
      })
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
  const [todoCategories, setTodoCategories] = useState<{ id: string; name: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showCategoryManager, setShowCategoryManager] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>('');

  // 表示モード
  const [viewMode, setViewMode] = useState<'detail' | 'compact' | 'grid' | 'kanban'>('detail');
  const [statusFilter, setStatusFilter] = useState<'all' | 'danger' | 'inProgress' | 'done'>('all');
  const [sortMode, setSortMode] = useState<'manual' | 'createdAsc' | 'createdDesc' | 'deadlineAsc' | 'deadlineDesc'>('manual');

  // スマホではグリッド・カンバンモードを使えないようにする
  useEffect(() => {
    if (isMobile && (viewMode === 'grid' || viewMode === 'kanban')) {
      setViewMode('detail');
    }
  }, [isMobile, viewMode]);

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
  const [todayMinMap, setTodayMinMap] = useState<Record<string, number>>({});
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

  // ポモドーロタイマーのlocalStorage復元
  useEffect(() => {
    try {
      const raw: string | null = localStorage.getItem('kiroku:pomodoro');
      if (raw) {
        const state: { todoId: string } = JSON.parse(raw) as { todoId: string };
        const target: Todo | undefined = todos.find((t) => t.id === state.todoId);
        if (target && !pomodoroTodo) {
          setPomodoroTodo(target);
        }
      }
    } catch { /* ignore */ }
  }, [todos]);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverMode, setDragOverMode] = useState<'child' | 'between' | null>(null);
  const [dropBetweenIndex, setDropBetweenIndex] = useState<number | null>(null);
  const [mouseDragY, setMouseDragY] = useState<number>(0);
  const mouseDragStartY = useRef<number>(0);
  const dropBetweenIndexRef = useRef<number | null>(null);

  // dropBetweenIndexの変更をrefに同期（mouseupハンドラから参照するため）
  useEffect(() => {
    dropBetweenIndexRef.current = dropBetweenIndex;
  }, [dropBetweenIndex]);

  // スマホ用スワイプ
  const touchStartRef = useRef<{ x: number; y: number; id: string; time: number } | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<Record<string, number>>({});
  const [swipeAction, setSwipeAction] = useState<Record<string, 'nest' | 'unnest' | null>>({});

  // スマホ用長押しドラッグ
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [touchDragId, setTouchDragId] = useState<string | null>(null);
  const [touchDragY, setTouchDragY] = useState<number>(0);
  const [touchDropIndex, setTouchDropIndex] = useState<number | null>(null);
  const touchDragStartY = useRef<number>(0);

  const sorted: Todo[] = useMemo((): Todo[] => {
    // 実際に存在するタスクIDのセット（孤立子タスク判定用）
    const allIds: Set<string> = new Set(todos.map((t) => t.id));

    // ルートタスク = parentIdなし、または親が存在しない（孤立子タスク）
    function isEffectiveRoot(t: Todo): boolean {
      if (!t.parentId) {
        return true;
      }
      // parentIdが設定されていても、親が存在しなければルート扱い
      if (!allIds.has(t.parentId)) {
        return true;
      }
      return false;
    }

    const s: Todo[] = [...todos].sort((a: Todo, b: Todo): number => {
      const aIsRoot: boolean = isEffectiveRoot(a);
      const bIsRoot: boolean = isEffectiveRoot(b);

      // ルートタスク同士: 完了を下に
      if (aIsRoot && bIsRoot) {
        const aDone: boolean = !!a.done;
        const bDone: boolean = !!b.done;
        if (aDone !== bDone) {
          if (aDone) {
            return 1;
          }
          return -1;
        }
      }

      // ソートモード別
      if (sortMode === 'createdAsc') {
        return (a.createdAt ?? 0) - (b.createdAt ?? 0);
      }
      if (sortMode === 'createdDesc') {
        return (b.createdAt ?? 0) - (a.createdAt ?? 0);
      }
      if (sortMode === 'deadlineAsc') {
        // 期限なしは最後尾（Infinity扱い）
        const aDeadline: number = a.deadline ?? Number.MAX_SAFE_INTEGER;
        const bDeadline: number = b.deadline ?? Number.MAX_SAFE_INTEGER;
        return aDeadline - bDeadline;
      }
      if (sortMode === 'deadlineDesc') {
        // 期限なしは最後尾（0扱い）
        const aDeadline: number = a.deadline ?? 0;
        const bDeadline: number = b.deadline ?? 0;
        return bDeadline - aDeadline;
      }

      // デフォルト: sortOrder順
      return a.sortOrder - b.sortOrder;
    });
    log('sort', {
      count: s.length,
      order: s.filter((t) => !t.parentId).map((t) => ({ title: t.title.slice(0, 10), done: !!t.done, sort: t.sortOrder })),
    });
    return s;
  }, [todos, sortMode]);

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

  /** ステータスフィルターを適用したtreeList */
  const filteredTreeList: { todo: Todo; depth: number }[] = useMemo((): { todo: Todo; depth: number }[] => {
    let result: { todo: Todo; depth: number }[] = treeList;

    // ステータスフィルター
    if (statusFilter !== 'all') {
      result = result.filter(({ todo: t }) => {
        const bg: string = cardBgClass(t);
        if (statusFilter === 'danger') {
          return bg === 'cardDanger';
        }
        if (statusFilter === 'inProgress') {
          return bg === 'cardInProgress';
        }
        if (statusFilter === 'done') {
          return bg === 'cardDone';
        }
        return true;
      });
    }

    // カテゴリフィルター
    if (categoryFilter !== 'all') {
      result = result.filter(({ todo: t }) => (t.category || '') === categoryFilter);
    }

    return result;
  }, [treeList, statusFilter, categoryFilter]);

  /** FLIPアニメーション: treeListが変わった後にカードの移動をアニメーションする */
  useEffect(() => {
    const prev: Record<string, DOMRect> = prevPositions.current;
    if (Object.keys(prev).length === 0) {
      return;
    }
    for (const { todo } of treeList) {
      const el: HTMLElement | null = cardRefsMap.current[todo.id] ?? null;
      if (!el) {
        continue;
      }
      const oldRect: DOMRect | undefined = prev[todo.id];
      if (!oldRect) {
        continue;
      }
      const newRect: DOMRect = el.getBoundingClientRect();
      const deltaY: number = oldRect.top - newRect.top;
      if (Math.abs(deltaY) < 2) {
        continue;
      }
      // Invert: 前の位置に戻す
      el.style.transform = `translateY(${deltaY}px)`;
      el.style.transition = 'none';
      // Play: アニメーションで新しい位置に移動
      requestAnimationFrame(() => {
        el.style.transition = 'transform 0.5s ease';
        el.style.transform = '';
        el.addEventListener('transitionend', () => {
          el.style.transition = '';
        }, { once: true });
      });
    }
    prevPositions.current = {};
  }, [treeList]);

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
      showUndoToast({
        toastId: 'alert-' + Date.now(),
        todoId: childId,
        message: '自分自身を親にすることはできません',
        undoLabel: '',
        undo: () => {},
      });
      return;
    }
    // 循環参照チェック：newParentIdがchildIdの子孫であればキャンセル
    if (newParentId) {
      const descendants: string[] = getDescendantIds(childId, todos);
      if (descendants.includes(newParentId)) {
        const parentTodo: Todo | undefined = todos.find((t) => t.id === newParentId);
        const childTodo: Todo | undefined = todos.find((t) => t.id === childId);
        showUndoToast({
          toastId: 'alert-' + Date.now(),
          todoId: childId,
          message: `「${childTodo?.title ?? ''}」の子タスクを親にすることはできません（循環参照）`,
          undoLabel: '',
          undo: () => {},
        });
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

    setSortMode('manual');
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
      category: selectedCategory,
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
    setSelectedCategory('');

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

    const shouldStart: boolean = !target.started;
    setTodos((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, actualMin: newActual, lastWorkedAt: workedAt, started: true }
          : t,
      ),
    );
    setActualInputs((prev) => ({ ...prev, [id]: '' }));
    setActualDateInputs((prev) => ({ ...prev, [id]: '' }));
    log('addLog:ok', { id, addMin, dateStr, autoStarted: shouldStart });

    const updates: Record<string, unknown> = { actualMin: newActual, lastWorkedAt: workedAt };
    if (shouldStart) {
      updates.started = 1;
    }
    await fetch('/api/todos/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    });
    // 作業ログにも記録
    fetch('/api/todos/' + id + '/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: `+${addMin}分 作業`, date: dateStr || undefined }),
    });
    // 今日分の場合、todayMinMapを更新
    if (!dateStr) {
      setTodayMinMap((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + addMin }));
    }
  }

  /**
   * 指定タスクの全子孫IDを再帰的に取得する
   * @param parentId - 親タスクのID
   * @param allTodos - 全タスク配列
   * @returns 子孫タスクのID配列
   */
  function getDescendantIds(parentId: string, allTodos: Todo[], visited?: Set<string>): string[] {
    const seen: Set<string> = visited ?? new Set();
    if (seen.has(parentId)) {
      return [];
    }
    seen.add(parentId);
    const children: Todo[] = allTodos.filter((t) => t.parentId === parentId);
    const ids: string[] = [];
    for (const child of children) {
      if (!seen.has(child.id)) {
        ids.push(child.id);
        ids.push(...getDescendantIds(child.id, allTodos, seen));
      }
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
    // FLIPアニメーション: ソート前の位置を記録
    snapshotCardPositions();

    const target: Todo | undefined = todos.find((t) => t.id === id);
    if (!target) {
      log('toggleDone:notFound', { id });
      return;
    }

    const wasDone: boolean = !!target.done;
    const newDone: boolean = !wasDone;
    log('toggleDone:start', { id, title: target.title, wasDone, newDone, rawDone: target.done, typeofDone: typeof target.done });
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

        {/* カテゴリ変更 */}
        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: '13px' }}>
          <span>📁</span>
          {[{ id: '', name: 'なし' }, ...todoCategories].map((cat) => (
            <button
              key={cat.id || '__none__'}
              type="button"
              onClick={() => {
                const newCat: string = cat.name === 'なし' ? '' : cat.name;
                setTodos((prev) => prev.map((todo) => (todo.id === t.id ? { ...todo, category: newCat } : todo)));
                fetch('/api/todos/' + t.id, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ updates: { category: newCat } }),
                });
              }}
              style={{
                padding: '2px 8px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
                border: (t.category || '') === (cat.name === 'なし' ? '' : cat.name) ? '2px solid #3b82f6' : '1px solid var(--card-border)',
                background: (t.category || '') === (cat.name === 'なし' ? '' : cat.name) ? '#dbeafe' : 'var(--card-bg)',
                color: (t.category || '') === (cat.name === 'なし' ? '' : cat.name) ? '#1d4ed8' : 'var(--foreground)',
                fontWeight: (t.category || '') === (cat.name === 'なし' ? '' : cat.name) ? 600 : 400,
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>

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
          <div className={styles.workLogInputTop}>
            <input
              type="date"
              value={actualDateInputs[t.id] ?? ''}
              onChange={(e) =>
                setActualDateInputs((prev) => ({ ...prev, [t.id]: e.target.value }))
              }
              className={styles.inputDate}
            />
            <button
              type="button"
              onClick={() => addWorkLog(t.id)}
              className={styles.iconBtn}
            >
              記録
            </button>
          </div>
          <textarea
            placeholder="やったことを記録...（Ctrl+Enterで記録、Shift+Enterで改行）"
            value={logInput}
            onChange={(e) => setLogInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                addWorkLog(t.id);
              }
            }}
            className={styles.input}
            rows={2}
            style={{ resize: 'vertical', width: '100%' }}
          />
        </div>
        {showLogId === t.id && (
          (workLogs[t.id] ?? []).length > 0 ? (
            <ul className={styles.workLogList}>
              {(workLogs[t.id] ?? []).map((wl: WorkLog) => (
                <li key={wl.id} className={styles.workLogItem}>
                  <span className={styles.workLogDate}>{wl.date}</span>
                  <span className={styles.workLogContent}>{wl.content}</span>
                  <button
                    type="button"
                    className={styles.dangerIconBtn}
                    style={{ fontSize: 10, padding: '1px 6px', marginLeft: 'auto', flexShrink: 0 }}
                    onClick={() => {
                      // 楽観的削除
                      setWorkLogs((prev) => ({
                        ...prev,
                        [t.id]: (prev[t.id] ?? []).filter((l: WorkLog) => l.id !== wl.id),
                      }));
                      // Undoトースト
                      showUndoToast({
                        toastId: 'wl-' + wl.id,
                        todoId: t.id,
                        message: '作業記録を削除しました',
                        undoLabel: '取り消す',
                        undo: () => {
                          // 復元
                          setWorkLogs((prev) => ({
                            ...prev,
                            [t.id]: [...(prev[t.id] ?? []), wl].sort((a: WorkLog, b: WorkLog) => b.createdAt - a.createdAt),
                          }));
                          // DB復元（POSTで再作成）
                          fetch('/api/todos/' + t.id + '/logs', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ content: wl.content, date: wl.date }),
                          });
                        },
                      });
                      // DB削除
                      fetch('/api/todos/' + t.id + '/logs', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ logId: wl.id }),
                      });
                    }}
                  >
                    🗑
                  </button>
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
      <AppHeader
        user={user}
        activeTab={activeTab}
        isPro={isPro}
        menuOpen={menuOpen}
        onMenuOpenChange={setMenuOpen}
        onTabChange={setActiveTab}
        onSwitchProTab={switchTab}
        onLogout={onLogout}
      />

      {(activeTab === 'tasks' || activeTab === 'today' || activeTab === 'calendar' || activeTab === 'task-sets' || activeTab === 'recurring') && (
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
          className={`${styles.diaryModeBtn} ${activeTab === 'today' ? styles.diaryModeBtnActive : ''}`}
          onClick={() => setActiveTab('today')}
        >
          今日
        </button>
        <button
          type="button"
          className={`${styles.diaryModeBtn} ${activeTab === 'calendar' ? styles.diaryModeBtnActive : ''}`}
          onClick={() => setActiveTab('calendar')}
        >
          カレンダー
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
        {/* カテゴリ選択 */}
        <div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>カテゴリ（任意）</span>
            <button type="button" onClick={() => setShowCategoryManager(!showCategoryManager)} style={{ fontSize: 12, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer' }}>
              {showCategoryManager ? '閉じる' : 'カテゴリ管理'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setSelectedCategory('')} style={{ padding: '4px 12px', borderRadius: 999, fontSize: 13, cursor: 'pointer', border: selectedCategory === '' ? '2px solid #3b82f6' : '1px solid var(--card-border)', background: selectedCategory === '' ? '#dbeafe' : 'var(--card-bg)', color: selectedCategory === '' ? '#1d4ed8' : 'var(--foreground)', fontWeight: selectedCategory === '' ? 600 : 400 }}>なし</button>
            {todoCategories.map((cat) => (
              <button key={cat.id} type="button" onClick={() => setSelectedCategory(cat.name)} style={{ padding: '4px 12px', borderRadius: 999, fontSize: 13, cursor: 'pointer', border: selectedCategory === cat.name ? '2px solid #3b82f6' : '1px solid var(--card-border)', background: selectedCategory === cat.name ? '#dbeafe' : 'var(--card-bg)', color: selectedCategory === cat.name ? '#1d4ed8' : 'var(--foreground)', fontWeight: selectedCategory === cat.name ? 600 : 400 }}>{cat.name}</button>
            ))}
          </div>
          {showCategoryManager && (
            <div style={{ marginTop: 8, padding: 10, background: '#f8fafc', borderRadius: 8, border: '1px solid var(--card-border)' }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <input placeholder="新しいカテゴリ名" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} className={styles.input} style={{ flex: 1 }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const name = newCategoryName.trim(); if (!name || todoCategories.some((c) => c.name === name)) { return; } fetch('/api/todo-categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, name }) }).then((r) => r.json()).then((data) => { setTodoCategories((prev) => [...prev, { id: data.id, name }]); setNewCategoryName(''); }); } }} />
                <button type="button" className={styles.primaryBtn} style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => { const name = newCategoryName.trim(); if (!name || todoCategories.some((c) => c.name === name)) { return; } fetch('/api/todo-categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, name }) }).then((r) => r.json()).then((data) => { setTodoCategories((prev) => [...prev, { id: data.id, name }]); setNewCategoryName(''); }); }}>追加</button>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {todoCategories.map((cat) => (
                  <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: '#e2e8f0', fontSize: 13 }}>
                    <span>{cat.name}</span>
                    <button type="button" onClick={() => { fetch('/api/todo-categories', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: cat.id, userId: user.id }) }).then(() => { setTodoCategories((prev) => prev.filter((c) => c.id !== cat.id)); setTodos((prev) => prev.map((t) => (t.category === cat.name ? { ...t, category: '' } : t))); }); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14, lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
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

      {/* 本日サマリー */}
      {(() => {
        const todayTotalMin: number = Object.values(todayMinMap).reduce((sum: number, v: number) => sum + v, 0);
        const todayDoneCount: number = todos.filter((t) => {
          if (!t.done || !t.lastWorkedAt) {
            return false;
          }
          const d: Date = new Date(t.lastWorkedAt);
          const now: Date = new Date();
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
        }).length;
        if (todayTotalMin === 0 && todayDoneCount === 0) {
          return null;
        }
        return (
          <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 13, color: 'var(--muted)' }}>
            {todayTotalMin > 0 && (
              <span>🔥 本日の作業: <strong style={{ color: '#f59e0b' }}>{minutesToText(todayTotalMin)}</strong></span>
            )}
            {todayDoneCount > 0 && (
              <span>✅ 本日の達成: <strong style={{ color: '#22c55e' }}>{todayDoneCount}件</strong></span>
            )}
          </div>
        );
      })()}

      {/* 凡例 + 表示切替 */}
      <div className={styles.legendRow}>
        <div className={styles.legend}>
          <span
            className={styles.legendItem}
            style={{ cursor: 'pointer', opacity: statusFilter === 'all' || statusFilter === 'danger' ? 1 : 0.4, fontWeight: statusFilter === 'danger' ? 700 : 400 }}
            onClick={() => setStatusFilter(statusFilter === 'danger' ? 'all' : 'danger')}
          >
            <span className={styles.legendDot} style={{ background: '#ef4444' }} />
            未着手({legendCounts.danger})
          </span>
          <span
            className={styles.legendItem}
            style={{ cursor: 'pointer', opacity: statusFilter === 'all' || statusFilter === 'inProgress' ? 1 : 0.4, fontWeight: statusFilter === 'inProgress' ? 700 : 400 }}
            onClick={() => setStatusFilter(statusFilter === 'inProgress' ? 'all' : 'inProgress')}
          >
            <span className={styles.legendDot} style={{ background: '#3b82f6' }} />
            着手済み({legendCounts.inProgress})
          </span>
          <span
            className={styles.legendItem}
            style={{ cursor: 'pointer', opacity: statusFilter === 'all' || statusFilter === 'done' ? 1 : 0.4, fontWeight: statusFilter === 'done' ? 700 : 400 }}
            onClick={() => setStatusFilter(statusFilter === 'done' ? 'all' : 'done')}
          >
            <span className={styles.legendDot} style={{ background: '#22c55e' }} />
            完了({legendCounts.done})
          </span>
          <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>
            📋=予定 ⏱=累計実績 🔥=本日
          </span>
        </div>
        <div data-tutorial="view-mode-buttons" className={styles.viewModeButtons}>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
            className={styles.input}
            style={{ fontSize: 12, padding: '4px 6px', maxWidth: 130 }}
            title="並び替え"
          >
            <option value="manual">手動順</option>
            <option value="createdDesc">作成日 新→古</option>
            <option value="createdAsc">作成日 古→新</option>
            <option value="deadlineAsc">期限 近→遠</option>
            <option value="deadlineDesc">期限 遠→近</option>
          </select>
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
          {!isMobile && (
            <button
              type="button"
              className={`${styles.viewModeBtn} ${viewMode === 'grid' ? styles.viewModeBtnActive : ''}`}
              onClick={() => { setViewMode('grid'); notifyTutorialAction('changeViewMode'); }}
              title="グリッド表示"
            >
              ⊞
            </button>
          )}
          {!isMobile && (
            <button
              type="button"
              className={`${styles.viewModeBtn} ${viewMode === 'kanban' ? styles.viewModeBtnActive : ''}`}
              onClick={() => { setViewMode('kanban'); }}
              title="カンバン表示"
            >
              ☰☰
            </button>
          )}
        </div>
      </div>

      {/* ルートに戻すドロップゾーン — 左サイドのunparentDropZoneで代替するため非表示 */}

      {/* カテゴリフィルター */}
      {todoCategories.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            style={{
              padding: '3px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
              border: categoryFilter === 'all' ? '2px solid #3b82f6' : '1px solid var(--card-border)',
              background: categoryFilter === 'all' ? '#dbeafe' : 'var(--card-bg)',
              color: categoryFilter === 'all' ? '#1d4ed8' : 'var(--foreground)',
              fontWeight: categoryFilter === 'all' ? 600 : 400,
            }}
          >
            全て
          </button>
          {todoCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryFilter(categoryFilter === cat.name ? 'all' : cat.name)}
              style={{
                padding: '3px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
                border: categoryFilter === cat.name ? '2px solid #3b82f6' : '1px solid var(--card-border)',
                background: categoryFilter === cat.name ? '#dbeafe' : 'var(--card-bg)',
                color: categoryFilter === cat.name ? '#1d4ed8' : 'var(--foreground)',
                fontWeight: categoryFilter === cat.name ? 600 : 400,
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Todo list — detail (既存の詳細表示) */}
      {viewMode === 'detail' && <section data-tutorial="task-list" className={`${styles.todoList} ${dragId ? styles.todoListDragging : ''}`}>
        {filteredTreeList.map(({ todo: t, depth }, idx) => {
          const bgClass: 'cardDone' | 'cardDanger' | 'cardInProgress' = cardBgClass(t);
          const isEditingThis: boolean = editingId === t.id;
          const isExpanded: boolean = expandedId === t.id;
          const isDragOverChild: boolean = dragOverId === t.id && dragOverMode === 'child' && dragId !== t.id;
          // カード間ドロップゾーンのハイライト（カードの上の隙間 = idx、下の隙間 = idx+1）
          const isBetweenActive: boolean = (dropBetweenIndex === idx && dragId !== t.id) || (touchDropIndex === idx && touchDragId !== null && touchDragId !== t.id);
          const isAfterActive: boolean = (dropBetweenIndex === (idx + 1) && dragId !== t.id) || (touchDropIndex === (idx + 1) && touchDragId !== null && touchDragId !== t.id);

          return (
            <div key={t.id}>
              {/* カード間ドロップゾーン（常にDOMに存在） */}
              <div
                className={`${styles.dropZone} ${isBetweenActive ? styles.dropZoneActive : ''}`}
                style={{ marginLeft: depth > 0 ? 21 : 0, display: (dragId || touchDragId) ? 'block' : 'none' }}
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
                    setSortMode('manual');
                  }
                  isDraggingRef.current = false;
                  setDragId(null);
                  setDragOverId(null);
                  setDragOverMode(null);
                  setDropBetweenIndex(null);
                }}
              />
            <div className={`${styles.cardRow} ${depth > 0 ? styles.cardRowNested : ''}`} style={depth > 0 ? { marginLeft: depth * (isMobile ? 8 : 16) } : {}}>
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
                    setSortMode('manual');
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
              ref={(el) => { cardRefsMap.current[t.id] = el; }}
              data-todo-id={t.id}
              className={`${styles.card} ${styles[bgClass]} ${isExpanded ? styles.cardExpanded : ''} ${isDragOverChild ? styles.cardDragOverChild : ''} ${dragOverMode === 'between' && dropBetweenIndex === idx && dragId !== t.id ? styles.cardDragOverTop : ''} ${dragOverMode === 'between' && dropBetweenIndex === idx + 1 && dragId !== t.id ? styles.cardDragOverBottom : ''} ${selectedId === t.id ? styles.cardSelected : ''} ${dragId === t.id ? styles.cardDragging : ''} ${touchDragId === t.id ? styles.cardTouchDragging : ''}`}
              style={{
                fontSize: Math.pow(0.9, depth) + 'em',
                flex: 1,
                transform: (dragId === t.id && mouseDragY !== 0)
                  ? `translateY(${mouseDragY}px)`
                  : touchDragId === t.id
                    ? `translateY(${touchDragY}px)`
                    : swipeOffset[t.id] ? `translateX(${swipeOffset[t.id]}px)` : undefined,
                transition: (dragId === t.id && mouseDragY !== 0) ? 'none' : touchDragId === t.id ? 'none' : swipeOffset[t.id] ? 'none' : 'transform 0.3s ease',
                background: touchDragId === t.id ? 'var(--card-bg)' : swipeAction[t.id] === 'nest' ? '#dbeafe' : swipeAction[t.id] === 'unnest' ? '#fef3c7' : undefined,
                opacity: (dragId === t.id && mouseDragY !== 0) ? 0.85 : touchDragId === t.id ? 0.8 : 1,
                boxShadow: (dragId === t.id && mouseDragY !== 0) ? '0 8px 24px rgba(0,0,0,0.18)' : touchDragId === t.id ? '0 8px 24px rgba(0,0,0,0.2)' : undefined,
                zIndex: (dragId === t.id && mouseDragY !== 0) ? 100 : touchDragId === t.id ? 100 : undefined,
                position: (dragId === t.id && mouseDragY !== 0) ? 'relative' as const : touchDragId === t.id ? 'relative' as const : undefined,
              }}
              onClick={() => {
                if (!isDraggingRef.current) {
                  setSelectedId(t.id);
                  toggleExpand(t.id);
                }
              }}
              onTouchStart={(e) => {
                if (!isMobile) {
                  return;
                }
                const touch = e.touches[0];
                touchStartRef.current = { x: touch.clientX, y: touch.clientY, id: t.id, time: Date.now() };
                touchDragStartY.current = touch.clientY;
                // 長押しタイマー（500ms）
                if (longPressTimerRef.current) {
                  clearTimeout(longPressTimerRef.current);
                }

                // ネイティブDOMリスナーで { passive: false } を使いスクロールを確実にブロック
                const cardEl: HTMLElement | null = e.currentTarget as HTMLElement;
                let isDragging: boolean = false;
                let longPressTriggered: boolean = false;

                const nativeTouchMove = (ev: TouchEvent): void => {
                  const t2 = ev.touches[0];

                  if (isDragging) {
                    // ドラッグモード中: スクロールを完全にブロック
                    ev.preventDefault();
                    ev.stopPropagation();
                    const dy: number = t2.clientY - touchDragStartY.current;
                    setTouchDragY(dy);
                    const cards: HTMLElement[] = Array.from(document.querySelectorAll('[data-todo-id]') as NodeListOf<HTMLElement>);
                    let dropIdx: number | null = null;
                    for (let i = 0; i < cards.length; i++) {
                      const rect: DOMRect = cards[i].getBoundingClientRect();
                      const mid: number = rect.top + rect.height / 2;
                      if (t2.clientY < mid) {
                        dropIdx = i;
                        break;
                      }
                    }
                    if (dropIdx === null) {
                      dropIdx = cards.length;
                    }
                    setTouchDropIndex(dropIdx);
                    return;
                  }

                  // 長押し待機中: 少し動いたらキャンセル
                  if (longPressTimerRef.current) {
                    const dx: number = t2.clientX - (touchStartRef.current?.x ?? 0);
                    const dy: number = t2.clientY - (touchStartRef.current?.y ?? 0);
                    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                      clearTimeout(longPressTimerRef.current);
                      longPressTimerRef.current = null;
                    } else {
                      // まだ長押し待機中でほぼ動いていない → スクロールをブロック
                      ev.preventDefault();
                    }
                  }

                  // 左右スワイプ処理
                  if (!touchStartRef.current || touchStartRef.current.id !== t.id) {
                    return;
                  }
                  const dx: number = t2.clientX - touchStartRef.current.x;
                  const dy: number = t2.clientY - touchStartRef.current.y;
                  if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
                    touchStartRef.current = null;
                    setSwipeOffset((prev) => ({ ...prev, [t.id]: 0 }));
                    setSwipeAction((prev) => ({ ...prev, [t.id]: null }));
                    return;
                  }
                  if (Math.abs(dx) > 15) {
                    ev.preventDefault();
                    setSwipeOffset((prev) => ({ ...prev, [t.id]: dx }));
                    if (dx < -60) {
                      setSwipeAction((prev) => ({ ...prev, [t.id]: 'nest' }));
                    } else if (dx > 60 && t.parentId) {
                      setSwipeAction((prev) => ({ ...prev, [t.id]: 'unnest' }));
                    } else {
                      setSwipeAction((prev) => ({ ...prev, [t.id]: null }));
                    }
                  }
                };

                const nativeTouchEnd = (): void => {
                  cardEl.removeEventListener('touchmove', nativeTouchMove);
                  cardEl.removeEventListener('touchend', nativeTouchEnd);
                  cardEl.removeEventListener('touchcancel', nativeTouchEnd);
                };

                cardEl.addEventListener('touchmove', nativeTouchMove, { passive: false });
                cardEl.addEventListener('touchend', nativeTouchEnd);
                cardEl.addEventListener('touchcancel', nativeTouchEnd);

                longPressTimerRef.current = setTimeout(() => {
                  // 長押し成立 → ドラッグモード開始
                  isDragging = true;
                  longPressTriggered = true;
                  setTouchDragId(t.id);
                  setTouchDragY(0);
                  touchStartRef.current = null;
                  setSwipeOffset((prev) => ({ ...prev, [t.id]: 0 }));
                  setSwipeAction((prev) => ({ ...prev, [t.id]: null }));
                  if (navigator.vibrate) {
                    navigator.vibrate(50);
                  }
                }, 500);
              }}
              onTouchMove={() => {
                // touchmoveはネイティブリスナーで処理（passive: false でpreventDefault可能）
              }}
              onTouchEnd={() => {
                if (!isMobile) {
                  return;
                }
                // 長押しタイマーをクリア
                if (longPressTimerRef.current) {
                  clearTimeout(longPressTimerRef.current);
                  longPressTimerRef.current = null;
                }

                // ドラッグモード終了 → ドロップ処理
                if (touchDragId === t.id && touchDropIndex !== null) {
                  const currentIdx: number = filteredTreeList.findIndex((item) => item.todo.id === t.id);
                  const dropIdx: number = touchDropIndex;
                  if (currentIdx !== -1 && dropIdx !== currentIdx && dropIdx !== currentIdx + 1) {
                    const listWithoutSelf: { todo: Todo; depth: number }[] = filteredTreeList.filter((item) => item.todo.id !== t.id);
                    const adjustedIdx: number = dropIdx > currentIdx ? dropIdx - 1 : dropIdx;
                    const prevItem: { todo: Todo } | undefined = listWithoutSelf[adjustedIdx - 1];
                    const nextItem: { todo: Todo } | undefined = listWithoutSelf[adjustedIdx];
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
                    const descendantIds: string[] = getDescendantIds(t.id, todos);
                    const movedIds: Set<string> = new Set([t.id, ...descendantIds]);
                    const oldOrder: number = t.sortOrder;
                    const diff: number = newOrder - oldOrder;
                    const updates: { id: string; sortOrder: number }[] = [];
                    const rollback: Todo[] = todos;
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
                    setSortMode('manual');
                  }
                  setTouchDragId(null);
                  setTouchDragY(0);
                  setTouchDropIndex(null);
                  return;
                }

                // 長押しドラッグがなかった場合はスワイプ処理
                if (touchDragId) {
                  setTouchDragId(null);
                  setTouchDragY(0);
                  setTouchDropIndex(null);
                }

                if (!touchStartRef.current || touchStartRef.current.id !== t.id) {
                  return;
                }
                const action = swipeAction[t.id];
                if (action === 'nest') {
                  moveRight(t.id);
                } else if (action === 'unnest' && t.parentId) {
                  moveLeft(t.id);
                }
                setSwipeOffset((prev) => ({ ...prev, [t.id]: 0 }));
                setSwipeAction((prev) => ({ ...prev, [t.id]: null }));
                touchStartRef.current = null;
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
                  const prevItem: { todo: Todo } | undefined = filteredTreeList[targetIdx - 1];
                  const nextItem: { todo: Todo } | undefined = filteredTreeList[targetIdx];
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
                  setSortMode('manual');
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
              {/* ドラッグハンドル（PC時のみ） */}
              {!isMobile && (
                <DragHandle
                  onDragStart={(e) => {
                    // HTML5 DnDを無効化し、mouseイベントで処理
                    e.preventDefault();
                  }}
                  onDragEnd={() => {}}
                  onMouseDown={(e: React.MouseEvent) => {
                    e.preventDefault();
                    isDraggingRef.current = true;
                    setDragId(t.id);
                    mouseDragStartY.current = e.clientY;
                    setMouseDragY(0);

                    const handleMouseMove = (ev: MouseEvent): void => {
                      const dy: number = ev.clientY - mouseDragStartY.current;
                      setMouseDragY(dy);
                      // ドロップ先のインデックスを計算
                      const cards: HTMLElement[] = Array.from(document.querySelectorAll('[data-todo-id]') as NodeListOf<HTMLElement>);
                      let insertBeforeIdx: number = cards.length;
                      for (let ci = 0; ci < cards.length; ci++) {
                        const cardId: string | null = cards[ci].getAttribute('data-todo-id');
                        // ドラッグ中の自分自身はスキップ
                        if (cardId === t.id) {
                          continue;
                        }
                        const rect: DOMRect = cards[ci].getBoundingClientRect();
                        const mid: number = rect.top + rect.height / 2;
                        if (ev.clientY < mid) {
                          // このカードのfilteredTreeList上のインデックスを取得
                          const treeIdx: number = filteredTreeList.findIndex((item) => item.todo.id === cardId);
                          insertBeforeIdx = treeIdx !== -1 ? treeIdx : ci;
                          break;
                        }
                      }
                      setDropBetweenIndex(insertBeforeIdx);
                      setDragOverMode('between');
                    };

                    const handleMouseUp = (): void => {
                      document.removeEventListener('mousemove', handleMouseMove);
                      document.removeEventListener('mouseup', handleMouseUp);

                      // ドロップ処理
                      if (dropBetweenIndexRef.current !== null) {
                        const currentIdx: number = filteredTreeList.findIndex((item) => item.todo.id === t.id);
                        const dropIdx: number = dropBetweenIndexRef.current;
                        if (currentIdx !== -1 && dropIdx !== currentIdx && dropIdx !== currentIdx + 1) {
                          // dropIdxは「この位置の前に挿入」を意味する
                          // 自分自身を抜いた後のリストで前後を計算
                          const listWithoutSelf: { todo: Todo; depth: number }[] = filteredTreeList.filter((item) => item.todo.id !== t.id);
                          const adjustedIdx: number = dropIdx > currentIdx ? dropIdx - 1 : dropIdx;
                          const prevItem: { todo: Todo } | undefined = listWithoutSelf[adjustedIdx - 1];
                          const nextItem: { todo: Todo } | undefined = listWithoutSelf[adjustedIdx];
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
                          const descendantIds: string[] = getDescendantIds(t.id, todos);
                          const movedIds: Set<string> = new Set([t.id, ...descendantIds]);
                          const oldOrder: number = t.sortOrder;
                          const diff: number = newOrder - oldOrder;
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
                          setSortMode('manual');
                        }
                      }

                      isDraggingRef.current = false;
                      setDragId(null);
                      setDragOverId(null);
                      setDragOverMode(null);
                      setDropBetweenIndex(null);
                      setMouseDragY(0);
                    };

                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                  }}
                />
              )}
              {/* 階層化ボタン（PC時のみ常時表示） */}
              {!isMobile && (
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
              )}
              {/* スワイプヒント（スマホのみ） */}
              {isMobile && swipeAction[t.id] && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  ...(swipeAction[t.id] === 'nest' ? { right: 12 } : { left: 12 }),
                  fontSize: 13,
                  fontWeight: 600,
                  color: swipeAction[t.id] === 'nest' ? '#2563eb' : '#d97706',
                  pointerEvents: 'none',
                }}>
                  {swipeAction[t.id] === 'nest' ? '▶ 階層化' : '◀ ルートに戻す'}
                </div>
              )}

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
                <div className={styles.cardLeftTitle}>
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
                    {t.category && (
                      <span style={{ marginLeft: 8, fontSize: 11, padding: '1px 6px', borderRadius: 999, background: '#e0f2fe', color: '#0369a1', fontWeight: 600, verticalAlign: 'middle' }}>
                        {t.category}
                      </span>
                    )}
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
                </div>

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
                    <span onDoubleClick={(e) => { e.stopPropagation(); startFieldEdit(t, 'est'); }} title="ダブルクリックで予定を編集" style={{ color: '#6b7280' }}>
                      📋{minutesToText(t.estMin)}
                    </span>
                  )}
                  {' / '}
                  {isEditingThis && editingField === 'actual' ? (
                    <span>
                      ⏱{' '}
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
                    <span onDoubleClick={(e) => { e.stopPropagation(); startFieldEdit(t, 'actual'); }} title="ダブルクリックで実績を編集" style={{ color: '#22c55e' }}>
                      ⏱{minutesToText(t.actualMin)}
                    </span>
                  )}
                  {(todayMinMap[t.id] ?? 0) > 0 && (
                    <span style={{ color: '#f59e0b' }}>
                      {' / '}🔥{minutesToText(todayMinMap[t.id])}
                    </span>
                  )}
                </div>

              </div>

              {/* ステータスバッジ */}
              <span className={bgClass === 'cardDanger' ? styles.badgeNg : styles.badgeOk} style={{ visibility: 'visible' }}>
                {bgClass === 'cardDone' ? '完了' : bgClass === 'cardInProgress' ? '着手' : '未着手'}
              </span>

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
                  <span style={{ color: t.deadline && t.deadline < Date.now() && !t.done ? '#ef4444' : undefined }}>⏰ {formatDeadline(t.deadline)}</span>
                  {(sortMode === 'createdAsc' || sortMode === 'createdDesc') && t.createdAt && (
                    <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--muted)' }}>作成: {formatDateShort(t.createdAt)}</span>
                  )}
                </div>
              )}

              {/* Right: actions */}
              <div className={styles.actions}>
                <div className={styles.actionField}>
                  <input
                    type="number"
                    min="0"
                    placeholder="+分"
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
                <button onClick={() => addLog(t.id)} className={styles.iconBtn} disabled={t.done} title="実績を加算">
                  +
                </button>
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
                    setSortMode('manual');
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
          {filteredTreeList.map(({ todo: t, depth }) => {
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
                      style={{ color: t.deadline && t.deadline < Date.now() && !t.done ? '#ef4444' : undefined }}
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
                  {(sortMode === 'createdAsc' || sortMode === 'createdDesc') && t.createdAt && (
                    <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {formatDateShort(t.createdAt)}
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
          {filteredTreeList.map(({ todo: t, depth }) => {
            const bgClass: 'cardDone' | 'cardDanger' | 'cardInProgress' = cardBgClass(t);
            const isEditingDeadline: boolean = editingId === t.id && editingField === 'deadline';
            const isExpanded: boolean = expandedId === t.id;
            return (
              <div
                key={t.id}
                className={`${styles.compactCard} ${styles[bgClass]} ${isExpanded ? styles.compactCardExpanded : ''}`}
                style={{ paddingLeft: depth * 16 + 8 }}
                onClick={() => {
                  if (expandedId === t.id) {
                    setExpandedId(null);
                  } else {
                    setExpandedId(t.id);
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
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
                      style={{ color: t.deadline && t.deadline < Date.now() && !t.done ? '#ef4444' : undefined }}
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
                  {(sortMode === 'createdAsc' || sortMode === 'createdDesc') && t.createdAt && (
                    <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {formatDateShort(t.createdAt)}
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
                {isExpanded && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--card-border)', width: '100%' }} onClick={(e) => e.stopPropagation()}>
                    {renderExpandedContent(t)}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* カンバン表示 */}
      {viewMode === 'kanban' && (() => {
        const notStarted: Todo[] = todos.filter((t) => cardBgClass(t) === 'cardDanger');
        const inProgress: Todo[] = todos.filter((t) => cardBgClass(t) === 'cardInProgress');
        const doneTasks: Todo[] = todos.filter((t) => t.done);

        function renderKanbanCard(t: Todo): React.ReactElement {
          const bgClass: 'cardDone' | 'cardDanger' | 'cardInProgress' = cardBgClass(t);
          const isExpanded: boolean = expandedId === t.id;
          return (
            <div
              key={t.id}
              className={`${styles.kanbanCard} ${styles[bgClass]}`}
            >
              {/* ヘッダー: クリックで展開/折りたたみ */}
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                onClick={() => toggleExpand(t.id)}
              >
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => toggleDone(t.id)}
                  onClick={(e) => e.stopPropagation()}
                  className={styles.checkbox}
                />
                <span style={{ fontWeight: 600, flex: 1, textDecoration: t.done ? 'line-through' : 'none', opacity: t.done ? 0.6 : 1 }}>
                  {t.title}
                </span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{isExpanded ? '▾' : '▸'}</span>
              </div>
              {t.deadline && (
                <div style={{ fontSize: 12, color: t.deadline < Date.now() && !t.done ? '#ef4444' : 'var(--muted)', marginTop: 4, paddingLeft: 30 }}>
                  期限: {formatDeadline(t.deadline)}
                </div>
              )}
              {(sortMode === 'createdAsc' || sortMode === 'createdDesc') && t.createdAt && (
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, paddingLeft: 30 }}>
                  作成: {formatDateShort(t.createdAt)}
                </div>
              )}
              {/* 展開コンテンツ: クリックはヘッダーに伝播しない */}
              {isExpanded && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--card-border)' }}>
                  {renderExpandedContent(t)}
                </div>
              )}
            </div>
          );
        }

        return (
          <div className={styles.kanbanBoard}>
            <div className={styles.kanbanColumn}>
              <div className={styles.kanbanColumnTitle} style={{ background: '#fef2f2', color: '#dc2626', borderBottom: '3px solid #ef4444' }}>
                未着手 ({notStarted.length})
              </div>
              {notStarted.map(renderKanbanCard)}
            </div>
            <div className={styles.kanbanColumn}>
              <div className={styles.kanbanColumnTitle} style={{ background: '#eff6ff', color: '#2563eb', borderBottom: '3px solid #3b82f6' }}>
                進行中 ({inProgress.length})
              </div>
              {inProgress.map(renderKanbanCard)}
            </div>
            <div className={styles.kanbanColumn}>
              <div className={styles.kanbanColumnTitle} style={{ background: '#f0fdf4', color: '#16a34a', borderBottom: '3px solid #22c55e' }}>
                完了 ({doneTasks.length})
              </div>
              {doneTasks.map(renderKanbanCard)}
            </div>
          </div>
        );
      })()}

      {/* Undo toasts */}
      <div className={styles.toastContainer}>
        {undoToasts.map((t) => (
          <div key={t.toastId} className={styles.toast}>
            <div className={styles.toastMessage}>{t.message}</div>
            {t.undoLabel !== '' && (
              <button onClick={t.undo} className={styles.iconBtn}>
                {t.undoLabel ?? '取り消す'}
              </button>
            )}
          </div>
        ))}
      </div>
      </div>
      )}

      {activeTab === 'task-sets' && (
        <TaskSetPanel
          user={user}
          categories={todoCategories}
          onApply={async (items) => {
            const minOrder: number = todos.length > 0 ? Math.min(...todos.map((t) => t.sortOrder)) : 0;
            for (let i: number = 0; i < items.length; i++) {
              // deadlineはX日後の数値文字列（例: "3"）→ 今日からX日後の23:59:59に変換
              let deadlineTs: number | undefined = undefined;
              if (items[i].deadline) {
                const daysLater: number = parseInt(items[i].deadline as string, 10);
                if (!isNaN(daysLater) && daysLater >= 0) {
                  const d: Date = new Date();
                  d.setDate(d.getDate() + daysLater);
                  d.setHours(23, 59, 59, 999);
                  deadlineTs = d.getTime();
                }
              }
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

      {activeTab === 'today' && (() => {
        return (
        <TodayPanel
          todos={todos}
          onToggleDone={toggleDone}
          todayActualMap={todayMinMap}
          onAddLog={(id: string, minutes: number) => {
            const target: Todo | undefined = todos.find((t) => t.id === id);
            if (!target) {
              return;
            }
            const newActual: number = target.actualMin + minutes;
            const now: number = Date.now();
            setTodos((prev) =>
              prev.map((t) => (t.id === id ? { ...t, actualMin: newActual, lastWorkedAt: now, started: true } : t)),
            );
            fetch('/api/todos/' + id, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ updates: { actualMin: newActual, lastWorkedAt: now, started: 1 } }),
            });
            // 作業ログにも記録
            fetch('/api/todos/' + id + '/logs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: `+${minutes}分 作業` }),
            });
            // todayMinMapを更新
            setTodayMinMap((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + minutes }));
          }}
          renderExpanded={(t: Todo) => renderExpandedContent(t)}
          onFieldEdit={(todoId: string, field: string, value: string) => {
            const updates: Record<string, unknown> = {};
            if (field === 'title') {
              const trimmed: string = value.trim();
              if (!trimmed) { return; }
              updates.title = trimmed;
              setTodos((prev) => prev.map((t) => (t.id === todoId ? { ...t, title: trimmed } : t)));
            } else if (field === 'detail') {
              updates.detail = value.trim();
              setTodos((prev) => prev.map((t) => (t.id === todoId ? { ...t, detail: value.trim() || undefined } : t)));
            } else if (field === 'est') {
              const est: number = Math.max(1, parseInt(value || '0', 10));
              updates.estMin = est;
              setTodos((prev) => prev.map((t) => (t.id === todoId ? { ...t, estMin: est } : t)));
            } else if (field === 'actual') {
              const actual: number = Math.max(0, parseInt(value || '0', 10));
              updates.actualMin = actual;
              updates.lastWorkedAt = Date.now();
              setTodos((prev) => prev.map((t) => (t.id === todoId ? { ...t, actualMin: actual, lastWorkedAt: Date.now() } : t)));
            } else if (field === 'deadline') {
              const deadline: number | undefined = value ? new Date(value + 'T23:59:59').getTime() : undefined;
              updates.deadline = deadline ?? null;
              setTodos((prev) => prev.map((t) => (t.id === todoId ? { ...t, deadline } : t)));
            }
            fetch('/api/todos/' + todoId, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ updates }),
            });
          }}
        />
        );
      })()}

      {activeTab === 'calendar' && (
        <CalendarPanel todos={todos} userId={user.id} />
      )}

      {activeTab === 'category-stats' && (
        <CategoryStatsPanel user={user} />
      )}

      {activeTab === 'archived' && (
        <ArchivedTodosPanel user={user} onRestore={fetchTodos} />
      )}

      {activeTab === 'recurring' && (
        <RecurringPanel user={user} onRefresh={fetchTodos} categories={todoCategories.map((c: { id: string; name: string }) => c.name)} />
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
          onUpdate={(updated: UserSettings) => { setSettings(updated); try { localStorage.setItem('kiroku:settings:' + user.id, JSON.stringify(updated)); } catch { /* ignore */ } }}
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

      {activeTab === 'bucket-list' && (
        <BucketListPanel user={user} />
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
            const now: number = Date.now();
            setTodos((prev) =>
              prev.map((t) => (t.id === id ? { ...t, actualMin: newActual, lastWorkedAt: now } : t)),
            );
            fetch('/api/todos/' + id, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ updates: { actualMin: newActual, lastWorkedAt: now } }),
            });
            // 作業ログにも記録
            fetch('/api/todos/' + id + '/logs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: `+${minutes}分 ポモドーロ作業` }),
            });
            setTodayMinMap((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + minutes }));
          }}
          workMinutes={settings.pomodoroWork ?? 25}
          breakMinutes={settings.pomodoroBreak ?? 5}
        />
      )}

      {settings.showButler !== false && (
        <ButlerAvatar todos={todos} settings={settings} />
      )}

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
