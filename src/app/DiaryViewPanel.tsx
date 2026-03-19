'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppUser, DiaryEntry } from './types';
import { log } from './utils';
import styles from './page.module.css';
import RichEditor from './RichEditor';
import { Pagination } from './SharedComponents';

/**
 * 日記を見直すページ
 * フィルター・編集・削除（Undo付き）・公開切り替えを行う
 * @param user - ログイン中のユーザー情報
 */
export default function DiaryViewPanel({ user }: { user: AppUser }): React.ReactElement {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editContent, setEditContent] = useState<string>('');
  const [toastMsg, setToastMsg] = useState<string>('');
  const [undoEntry, setUndoEntry] = useState<DiaryEntry | null>(null);
  const [undoTimerId, setUndoTimerId] = useState<number | null>(null);

  // フィルター
  const [searchWord, setSearchWord] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const PAGE_SIZE: number = 20;

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

  /** 編集を開始する */
  function startEdit(entry: DiaryEntry): void {
    setEditingId(entry.id);
    setEditTitle(entry.title);
    setEditContent(entry.content);
  }

  /** 編集をキャンセルする */
  function cancelEdit(): void {
    setEditingId(null);
  }

  /** 編集内容を保存する */
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

  /** 日記を削除する（Undo付き） */
  async function deleteEntry(id: string): Promise<void> {
    const target: DiaryEntry | undefined = entries.find((e) => e.id === id);
    if (!target) {
      return;
    }

    setEntries((prev) => prev.filter((e) => e.id !== id));
    setUndoEntry(target);
    setToastMsg(`「${target.title}」を削除しました`);

    // 3秒後に実際に削除
    if (undoTimerId) {
      window.clearTimeout(undoTimerId);
    }
    const timerId: number = window.setTimeout(async () => {
      await fetch('/api/diary/' + id, { method: 'DELETE' });
      setToastMsg('');
      setUndoEntry(null);
      log('diary:delete', { id });
    }, 3000);
    setUndoTimerId(timerId);
  }

  /** 削除を取り消す */
  function undoDelete(): void {
    if (undoTimerId) {
      window.clearTimeout(undoTimerId);
    }
    if (undoEntry) {
      setEntries((prev) => [undoEntry, ...prev]);
    }
    setToastMsg('');
    setUndoEntry(null);
    setUndoTimerId(null);
  }

  /** 公開/非公開を切り替える */
  async function togglePublic(id: string): Promise<void> {
    const target: DiaryEntry | undefined = entries.find((e) => e.id === id);
    if (!target) {
      return;
    }

    const newPublic: boolean = !target.isPublic;
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, isPublic: newPublic } : e)),
    );

    await fetch('/api/diary/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublic: newPublic }),
    });

    log('diary:togglePublic', { id, isPublic: newPublic });
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

  // フィルター変更時にページをリセット
  useEffect(() => {
    setCurrentPage(1);
  }, [dateFrom, dateTo, searchWord]);

  const totalPages: number = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged: DiaryEntry[] = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (loading) {
    return <p>読み込み中...</p>;
  }

  return (
    <div className={styles.diaryPanel}>
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
        {paged.map((entry: DiaryEntry) => (
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
                {entry.isPublic && (
                  <span className={styles.publicBadge}>公開中</span>
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
                    <button
                      type="button"
                      onClick={() => togglePublic(entry.id)}
                      className={entry.isPublic ? styles.primaryBtn : styles.iconBtn}
                      style={{ fontSize: '12px', padding: '4px 8px' }}
                    >
                      {entry.isPublic ? '非公開にする' : '公開する'}
                    </button>
                  </>
                )}
              </div>
            </div>
            {editingId === entry.id ? (
              <RichEditor
                content={editContent}
                onChange={(html: string) => setEditContent(html)}
              />
            ) : (
              <div className={styles.diaryContent} dangerouslySetInnerHTML={{ __html: entry.content }} />
            )}
          </article>
        ))}

        {/* ページネーション */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPrevious={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          onNext={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
        />
      </section>

      {/* トースト */}
      {toastMsg && (
        <div className={styles.toastContainer}>
          <div className={styles.toast}>
            <div className={styles.toastMessage}>{toastMsg}</div>
            {undoEntry && (
              <button onClick={undoDelete} className={styles.iconBtn}>
                取り消す
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
