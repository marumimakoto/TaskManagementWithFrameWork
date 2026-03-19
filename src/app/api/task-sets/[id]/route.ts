import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/**
 * タスクセットまたはセット内アイテムを更新する
 * - { isPublic } → セットの公開/非公開切替
 * - { action: 'updateItem', itemId, updates } → アイテムの個別更新
 * - { action: 'deleteItem', itemId } → アイテムの削除
 * - { action: 'swapOrder', itemId1, itemId2 } → 2つのアイテムのsort_orderを入れ替え
 * - { action: 'setParent', itemId, parentId } → アイテムの親を変更
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id }: { id: string } = await params;
  const body = await request.json();
  const db: import('better-sqlite3').Database = getDb();

  try {
    // セットの公開切替
    if (body.isPublic !== undefined) {
      db.prepare('UPDATE task_sets SET is_public = ? WHERE id = ?').run(body.isPublic ? 1 : 0, id);
      return NextResponse.json({ ok: true });
    }

    const action: string = body.action;

    if (action === 'updateItem') {
      const { itemId, updates } = body;
      const fields: string[] = [];
      const values: unknown[] = [];
      if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
      if (updates.estMin !== undefined) { fields.push('est_min = ?'); values.push(updates.estMin); }
      if (updates.detail !== undefined) { fields.push('detail = ?'); values.push(updates.detail); }
      if (updates.recurrence !== undefined) { fields.push('recurrence = ?'); values.push(updates.recurrence); }
      if (updates.deadline !== undefined) { fields.push('deadline = ?'); values.push(updates.deadline || null); }
      if (updates.sortOrder !== undefined) { fields.push('sort_order = ?'); values.push(updates.sortOrder); }
      if (updates.parentId !== undefined) { fields.push('parent_id = ?'); values.push(updates.parentId || null); }
      if (fields.length > 0) {
        values.push(itemId);
        db.prepare(`UPDATE task_set_items SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      }
      return NextResponse.json({ ok: true });
    }

    if (action === 'deleteItem') {
      db.prepare('DELETE FROM task_set_items WHERE id = ?').run(body.itemId);
      return NextResponse.json({ ok: true });
    }

    if (action === 'swapOrder') {
      const item1 = db.prepare('SELECT sort_order FROM task_set_items WHERE id = ?').get(body.itemId1) as { sort_order: number } | undefined;
      const item2 = db.prepare('SELECT sort_order FROM task_set_items WHERE id = ?').get(body.itemId2) as { sort_order: number } | undefined;
      if (item1 && item2) {
        db.prepare('UPDATE task_set_items SET sort_order = ? WHERE id = ?').run(item2.sort_order, body.itemId1);
        db.prepare('UPDATE task_set_items SET sort_order = ? WHERE id = ?').run(item1.sort_order, body.itemId2);
      }
      return NextResponse.json({ ok: true });
    }

    if (action === 'setParent') {
      db.prepare('UPDATE task_set_items SET parent_id = ? WHERE id = ?').run(body.parentId || null, body.itemId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (e: unknown) {
    const message: string = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * タスクセットを削除する
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id }: { id: string } = await params;
  const db: import('better-sqlite3').Database = getDb();
  db.prepare('DELETE FROM task_set_items WHERE set_id = ?').run(id);
  db.prepare('DELETE FROM task_sets WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
