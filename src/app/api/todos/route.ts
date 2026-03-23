import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { Recurrence, Todo } from '@/app/types';

/** SQLiteのtodosテーブルから取得した生の行データ */
interface TodoRow {
  id: string;
  user_id: string;
  parent_id: string | null;
  title: string;
  est_min: number;
  actual_min: number;
  stuck_hours: number;
  last_worked_at: number | null;
  deadline: number | null;
  recurrence: string;
  detail: string;
  started: number;
  done: number;
  sort_order: number;
  created_at: number;
}

/**
 * DBの行データをフロント用のTodoオブジェクトに変換する
 * カラム名をスネークケース → キャメルケースに変換し、null → undefinedに変換する
 * @param row - SQLiteから取得した行データ
 * @returns フロント用のTodoオブジェクト
 */
function rowToTodo(row: TodoRow): Todo {
  return {
    id: row.id,
    parentId: row.parent_id ?? undefined,
    title: row.title,
    estMin: row.est_min,
    actualMin: row.actual_min,
    stuckHours: row.stuck_hours,
    lastWorkedAt: row.last_worked_at ?? undefined,
    deadline: row.deadline ?? undefined,
    recurrence: row.recurrence as Recurrence,
    detail: row.detail || undefined,
    started: row.started === 1,
    done: row.done === 1,
    createdAt: row.created_at,
    sortOrder: row.sort_order,
  };
}

/**
 * 指定ユーザーのタスク一覧をDBから取得して返す
 * @param request - クエリパラメータに userId を含むリクエスト
 * @returns タスク一覧のJSON配列
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId: string | null = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const db = await getDb();
  const rows: TodoRow[] = await db.all<TodoRow>(
    'SELECT * FROM todos WHERE user_id = ? ORDER BY sort_order ASC, created_at DESC', userId
  );

  const todos: Todo[] = rows.map(rowToTodo);
  return NextResponse.json(todos);
}

/**
 * 新しいタスクをDBに追加する
 * @param request - { userId, todo } を含むJSONリクエスト
 * @returns 成功時 { ok: true }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body: { userId?: string; todo?: Todo } = await request.json();
  const { userId, todo } = body;

  if (!userId || !todo) {
    return NextResponse.json({ error: 'userId and todo are required' }, { status: 400 });
  }

  const db = await getDb();
  await db.run(`
    INSERT INTO todos (id, user_id, parent_id, title, est_min, actual_min, stuck_hours, last_worked_at, deadline, recurrence, detail, started, done, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    todo.id,
    userId,
    todo.parentId ?? null,
    todo.title,
    todo.estMin,
    todo.actualMin,
    todo.stuckHours,
    todo.lastWorkedAt ?? null,
    todo.deadline ?? null,
    todo.recurrence,
    todo.detail ?? '',
    todo.started ? 1 : 0,
    todo.done ? 1 : 0,
    todo.sortOrder ?? 0,
  );

  return NextResponse.json({ ok: true });
}
