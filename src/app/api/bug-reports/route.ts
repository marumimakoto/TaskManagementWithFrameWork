import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import crypto from 'crypto';

interface BugReportRow {
  id: string;
  user_id: string;
  user_name: string;
  title: string;
  description: string;
  status: string;
  admin_reply: string | null;
  created_at: number;
  updated_at: number;
}

/**
 * バグ報告一覧を取得する
 * userId指定: そのユーザーの報告のみ
 * role=admin: 全報告
 */
export function GET(request: NextRequest): NextResponse {
  const userId: string | null = request.nextUrl.searchParams.get('userId');
  const role: string | null = request.nextUrl.searchParams.get('role');

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const db: import('better-sqlite3').Database = getDb();

  let rows: BugReportRow[];
  if (role === 'admin') {
    rows = db.prepare(
      'SELECT * FROM bug_reports ORDER BY created_at DESC'
    ).all() as BugReportRow[];
  } else {
    rows = db.prepare(
      'SELECT * FROM bug_reports WHERE user_id = ? ORDER BY created_at DESC'
    ).all(userId) as BugReportRow[];
  }

  const result = rows.map((row: BugReportRow) => ({
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    title: row.title,
    description: row.description,
    status: row.status,
    adminReply: row.admin_reply ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return NextResponse.json(result);
}

/**
 * バグ報告を新規作成する
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body: { userId?: string; userName?: string; title?: string; description?: string } = await request.json();
  const { userId, userName, title, description } = body;

  if (!userId || !title || !description) {
    return NextResponse.json({ error: 'userId, title, description are required' }, { status: 400 });
  }

  const db: import('better-sqlite3').Database = getDb();
  const id: string = crypto.randomUUID();
  const now: number = Date.now();

  db.prepare(
    'INSERT INTO bug_reports (id, user_id, user_name, title, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, userId, userName ?? '', title.trim(), description.trim(), now, now);

  return NextResponse.json({ ok: true, id });
}

/**
 * バグ報告を更新する（管理者の返信・ステータス変更）
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const body: { id?: string; status?: string; adminReply?: string } = await request.json();
  const { id, status, adminReply } = body;

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const db: import('better-sqlite3').Database = getDb();
  const now: number = Date.now();

  const fields: string[] = ['updated_at = ?'];
  const values: (string | number)[] = [now];

  if (status !== undefined) {
    fields.push('status = ?');
    values.push(status);
  }
  if (adminReply !== undefined) {
    fields.push('admin_reply = ?');
    values.push(adminReply);
  }

  values.push(id);
  db.prepare(`UPDATE bug_reports SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  return NextResponse.json({ ok: true });
}
