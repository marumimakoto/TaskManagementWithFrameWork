'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Todo } from './types';
import { minutesToText } from './utils';
import styles from './page.module.css';

/** タイムブロックの1スロット */
interface TimeBlock {
  hour: number;
  todoId: string | null;
}

const HOURS: number[] = Array.from({ length: 16 }, (_, i) => i + 6); // 6:00〜21:00

const STORAGE_KEY: string = 'kiroku:timeblocks';

/**
 * タイムブロッキングパネル
 * 1時間単位でタスクを時間帯に割り当てる
 */
export default function TimeBlockPanel({
  todos,
  userId,
}: {
  todos: Todo[];
  userId: string;
}): React.ReactElement {
  const [blocks, setBlocks] = useState<TimeBlock[]>(() => {
    try {
      const todayStr: string = new Date().toISOString().slice(0, 10);
      const raw: string | null = localStorage.getItem(STORAGE_KEY + ':' + userId + ':' + todayStr);
      if (raw) {
        return JSON.parse(raw) as TimeBlock[];
      }
    } catch { /* ignore */ }
    return HOURS.map((hour: number): TimeBlock => ({ hour, todoId: null }));
  });

  const [dragTodoId, setDragTodoId] = useState<string | null>(null);

  const undoneTodos: Todo[] = useMemo(() => {
    return todos.filter((t) => !t.done);
  }, [todos]);

  // 保存
  useEffect(() => {
    try {
      const todayStr: string = new Date().toISOString().slice(0, 10);
      localStorage.setItem(STORAGE_KEY + ':' + userId + ':' + todayStr, JSON.stringify(blocks));
    } catch { /* ignore */ }
  }, [blocks, userId]);

  function assignTodo(hour: number, todoId: string | null): void {
    setBlocks((prev) =>
      prev.map((b) => b.hour === hour ? { ...b, todoId } : b)
    );
  }

  function removeTodo(hour: number): void {
    assignTodo(hour, null);
  }

  // 割り当て済みタスクIDのセット
  const assignedIds: Set<string> = useMemo(() => {
    const set: Set<string> = new Set<string>();
    for (const b of blocks) {
      if (b.todoId) {
        set.add(b.todoId);
      }
    }
    return set;
  }, [blocks]);

  // 割り当て済み合計時間
  const totalAssigned: number = blocks.filter((b) => b.todoId !== null).length * 60;

  // 現在の時間帯
  const currentHour: number = new Date().getHours();

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* サマリー */}
      <div style={{
        display: 'flex', gap: 16, marginBottom: 16, padding: '12px 16px',
        background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10,
      }}>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>割り当て済み</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#3b82f6' }}>{minutesToText(totalAssigned)}</div>
        </div>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>空きスロット</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--muted)' }}>
            {blocks.filter((b) => !b.todoId).length}時間
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
        {/* 左: 未割り当てタスク */}
        <div>
          <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)', marginBottom: 8 }}>
            タスク（ドラッグして配置）
          </h4>
          <div style={{ display: 'grid', gap: 4 }}>
            {undoneTodos.filter((t) => !assignedIds.has(t.id)).map((t: Todo) => (
              <div
                key={t.id}
                draggable
                onDragStart={() => setDragTodoId(t.id)}
                onDragEnd={() => setDragTodoId(null)}
                style={{
                  padding: '6px 10px', borderRadius: 6, cursor: 'grab',
                  background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 600 }}>{t.title}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>📋{minutesToText(t.estMin)}</div>
              </div>
            ))}
            {undoneTodos.filter((t) => !assignedIds.has(t.id)).length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--muted)', padding: 8 }}>全タスク割り当て済み</p>
            )}
          </div>
        </div>

        {/* 右: タイムライン */}
        <div>
          <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)', marginBottom: 8 }}>
            タイムライン
          </h4>
          <div style={{ display: 'grid', gap: 2 }}>
            {blocks.map((block: TimeBlock) => {
              const todo: Todo | undefined = block.todoId ? todos.find((t) => t.id === block.todoId) : undefined;
              const isCurrentHour: boolean = block.hour === currentHour;
              return (
                <div
                  key={block.hour}
                  onDragOver={(e) => {
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragTodoId) {
                      assignTodo(block.hour, dragTodoId);
                      setDragTodoId(null);
                    }
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px', borderRadius: 6,
                    background: isCurrentHour ? '#eff6ff' : 'var(--card-bg)',
                    border: isCurrentHour ? '2px solid #3b82f6' : '1px solid var(--card-border)',
                    minHeight: 40,
                  }}
                >
                  <span style={{ width: 45, fontSize: 13, fontWeight: 600, color: isCurrentHour ? '#3b82f6' : 'var(--muted)', flexShrink: 0 }}>
                    {block.hour}:00
                  </span>
                  {todo ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                        background: todo.done ? '#dcfce7' : '#dbeafe',
                        color: todo.done ? '#16a34a' : '#2563eb',
                      }}>
                        {todo.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeTodo(block.hour)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#ef4444', padding: '0 4px' }}
                        title="解除"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <span style={{ flex: 1, fontSize: 12, color: 'var(--input-border)' }}>
                      {dragTodoId ? 'ここにドロップ' : '—'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
