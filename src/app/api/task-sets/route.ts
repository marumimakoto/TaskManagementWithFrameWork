import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/** タスクセットの行データ */
interface TaskSetRow {
  id: string;
  user_id: string;
  name: string;
  is_public: number;
  created_at: number;
}

/** タスクセット内アイテムの行データ */
interface TaskSetItemRow {
  id: string;
  set_id: string;
  parent_id: string | null;
  title: string;
  est_min: number;
  detail: string;
  recurrence: string;
  deadline: string | null;
  sort_order: number;
}

/**
 * ユーザーのタスクセット一覧を取得する（アイテム付き）
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId: string | null = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const db = await getDb();
  const sets: TaskSetRow[] = await db.all<TaskSetRow>(
    'SELECT * FROM task_sets WHERE user_id = ? ORDER BY created_at DESC', userId
  );

  const result = [];
  for (const s of sets) {
    const items: TaskSetItemRow[] = await db.all<TaskSetItemRow>(
      'SELECT * FROM task_set_items WHERE set_id = ? ORDER BY sort_order ASC', s.id
    );
    result.push({
      id: s.id,
      name: s.name,
      isPublic: s.is_public === 1,
      items: items.map((item: TaskSetItemRow) => ({
        id: item.id,
        parentId: item.parent_id ?? undefined,
        title: item.title,
        estMin: item.est_min,
        detail: item.detail || undefined,
        recurrence: item.recurrence,
        deadline: item.deadline || undefined,
        sortOrder: item.sort_order,
      })),
    });
  }

  return NextResponse.json(result);
}

/**
 * タスクセットを作成する、または既存セットにアイテムを追加する
 * setIdが指定されていれば既存セットにアイテムを追加
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
  const body: {
    userId?: string;
    name?: string;
    setId?: string;
    items?: { title: string; estMin?: number; detail?: string; recurrence?: string; deadline?: string }[];
  } = await request.json();

  const { userId, name, items } = body;
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const db = await getDb();

  // 既存セットにアイテムを追加
  if (body.setId && items && items.length > 0) {
    const maxOrder = await db.get<{ max_order: number }>(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM task_set_items WHERE set_id = ?', body.setId
    );

    for (let i: number = 0; i < items.length; i++) {
      const item = items[i];
      await db.run(
        'INSERT INTO task_set_items (id, set_id, title, est_min, detail, recurrence, deadline, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        crypto.randomUUID(),
        body.setId,
        item.title,
        item.estMin ?? 30,
        item.detail ?? '',
        item.recurrence ?? 'carry',
        item.deadline ?? null,
        (maxOrder?.max_order ?? -1) + 1 + i,
      );
    }
    return NextResponse.json({ ok: true });
  }

  // 新規セット作成
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const setId: string = crypto.randomUUID();

  await db.run('INSERT INTO task_sets (id, user_id, name) VALUES (?, ?, ?)', setId, userId, name.trim());

  for (let i: number = 0; i < (items ?? []).length; i++) {
    const item: { title: string; estMin?: number; detail?: string; recurrence?: string; deadline?: string } = (items ?? [])[i];
    await db.run(
      'INSERT INTO task_set_items (id, set_id, title, est_min, detail, recurrence, deadline, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      crypto.randomUUID(),
      setId,
      item.title,
      item.estMin ?? 30,
      item.detail ?? '',
      item.recurrence ?? 'carry',
      item.deadline ?? null,
      i,
    );
  }

  return NextResponse.json({ ok: true, id: setId });
  } catch (e: unknown) {
    const message: string = e instanceof Error ? e.message : String(e);
    console.error('[task-sets POST] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
