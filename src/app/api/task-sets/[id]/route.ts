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
  const db = await getDb();

  try {
    // セットの公開切替
    if (body.isPublic !== undefined) {
      await db.run('UPDATE task_sets SET is_public = ? WHERE id = ?', body.isPublic ? 1 : 0, id);
      return NextResponse.json({ ok: true });
    }

    const action: string = body.action;

    if (action === 'rename') {
      const newName: string = body.name?.trim();
      if (!newName) {
        return NextResponse.json({ error: 'name is required' }, { status: 400 });
      }
      await db.run('UPDATE task_sets SET name = ? WHERE id = ?', newName, id);
      return NextResponse.json({ ok: true });
    }

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
        await db.run(`UPDATE task_set_items SET ${fields.join(', ')} WHERE id = ?`, ...values);
      }
      return NextResponse.json({ ok: true });
    }

    if (action === 'deleteItem') {
      await db.run('DELETE FROM task_set_items WHERE id = ?', body.itemId);
      return NextResponse.json({ ok: true });
    }

    if (action === 'swapOrder') {
      const item1 = await db.get<{ sort_order: number }>('SELECT sort_order FROM task_set_items WHERE id = ?', body.itemId1);
      const item2 = await db.get<{ sort_order: number }>('SELECT sort_order FROM task_set_items WHERE id = ?', body.itemId2);
      if (item1 && item2) {
        await db.run('UPDATE task_set_items SET sort_order = ? WHERE id = ?', item2.sort_order, body.itemId1);
        await db.run('UPDATE task_set_items SET sort_order = ? WHERE id = ?', item1.sort_order, body.itemId2);
      }
      return NextResponse.json({ ok: true });
    }

    if (action === 'setParent') {
      await db.run('UPDATE task_set_items SET parent_id = ? WHERE id = ?', body.parentId || null, body.itemId);
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
  const db = await getDb();
  await db.run('DELETE FROM task_set_items WHERE set_id = ?', id);
  await db.run('DELETE FROM task_sets WHERE id = ?', id);
  return NextResponse.json({ ok: true });
}
