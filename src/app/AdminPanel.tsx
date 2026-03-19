'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AppUser } from './types';
import { formatDateShort } from './utils';
import styles from './page.module.css';

interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: number;
}

interface PublicDiary {
  id: string;
  userName: string;
  title: string;
  date: string;
}

/**
 * 管理者ページ
 * ユーザー一覧の閲覧、公開コンテンツの管理
 */
export default function AdminPanel({ user }: { user: AppUser }): React.ReactElement {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [diaries, setDiaries] = useState<PublicDiary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [tab, setTab] = useState<'users' | 'diaries' | 'bugs'>('users');
  const [message, setMessage] = useState<string>('');

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      const [usersRes, diaryRes] = await Promise.all([
        fetch('/api/admin?role=admin'),
        fetch('/api/diary/public?userId=' + user.id),
      ]);
      const usersData: UserInfo[] = await usersRes.json();
      const diaryData = await diaryRes.json();
      setUsers(usersData);
      setDiaries((diaryData ?? []).map((d: { id: string; user_name?: string; userName?: string; title: string; date: string }) => ({
        id: d.id,
        userName: d.user_name ?? d.userName ?? '',
        title: d.title,
        date: d.date,
      })));
    } catch (e) {
      console.error('Failed to fetch admin data', e);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function showMsg(msg: string): void {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  }

  async function deleteDiary(id: string): Promise<void> {
    if (!window.confirm('この公開日記を削除しますか？')) {
      return;
    }
    try {
      await fetch('/api/admin', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'admin', type: 'diary', id }),
      });
      setDiaries((prev) => prev.filter((d) => d.id !== id));
      showMsg('削除しました');
    } catch (e) {
      console.error('Failed to delete diary', e);
    }
  }

  if (user.role !== 'admin') {
    return <p className={styles.diaryEmpty}>管理者権限が必要です</p>;
  }

  return (
    <div className={styles.diaryPanel}>
      <div className={styles.helpModeBar}>
        <button
          type="button"
          className={`${styles.viewModeBtn} ${tab === 'users' ? styles.viewModeBtnActive : ''}`}
          onClick={() => setTab('users')}
        >
          ユーザー
        </button>
        <button
          type="button"
          className={`${styles.viewModeBtn} ${tab === 'diaries' ? styles.viewModeBtnActive : ''}`}
          onClick={() => setTab('diaries')}
        >
          公開日記
        </button>
        <button
          type="button"
          className={`${styles.viewModeBtn} ${tab === 'bugs' ? styles.viewModeBtnActive : ''}`}
          onClick={() => setTab('bugs')}
        >
          バグ報告
        </button>
        {message && (
          <span className={styles.matrixMessage} style={{ marginLeft: 8 }}>{message}</span>
        )}
      </div>

      {loading && <p className={styles.diaryEmpty}>読み込み中...</p>}

      {!loading && tab === 'users' && (
        <div className={styles.statsTable}>
          <div className={styles.statsHeaderRow} style={{ gridTemplateColumns: '1fr 1.5fr 1fr 1fr' }}>
            <span className={styles.statsHeaderCell}>名前</span>
            <span className={styles.statsHeaderCell}>メール</span>
            <span className={styles.statsHeaderCell}>権限</span>
            <span className={styles.statsHeaderCell}>登録日</span>
          </div>
          {users.map((u: UserInfo) => (
            <div key={u.id} className={styles.statsRow} style={{ gridTemplateColumns: '1fr 1.5fr 1fr 1fr' }}>
              <span className={styles.statsCell}>{u.name}</span>
              <span className={styles.statsCell}>{u.email}</span>
              <span className={styles.statsCell}>{u.role === 'admin' ? '管理者' : '一般'}</span>
              <span className={styles.statsCell}>{formatDateShort(u.created_at)}</span>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === 'diaries' && (
        <div className={styles.archiveList}>
          {diaries.length === 0 ? (
            <p className={styles.diaryEmpty}>公開日記はありません</p>
          ) : (
            diaries.map((d: PublicDiary) => (
              <div key={d.id} className={styles.archiveCard}>
                <div className={styles.archiveCardMain}>
                  <span className={styles.archiveTitle}>{d.title}</span>
                  <span className={styles.archiveDeadline}>{d.userName} / {d.date}</span>
                </div>
                <button
                  type="button"
                  className={styles.dangerIconBtn}
                  style={{ fontSize: '12px', padding: '4px 10px', alignSelf: 'flex-start' }}
                  onClick={() => deleteDiary(d.id)}
                >
                  削除
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {!loading && tab === 'bugs' && (
        <p className={styles.diaryEmpty}>
          バグ報告はハンバーガーメニューの「バグ報告」ページから管理できます
        </p>
      )}
    </div>
  );
}
