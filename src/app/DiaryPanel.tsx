'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppUser, DiaryEntry } from './types';
import { log, uid } from './utils';
import styles from './page.module.css';
import RichEditor from './RichEditor';

/**
 * 今日の日付を YYYY-MM-DD 形式で返す
 * @returns 今日の日付文字列
 */
function todayString(): string {
  const now: Date = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * 日記パネルコンポーネント
 * 日付ごとの日記エントリの一覧表示・作成・編集・削除を行う
 * @param user - ログイン中のユーザー情報
 */
export default function DiaryPanel({ user }: { user: AppUser }): React.ReactElement {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [newDate, setNewDate] = useState<string>(todayString());
  const [newTitle, setNewTitle] = useState<string>('');
  const [newContent, setNewContent] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editContent, setEditContent] = useState<string>('');
  const [toastMsg, setToastMsg] = useState<string>('');

  // フィルター
  const [searchWord, setSearchWord] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  /** APIから日記一覧を取得する */
  const fetchEntries = useCallback(async (): Promise<void> => {
    try {
      const res: Response = await fetch('/api/diary?userId=' + user.id);
      const data: DiaryEntry[] = await res.json();
      setEntries(data);
      log('diary:fetch', { count: data.length });
    } catch (e) {
      console.warn('Failed to fetch diary entries', e);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  /**
   * 日記エントリを作成する。同日のエントリが既にある場合はAPIが追記して返す
   * フロント側では返ってきたエントリのIDで既存を差し替えるか、新規追加する
   */
  async function addEntry(): Promise<void> {
    // 内容が空なら何もしない
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
    const data: { entry: DiaryEntry; appended: boolean } = await res.json();
    const entry: DiaryEntry = data.entry;

    setEntries((prev) => {
      const existingIndex: number = prev.findIndex((e) => e.id === entry.id);
      if (existingIndex >= 0) {
        const updated: DiaryEntry[] = [...prev];
        updated[existingIndex] = entry;
        return updated;
      }
      return [entry, ...prev];
    });

    if (data.appended) {
      setToastMsg('既存の日記に追記しました');
      window.setTimeout(() => {
        setToastMsg('');
      }, 3000);
    }
    setNewTitle('');
    setNewContent('');
    log('diary:add', { date: newDate });
  }

  /**
   * 日記エントリの編集を開始する
   * @param entry - 編集対象のエントリ
   */
  function startEdit(entry: DiaryEntry): void {
    setEditingId(entry.id);
    setEditTitle(entry.title);
    setEditContent(entry.content);
  }

  /** 編集をキャンセルする */
  function cancelEdit(): void {
    setEditingId(null);
  }

  /**
   * 編集内容を保存する
   * @param id - 対象エントリのID
   */
  async function saveEdit(id: string): Promise<void> {
    const content: string = editContent.trim();
    if (!content) {
      return;
    }
    const title: string = editTitle.trim() || '無題';

    await fetch('/api/diary/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content }),
    });

    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, title, content, updatedAt: Date.now() } : e)),
    );
    setEditingId(null);
    log('diary:edit', { id });
  }

  /**
   * 日記エントリを削除する
   * @param id - 対象エントリのID
   */
  async function deleteEntry(id: string): Promise<void> {
    await fetch('/api/diary/' + id, { method: 'DELETE' });
    setEntries((prev) => prev.filter((e) => e.id !== id));
    log('diary:delete', { id });
  }

  /** フィルター条件に基づいて絞り込まれた日記一覧 */
  const filtered: DiaryEntry[] = useMemo((): DiaryEntry[] => {
    return entries.filter((e: DiaryEntry): boolean => {
      if (dateFrom && e.date < dateFrom) {
        return false;
      }
      if (dateTo && e.date > dateTo) {
        return false;
      }
      if (searchWord.trim()) {
        const word: string = searchWord.trim().toLowerCase();
        const inTitle: boolean = e.title.toLowerCase().includes(word);
        const inContent: boolean = e.content.toLowerCase().includes(word);
        if (!inTitle && !inContent) {
          return false;
        }
      }
      return true;
    });
  }, [entries, dateFrom, dateTo, searchWord]);

  if (loading) {
    return <p>読み込み中...</p>;
  }

  return (
    <div className={styles.diaryPanel}>
      {/* 新規作成フォーム */}
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

      {/* フィルター */}
      <section className={styles.diaryFilter}>
        <div className={styles.diaryFilterRow}>
          <div>
            <label className={styles.fieldLabel}>開始日</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={styles.input}
            />
          </div>
          <div>
            <label className={styles.fieldLabel}>終了日</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={styles.input}
            />
          </div>
          <div className={styles.diarySearchField}>
            <label className={styles.fieldLabel}>キーワード</label>
            <input
              type="text"
              placeholder="タイトル・本文を検索"
              value={searchWord}
              onChange={(e) => setSearchWord(e.target.value)}
              className={styles.input}
            />
          </div>
          {(dateFrom || dateTo || searchWord) && (
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => { setDateFrom(''); setDateTo(''); setSearchWord(''); }}
              style={{ alignSelf: 'flex-end' }}
            >
              クリア
            </button>
          )}
        </div>
        <p className={styles.diaryFilterCount}>
          {filtered.length} / {entries.length} 件
        </p>
      </section>

      {/* エントリ一覧 */}
      <section className={styles.diaryList}>
        {filtered.length === 0 && entries.length === 0 && (
          <p className={styles.diaryEmpty}>日記はまだありません</p>
        )}
        {filtered.length === 0 && entries.length > 0 && (
          <p className={styles.diaryEmpty}>条件に一致する日記がありません</p>
        )}
        {filtered.map((entry: DiaryEntry) => (
          <article key={entry.id} className={styles.diaryCard}>
            <div className={styles.diaryCardHeader}>
              <div className={styles.diaryDateTitleInline}>
                <span className={styles.diaryDate}>{entry.date}</span>
                {editingId === entry.id ? (
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className={styles.diaryTitleInput}
                    placeholder="無題"
                  />
                ) : (
                  <span className={styles.diaryTitle}>{entry.title}</span>
                )}
              </div>
              <div className={styles.diaryActions}>
                {editingId === entry.id ? (
                  <>
                    <button type="button" onClick={() => saveEdit(entry.id)} className={styles.iconBtn}>
                      保存
                    </button>
                    <button type="button" onClick={cancelEdit} className={styles.iconBtn}>
                      取消
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => startEdit(entry)} className={styles.iconBtn}>
                      編集
                    </button>
                    <button type="button" onClick={() => deleteEntry(entry.id)} className={styles.dangerIconBtn}>
                      削除
                    </button>
                  </>
                )}
              </div>
            </div>
            {editingId === entry.id ? (
              <>
              <RichEditor
                content={editContent}
                onChange={(html: string) => setEditContent(html)}
              />
              </>
            ) : (
              <div className={styles.diaryContent} dangerouslySetInnerHTML={{ __html: entry.content }} />
            )}
          </article>
        ))}
      </section>

      {/* 追記トースト */}
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
