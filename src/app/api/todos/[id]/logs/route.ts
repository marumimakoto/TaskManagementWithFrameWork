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
  const db = await getDb();
  const rows: WorkLogRow[] = await db.all<WorkLogRow>(
    'SELECT * FROM work_logs WHERE todo_id = ? ORDER BY date DESC, created_at DESC', id
  );

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

  const db = await getDb();
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

  await db.run(
    'INSERT INTO work_logs (id, todo_id, content, date, created_at) VALUES (?, ?, ?, ?, ?)',
    logId, id, content.trim(), date, createdAt
  );

  const log: WorkLog = {
    id: logId,
    todoId: id,
    content: content.trim(),
    date,
    createdAt,
  };

  return NextResponse.json(log);
}

/**
 * 作業ログを削除する
 * @param request - { logId } を含むJSONリクエスト
 * @returns 成功時 { ok: true }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const body: { logId?: string } = await request.json();
    const { logId } = body;
    if (!logId) {
      return NextResponse.json({ error: 'logId is required' }, { status: 400 });
    }

    const db = await getDb();
    await db.run('DELETE FROM work_logs WHERE id = ?', logId);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message: string = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
