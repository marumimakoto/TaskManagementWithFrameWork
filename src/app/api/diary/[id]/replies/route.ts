import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/** リプライの行データ */
interface ReplyRow {
  id: string;
  diary_id: string;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  content: string;
  created_at: number;
}

/**
 * 指定日記のリプライ一覧を取得する
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id }: { id: string } = await params;
  const db: import('better-sqlite3').Database = getDb();
  const rows: ReplyRow[] = db.prepare(`
    SELECT r.id, r.diary_id, r.user_id, u.name as user_name, u.avatar as user_avatar, r.content, r.created_at
    FROM diary_replies r
    JOIN users u ON r.user_id = u.id
    WHERE r.diary_id = ?
    ORDER BY r.created_at ASC
  `).all(id) as ReplyRow[];

  return NextResponse.json(rows);
}

/**
 * 指定日記にリプライを追加する
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id }: { id: string } = await params;
  const body: { userId?: string; content?: string } = await request.json();

  if (!body.userId || !body.content?.trim()) {
    return NextResponse.json({ error: 'userId and content are required' }, { status: 400 });
  }

  const db: import('better-sqlite3').Database = getDb();
  const replyId: string = crypto.randomUUID();
  db.prepare(
    'INSERT INTO diary_replies (id, diary_id, user_id, content) VALUES (?, ?, ?, ?)'
  ).run(replyId, id, body.userId, body.content.trim());

  // ユーザー情報付きで返す
  const row: ReplyRow = db.prepare(`
    SELECT r.id, r.diary_id, r.user_id, u.name as user_name, u.avatar as user_avatar, r.content, r.created_at
    FROM diary_replies r
    JOIN users u ON r.user_id = u.id
    WHERE r.id = ?
  `).get(replyId) as ReplyRow;

  return NextResponse.json(row);
}
