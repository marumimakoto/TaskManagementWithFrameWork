import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/**
 * 管理者用: ユーザー一覧を取得する
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const role: string | null = request.nextUrl.searchParams.get('role');
  if (role !== 'admin') {
    return NextResponse.json({ error: 'admin only' }, { status: 403 });
  }

  const db = await getDb();
  const rows = await db.all<{ id: string; name: string; email: string; role: string; created_at: number }>(
    'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC'
  );

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

  const db = await getDb();

  if (body.type === 'diary') {
    await db.run('DELETE FROM diary_entries WHERE id = ?', body.id);
  } else if (body.type === 'task-set') {
    await db.run('DELETE FROM task_set_items WHERE set_id = ?', body.id);
    await db.run('DELETE FROM task_sets WHERE id = ?', body.id);
  }

  return NextResponse.json({ ok: true });
}
