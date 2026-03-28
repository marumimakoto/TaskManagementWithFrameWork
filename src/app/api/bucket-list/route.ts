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

    return NextResponse.json(items);
  } catch (e: unknown) {
    const message: string = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * やりたいことリストに新しい項目を追加する
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
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
 * やりたいことリストの項目を削除する
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const db = await getDb();
    await db.run('DELETE FROM bucket_list WHERE id = ?', id);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message: string = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
