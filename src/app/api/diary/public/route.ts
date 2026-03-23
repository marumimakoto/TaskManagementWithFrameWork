import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/** 公開日記の行データ */
interface PublicDiaryRow {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  title: string;
  date: string;
  content: string;
  like_count: number;
  reply_count: number;
  created_at: number;
}

/**
 * 全ユーザーの公開日記を日付降順で取得する（いいね数・リプ数付き）
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId: string | null = request.nextUrl.searchParams.get('userId');
  const db = await getDb();
  const rows: PublicDiaryRow[] = await db.all<PublicDiaryRow>(`
    SELECT d.id, d.user_id, u.name as user_name, u.avatar as user_avatar, d.title, d.date, d.content, d.created_at,
      (SELECT COUNT(*) FROM diary_likes WHERE diary_id = d.id) as like_count,
      (SELECT COUNT(*) FROM diary_replies WHERE diary_id = d.id) as reply_count
    FROM diary_entries d
    JOIN users u ON d.user_id = u.id
    WHERE d.is_public = 1
    ORDER BY d.date DESC, d.created_at DESC
  `);

  // ユーザーがいいね済みかどうかも返す
  const result = [];
  for (const row of rows) {
    let liked: boolean = false;
    if (userId) {
      const likeRow = await db.get(
        'SELECT id FROM diary_likes WHERE diary_id = ? AND user_id = ?', row.id, userId
      );
      liked = !!likeRow;
    }
    result.push({ ...row, liked });
  }

  return NextResponse.json(result);
}
