import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import crypto from 'crypto';

const DEFAULT_CATEGORIES: string[] = ['仕事', '私生活', '読書', '勉強', '健康', '家事', 'その他'];

/**
 * タスクカテゴリ一覧を取得する（なければデフォルトを作成）
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId: string | null = request.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const db = await getDb();
    let rows = await db.all(
      'SELECT * FROM todo_categories WHERE user_id = ? ORDER BY sort_order ASC',
      userId,
    );

    // 初回: デフォルトカテゴリを作成
    if (rows.length === 0) {
      for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
        await db.run(
          'INSERT INTO todo_categories (id, user_id, name, sort_order) VALUES (?, ?, ?, ?)',
          crypto.randomUUID(), userId, DEFAULT_CATEGORIES[i], i,
        );
      }
      rows = await db.all(
        'SELECT * FROM todo_categories WHERE user_id = ? ORDER BY sort_order ASC',
        userId,
      );
    }

    const categories = rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      name: row.name,
    }));

    return NextResponse.json(categories);
  } catch (e: unknown) {
    const message: string = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * カテゴリを追加する
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { userId, name } = body;
    if (!userId || !name?.trim()) {
      return NextResponse.json({ error: 'userId and name required' }, { status: 400 });
    }

    const db = await getDb();
    const id: string = crypto.randomUUID();
    await db.run(
      'INSERT INTO todo_categories (id, user_id, name) VALUES (?, ?, ?)',
      id, userId, name.trim(),
    );

    return NextResponse.json({ id, name: name.trim() });
  } catch (e: unknown) {
    const message: string = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * カテゴリを削除する（該当タスクのカテゴリは空に）
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { id, userId } = body;
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const db = await getDb();
    const cat = await db.get('SELECT name FROM todo_categories WHERE id = ?', id);
    if (cat) {
      await db.run("UPDATE todos SET category = '' WHERE user_id = ? AND category = ?", userId, cat.name as string);
    }
    await db.run('DELETE FROM todo_categories WHERE id = ?', id);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message: string = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
