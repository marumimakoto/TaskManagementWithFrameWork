'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import styles from '../page.module.css';

/**
 * パスワード再設定ページの中身
 * URLのクエリパラメータからトークンを取得して新しいパスワードを設定する
 */
function ResetPasswordForm(): React.ReactElement {
  const searchParams = useSearchParams();
  const token: string | null = searchParams.get('token');

  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [done, setDone] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  /** 新しいパスワードを送信する */
  async function handleReset(): Promise<void> {
    setError('');

    if (!newPassword || newPassword.length < 6) {
      setError('パスワードは6文字以上で入力してください');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }

    const res: Response = await fetch('/api/auth/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });
    const data: { ok?: boolean; error?: string } = await res.json();

    if (!res.ok || !data.ok) {
      setError(data.error ?? 'パスワードの再設定に失敗しました');
      return;
    }

    setDone(true);
  }

  if (!token) {
    return (
      <div className={styles.loginWrapper}>
        <div className={styles.loginCard}>
          <h1 className={styles.loginTitle}>エラー</h1>
          <p className={styles.resetDescription}>無効なリセットリンクです。</p>
          <p className={styles.loginHint}>
            <a href="/forgot-password" className={styles.linkBtn}>パスワード再設定を申請する</a>
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className={styles.loginWrapper}>
      <div className={styles.loginCard}>
        <h1 className={styles.loginTitle}>新しいパスワード</h1>

        {done ? (
          <div>
            <p className={styles.resetSentMsg}>
              パスワードを再設定しました。新しいパスワードでログインしてください。
            </p>
            <p className={styles.loginHint}>
              <a href="/" className={styles.linkBtn}>ログインに戻る</a>
            </p>
          </div>
        ) : (
          <div className={styles.loginForm}>
            <input
              type="password"
              placeholder="新しいパスワード（6文字以上）"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={styles.input}
            />
            <input
              type="password"
              placeholder="パスワード（確認）"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={styles.input}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleReset();
                }
              }}
            />
            {error && <p className={styles.loginError}>{error}</p>}
            <button type="button" onClick={handleReset} className={styles.primaryBtn}>
              パスワードを再設定
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * パスワード再設定ページ
 * useSearchParamsをSuspenseで囲む必要がある
 */
export default function ResetPasswordPage(): React.ReactElement {
  return (
    <Suspense fallback={<div className={styles.loginWrapper}><p>読み込み中...</p></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
