import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import crypto from 'crypto';

interface MatrixRow {
  id: string;
  user_id: string;
  name: string;
  data: string;
  created_at: number;
  updated_at: number;
}

/**
 * ユーザーの保存済みマトリクス一覧を取得する
 */
export function GET(request: NextRequest): NextResponse {
  const userId: string | null = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const db: import('better-sqlite3').Database = getDb();
  const rows: MatrixRow[] = db.prepare(
    'SELECT * FROM matrix_positions WHERE user_id = ? ORDER BY updated_at DESC'
  ).all(userId) as MatrixRow[];

  const result = rows.map((row: MatrixRow) => ({
    id: row.id,
    name: row.name,
    data: JSON.parse(row.data),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return NextResponse.json(result);
}

/**
 * マトリクスの配置を保存する（新規 or 上書き）
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body: {
    userId?: string;
    id?: string;
    name?: string;
    data?: Record<string, { x: number; y: number }>;
  } = await request.json();

  const { userId, name, data } = body;
  if (!userId || !data) {
    return NextResponse.json({ error: 'userId and data are required' }, { status: 400 });
  }

  const db: import('better-sqlite3').Database = getDb();
  const now: number = Date.now();
  const saveName: string = (name ?? '').trim() || '無題';

  if (body.id) {
    // 上書き保存
    db.prepare(
      'UPDATE matrix_positions SET name = ?, data = ?, updated_at = ? WHERE id = ? AND user_id = ?'
    ).run(saveName, JSON.stringify(data), now, body.id, userId);
    return NextResponse.json({ ok: true, id: body.id });
  }

  // 新規保存
  const id: string = crypto.randomUUID();
  db.prepare(
    'INSERT INTO matrix_positions (id, user_id, name, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, userId, saveName, JSON.stringify(data), now, now);
  return NextResponse.json({ ok: true, id });
}

/**
 * 保存済みマトリクスを削除する
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const body: { userId?: string; id?: string } = await request.json();
  if (!body.userId || !body.id) {
    return NextResponse.json({ error: 'userId and id are required' }, { status: 400 });
  }

  const db: import('better-sqlite3').Database = getDb();
  db.prepare('DELETE FROM matrix_positions WHERE id = ? AND user_id = ?').run(body.id, body.userId);
  return NextResponse.json({ ok: true });
}
