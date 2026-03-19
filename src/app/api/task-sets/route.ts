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
export function GET(request: NextRequest): NextResponse {
  const userId: string | null = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const db: import('better-sqlite3').Database = getDb();
  const sets: TaskSetRow[] = db.prepare(
    'SELECT * FROM task_sets WHERE user_id = ? ORDER BY created_at DESC'
  ).all(userId) as TaskSetRow[];

  const result = sets.map((s: TaskSetRow) => {
    const items: TaskSetItemRow[] = db.prepare(
      'SELECT * FROM task_set_items WHERE set_id = ? ORDER BY sort_order ASC'
    ).all(s.id) as TaskSetItemRow[];
    return {
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
    };
  });

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

  const db: import('better-sqlite3').Database = getDb();

  // 既存セットにアイテムを追加
  if (body.setId && items && items.length > 0) {
    const insertItem = db.prepare(
      'INSERT INTO task_set_items (id, set_id, title, est_min, detail, recurrence, deadline, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const maxOrder = db.prepare(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM task_set_items WHERE set_id = ?'
    ).get(body.setId) as { max_order: number };

    items.forEach((item, i: number) => {
      insertItem.run(
        crypto.randomUUID(),
        body.setId,
        item.title,
        item.estMin ?? 30,
        item.detail ?? '',
        item.recurrence ?? 'carry',
        item.deadline ?? null,
        maxOrder.max_order + 1 + i,
      );
    });
    return NextResponse.json({ ok: true });
  }

  // 新規セット作成
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const setId: string = crypto.randomUUID();

  db.prepare('INSERT INTO task_sets (id, user_id, name) VALUES (?, ?, ?)').run(setId, userId, name.trim());

  const insertItem = db.prepare(
    'INSERT INTO task_set_items (id, set_id, title, est_min, detail, recurrence, deadline, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const insertAll = db.transaction(() => {
    (items ?? []).forEach((item: { title: string; estMin?: number; detail?: string; recurrence?: string; deadline?: string }, i: number) => {
      insertItem.run(
        crypto.randomUUID(),
        setId,
        item.title,
        item.estMin ?? 30,
        item.detail ?? '',
        item.recurrence ?? 'carry',
        item.deadline ?? null,
        i,
      );
    });
  });
  insertAll();

  return NextResponse.json({ ok: true, id: setId });
  } catch (e: unknown) {
    const message: string = e instanceof Error ? e.message : String(e);
    console.error('[task-sets POST] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
