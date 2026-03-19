'use client';

import { useState } from 'react';
import type { AppUser } from './types';
import { log, todayString } from './utils';
import styles from './page.module.css';
import RichEditor from './RichEditor';

/**
 * 日記を書くページ
 * @param user - ログイン中のユーザー情報
 */
export default function DiaryWritePanel({ user }: { user: AppUser }): React.ReactElement {
  const [newDate, setNewDate] = useState<string>(todayString());
  const [newTitle, setNewTitle] = useState<string>('');
  const [newContent, setNewContent] = useState<string>('');
  const [toastMsg, setToastMsg] = useState<string>('');

  /** 日記エントリを作成する */
  async function addEntry(): Promise<void> {
    const content: string = newContent.trim();
    if (!content || !newDate) {
      return;
    }

    const title: string = newTitle.trim() || '無題';
    const res: Response = await fetch('/api/diary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, title, date: newDate, content }),
    });
    const data: { entry: unknown; appended: boolean } = await res.json();

    if (data.appended) {
      setToastMsg('既存の日記に追記しました');
    } else {
      setToastMsg('日記を保存しました');
    }
    window.setTimeout(() => setToastMsg(''), 3000);

    setNewTitle('');
    setNewContent('');
    log('diary:add', { date: newDate });
  }

  return (
    <div className={styles.diaryPanel}>
      <section className={styles.diaryForm}>
        <div className={styles.diaryDateTitleRow}>
          <div>
            <label className={styles.fieldLabel}>日付</label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className={styles.input}
            />
          </div>
          <div className={styles.diaryTitleField}>
            <label className={styles.fieldLabel}>タイトル</label>
            <input
              placeholder="無題"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className={styles.input}
            />
          </div>
        </div>
        <label className={styles.fieldLabel}>内容</label>
        <RichEditor
          content={newContent}
          onChange={(html: string) => setNewContent(html)}
          placeholder="今日あったことを書く..."
        />
        <button type="button" onClick={addEntry} className={styles.primaryBtn}>
          記録する
        </button>
      </section>

      {toastMsg && (
        <div className={styles.toastContainer}>
          <div className={styles.toast}>
            <div className={styles.toastMessage}>{toastMsg}</div>
          </div>
        </div>
      )}
    </div>
  );
}
