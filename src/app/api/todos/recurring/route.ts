import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/**
 * 繰り返し設定があるタスク一覧を取得する
 */
export function GET(request: NextRequest): NextResponse {
  const userId: string | null = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const db: import('better-sqlite3').Database = getDb();
  const rows = db.prepare(
    "SELECT id, title, est_min, recurrence, detail, deadline, done, created_at FROM todos WHERE user_id = ? AND recurrence != 'carry' AND recurrence != '' ORDER BY created_at DESC"
  ).all(userId) as {
    id: string; title: string; est_min: number; recurrence: string; detail: string;
    deadline: number | null; done: number; created_at: number;
  }[];

  const result = rows.map((row) => ({
    id: row.id,
    title: row.title,
    estMin: row.est_min,
    recurrence: row.recurrence,
    detail: row.detail || undefined,
    deadline: row.deadline ?? undefined,
    done: row.done === 1,
    createdAt: row.created_at,
  }));

  return NextResponse.json(result);
}
