'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AppUser } from './types';
import { formatDeadline, formatDateTime } from './utils';
import styles from './page.module.css';

/** アーカイブされたタスクの型 */
interface ArchivedTodo {
  id: string;
  title: string;
  estMin: number;
  actualMin: number;
  detail?: string;
  deadline?: number;
  done: boolean;
  createdAt: number;
  archivedAt: number;
}

/**
 * 削除済みタスクのアーカイブ一覧ページ
 * 過去100件のアーカイブを表示し、選択してタスクに復元できる
 */
export default function ArchivedTodosPanel({
  user,
  onRestore,
}: {
  user: AppUser;
  onRestore: () => void;
}): React.ReactElement {
  const [archived, setArchived] = useState<ArchivedTodo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [restoredIds, setRestoredIds] = useState<Set<string>>(new Set());

  /** アーカイブ一覧を取得する */
  const fetchArchived = useCallback(async (): Promise<void> => {
    try {
      const res: Response = await fetch('/api/todos/archive?userId=' + user.id);
      const data: ArchivedTodo[] = await res.json();
      setArchived(data);
    } catch (e) {
      console.error('Failed to fetch archived todos', e);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    fetchArchived();
  }, [fetchArchived]);

  /** アーカイブからタスクを復元する */
  async function restoreTodo(id: string): Promise<void> {
    setProcessingId(id);
    try {
      await fetch('/api/todos/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, id }),
      });
      setRestoredIds((prev) => {
        const next: Set<string> = new Set(prev);
        next.add(id);
        return next;
      });
      onRestore();
    } catch (e) {
      console.error('Failed to restore todo', e);
    } finally {
      setProcessingId(null);
    }
  }

  /** 復元を取り消す（タスクを再度削除してアーカイブに戻す） */
  async function undoRestore(id: string): Promise<void> {
    setProcessingId(id);
    try {
      // todosから削除（DELETE APIがアーカイブに再保存する）
      await fetch('/api/todos/' + id, { method: 'DELETE' });
      setRestoredIds((prev) => {
        const next: Set<string> = new Set(prev);
        next.delete(id);
        return next;
      });
      onRestore();
    } catch (e) {
      console.error('Failed to undo restore', e);
    } finally {
      setProcessingId(null);
    }
  }


  /** アーカイブを全て削除する */
  async function removeAllArchived(): Promise<void> {
    if (archived.length === 0) {
      return;
    }
    if (!window.confirm(`アーカイブ${archived.length}件を全て削除しますか？この操作は取り消せません。`)) {
      return;
    }
    try {
      await fetch('/api/todos/archive?userId=' + user.id, { method: 'DELETE' });
      setArchived([]);
    } catch (e) {
      console.error('Failed to delete all archived', e);
    }
  }

  if (loading) {
    return <p className={styles.diaryEmpty}>読み込み中...</p>;
  }

  return (
    <div className={styles.archivePanel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h2 className={styles.panelTitle} style={{ margin: 0 }}>削除したタスク（最大100件）</h2>
        {archived.length > 0 && (
          <button
            type="button"
            className={styles.dangerIconBtn}
            onClick={removeAllArchived}
            style={{ fontSize: '12px', padding: '4px 10px' }}
          >
            全て削除
          </button>
        )}
      </div>
      {archived.length === 0 ? (
        <p className={styles.diaryEmpty}>削除済みタスクはありません</p>
      ) : (
        <div className={styles.archiveList}>
          {archived.map((t: ArchivedTodo) => {
            const isRestored: boolean = restoredIds.has(t.id);
            const isProcessing: boolean = processingId === t.id;
            return (
              <div
                key={t.id}
                className={`${styles.archiveCard} ${isRestored ? styles.archiveCardRestored : ''}`}
              >
                <div className={styles.archiveCardMain}>
                  {isRestored ? (
                    <span className={styles.archiveStatusRestored}>復元済み</span>
                  ) : (
                    <span className={`${styles.archiveStatus} ${t.done ? styles.archiveStatusDone : styles.archiveStatusUndone}`}>
                      {t.done ? '完了' : '未完了'}
                    </span>
                  )}
                  <span className={styles.archiveTitle}>{t.title}</span>
                  {t.deadline && (
                    <span className={styles.archiveDeadline}>
                      期限: {formatDeadline(t.deadline)}
                    </span>
                  )}
                  {isRestored ? (
                    <button
                      type="button"
                      className={styles.dangerIconBtn}
                      style={{ fontSize: '12px', padding: '4px 12px', marginLeft: 'auto', flexShrink: 0 }}
                      onClick={() => undoRestore(t.id)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? '処理中...' : '復元の取り消し'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      style={{ fontSize: '12px', padding: '4px 12px', marginLeft: 'auto', flexShrink: 0 }}
                      onClick={() => restoreTodo(t.id)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? '復元中...' : '復元する'}
                    </button>
                  )}
                </div>
                <div className={styles.archiveCardMeta}>
                  <span className={styles.archiveMetaText}>
                    予定: {t.estMin}分 / 実績: {t.actualMin}分
                  </span>
                  {t.detail && (
                    <span className={styles.archiveMetaText}>
                      {t.detail.length > 50 ? t.detail.slice(0, 50) + '...' : t.detail}
                    </span>
                  )}
                  <span className={styles.archiveMetaText}>
                    削除日時: {formatDateTime(t.archivedAt)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
