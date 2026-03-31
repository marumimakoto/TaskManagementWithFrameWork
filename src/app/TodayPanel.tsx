'use client';

import { useMemo, useState } from 'react';
import type { Todo } from './types';
import { minutesToText, formatDeadline } from './utils';
import styles from './page.module.css';

/**
 * 今日やることビュー
 * 未完了タスクから今日やるものを選び、予定/実績の合計を表示する
 * タスクをクリックで展開し、詳細・実績入力・ステータス変更が可能
 */
export default function TodayPanel({
  todos,
  onToggleDone,
  onAddLog,
}: {
  todos: Todo[];
  onToggleDone: (id: string) => void;
  onAddLog: (id: string, minutes: number) => void;
}): React.ReactElement {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [logMinutes, setLogMinutes] = useState<Record<string, string>>({});

  const undoneTodos: Todo[] = useMemo(() => {
    return todos.filter((t) => !t.done);
  }, [todos]);

  const selectedTodos: Todo[] = useMemo(() => {
    return undoneTodos.filter((t) => selectedIds.has(t.id));
  }, [undoneTodos, selectedIds]);

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

  function handleAddLog(id: string): void {
    const min: number = parseInt(logMinutes[id] ?? '0', 10);
    if (min <= 0) {
      return;
    }
    onAddLog(id, min);
    setLogMinutes((prev) => ({ ...prev, [id]: '' }));
  }

  function renderTaskCard(t: Todo, isSelected: boolean): React.ReactElement {
    const isExpanded: boolean = expandedId === t.id;
    return (
      <div
        key={t.id}
        style={{
          padding: '10px 14px', borderRadius: 10,
          background: isSelected ? '#eff6ff' : 'var(--card-bg)',
          border: `1px solid ${isSelected ? '#bfdbfe' : 'var(--card-border)'}`,
          borderLeft: `4px solid ${t.done ? '#22c55e' : isSelected ? '#3b82f6' : 'var(--card-border)'}`,
          cursor: 'pointer',
        }}
      >
        {/* ヘッダー */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 10 }}
          onClick={() => setExpandedId(isExpanded ? null : t.id)}
        >
          <input
            type="checkbox"
            checked={t.done}
            onChange={(e) => { e.stopPropagation(); onToggleDone(t.id); }}
            onClick={(e) => e.stopPropagation()}
            className={styles.checkbox}
          />
          {isSelected && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggleSelect(t.id); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14 }}
              title="今日のリストから外す"
            >
              ✕
            </button>
          )}
          {!isSelected && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggleSelect(t.id); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', fontSize: 14 }}
              title="今日のリストに追加"
            >
              ＋
            </button>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, textDecoration: t.done ? 'line-through' : 'none', opacity: t.done ? 0.6 : 1 }}>
              {t.title}
              {t.category && (
                <span style={{ marginLeft: 6, fontSize: 11, padding: '1px 6px', borderRadius: 999, background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>
                  {t.category}
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              予定 {minutesToText(t.estMin)} / 実績 {minutesToText(t.actualMin)}
              {t.deadline && <span style={{ marginLeft: 8 }}>期限: {formatDeadline(t.deadline)}</span>}
            </div>
          </div>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{isExpanded ? '▾' : '▸'}</span>
        </div>

        {/* 展開時の詳細 */}
        {isExpanded && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--card-border)' }} onClick={(e) => e.stopPropagation()}>
            {/* 詳細 */}
            {t.detail && (
              <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 8 }}>
                {t.detail}
              </div>
            )}

            {/* 実績入力 */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
              <input
                type="number"
                min="0"
                placeholder="分"
                value={logMinutes[t.id] ?? ''}
                onChange={(e) => setLogMinutes((prev) => ({ ...prev, [t.id]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddLog(t.id);
                  }
                }}
                className={styles.inputNarrow}
                disabled={t.done}
              />
              <button
                type="button"
                onClick={() => handleAddLog(t.id)}
                className={styles.iconBtn}
                disabled={t.done}
              >
                実績
              </button>
            </div>

            {/* ステータス情報 */}
            <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span>予定: {minutesToText(t.estMin)}</span>
              <span>実績: {minutesToText(t.actualMin)}</span>
              <span>残り: {minutesToText(Math.max(0, t.estMin - t.actualMin))}</span>
              {t.deadline && <span>期限: {formatDeadline(t.deadline)}</span>}
              <span>{t.actualMin > 0 ? '着手済み' : '未着手'}</span>
            </div>
          </div>
        )}
      </div>
    );
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
            {selectedTodos.map((t) => renderTaskCard(t, true))}
          </div>
        </div>
      )}

      {/* 未完了タスク一覧 */}
      <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--muted)' }}>
        未完了タスクから選ぶ
      </h4>
      <div style={{ display: 'grid', gap: 4 }}>
        {undoneTodos.filter((t) => !selectedIds.has(t.id)).map((t) => renderTaskCard(t, false))}
        {undoneTodos.length === 0 && (
          <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 24 }}>未完了タスクがありません</p>
        )}
      </div>
    </div>
  );
}
