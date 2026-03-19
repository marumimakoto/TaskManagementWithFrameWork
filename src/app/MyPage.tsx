'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AppUser } from './types';
import { log, saveSession } from './utils';
import styles from './page.module.css';

/**
 * マイページコンポーネント
 * プロフィール（名前・メールアドレス・誕生日）の表示・編集とパスワード変更を行う
 * @param user - ログイン中のユーザー情報
 * @param onUserUpdate - プロフィール更新時にページ全体のユーザー情報を同期するコールバック
 */
export default function MyPage({
  user,
  onUserUpdate,
}: {
  user: AppUser;
  onUserUpdate: (updated: AppUser) => void;
}): React.ReactElement {
  // プロフィール
  const [name, setName] = useState<string>(user.name);
  const [email, setEmail] = useState<string>(user.email);
  const [birthday, setBirthday] = useState<string>(user.birthday ?? '');
  const [avatar, setAvatar] = useState<string>(user.avatar ?? '');
  const [profileMsg, setProfileMsg] = useState<string>('');
  const [profileError, setProfileError] = useState<string>('');

  // パスワード変更
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [passwordMsg, setPasswordMsg] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');

  /**
   * プロフィールを保存する
   */
  async function saveProfile(): Promise<void> {
    setProfileMsg('');
    setProfileError('');

    const res: Response = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        name,
        email,
        birthday: birthday || undefined,
        avatar: avatar || undefined,
      }),
    });
    const data: { user?: AppUser; error?: string } = await res.json();

    if (!res.ok || !data.user) {
      setProfileError(data.error ?? '保存に失敗しました');
      return;
    }

    saveSession(data.user);
    onUserUpdate(data.user);
    setProfileMsg('保存しました');
    log('profile:update', { userId: user.id });
  }

  /**
   * パスワードを変更する
   */
  async function changePassword(): Promise<void> {
    setPasswordMsg('');
    setPasswordError('');

    const res: Response = await fetch('/api/auth/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        currentPassword,
        newPassword,
      }),
    });
    const data: { ok?: boolean; error?: string } = await res.json();

    if (!res.ok || !data.ok) {
      setPasswordError(data.error ?? 'パスワード変更に失敗しました');
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setPasswordMsg('パスワードを変更しました');
    log('password:change', { userId: user.id });
  }

  return (
    <div className={styles.myPage}>
      {/* プロフィール */}
      <section className={styles.myPageSection}>
        <h2 className={styles.myPageHeading}>プロフィール</h2>
        <div className={styles.myPageForm}>
          {/* アイコン */}
          <div className={styles.avatarSection}>
            <div
              className={styles.avatarPreview}
              style={avatar ? { backgroundImage: `url(${avatar})` } : {}}
            >
              {!avatar && '?'}
            </div>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => {
                const input: HTMLInputElement = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = () => {
                  const file: File | undefined = input.files?.[0];
                  if (!file) {
                    return;
                  }
                  const reader: FileReader = new FileReader();
                  reader.onload = () => {
                    setAvatar(reader.result as string);
                  };
                  reader.readAsDataURL(file);
                };
                input.click();
              }}
            >
              画像を変更
            </button>
            {avatar && (
              <button
                type="button"
                className={styles.dangerIconBtn}
                onClick={() => setAvatar('')}
              >
                削除
              </button>
            )}
          </div>
          <div>
            <label className={styles.fieldLabel}>名前</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={styles.input}
            />
          </div>
          <div>
            <label className={styles.fieldLabel}>メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
            />
          </div>
          <div>
            <label className={styles.fieldLabel}>誕生日</label>
            <input
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              className={styles.input}
            />
          </div>
          {profileError && <p className={styles.loginError}>{profileError}</p>}
          {profileMsg && <p className={styles.myPageSuccess}>{profileMsg}</p>}
          <button type="button" onClick={saveProfile} className={styles.primaryBtn}>
            保存
          </button>
        </div>
      </section>

      {/* パスワード変更 */}
      <section className={styles.myPageSection}>
        <h2 className={styles.myPageHeading}>パスワード変更</h2>
        <div className={styles.myPageForm}>
          <div>
            <label className={styles.fieldLabel}>現在のパスワード</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={styles.input}
            />
          </div>
          <div>
            <label className={styles.fieldLabel}>新しいパスワード（6文字以上）</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={styles.input}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  changePassword();
                }
              }}
            />
          </div>
          {passwordError && <p className={styles.loginError}>{passwordError}</p>}
          {passwordMsg && <p className={styles.myPageSuccess}>{passwordMsg}</p>}
          <button type="button" onClick={changePassword} className={styles.primaryBtn}>
            変更
          </button>
          <p className={styles.loginHint}>
            <a href="/forgot-password" className={styles.linkBtn}>パスワードを忘れた場合</a>
          </p>
        </div>
      </section>
    </div>
  );
}
