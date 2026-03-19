'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AppUser } from './types';
import styles from './page.module.css';

/** 繰り返しタスクの型 */
interface RecurringTodo {
  id: string;
  title: string;
  estMin: number;
  recurrence: string;
  detail?: string;
  deadline?: number;
  done: boolean;
  createdAt: number;
}

/** 繰り返し種別を日本語ラベルに変換する */
function recurrenceLabel(rec: string): string {
  if (rec === 'daily') {
    return '毎日';
  }
  if (rec === 'weekly') {
    return '毎週';
  }
  if (rec === 'monthly') {
    return '毎月';
  }
  if (rec === 'yearly') {
    return '毎年';
  }
  if (rec.startsWith('custom:')) {
    const parts: string[] = rec.split(':');
    const interval: number = parseInt(parts[1] ?? '1', 10);
    const unit: string = parts[2] ?? 'day';
    const unitLabels: Record<string, string> = { day: '日', week: '週', month: '月', year: '年' };
    let label: string = `${interval}${unitLabels[unit] ?? unit}ごと`;

    if (unit === 'week' && parts[3]) {
      const dayLabels: Record<string, string> = { sun: '日', mon: '月', tue: '火', wed: '水', thu: '木', fri: '金', sat: '土' };
      const days: string = parts[3].split(',').map((d) => dayLabels[d] ?? d).join('・');
      label += `（${days}曜日）`;
    }
    if (unit === 'month') {
      if (parts[3] === 'date') {
        label += `（毎月${parts[4] ?? '1'}日）`;
      } else if (parts[3] === 'weekday') {
        const dayLabels: Record<string, string> = { sun: '日', mon: '月', tue: '火', wed: '水', thu: '木', fri: '金', sat: '土' };
        label += `（第${parts[4] ?? '1'}${dayLabels[parts[5] ?? 'mon'] ?? ''}曜日）`;
      }
    }
    return label;
  }
  return rec;
}

/**
 * 繰り返しタスク一覧・編集ページ
 */
export default function RecurringPanel({ user, onRefresh }: { user: AppUser; onRefresh: () => void }): React.ReactElement {
  const [items, setItems] = useState<RecurringTodo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRecurrence, setEditRecurrence] = useState<string>('daily');
  const [message, setMessage] = useState<string>('');

  const fetchItems = useCallback(async (): Promise<void> => {
    try {
      const res: Response = await fetch('/api/todos/recurring?userId=' + user.id);
      const data: RecurringTodo[] = await res.json();
      setItems(data);
    } catch (e) {
      console.error('Failed to fetch recurring todos', e);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  function showMsg(msg: string): void {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  }

  /** 繰り返し設定を更新する */
  async function saveRecurrence(id: string): Promise<void> {
    try {
      await fetch('/api/todos/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: { recurrence: editRecurrence } }),
      });
      setEditingId(null);
      await fetchItems();
      onRefresh();
      showMsg('繰り返し設定を更新しました');
    } catch (e) {
      console.error('Failed to update recurrence', e);
    }
  }

  /** 繰り返し設定を解除する（carry に戻す） */
  async function removeRecurrence(id: string): Promise<void> {
    try {
      await fetch('/api/todos/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: { recurrence: 'carry' } }),
      });
      await fetchItems();
      onRefresh();
      showMsg('繰り返しを解除しました');
    } catch (e) {
      console.error('Failed to remove recurrence', e);
    }
  }

  if (loading) {
    return <p className={styles.diaryEmpty}>読み込み中...</p>;
  }

  return (
    <div className={styles.diaryPanel}>
      <h2 className={styles.panelTitle}>繰り返しタスク一覧</h2>
      {message && (
        <p style={{ color: '#22c55e', fontSize: '13px', marginBottom: 8 }}>{message}</p>
      )}

      {items.length === 0 ? (
        <p className={styles.diaryEmpty}>繰り返し設定されたタスクはありません</p>
      ) : (
        <div className={styles.archiveList}>
          {items.map((t: RecurringTodo) => (
            <div key={t.id} className={styles.archiveCard}>
              <div className={styles.archiveCardMain}>
                <span
                  className={styles.activityTypeBadge}
                  style={{ background: t.done ? '#22c55e' : '#3b82f6' }}
                >
                  {t.done ? '完了' : '未完了'}
                </span>
                <span className={styles.archiveTitle}>{t.title}</span>
                <span className={styles.archiveDeadline}>
                  {recurrenceLabel(t.recurrence)}
                </span>
              </div>

              {t.detail && (
                <p className={styles.activityContent} style={{ margin: '4px 0 0' }}>
                  {t.detail.length > 80 ? t.detail.slice(0, 80) + '...' : t.detail}
                </p>
              )}

              {editingId === t.id ? (
                <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    value={editRecurrence}
                    onChange={(e) => setEditRecurrence(e.target.value)}
                    className={styles.input}
                    style={{ maxWidth: 200 }}
                  >
                    <option value="daily">毎日</option>
                    <option value="weekly">毎週</option>
                    <option value="monthly">毎月</option>
                    <option value="yearly">毎年</option>
                  </select>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    style={{ fontSize: '12px', padding: '4px 12px' }}
                    onClick={() => saveRecurrence(t.id)}
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => setEditingId(null)}
                  >
                    キャンセル
                  </button>
                </div>
              ) : (
                <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    style={{ fontSize: '12px' }}
                    onClick={() => { setEditingId(t.id); setEditRecurrence(t.recurrence); }}
                  >
                    設定を変更
                  </button>
                  <button
                    type="button"
                    className={styles.dangerIconBtn}
                    style={{ fontSize: '12px', padding: '4px 10px' }}
                    onClick={() => removeRecurrence(t.id)}
                  >
                    繰り返しを解除
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
