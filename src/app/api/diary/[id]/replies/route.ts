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
  const db = await getDb();
  const rows: ReplyRow[] = await db.all<ReplyRow>(`
    SELECT r.id, r.diary_id, r.user_id, u.name as user_name, u.avatar as user_avatar, r.content, r.created_at
    FROM diary_replies r
    JOIN users u ON r.user_id = u.id
    WHERE r.diary_id = ?
    ORDER BY r.created_at ASC
  `, id);

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

  const db = await getDb();
  const replyId: string = crypto.randomUUID();
  await db.run(
    'INSERT INTO diary_replies (id, diary_id, user_id, content) VALUES (?, ?, ?, ?)',
    replyId, id, body.userId, body.content.trim()
  );

  // ユーザー情報付きで返す
  const row: ReplyRow | undefined = await db.get<ReplyRow>(`
    SELECT r.id, r.diary_id, r.user_id, u.name as user_name, u.avatar as user_avatar, r.content, r.created_at
    FROM diary_replies r
    JOIN users u ON r.user_id = u.id
    WHERE r.id = ?
  `, replyId);

  return NextResponse.json(row);
}
