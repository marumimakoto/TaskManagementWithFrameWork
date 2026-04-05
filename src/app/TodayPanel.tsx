'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Todo } from './types';
import { minutesToText, formatDeadline } from './utils';
import styles from './page.module.css';

const TODAY_IDS_KEY: string = 'kiroku:today-ids';
const TODAY_DATE_KEY: string = 'kiroku:today-date';

/**
 * 今日やることビュー
 * 未完了タスクから今日やるものを選び、予定/実績の合計を表示する
 * タスク展開時はホーム画面と同じフォーマットで詳細を表示
 */
export default function TodayPanel({
  todos,
  onToggleDone,
  onAddLog,
  todayActualMap = {},
  renderExpanded,
  onFieldEdit,
}: {
  todos: Todo[];
  onToggleDone: (id: string) => void;
  onAddLog: (id: string, minutes: number) => void;
  todayActualMap?: Record<string, number>;
  renderExpanded?: (t: Todo) => React.ReactNode;
  onFieldEdit?: (todoId: string, field: string, value: string) => void;
}): React.ReactElement {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    try {
      // 日付が変わっていたらリセット
      const todayStr: string = new Date().toISOString().slice(0, 10);
      const savedDate: string | null = localStorage.getItem(TODAY_DATE_KEY);
      if (savedDate && savedDate !== todayStr) {
        localStorage.removeItem(TODAY_IDS_KEY);
        localStorage.setItem(TODAY_DATE_KEY, todayStr);
        return new Set<string>();
      }
      localStorage.setItem(TODAY_DATE_KEY, todayStr);
      const raw: string | null = localStorage.getItem(TODAY_IDS_KEY);
      if (raw) {
        return new Set<string>(JSON.parse(raw) as string[]);
      }
    } catch { /* ignore */ }
    return new Set<string>();
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // selectedIdsが変わるたびにlocalStorageに保存
  useEffect(() => {
    try {
      localStorage.setItem(TODAY_IDS_KEY, JSON.stringify([...selectedIds]));
    } catch { /* ignore */ }
  }, [selectedIds]);

  const [logMinutes, setLogMinutes] = useState<Record<string, string>>({});
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function startEdit(t: Todo, field: string): void {
    // ダブルクリック時にシングルクリック（閉じる）をキャンセル
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    setEditingTodoId(t.id);
    setEditingField(field);
    if (field === 'title') {
      setEditValue(t.title);
    } else if (field === 'detail') {
      setEditValue(t.detail ?? '');
    } else if (field === 'est') {
      setEditValue(String(t.estMin));
    } else if (field === 'actual') {
      setEditValue(String(t.actualMin));
    } else if (field === 'deadline') {
      setEditValue(t.deadline ? new Date(t.deadline).toISOString().slice(0, 10) : '');
    }
  }

  function saveEdit(todoId: string): void {
    if (onFieldEdit && editingField) {
      onFieldEdit(todoId, editingField, editValue);
    }
    setEditingTodoId(null);
    setEditingField(null);
  }

  const undoneTodos: Todo[] = useMemo(() => {
    return todos.filter((t) => !t.done);
  }, [todos]);

  // 選択中のタスク（完了タスクも含む — 当日中は表示を維持）
  const selectedTodos: Todo[] = useMemo(() => {
    return todos.filter((t) => selectedIds.has(t.id));
  }, [todos, selectedIds]);

  const totalEst: number = selectedTodos.reduce((sum, t) => sum + t.estMin, 0);
  const todayActual: number = selectedTodos.reduce((sum, t) => sum + (todayActualMap[t.id] ?? 0), 0);
  const remaining: number = Math.max(0, totalEst - todayActual);

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
        }}
      >
        {/* ヘッダー */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
          onClick={() => {
            // 展開中はダブルクリック編集と干渉しないように遅延
            if (isExpanded) {
              if (clickTimerRef.current) {
                clearTimeout(clickTimerRef.current);
                clickTimerRef.current = null;
                return;
              }
              clickTimerRef.current = setTimeout(() => {
                setExpandedId(null);
                clickTimerRef.current = null;
              }, 250);
            } else {
              setExpandedId(t.id);
            }
          }}
        >
          <input
            type="checkbox"
            checked={t.done}
            onChange={(e) => { e.stopPropagation(); onToggleDone(t.id); }}
            onClick={(e) => e.stopPropagation()}
            className={styles.checkbox}
          />
          {isSelected ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggleSelect(t.id); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14 }}
              title="今日のリストから外す"
            >
              ✕
            </button>
          ) : (
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
            {/* タイトル */}
            {isExpanded && editingTodoId === t.id && editingField === 'title' ? (
              <input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => { if (e.key === 'Enter') { saveEdit(t.id); } if (e.key === 'Escape') { setEditingTodoId(null); } }}
                onBlur={() => saveEdit(t.id)}
                className={styles.input}
                style={{ fontWeight: 600, fontSize: 15 }}
                autoFocus
              />
            ) : (
              <div
                style={{ fontWeight: 600, textDecoration: t.done ? 'line-through' : 'none', opacity: t.done ? 0.6 : 1 }}
                onDoubleClick={isExpanded && onFieldEdit ? (e) => { e.stopPropagation(); startEdit(t, 'title'); } : undefined}
                title={isExpanded ? 'ダブルクリックで編集' : undefined}
              >
                {t.title}
                {t.category && (
                  <span style={{ marginLeft: 6, fontSize: 11, padding: '1px 6px', borderRadius: 999, background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>
                    {t.category}
                  </span>
                )}
              </div>
            )}
            {/* 予定/実績 */}
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              {isExpanded && editingTodoId === t.id && editingField === 'est' ? (
                <span>📋<input type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Enter') { saveEdit(t.id); } if (e.key === 'Escape') { setEditingTodoId(null); } }} onBlur={() => saveEdit(t.id)} style={{ width: 60 }} className={styles.inputNarrow} autoFocus />分</span>
              ) : (
                <span onDoubleClick={isExpanded && onFieldEdit ? (e) => { e.stopPropagation(); startEdit(t, 'est'); } : undefined} style={{ cursor: isExpanded ? 'pointer' : 'default' }}>
                  📋{minutesToText(t.estMin)}
                </span>
              )}
              {' / '}
              {isExpanded && editingTodoId === t.id && editingField === 'actual' ? (
                <span>⏱<input type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Enter') { saveEdit(t.id); } if (e.key === 'Escape') { setEditingTodoId(null); } }} onBlur={() => saveEdit(t.id)} style={{ width: 60 }} className={styles.inputNarrow} autoFocus />分</span>
              ) : (
                <span onDoubleClick={isExpanded && onFieldEdit ? (e) => { e.stopPropagation(); startEdit(t, 'actual'); } : undefined} style={{ cursor: isExpanded ? 'pointer' : 'default' }}>
                  ⏱{minutesToText(t.actualMin)}
                </span>
              )}
              {(todayActualMap[t.id] ?? 0) > 0 && (
                <span style={{ color: '#f59e0b' }}>
                  {' / '}🔥{minutesToText(todayActualMap[t.id])}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, gap: 2 }}>
            {/* 期限 */}
            {isExpanded && editingTodoId === t.id && editingField === 'deadline' ? (
              <input type="date" value={editValue} onChange={(e) => setEditValue(e.target.value)} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Enter') { saveEdit(t.id); } if (e.key === 'Escape') { setEditingTodoId(null); } }} onBlur={() => saveEdit(t.id)} className={styles.inputNarrow} autoFocus />
            ) : t.deadline ? (
              <span
                style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap', cursor: isExpanded ? 'pointer' : 'default' }}
                onDoubleClick={isExpanded && onFieldEdit ? (e) => { e.stopPropagation(); startEdit(t, 'deadline'); } : undefined}
              >
                ⏰ {formatDeadline(t.deadline)}
              </span>
            ) : null}
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{isExpanded ? '▾' : '▸'}</span>
          </div>
        </div>

        {/* 実績入力（選択中のカードに常時表示） */}
        {isSelected && !t.done && (
          <div
            style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, paddingLeft: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="number"
              min="0"
              placeholder="+分"
              value={logMinutes[t.id] ?? ''}
              onChange={(e) => setLogMinutes((prev) => ({ ...prev, [t.id]: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') { handleAddLog(t.id); } }}
              className={styles.inputNarrow}
              style={{ width: 60 }}
            />
            <button
              type="button"
              onClick={() => handleAddLog(t.id)}
              className={styles.iconBtn}
              style={{ fontSize: 12, padding: '4px 8px' }}
            >
              実績を加算
            </button>
          </div>
        )}

        {/* 展開時: renderExpandedがあればホーム画面と同じ、なければ簡易表示 */}
        {isExpanded && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--card-border)' }} onClick={(e) => e.stopPropagation()}>
            {renderExpanded ? (
              renderExpanded(t)
            ) : (
              <>
                {t.detail && (
                  <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 8 }}>{t.detail}</div>
                )}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
                  <input
                    type="number" min="0" placeholder="分"
                    value={logMinutes[t.id] ?? ''}
                    onChange={(e) => setLogMinutes((prev) => ({ ...prev, [t.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { handleAddLog(t.id); } }}
                    className={styles.inputNarrow} disabled={t.done}
                  />
                  <button type="button" onClick={() => handleAddLog(t.id)} className={styles.iconBtn} disabled={t.done}>実績</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* 合計サマリー */}
      <div style={{ marginBottom: 16, padding: 16, background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--card-border)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>今日やること ({selectedTodos.length}件)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>予定合計</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#3b82f6' }}>{minutesToText(totalEst)}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>本日実績</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#22c55e' }}>{minutesToText(todayActual)}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>残り</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: remaining > 0 ? '#ef4444' : '#22c55e' }}>{minutesToText(remaining)}</div>
          </div>
        </div>
        {totalEst > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ width: '100%', height: 6, background: 'var(--input-border)', borderRadius: 3 }}>
              <div style={{ width: `${Math.min(100, (todayActual / totalEst) * 100)}%`, height: '100%', background: '#3b82f6', borderRadius: 3, transition: 'width 0.3s ease' }} />
            </div>
          </div>
        )}
      </div>

      {/* 選択済みタスク */}
      {selectedTodos.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--muted)' }}>選択中</h4>
          <div style={{ display: 'grid', gap: 6 }}>{selectedTodos.map((t) => renderTaskCard(t, true))}</div>
        </div>
      )}

      {/* 未完了タスク一覧 */}
      <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--muted)' }}>未完了タスクから選ぶ</h4>
      <div style={{ display: 'grid', gap: 4 }}>
        {undoneTodos.filter((t) => !selectedIds.has(t.id)).map((t) => renderTaskCard(t, false))}
        {undoneTodos.length === 0 && (
          <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 24 }}>未完了タスクがありません</p>
        )}
      </div>
    </div>
  );
}
