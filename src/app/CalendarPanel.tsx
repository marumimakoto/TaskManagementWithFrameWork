'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Todo } from './types';
import { formatDeadline } from './utils';
import styles from './page.module.css';

/** 繰り返しルールの型 */
type RecurringRule = {
  id: string;
  title: string;
  recurrence: string;
  deadlineOffsetDays: number | null;
  estMin: number;
};

/** CalendarPanelのprops型 */
type CalendarPanelProps = {
  todos: Todo[];
  userId?: string;
  recurringRules?: RecurringRule[];
};

/**
 * 指定した年月の日数を返す
 * @param year - 年
 * @param month - 月（0始まり）
 */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * 指定した年月の1日の曜日を返す（0=日曜）
 * @param year - 年
 * @param month - 月（0始まり）
 */
function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

/**
 * ミリ秒タイムスタンプから「YYYY-MM-DD」キーを生成する
 * @param ts - ミリ秒タイムスタンプ
 */
function toDateKey(ts: number): string {
  const d: Date = new Date(ts);
  const year: number = d.getFullYear();
  const month: string = String(d.getMonth() + 1).padStart(2, '0');
  const day: string = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 今日の日付キー「YYYY-MM-DD」を返す
 */
function getTodayKey(): string {
  return toDateKey(Date.now());
}

/** 曜日ヘッダーのラベル */
const WEEKDAY_LABELS: string[] = ['日', '月', '火', '水', '木', '金', '土'];

/** カレンダーページコンポーネント */
export default function CalendarPanel({ todos, userId, recurringRules: propRules }: CalendarPanelProps): React.ReactElement {
  const [fetchedRules, setFetchedRules] = useState<RecurringRule[]>([]);
  const recurringRules: RecurringRule[] = propRules ?? fetchedRules;

  // userIdが渡された場合、繰り返しルールをAPIから取得
  useEffect(() => {
    if (!userId || propRules) {
      return;
    }
    fetch('/api/todos/recurring?userId=' + userId)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setFetchedRules(data);
        }
      })
      .catch(() => {});
  }, [userId, propRules]);
  const now: Date = new Date();
  const [currentYear, setCurrentYear] = useState<number>(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(now.getMonth());
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [showRecurring, setShowRecurring] = useState<boolean>(() => {
    try {
      const saved: string | null = localStorage.getItem('kiroku:calendar-show-recurring');
      if (saved !== null) {
        return saved === 'true';
      }
    } catch { /* ignore */ }
    return false;
  });

  /** 日付キー → その日が期限のTodo配列のマップ */
  const todosByDate: Map<string, Todo[]> = useMemo(() => {
    const map: Map<string, Todo[]> = new Map();

    // 既存タスクの期限
    for (const todo of todos) {
      if (todo.deadline === undefined) {
        continue;
      }
      const key: string = toDateKey(todo.deadline);
      const existing: Todo[] | undefined = map.get(key);
      if (existing !== undefined) {
        existing.push(todo);
      } else {
        map.set(key, [todo]);
      }
    }

    // 繰り返しルールから今月・来月の該当日を計算してカレンダーに表示
    // カレンダー表示OFFのルールを除外
    let calendarFlags: Record<string, boolean> = {};
    try {
      const cached: string | null = localStorage.getItem('kiroku:recurring-calendar:' + (userId ?? ''));
      if (cached) {
        calendarFlags = JSON.parse(cached);
      }
    } catch { /* ignore */ }
    const filteredRules: RecurringRule[] = recurringRules.filter((r) => calendarFlags[r.id] !== false);

    if (showRecurring && filteredRules.length > 0) {
      const today: Date = new Date();
      today.setHours(0, 0, 0, 0);
      // 今月1日から来月末日まで
      const rangeStart: Date = new Date(currentYear, currentMonth, 1);
      const rangeEnd: Date = new Date(currentYear, currentMonth + 2, 0);

      for (const rule of filteredRules) {
        const offset: number = rule.deadlineOffsetDays ?? 0;
        const rec: string = rule.recurrence;
        const DAY_NAMES: string[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

        // rangeStart〜rangeEndの各日をチェック
        const current: Date = new Date(rangeStart);
        while (current <= rangeEnd) {
          let matches: boolean = false;
          const dayOfWeek: number = current.getDay();
          const dayOfMonth: number = current.getDate();

          if (rec === 'daily' || rec === 'day') {
            matches = true;
          } else if (rec.startsWith('custom:')) {
            const parts: string[] = rec.split(':');
            const unit: string = parts[2] ?? 'day';
            if (unit === 'day') {
              matches = true;
            } else if (unit === 'week') {
              const weekDays: string[] = (parts[3] ?? 'mon').split(',');
              matches = weekDays.includes(DAY_NAMES[dayOfWeek]);
            } else if (unit === 'month') {
              const monthMode: string = parts[3] ?? 'date';
              if (monthMode === 'date') {
                const targetDay: number = parseInt(parts[4] ?? '1', 10);
                matches = dayOfMonth === targetDay;
              } else if (monthMode === 'weekday') {
                const nth: number = parseInt(parts[4] ?? '1', 10);
                const targetDayName: string = parts[5] ?? 'mon';
                matches = DAY_NAMES[dayOfWeek] === targetDayName && Math.ceil(dayOfMonth / 7) === nth;
              }
            }
          } else if (rec === 'weekly' || rec.startsWith('week:')) {
            matches = dayOfWeek === 1; // デフォルト月曜
          } else if (rec === 'monthly') {
            matches = dayOfMonth === 1;
          }

          if (matches && current >= today) {
            const deadlineDate: Date = new Date(current);
            deadlineDate.setDate(deadlineDate.getDate() + offset);
            deadlineDate.setHours(23, 59, 59, 999);
            const dateKey: string = toDateKey(deadlineDate.getTime());
            // 既にtodosに同タイトル・同日の期限があればスキップ
            const existingInMap: Todo[] | undefined = map.get(dateKey);
            const alreadyExists: boolean = existingInMap
              ? existingInMap.some((t) => t.title === rule.title || t.title === '🔁 ' + rule.title)
              : false;
            if (!alreadyExists) {
              const futureTodo: Todo = {
                id: 'recurring-' + rule.id + '-' + dateKey,
                title: '🔁 ' + rule.title,
                estMin: rule.estMin,
                actualMin: 0,
                stuckHours: 0,
                recurrence: rule.recurrence,
                started: false,
                done: false,
                sortOrder: 0,
                deadline: deadlineDate.getTime(),
              };
              const existing: Todo[] | undefined = map.get(dateKey);
              if (existing !== undefined) {
                existing.push(futureTodo);
              } else {
                map.set(dateKey, [futureTodo]);
              }
            }
          }
          current.setDate(current.getDate() + 1);
        }
      }
    }

    return map;
  }, [todos, recurringRules, currentYear, currentMonth, showRecurring]);

  /** 前月に移動する */
  function goToPreviousMonth(): void {
    if (currentMonth === 0) {
      setCurrentYear(currentYear - 1);
      setCurrentMonth(11);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
    setSelectedDateKey(null);
  }

  /** 次月に移動する */
  function goToNextMonth(): void {
    if (currentMonth === 11) {
      setCurrentYear(currentYear + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
    setSelectedDateKey(null);
  }

  const daysInMonth: number = getDaysInMonth(currentYear, currentMonth);
  const firstDayOfWeek: number = getFirstDayOfWeek(currentYear, currentMonth);
  const todayKey: string = getTodayKey();

  /** カレンダーのセル配列を構築する（null=空セル） */
  const calendarCells: (number | null)[] = useMemo(() => {
    const cells: (number | null)[] = [];
    // 月初の曜日までの空セル
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push(null);
    }
    // 1日〜末日
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push(day);
    }
    // 末尾を7の倍数に揃える空セル
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }
    return cells;
  }, [firstDayOfWeek, daysInMonth]);

  /** 選択された日付のタスク一覧 */
  const selectedDayTodos: Todo[] = useMemo(() => {
    if (selectedDateKey === null) {
      return [];
    }
    return todosByDate.get(selectedDateKey) ?? [];
  }, [selectedDateKey, todosByDate]);

  /**
   * 日付セルのキーを生成する
   * @param day - 日（1始まり）
   */
  function buildDateKey(day: number): string {
    const month: string = String(currentMonth + 1).padStart(2, '0');
    const dayStr: string = String(day).padStart(2, '0');
    return `${currentYear}-${month}-${dayStr}`;
  }

  return (
    <div style={{ padding: '8px', maxWidth: '100%', margin: '0 auto', overflowX: 'auto' }}>
      {/* ヘッダー: 前月 / 年月表示 / 次月 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}
      >
        <button
          onClick={goToPreviousMonth}
          style={{
            padding: '8px 16px',
            border: '1px solid var(--card-border, #ccc)',
            borderRadius: '6px',
            background: 'var(--card-bg, #fff)',
            cursor: 'pointer',
            fontSize: '16px',
          }}
        >
          &lt; 前月
        </button>
        <h2 style={{ margin: 0, fontSize: '20px' }}>
          {currentYear}年{currentMonth + 1}月
        </h2>
        <button
          onClick={goToNextMonth}
          style={{
            padding: '8px 16px',
            border: '1px solid var(--card-border, #ccc)',
            borderRadius: '6px',
            background: 'var(--card-bg, #fff)',
            cursor: 'pointer',
            fontSize: '16px',
          }}
        >
          次月 &gt;
        </button>
      </div>

      {/* 繰り返しタスク表示トグル */}
      {recurringRules.length > 0 && (
        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'flex-end' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: 'var(--muted)' }}>
            <input
              type="checkbox"
              checked={showRecurring}
              onChange={(e) => { setShowRecurring(e.target.checked); try { localStorage.setItem('kiroku:calendar-show-recurring', String(e.target.checked)); } catch { /* ignore */ } }}
            />
            繰り返しタスクを表示
          </label>
        </div>
      )}

      {/* 曜日ヘッダー */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          textAlign: 'center',
          fontWeight: 'bold',
          marginBottom: '4px',
        }}
      >
        {WEEKDAY_LABELS.map((label: string, index: number) => (
          <div
            key={label}
            style={{
              padding: '8px 0',
              color: index === 0 ? '#e53e3e' : index === 6 ? '#3182ce' : 'inherit',
              fontSize: '14px',
            }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* カレンダー本体 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(50px, 1fr))',
          border: '1px solid var(--card-border, #ccc)',
          borderRadius: '8px',
          overflow: 'hidden',
          minWidth: '350px',
        }}
      >
        {calendarCells.map((day: number | null, index: number) => {
          if (day === null) {
            return (
              <div
                key={`empty-${index}`}
                style={{
                  minHeight: '140px',
                  borderRight: (index + 1) % 7 !== 0 ? '1px solid var(--card-border, #eee)' : 'none',
                  borderBottom: '1px solid var(--card-border, #eee)',
                  background: 'var(--card-bg, #f9f9f9)',
                  opacity: 0.3,
                }}
              />
            );
          }

          const dateKey: string = buildDateKey(day);
          const isToday: boolean = dateKey === todayKey;
          const isSelected: boolean = dateKey === selectedDateKey;
          const dayTodos: Todo[] = todosByDate.get(dateKey) ?? [];
          const hasTodos: boolean = dayTodos.length > 0;
          const colIndex: number = index % 7;
          const isSunday: boolean = colIndex === 0;
          const isSaturday: boolean = colIndex === 6;

          return (
            <div
              key={dateKey}
              onClick={() => {
                setSelectedDateKey(dateKey);
              }}
              style={{
                minHeight: '140px',
                padding: '4px 6px',
                cursor: 'pointer',
                borderRight: !isSaturday ? '1px solid var(--card-border, #eee)' : 'none',
                borderBottom: '1px solid var(--card-border, #eee)',
                background: isSelected
                  ? 'rgba(66, 153, 225, 0.15)'
                  : isToday
                    ? 'rgba(237, 137, 54, 0.1)'
                    : 'var(--card-bg, #fff)',
                transition: 'background 0.15s',
              }}
            >
              {/* 日付番号 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginBottom: '2px',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: isToday ? '26px' : 'auto',
                    height: isToday ? '26px' : 'auto',
                    borderRadius: isToday ? '50%' : '0',
                    background: isToday ? '#ed8936' : 'transparent',
                    color: isToday
                      ? '#fff'
                      : isSunday
                        ? '#e53e3e'
                        : isSaturday
                          ? '#3182ce'
                          : 'inherit',
                    fontWeight: isToday ? 'bold' : 'normal',
                    fontSize: '13px',
                  }}
                >
                  {day}
                </span>
                {/* タスク件数バッジは削除済み */}
              </div>

              {/* タスク名を最大3件まで表示 */}
              {dayTodos.slice(0, 3).map((todo: Todo) => (
                <div
                  key={todo.id}
                  style={{
                    fontSize: '11px',
                    lineHeight: '1.3',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: todo.done ? '#a0aec0' : 'inherit',
                    textDecoration: todo.done ? 'line-through' : 'none',
                  }}
                >
                  {todo.title}
                </div>
              ))}
              {dayTodos.length > 3 && (
                <div style={{ fontSize: '10px', color: '#a0aec0' }}>
                  +{dayTodos.length - 3}件
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 選択した日のタスク一覧 */}
      {selectedDateKey !== null && (
        <div style={{ marginTop: '20px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '16px' }}>
            {selectedDateKey.replace(/-/g, '/')} のタスク
            （{selectedDayTodos.length}件）
          </h3>
          {selectedDayTodos.length === 0 && (
            <p style={{ color: '#a0aec0', fontSize: '14px' }}>
              この日に期限のタスクはありません。
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {selectedDayTodos.map((todo: Todo) => (
              <div
                key={todo.id}
                style={{
                  padding: '12px 16px',
                  border: '1px solid var(--card-border, #ccc)',
                  borderRadius: '8px',
                  background: 'var(--card-bg, #fff)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '4px',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: todo.done ? '#48bb78' : '#ed8936',
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontWeight: 'bold',
                      fontSize: '15px',
                      textDecoration: todo.done ? 'line-through' : 'none',
                      color: todo.done ? '#a0aec0' : 'inherit',
                    }}
                  >
                    {todo.title}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: '16px',
                    fontSize: '13px',
                    color: '#718096',
                    marginLeft: '16px',
                  }}
                >
                  {todo.category && (
                    <span>カテゴリ: {todo.category}</span>
                  )}
                  <span>
                    期限: {formatDeadline(todo.deadline)}
                  </span>
                  <span>
                    見積: {todo.estMin}分
                  </span>
                  <span>
                    実績: {todo.actualMin}分
                  </span>
                  <span>
                    {todo.done ? '完了' : '未完了'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
