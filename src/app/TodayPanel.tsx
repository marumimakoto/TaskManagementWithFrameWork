'use client';

import { useMemo, useState } from 'react';
import type { Todo } from './types';
import { minutesToText } from './utils';
import styles from './page.module.css';

/**
 * 今日やることビュー
 * 未完了タスクから今日やるものを選び、予定/実績の合計を表示する
 */
export default function TodayPanel({
  todos,
  onToggleDone,
}: {
  todos: Todo[];
  onToggleDone: (id: string) => void;
}): React.ReactElement {
  // 今日やるタスクとして選択されたIDのセット
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 未完了タスクだけ表示
  const undoneTodos: Todo[] = useMemo(() => {
    return todos.filter((t) => !t.done);
  }, [todos]);

  // 選択されたタスク
  const selectedTodos: Todo[] = useMemo(() => {
    return undoneTodos.filter((t) => selectedIds.has(t.id));
  }, [undoneTodos, selectedIds]);

  // 合計
  const totalEst: number = selectedTodos.reduce((sum, t) => sum + t.estMin, 0);
  const totalActual: number = selectedTodos.reduce((sum, t) => sum + t.actualMin, 0);
  const remaining: number = Math.max(0, totalEst - totalActual);

  function toggleSelect(id: string): void {
    setSelectedIds((prev) => {
      const next: Set<string> = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* 合計サマリー */}
      <div style={{
        marginBottom: 16, padding: 16, background: 'var(--card-bg)',
        borderRadius: 12, border: '1px solid var(--card-border)',
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
          今日やること ({selectedTodos.length}件)
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>予定合計</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#3b82f6' }}>
              {minutesToText(totalEst)}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>実績合計</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#22c55e' }}>
              {minutesToText(totalActual)}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>残り</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: remaining > 0 ? '#ef4444' : '#22c55e' }}>
              {minutesToText(remaining)}
            </div>
          </div>
        </div>
        {totalEst > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ width: '100%', height: 6, background: 'var(--input-border)', borderRadius: 3 }}>
              <div style={{
                width: `${Math.min(100, totalEst > 0 ? (totalActual / totalEst) * 100 : 0)}%`,
                height: '100%', background: '#3b82f6', borderRadius: 3, transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
        )}
      </div>

      {/* 選択済みタスク */}
      {selectedTodos.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--muted)' }}>選択中</h4>
          <div style={{ display: 'grid', gap: 6 }}>
            {selectedTodos.map((t) => (
              <div
                key={t.id}
                style={{
                  padding: '10px 14px', borderRadius: 10,
                  background: '#eff6ff', border: '1px solid #bfdbfe', borderLeft: '4px solid #3b82f6',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}
              >
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => onToggleDone(t.id)}
                  className={styles.checkbox}
                />
                <button
                  type="button"
                  onClick={() => toggleSelect(t.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 16 }}
                  title="今日のリストから外す"
                >
                  ✕
                </button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{t.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                    予定 {minutesToText(t.estMin)} / 実績 {minutesToText(t.actualMin)}
                    {t.category && (
                      <span style={{ marginLeft: 6, fontSize: 11, padding: '1px 6px', borderRadius: 999, background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>
                        {t.category}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 未完了タスク一覧（選択用） */}
      <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--muted)' }}>
        未完了タスクから選ぶ
      </h4>
      <div style={{ display: 'grid', gap: 4 }}>
        {undoneTodos.map((t) => {
          const isSelected: boolean = selectedIds.has(t.id);
          return (
            <div
              key={t.id}
              onClick={() => toggleSelect(t.id)}
              style={{
                padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                background: isSelected ? '#dbeafe' : 'var(--card-bg)',
                border: `1px solid ${isSelected ? '#93c5fd' : 'var(--card-border)'}`,
                display: 'flex', alignItems: 'center', gap: 10,
                opacity: isSelected ? 0.7 : 1,
              }}
            >
              <span style={{ fontSize: 16 }}>{isSelected ? '✓' : '○'}</span>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 500 }}>{t.title}</span>
                <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--muted)' }}>
                  {minutesToText(t.estMin)}
                </span>
                {t.category && (
                  <span style={{ marginLeft: 6, fontSize: 11, padding: '1px 6px', borderRadius: 999, background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>
                    {t.category}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {undoneTodos.length === 0 && (
          <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 24 }}>未完了タスクがありません</p>
        )}
      </div>
    </div>
  );
}
