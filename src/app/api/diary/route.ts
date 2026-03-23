import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { DiaryEntry } from '@/app/types';

/** DBのdiary_entriesテーブルの行データ */
interface DiaryRow {
  id: string;
  user_id: string;
  title: string;
  date: string;
  content: string;
  is_public: number;
  created_at: number;
  updated_at: number;
}

/**
 * DBの行データをフロント用のDiaryEntryに変換する
 * @param row - SQLiteから取得した行データ
 * @returns フロント用のDiaryEntryオブジェクト
 */
function rowToDiary(row: DiaryRow): DiaryEntry {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    content: row.content,
    isPublic: row.is_public === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * 指定ユーザーの日記一覧を日付降順で取得する
 * @param request - クエリパラメータに userId を含むリクエスト
 * @returns 日記エントリのJSON配列
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId: string | null = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const db = await getDb();
  const rows: DiaryRow[] = await db.all<DiaryRow>(
    'SELECT * FROM diary_entries WHERE user_id = ? ORDER BY date DESC, created_at DESC', userId
  );

  const entries: DiaryEntry[] = rows.map(rowToDiary);
  return NextResponse.json(entries);
}

/**
 * 日記エントリを作成する。同日のエントリが既に存在する場合は本文を追記する
 * @param request - { userId, title, date, content } を含むJSONリクエスト
 * @returns 作成または更新されたDiaryEntryオブジェクト
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body: { userId?: string; title?: string; date?: string; content?: string } = await request.json();
  const { userId, date, content } = body;

  if (!userId || !date || !content || !content.trim()) {
    return NextResponse.json({ error: 'userId, date, content are required' }, { status: 400 });
  }

  const title: string = body.title?.trim() || '無題';
  const db = await getDb();
  const now: number = Date.now();

  // 同日のエントリが既にあるかチェック
  const existing: DiaryRow | undefined = await db.get<DiaryRow>(
    'SELECT * FROM diary_entries WHERE user_id = ? AND date = ?', userId, date
  );

  if (existing) {
    // 既存エントリに追記
    const appendedContent: string = existing.content + '\n\n' + content.trim();
    await db.run(
      'UPDATE diary_entries SET content = ?, updated_at = ? WHERE id = ?',
      appendedContent, now, existing.id
    );

    const updated: DiaryEntry = {
      id: existing.id,
      title: existing.title,
      date: existing.date,
      content: appendedContent,
      isPublic: existing.is_public === 1,
      createdAt: existing.created_at,
      updatedAt: now,
    };
    return NextResponse.json({ entry: updated, appended: true });
  }

  // 新規作成
  const id: string = crypto.randomUUID();
  await db.run(
    'INSERT INTO diary_entries (id, user_id, title, date, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    id, userId, title, date, content.trim(), now, now
  );

  const entry: DiaryEntry = {
    id,
    title,
    date,
    content: content.trim(),
    isPublic: false,
    createdAt: now,
    updatedAt: now,
  };

  return NextResponse.json({ entry, appended: false });
}
