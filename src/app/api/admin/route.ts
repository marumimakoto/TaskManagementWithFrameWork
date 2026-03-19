import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/**
 * 管理者用: ユーザー一覧を取得する
 */
export function GET(request: NextRequest): NextResponse {
  const role: string | null = request.nextUrl.searchParams.get('role');
  if (role !== 'admin') {
    return NextResponse.json({ error: 'admin only' }, { status: 403 });
  }

  const db: import('better-sqlite3').Database = getDb();
  const rows = db.prepare(
    'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC'
  ).all() as { id: string; name: string; email: string; role: string; created_at: number }[];

  return NextResponse.json(rows);
}

/**
 * 管理者用: 公開日記やタスクセットを削除する
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const body: { role?: string; type?: string; id?: string } = await request.json();
  if (body.role !== 'admin') {
    return NextResponse.json({ error: 'admin only' }, { status: 403 });
  }
  if (!body.type || !body.id) {
    return NextResponse.json({ error: 'type and id are required' }, { status: 400 });
  }

  const db: import('better-sqlite3').Database = getDb();

  if (body.type === 'diary') {
    db.prepare('DELETE FROM diary_entries WHERE id = ?').run(body.id);
  } else if (body.type === 'task-set') {
    db.prepare('DELETE FROM task_set_items WHERE set_id = ?').run(body.id);
    db.prepare('DELETE FROM task_sets WHERE id = ?').run(body.id);
  }

  return NextResponse.json({ ok: true });
}
