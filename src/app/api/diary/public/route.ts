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
export function GET(request: NextRequest): NextResponse {
  const userId: string | null = request.nextUrl.searchParams.get('userId');
  const db: import('better-sqlite3').Database = getDb();
  const rows: PublicDiaryRow[] = db.prepare(`
    SELECT d.id, d.user_id, u.name as user_name, u.avatar as user_avatar, d.title, d.date, d.content, d.created_at,
      (SELECT COUNT(*) FROM diary_likes WHERE diary_id = d.id) as like_count,
      (SELECT COUNT(*) FROM diary_replies WHERE diary_id = d.id) as reply_count
    FROM diary_entries d
    JOIN users u ON d.user_id = u.id
    WHERE d.is_public = 1
    ORDER BY d.date DESC, d.created_at DESC
  `).all() as PublicDiaryRow[];

  // ユーザーがいいね済みかどうかも返す
  const result = rows.map((row) => {
    let liked: boolean = false;
    if (userId) {
      const likeRow = db.prepare(
        'SELECT id FROM diary_likes WHERE diary_id = ? AND user_id = ?'
      ).get(row.id, userId);
      liked = !!likeRow;
    }
    return { ...row, liked };
  });

  return NextResponse.json(result);
}
