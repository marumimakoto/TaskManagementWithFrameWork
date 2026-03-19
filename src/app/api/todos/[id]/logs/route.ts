import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { WorkLog } from '@/app/types';

/** DBのwork_logsテーブルの行データ */
interface WorkLogRow {
  id: string;
  todo_id: string;
  content: string;
  date: string;
  created_at: number;
}

/**
 * DBの行データをフロント用のWorkLogオブジェクトに変換する
 * @param row - SQLiteから取得した行データ
 * @returns フロント用のWorkLogオブジェクト
 */
function rowToWorkLog(row: WorkLogRow): WorkLog {
  return {
    id: row.id,
    todoId: row.todo_id,
    content: row.content,
    date: row.date,
    createdAt: row.created_at,
  };
}

/**
 * 指定タスクの作業ログ一覧を日付降順で取得する
 * @param _request - 未使用
 * @param params - URLパスパラメータ（タスクID）
 * @returns 作業ログのJSON配列
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id }: { id: string } = await params;
  const db: import('better-sqlite3').Database = getDb();
  const rows: WorkLogRow[] = db.prepare(
    'SELECT * FROM work_logs WHERE todo_id = ? ORDER BY date DESC, created_at DESC'
  ).all(id) as WorkLogRow[];

  const logs: WorkLog[] = rows.map(rowToWorkLog);
  return NextResponse.json(logs);
}

/**
 * 指定タスクに作業ログを追加する
 * @param request - { content } を含むJSONリクエスト
 * @param params - URLパスパラメータ（タスクID）
 * @returns 作成されたWorkLogオブジェクト
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id }: { id: string } = await params;
  const body: { content?: string; date?: string } = await request.json();
  const { content } = body;

  if (!content || !content.trim()) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  const db: import('better-sqlite3').Database = getDb();
  const logId: string = crypto.randomUUID();
  const pad = (n: number): string => String(n).padStart(2, '0');
  let date: string;
  if (body.date && body.date.trim()) {
    date = body.date.trim();
  } else {
    const now: Date = new Date();
    date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }
  const createdAt: number = Date.now();

  db.prepare(
    'INSERT INTO work_logs (id, todo_id, content, date, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(logId, id, content.trim(), date, createdAt);

  const log: WorkLog = {
    id: logId,
    todoId: id,
    content: content.trim(),
    date,
    createdAt,
  };

  return NextResponse.json(log);
}
