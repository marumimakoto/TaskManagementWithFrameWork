'use client';

import { useEffect, useRef, useState } from 'react';
import type { AppUser } from './types';
import { log, loadSession, saveSession, clearSession } from './utils';
import styles from './page.module.css';
import { WELCOME_MESSAGES } from './welcomeMessages';
import TodoApp from './TodoApp';

/**
 * ページのルートコンポーネント
 * ログイン状態を管理し、未ログインならログイン/登録画面、ログイン済みならTodoAppを表示する
 */

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
