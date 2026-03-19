import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import crypto from 'crypto';

/**
 * 公開タスクセット一覧を取得する（いいね数・自分がいいね済みかも含む）
 * userId指定時: そのユーザーのセットを除外 + いいね済み判定
 */
export function GET(request: NextRequest): NextResponse {
  const userId: string | null = request.nextUrl.searchParams.get('userId');
  const db: import('better-sqlite3').Database = getDb();

  let query: string = `
    SELECT s.id, s.name, s.user_id, u.name as user_name, s.created_at,
      (SELECT COUNT(*) FROM task_set_likes WHERE set_id = s.id) as like_count
    FROM task_sets s
    JOIN users u ON s.user_id = u.id
    WHERE s.is_public = 1
  `;
  const params: string[] = [];

  if (userId) {
    query += ' AND s.user_id != ?';
    params.push(userId);
  }

  query += ' ORDER BY s.created_at DESC';

  const sets = db.prepare(query).all(...params) as {
    id: string; name: string; user_id: string; user_name: string; created_at: number; like_count: number;
  }[];

  const result = sets.map((s) => {
    const items = db.prepare(
      'SELECT id, title, est_min, detail, recurrence, deadline FROM task_set_items WHERE set_id = ? ORDER BY sort_order ASC'
    ).all(s.id) as { id: string; title: string; est_min: number; detail: string; recurrence: string; deadline: string | null }[];

    let liked: boolean = false;
    if (userId) {
      const likeRow = db.prepare(
        'SELECT id FROM task_set_likes WHERE set_id = ? AND user_id = ?'
      ).get(s.id, userId);
      liked = !!likeRow;
    }

    return {
      id: s.id,
      name: s.name,
      userName: s.user_name,
      likeCount: s.like_count,
      liked,
      items: items.map((item) => ({
        title: item.title,
        estMin: item.est_min,
        detail: item.detail || undefined,
        recurrence: item.recurrence,
        deadline: item.deadline || undefined,
      })),
    };
  });

  return NextResponse.json(result);
}

/**
 * いいねをトグルする
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body: { userId?: string; setId?: string } = await request.json();
  const { userId, setId } = body;

  if (!userId || !setId) {
    return NextResponse.json({ error: 'userId and setId are required' }, { status: 400 });
  }

  const db: import('better-sqlite3').Database = getDb();

  const existing = db.prepare(
    'SELECT id FROM task_set_likes WHERE set_id = ? AND user_id = ?'
  ).get(setId, userId) as { id: string } | undefined;

  if (existing) {
    db.prepare('DELETE FROM task_set_likes WHERE id = ?').run(existing.id);
    const count = db.prepare('SELECT COUNT(*) as cnt FROM task_set_likes WHERE set_id = ?').get(setId) as { cnt: number };
    return NextResponse.json({ liked: false, likeCount: count.cnt });
  }

  const id: string = crypto.randomUUID();
  db.prepare('INSERT INTO task_set_likes (id, set_id, user_id) VALUES (?, ?, ?)').run(id, setId, userId);
  const count = db.prepare('SELECT COUNT(*) as cnt FROM task_set_likes WHERE set_id = ?').get(setId) as { cnt: number };
  return NextResponse.json({ liked: true, likeCount: count.cnt });
}
