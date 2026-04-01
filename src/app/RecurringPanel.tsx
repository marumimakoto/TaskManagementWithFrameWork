'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AppUser } from './types';
import { minutesToText, uid } from './utils';
import { useIsMobile } from './useIsMobile';
import styles from './page.module.css';
import RecurrenceSelector from './RecurrenceSelector';

/** 繰り返しタスクの型 */
interface RecurringTodo {
  id: string;
  title: string;
  estMin: number;
  recurrence: string;
  detail?: string;
  deadlineOffsetDays?: number | null;
  generatedCount: number;
  completedCount: number;
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
  const isMobile: boolean = useIsMobile();
  const [items, setItems] = useState<RecurringTodo[]>(() => {
    try {
      const cached: string | null = localStorage.getItem('kiroku:recurring:' + user.id);
      if (cached) {
        return JSON.parse(cached) as RecurringTodo[];
      }
    } catch { /* ignore */ }
    return [];
  });
  const [loading, setLoading] = useState<boolean>(() => {
    try {
      return !localStorage.getItem('kiroku:recurring:' + user.id);
    } catch {
      return true;
    }
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRecurrence, setEditRecurrence] = useState<string>('daily');
  const [message, setMessage] = useState<string>('');
  const [undoItem, setUndoItem] = useState<RecurringTodo | null>(null);
  const [recurringView, setRecurringView] = useState<'rules' | 'stats'>('rules');
  const [totalActualByTitle, setTotalActualByTitle] = useState<Record<string, number>>({});
  const [calendarFlags, setCalendarFlags] = useState<Record<string, boolean>>(() => {
    try {
      const cached: string | null = localStorage.getItem('kiroku:recurring-calendar:' + user.id);
      if (cached) {
        return JSON.parse(cached) as Record<string, boolean>;
      }
    } catch { /* ignore */ }
    return {};
  });

  function toggleCalendarFlag(ruleId: string): void {
    setCalendarFlags((prev) => {
      const next: Record<string, boolean> = { ...prev, [ruleId]: !(prev[ruleId] !== false) };
      try { localStorage.setItem('kiroku:recurring-calendar:' + user.id, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  const fetchItems = useCallback(async (): Promise<void> => {
    try {
      const [recurringRes, archiveRes] = await Promise.all([
        fetch('/api/todos/recurring?userId=' + user.id),
        fetch('/api/todos/archive?userId=' + user.id),
      ]);
      const data: RecurringTodo[] = await recurringRes.json();
      setItems(data);
      try { localStorage.setItem('kiroku:recurring:' + user.id, JSON.stringify(data)); } catch { /* ignore */ }

      // アーカイブから累計実績時間を集計
      try {
        const archiveData: { title: string; actualMin: number }[] = await archiveRes.json();
        const actualMap: Record<string, number> = {};
        for (const a of archiveData) {
          actualMap[a.title] = (actualMap[a.title] ?? 0) + (a.actualMin ?? 0);
        }
        setTotalActualByTitle(actualMap);
      } catch { /* ignore */ }
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
  async function saveRecurrence(id: string, recurrenceValue?: string): Promise<void> {
    const rec: string = recurrenceValue ?? editRecurrence;
    try {
      await fetch('/api/todos/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: { recurrence: rec } }),
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
    const removed: RecurringTodo | undefined = items.find((item) => item.id === id);
    // 楽観的更新：即座にリストから削除
    setItems((prev) => prev.filter((item) => item.id !== id));
    setUndoItem(removed ?? null);
    showMsg('');  // 既存メッセージをクリア

    try {
      const res: Response = await fetch('/api/todos/recurring', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        await fetchItems();
      }
      onRefresh();
    } catch (e) {
      console.error('Failed to remove recurrence', e);
      await fetchItems();
    }

    // 3秒後にUndoを消す
    setTimeout(() => {
      setUndoItem((current) => (current?.id === id ? null : current));
    }, 5000);
  }

  async function undoRemove(): Promise<void> {
    if (!undoItem) {
      return;
    }
    // recurring_rulesのenabledを1に戻す
    await fetch('/api/todos/recurring', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: undoItem.id, updates: { enabled: true } }),
    });
    setUndoItem(null);
    await fetchItems();
    showMsg('繰り返しを復元しました');
  }

  if (loading) {
    return <p className={styles.diaryEmpty}>読み込み中...</p>;
  }

  // 達成率ダッシュボード用の集計
  const totalGenerated: number = items.reduce((sum, t) => sum + t.generatedCount, 0);
  const totalCompleted: number = items.reduce((sum, t) => sum + t.completedCount, 0);
  const overallRate: number = totalGenerated > 0 ? Math.round((totalCompleted / totalGenerated) * 100) : 0;

  return (
    <div className={styles.diaryPanel}>
      {/* タブ切替 */}
      <div className={styles.diaryModeBar} style={{ marginBottom: 12 }}>
        <button
          type="button"
          className={`${styles.diaryModeBtn} ${recurringView === 'rules' ? styles.diaryModeBtnActive : ''}`}
          onClick={() => setRecurringView('rules')}
        >
          ルール一覧
        </button>
        <button
          type="button"
          className={`${styles.diaryModeBtn} ${recurringView === 'stats' ? styles.diaryModeBtnActive : ''}`}
          onClick={() => setRecurringView('stats')}
        >
          達成率ダッシュボード
        </button>
      </div>

      {message && (
        <p style={{ color: '#22c55e', fontSize: '13px', marginBottom: 8 }}>{message}</p>
      )}
      {undoItem && (
        <div className={styles.toast} style={{ position: 'relative', marginBottom: 8 }}>
          <div className={styles.toastMessage}>
            「{undoItem.title}」の繰り返しを解除しました
          </div>
          <button onClick={undoRemove} className={styles.iconBtn}>
            取り消す
          </button>
        </div>
      )}

      {/* 達成率ダッシュボード */}
      {recurringView === 'stats' && (
        <div>
          {/* 全体サマリー */}
          <div style={{ marginBottom: 16, padding: 16, background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--card-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 600 }}>全体達成率</span>
              <span style={{ fontSize: 24, fontWeight: 700, color: '#3b82f6' }}>{overallRate}%</span>
            </div>
            <div style={{ width: '100%', height: 8, background: 'var(--input-border)', borderRadius: 4 }}>
              <div style={{ width: `${overallRate}%`, height: '100%', background: '#3b82f6', borderRadius: 4, transition: 'width 0.5s ease' }} />
            </div>
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-around', fontSize: 14, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>生成回数</div>
                <div style={{ fontWeight: 700, fontSize: 20 }}>{totalGenerated}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>達成回数</div>
                <div style={{ fontWeight: 700, fontSize: 20, color: '#22c55e' }}>{totalCompleted}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>累計実績</div>
                <div style={{ fontWeight: 700, fontSize: 20, color: '#3b82f6' }}>
                  {minutesToText(Object.values(totalActualByTitle).reduce((s, v) => s + v, 0))}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>ルール数</div>
                <div style={{ fontWeight: 700, fontSize: 20 }}>{items.length}</div>
              </div>
            </div>
          </div>

          {/* ルール別達成率 */}
          {items.length === 0 ? (
            <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 24 }}>繰り返しルールがありません</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {items
                .sort((a, b) => {
                  const rateA: number = a.generatedCount > 0 ? a.completedCount / a.generatedCount : 0;
                  const rateB: number = b.generatedCount > 0 ? b.completedCount / b.generatedCount : 0;
                  return rateB - rateA;
                })
                .map((t) => {
                  const rate: number = t.generatedCount > 0 ? Math.round((t.completedCount / t.generatedCount) * 100) : 0;
                  return (
                    <div key={t.id} style={{ padding: '12px 16px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontWeight: 600 }}>{t.title}</span>
                        <span style={{ fontSize: 18, fontWeight: 700, color: rate >= 80 ? '#22c55e' : rate >= 50 ? '#f59e0b' : '#ef4444' }}>{rate}%</span>
                      </div>
                      <div style={{ width: '100%', height: 6, background: 'var(--input-border)', borderRadius: 3, marginBottom: 6 }}>
                        <div style={{
                          width: `${rate}%`, height: '100%', borderRadius: 3, transition: 'width 0.5s ease',
                          background: rate >= 80 ? '#22c55e' : rate >= 50 ? '#f59e0b' : '#ef4444',
                        }} />
                      </div>
                      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--muted)', flexWrap: 'wrap' }}>
                        <span>🔁 {recurrenceLabel(t.recurrence)}</span>
                        <span>生成: {t.generatedCount}回</span>
                        <span>達成: {t.completedCount}回</span>
                        <span>累計: {minutesToText(totalActualByTitle[t.title] ?? 0)}</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* ルール一覧 */}
      {recurringView === 'rules' && (
      <>
      {items.length === 0 ? (
        <p className={styles.diaryEmpty}>繰り返し設定されたタスクはありません</p>
      ) : (
        <div className={styles.archiveList}>
          {items.map((t: RecurringTodo) => (
            <div key={t.id} className={styles.archiveCard}>
              <div className={styles.archiveCardMain}>
                <span
                  className={styles.activityTypeBadge}
                  style={{ background: '#3b82f6' }}
                >
                  有効
                </span>
                <span className={styles.archiveTitle}>{t.title}</span>
                <span style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--accent, #2563eb)' }}>
                  🔁 {recurrenceLabel(t.recurrence)}
                </span>
                {t.generatedCount > 0 && (
                  <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 8 }}>
                    達成率: {t.completedCount}/{t.generatedCount}
                    ({t.generatedCount > 0 ? Math.round((t.completedCount / t.generatedCount) * 100) : 0}%)
                  </span>
                )}
              </div>

              {t.detail && (
                <p className={styles.activityContent} style={{ margin: '4px 0 0' }}>
                  {t.detail.length > 80 ? t.detail.slice(0, 80) + '...' : t.detail}
                </p>
              )}

              {editingId === t.id ? (
                <div style={{ marginTop: 8 }}>
                  <RecurrenceSelector
                    value={editRecurrence}
                    onChange={(v) => {
                      setEditRecurrence(v);
                      // プリセット選択時は即保存
                      if (!v.startsWith('custom')) {
                        saveRecurrence(t.id, v);
                      }
                    }}
                    onSave={() => saveRecurrence(t.id)}
                    showSaveButton={true}
                  />
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    style={{ fontSize: '14px', padding: '6px 14px', marginTop: 8 }}
                    onClick={() => setEditingId(null)}
                  >
                    キャンセル
                  </button>
                </div>
              ) : (
                <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    style={{ fontSize: '12px', padding: '4px 10px' }}
                    onClick={async () => {
                      // このルールのタスクを今日のタスクとして追加
                      const newId: string = uid();
                      let deadline: number | null = null;
                      if (t.deadlineOffsetDays !== null && t.deadlineOffsetDays !== undefined) {
                        const d: Date = new Date();
                        d.setDate(d.getDate() + t.deadlineOffsetDays);
                        d.setHours(23, 59, 59, 999);
                        deadline = d.getTime();
                      }
                      const todo = {
                        id: newId,
                        title: t.title,
                        estMin: t.estMin,
                        actualMin: 0,
                        stuckHours: 0,
                        recurrence: t.recurrence,
                        detail: t.detail ?? '',
                        deadline,
                        started: false,
                        done: false,
                        sortOrder: 0,
                      };
                      await fetch('/api/todos', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: user.id, todo }),
                      });
                      onRefresh();
                      showMsg(`「${t.title}」を今日のタスクに追加しました`);
                    }}
                  >
                    今日追加
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    style={{ fontSize: '12px' }}
                    onClick={() => { setEditingId(t.id); setEditRecurrence(t.recurrence); }}
                  >
                    設定を変更
                  </button>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={calendarFlags[t.id] !== false}
                      onChange={() => toggleCalendarFlag(t.id)}
                    />
                    {isMobile ? '📅' : '📅カレンダー'}
                  </label>
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
      </>
      )}
    </div>
  );
}
