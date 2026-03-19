'use client';

import { useState } from 'react';
import styles from '../page.module.css';

/**
 * パスワードリセット申請ページ
 * メールアドレスを入力して再設定リンクを送信する
 */
export default function ForgotPasswordPage(): React.ReactElement {
  const [email, setEmail] = useState<string>('');
  const [sent, setSent] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  /** リセット申請を送信する */
  async function handleSubmit(): Promise<void> {
    setError('');
    if (!email.trim()) {
      setError('メールアドレスを入力してください');
      return;
    }

    const res: Response = await fetch('/api/auth/reset-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    });
    const data: { ok?: boolean; error?: string } = await res.json();

    if (!res.ok && data.error) {
      setError(data.error);
      return;
    }

    setSent(true);
  }

  return (
    <div className={styles.loginWrapper}>
      <div className={styles.loginCard}>
        <h1 className={styles.loginTitle}>パスワード再設定</h1>

        {sent ? (
          <div>
            <p className={styles.resetSentMsg}>
              入力されたメールアドレス宛にパスワード再設定リンクを送信しました。
              メールをご確認ください。
            </p>
            <p className={styles.loginHint}>
              <a href="/" className={styles.linkBtn}>ログインに戻る</a>
            </p>
          </div>
        ) : (
          <div className={styles.loginForm}>
            <p className={styles.resetDescription}>
              登録済みのメールアドレスを入力してください。パスワード再設定リンクをお送りします。
            </p>
            <input
              type="email"
              placeholder="メールアドレス"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSubmit();
                }
              }}
            />
            {error && <p className={styles.loginError}>{error}</p>}
            <button type="button" onClick={handleSubmit} className={styles.primaryBtn}>
              再設定リンクを送信
            </button>
            <p className={styles.loginHint}>
              <a href="/" className={styles.linkBtn}>ログインに戻る</a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
