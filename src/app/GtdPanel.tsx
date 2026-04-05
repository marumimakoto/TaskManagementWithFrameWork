'use client';

import { useMemo, useState } from 'react';
import type { Todo } from './types';
import { minutesToText, formatDeadline } from './utils';
import styles from './page.module.css';

/** GTDステータスの定義 */
const GTD_STATUSES: { key: string; label: string; color: string; description: string }[] = [
  { key: '', label: 'Inbox', color: '#6b7280', description: '未整理 — まず振り分けよう' },
  { key: 'next_action', label: '次のアクション', color: '#3b82f6', description: '今すぐ取り掛かるべきタスク' },
  { key: 'waiting', label: '待機中', color: '#f59e0b', description: '他の人や条件の完了を待っている' },
  { key: 'someday', label: 'いつかやる', color: '#a855f7', description: '今すぐではないが、いつかやりたい' },
];

/**
 * GTD（Getting Things Done）パネル
 * タスクをInbox→次のアクション/待機中/いつかやるに振り分ける
 */
export default function GtdPanel({
  todos,
  onUpdateGtdStatus,
  onToggleDone,
}: {
  todos: Todo[];
  onUpdateGtdStatus: (id: string, status: string) => void;
  onToggleDone: (id: string) => void;
}): React.ReactElement {
  const [activeStatus, setActiveStatus] = useState<string>('');

  const undoneTodos: Todo[] = useMemo(() => {
    return todos.filter((t) => !t.done);
  }, [todos]);

  const grouped: Record<string, Todo[]> = useMemo(() => {
    const result: Record<string, Todo[]> = { '': [], 'next_action': [], 'waiting': [], 'someday': [] };
    for (const t of undoneTodos) {
      const status: string = t.gtdStatus || '';
      if (result[status]) {
        result[status].push(t);
      } else {
        result[''].push(t);
      }
    }
    return result;
  }, [undoneTodos]);

  const activeTodos: Todo[] = grouped[activeStatus] ?? [];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* ステータスタブ */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16 }}>
        {GTD_STATUSES.map((s) => {
          const count: number = (grouped[s.key] ?? []).length;
          const isActive: boolean = activeStatus === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setActiveStatus(s.key)}
              style={{
                flex: 1, padding: '10px 8px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                border: '1px solid var(--card-border)',
                borderBottom: isActive ? `3px solid ${s.color}` : '1px solid var(--card-border)',
                background: isActive ? 'var(--card-bg)' : 'transparent',
                color: isActive ? s.color : 'var(--muted)',
              }}
            >
              {s.label} ({count})
            </button>
          );
        })}
      </div>

      {/* 説明 */}
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
        {GTD_STATUSES.find((s) => s.key === activeStatus)?.description}
      </p>

      {/* タスクリスト */}
      {activeTodos.length === 0 ? (
        <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 32 }}>
          {activeStatus === '' ? '未整理のタスクはありません' : 'タスクはありません'}
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {activeTodos.map((t: Todo) => (
            <div
              key={t.id}
              style={{
                padding: '10px 14px', borderRadius: 10,
                background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                borderLeft: `4px solid ${GTD_STATUSES.find((s) => s.key === activeStatus)?.color ?? '#6b7280'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => onToggleDone(t.id)}
                  className={styles.checkbox}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>
                    {t.title}
                    {t.category && (
                      <span style={{ marginLeft: 6, fontSize: 11, padding: '1px 6px', borderRadius: 999, background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>
                        {t.category}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    📋{minutesToText(t.estMin)} / ⏱{minutesToText(t.actualMin)}
                    {t.deadline && <span> / ⏰{formatDeadline(t.deadline)}</span>}
                  </div>
                </div>
                {/* 振り分けボタン */}
                <div style={{ display: 'flex', gap: 4 }}>
                  {GTD_STATUSES.filter((s) => s.key !== activeStatus).map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => onUpdateGtdStatus(t.id, s.key)}
                      style={{
                        padding: '3px 8px', borderRadius: 999, fontSize: 11, cursor: 'pointer',
                        border: `1px solid ${s.color}`, background: 'transparent', color: s.color,
                      }}
                      title={s.description}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
