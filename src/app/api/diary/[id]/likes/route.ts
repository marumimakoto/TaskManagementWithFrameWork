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
  const db = await getDb();

  const countRow = await db.get<{ count: number }>(
    'SELECT COUNT(*) as count FROM diary_likes WHERE diary_id = ?', id
  );

  let liked: boolean = false;
  if (userId) {
    const likeRow = await db.get(
      'SELECT id FROM diary_likes WHERE diary_id = ? AND user_id = ?', id, userId
    );
    liked = !!likeRow;
  }

  return NextResponse.json({ count: countRow?.count ?? 0, liked });
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

  const db = await getDb();
  const existing = await db.get(
    'SELECT id FROM diary_likes WHERE diary_id = ? AND user_id = ?', id, body.userId
  );

  if (existing) {
    await db.run('DELETE FROM diary_likes WHERE diary_id = ? AND user_id = ?', id, body.userId);
  } else {
    await db.run(
      'INSERT INTO diary_likes (id, diary_id, user_id) VALUES (?, ?, ?)',
      crypto.randomUUID(), id, body.userId
    );
  }

  const countRow = await db.get<{ count: number }>(
    'SELECT COUNT(*) as count FROM diary_likes WHERE diary_id = ?', id
  );

  return NextResponse.json({ count: countRow?.count ?? 0, liked: !existing });
}
