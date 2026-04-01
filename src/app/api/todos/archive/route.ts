import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/** アーカイブされたタスクの行データ */
interface ArchivedTodoRow {
  id: string;
  user_id: string;
  title: string;
  est_min: number;
  actual_min: number;
  detail: string;
  category: string;
  deadline: number | null;
  done: number;
  created_at: number;
  archived_at: number;
}

/**
 * 指定ユーザーのアーカイブ済みタスク一覧を取得する（最新100件）
 * @param request - クエリパラメータに userId を含むリクエスト
 * @returns アーカイブ一覧のJSON配列
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId: string | null = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const db = await getDb();
  const rows: ArchivedTodoRow[] = await db.all<ArchivedTodoRow>(
    'SELECT * FROM archived_todos WHERE user_id = ? ORDER BY archived_at DESC LIMIT 100', userId
  );

  const result = rows.map((row: ArchivedTodoRow) => ({
    id: row.id,
    title: row.title,
    estMin: row.est_min,
    actualMin: row.actual_min,
    detail: row.detail || undefined,
    category: row.category || '',
    deadline: row.deadline ?? undefined,
    done: row.done === 1,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
  }));

  return NextResponse.json(result);
}

/**
 * アーカイブからタスクを復元する
 * archived_todosから取得し、todosに再挿入してからアーカイブから削除する
 * @param request - { userId, id } を含むJSONリクエスト
 * @returns 成功時 { ok: true }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body: { userId?: string; id?: string } = await request.json();
  const { userId, id } = body;

  if (!userId || !id) {
    return NextResponse.json({ error: 'userId and id are required' }, { status: 400 });
  }

  const db = await getDb();

  const row: ArchivedTodoRow | undefined = await db.get<ArchivedTodoRow>(
    'SELECT * FROM archived_todos WHERE id = ? AND user_id = ?', id, userId
  );

  if (!row) {
    return NextResponse.json({ error: 'archived todo not found' }, { status: 404 });
  }

  // todosテーブルに復元
  await db.run(
    'INSERT OR REPLACE INTO todos (id, user_id, title, est_min, actual_min, detail, deadline, done, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    row.id, row.user_id, row.title, row.est_min, row.actual_min, row.detail, row.deadline, row.done, row.created_at
  );

  // アーカイブから削除
  await db.run('DELETE FROM archived_todos WHERE id = ?', id);

  return NextResponse.json({ ok: true });
}

/**
 * ユーザーのアーカイブを全て削除する
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const userId: string | null = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.run('DELETE FROM archived_todos WHERE user_id = ?', userId);
  return NextResponse.json({ ok: true, deleted: result.changes });
}
