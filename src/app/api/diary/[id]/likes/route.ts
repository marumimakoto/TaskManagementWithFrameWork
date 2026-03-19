import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/**
 * 日記のいいね数を取得する
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id }: { id: string } = await params;
  const userId: string | null = request.nextUrl.searchParams.get('userId');
  const db: import('better-sqlite3').Database = getDb();

  const countRow = db.prepare(
    'SELECT COUNT(*) as count FROM diary_likes WHERE diary_id = ?'
  ).get(id) as { count: number };

  let liked: boolean = false;
  if (userId) {
    const likeRow = db.prepare(
      'SELECT id FROM diary_likes WHERE diary_id = ? AND user_id = ?'
    ).get(id, userId);
    liked = !!likeRow;
  }

  return NextResponse.json({ count: countRow.count, liked });
}

/**
 * いいねを切り替える（トグル）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id }: { id: string } = await params;
  const body: { userId?: string } = await request.json();
  if (!body.userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const db: import('better-sqlite3').Database = getDb();
  const existing = db.prepare(
    'SELECT id FROM diary_likes WHERE diary_id = ? AND user_id = ?'
  ).get(id, body.userId);

  if (existing) {
    db.prepare('DELETE FROM diary_likes WHERE diary_id = ? AND user_id = ?').run(id, body.userId);
  } else {
    db.prepare(
      'INSERT INTO diary_likes (id, diary_id, user_id) VALUES (?, ?, ?)'
    ).run(crypto.randomUUID(), id, body.userId);
  }

  const countRow = db.prepare(
    'SELECT COUNT(*) as count FROM diary_likes WHERE diary_id = ?'
  ).get(id) as { count: number };

  return NextResponse.json({ count: countRow.count, liked: !existing });
}
