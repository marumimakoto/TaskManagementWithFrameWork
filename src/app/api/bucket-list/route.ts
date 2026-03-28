import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import crypto from 'crypto';

/**
 * やりたいことリストの一覧を取得する
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId: string | null = request.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const db = await getDb();
    const rows = await db.all(
      'SELECT * FROM bucket_list WHERE user_id = ? ORDER BY done ASC, sort_order ASC, created_at DESC',
      userId,
    );

    const items = rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      title: row.title,
      detail: row.detail,
      category: row.category,
      deadlineYear: row.deadline_year,
      done: row.done === 1,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
    }));

    // カテゴリ一覧を取得（なければデフォルトを作成）
    let categories = await db.all(
      'SELECT * FROM bucket_categories WHERE user_id = ? ORDER BY sort_order ASC',
      userId,
    );
    if (categories.length === 0) {
      const defaults: string[] = ['仕事', '私生活', '趣味', '健康', '学び', 'お金', '旅行', 'その他'];
      for (let i = 0; i < defaults.length; i++) {
        await db.run(
          'INSERT INTO bucket_categories (id, user_id, name, sort_order) VALUES (?, ?, ?, ?)',
          crypto.randomUUID(), userId, defaults[i], i,
        );
      }
      categories = await db.all(
        'SELECT * FROM bucket_categories WHERE user_id = ? ORDER BY sort_order ASC',
        userId,
      );
    }
    const categoryList = categories.map((row: Record<string, unknown>) => ({
      id: row.id,
      name: row.name,
    }));

    return NextResponse.json({ items, categories: categoryList });
  } catch (e: unknown) {
    const message: string = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * やりたいことリストに新しい項目またはカテゴリを追加する
 * type='category' の場合はカテゴリ追加
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();

    // カテゴリ追加
    if (body.type === 'category') {
      const { userId, name } = body;
      if (!userId || !name?.trim()) {
        return NextResponse.json({ error: 'userId and name required' }, { status: 400 });
      }
      const db = await getDb();
      const catId: string = crypto.randomUUID();
      await db.run(
        'INSERT INTO bucket_categories (id, user_id, name) VALUES (?, ?, ?)',
        catId, userId, name.trim(),
      );
      return NextResponse.json({ id: catId, name: name.trim() });
    }

    // アイテム追加
    const { userId, title, detail, category, deadlineYear } = body;

    if (!userId || !title?.trim()) {
      return NextResponse.json({ error: 'userId and title required' }, { status: 400 });
    }

    const db = await getDb();
    const id: string = crypto.randomUUID();

    await db.run(
      'INSERT INTO bucket_list (id, user_id, title, detail, category, deadline_year) VALUES (?, ?, ?, ?, ?, ?)',
      id,
      userId,
      title.trim(),
      detail?.trim() ?? '',
      category ?? '私生活',
      deadlineYear ?? null,
    );

    return NextResponse.json({ id });
  } catch (e: unknown) {
    const message: string = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * やりたいことリストの項目を更新する
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { id, updates } = body;

    if (!id || !updates) {
      return NextResponse.json({ error: 'id and updates required' }, { status: 400 });
    }

    const db = await getDb();
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.title !== undefined) {
      fields.push('title = ?');
      values.push(updates.title);
    }
    if (updates.detail !== undefined) {
      fields.push('detail = ?');
      values.push(updates.detail);
    }
    if (updates.category !== undefined) {
      fields.push('category = ?');
      values.push(updates.category);
    }
    if (updates.deadlineYear !== undefined) {
      fields.push('deadline_year = ?');
      values.push(updates.deadlineYear);
    }
    if (updates.done !== undefined) {
      fields.push('done = ?');
      values.push(updates.done ? 1 : 0);
    }
    if (updates.sortOrder !== undefined) {
      fields.push('sort_order = ?');
      values.push(updates.sortOrder);
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'no fields to update' }, { status: 400 });
    }

    values.push(id);
    await db.run(`UPDATE bucket_list SET ${fields.join(', ')} WHERE id = ?`, ...values);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message: string = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * やりたいことリストの項目またはカテゴリを削除する
 * type='category' の場合はカテゴリ削除（該当アイテムは「未分類」に変更）
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { id, type } = body;
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const db = await getDb();

    if (type === 'category') {
      // カテゴリ名を取得
      const cat = await db.get('SELECT name FROM bucket_categories WHERE id = ?', id);
      if (cat) {
        const catName: string = cat.name as string;
        // このカテゴリのアイテムを「未分類」に変更
        await db.run('UPDATE bucket_list SET category = ? WHERE category = ?', '未分類', catName);
      }
      await db.run('DELETE FROM bucket_categories WHERE id = ?', id);
    } else {
      await db.run('DELETE FROM bucket_list WHERE id = ?', id);
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message: string = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
