import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/**
 * 繰り返しルール一覧を取得する
 * todosテーブルではなくrecurring_rulesテーブルから取得する
 * タスクが削除されてもルールは残る
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId: string | null = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const db = await getDb();
  const rows = await db.all<{
    id: string; title: string; est_min: number; recurrence: string; detail: string;
    deadline_offset_days: number | null; enabled: number;
    generated_count: number; completed_count: number; created_at: number;
  }>(
    'SELECT id, title, est_min, recurrence, detail, deadline_offset_days, enabled, generated_count, completed_count, created_at FROM recurring_rules WHERE user_id = ? AND enabled = 1 ORDER BY created_at DESC', userId
  );

  const result = rows.map((row) => ({
    id: row.id,
    title: row.title,
    estMin: row.est_min,
    recurrence: row.recurrence,
    detail: row.detail || undefined,
    deadlineOffsetDays: row.deadline_offset_days,
    generatedCount: row.generated_count ?? 0,
    completedCount: row.completed_count ?? 0,
    createdAt: row.created_at,
  }));

  return NextResponse.json(result);
}

/**
 * 繰り返しルールを無効化する
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const db = await getDb();
    await db.run('UPDATE recurring_rules SET enabled = 0 WHERE id = ?', id);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message: string = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * 繰り返しルールを更新する
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
    if (updates.estMin !== undefined) {
      fields.push('est_min = ?');
      values.push(updates.estMin);
    }
    if (updates.recurrence !== undefined) {
      fields.push('recurrence = ?');
      values.push(updates.recurrence);
    }
    if (updates.detail !== undefined) {
      fields.push('detail = ?');
      values.push(updates.detail);
    }
    if (updates.deadlineOffsetDays !== undefined) {
      fields.push('deadline_offset_days = ?');
      values.push(updates.deadlineOffsetDays);
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'no fields' }, { status: 400 });
    }

    values.push(id);
    await db.run(`UPDATE recurring_rules SET ${fields.join(', ')} WHERE id = ?`, ...values);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message: string = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
