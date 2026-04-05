import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import crypto from 'crypto';

/**
 * 指定IDのタスクを部分更新する
 * リクエストボディの { updates } に含まれるフィールドだけをDBに反映する
 * @param request - { updates: { title?, estMin?, done?, ... } } を含むJSONリクエスト
 * @param params - URLパスパラメータ（タスクID）
 * @returns 成功時 { ok: true }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id }: { id: string } = await params;
  const body: { updates?: Record<string, unknown> } = await request.json();
  const { updates } = body;

  if (!updates) {
    return NextResponse.json({ error: 'updates is required' }, { status: 400 });
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
  if (updates.actualMin !== undefined) {
    fields.push('actual_min = ?');
    values.push(updates.actualMin);
  }
  if (updates.stuckHours !== undefined) {
    fields.push('stuck_hours = ?');
    values.push(updates.stuckHours);
  }
  if (updates.lastWorkedAt !== undefined) {
    fields.push('last_worked_at = ?');
    values.push(updates.lastWorkedAt ?? null);
  }
  if (updates.deadline !== undefined) {
    fields.push('deadline = ?');
    values.push(updates.deadline ?? null);
  }
  if (updates.recurrence !== undefined) {
    fields.push('recurrence = ?');
    values.push(updates.recurrence);
  }
  if (updates.parentId !== undefined) {
    fields.push('parent_id = ?');
    values.push(updates.parentId ?? null);
  }
  if (updates.detail !== undefined) {
    fields.push('detail = ?');
    values.push(updates.detail);
  }
  if (updates.sortOrder !== undefined) {
    fields.push('sort_order = ?');
    values.push(updates.sortOrder);
  }
  if (updates.category !== undefined) {
    fields.push('category = ?');
    values.push(updates.category);
  }
  if (updates.gtdStatus !== undefined) {
    fields.push('gtd_status = ?');
    values.push(updates.gtdStatus);
  }
  if (updates.started !== undefined) {
    fields.push('started = ?');
    values.push(updates.started ? 1 : 0);
  }
  if (updates.done !== undefined) {
    fields.push('done = ?');
    values.push(updates.done ? 1 : 0);
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: 'no fields to update' }, { status: 400 });
  }

  // UPDATE前に旧データを取得（繰り返し設定の変更判定用）
  const oldTodo = updates.recurrence !== undefined
    ? await db.get<{ user_id: string; title: string; est_min: number; detail: string; category: string; deadline: number | null; recurrence: string }>(
        'SELECT user_id, title, est_min, detail, category, deadline, recurrence FROM todos WHERE id = ?', id
      )
    : null;

  values.push(id);
  await db.run(`UPDATE todos SET ${fields.join(', ')} WHERE id = ?`, ...values);

  // 繰り返し設定が変更された場合、recurring_rulesを更新
  if (updates.recurrence !== undefined && oldTodo) {
    console.log('[recurring-debug]', { newRec: updates.recurrence, oldRec: oldTodo.recurrence, changed: updates.recurrence !== oldTodo.recurrence });
    if (updates.recurrence !== oldTodo.recurrence) {
      try {
        // 繰り返し設定が実際に変わった場合のみ、既存ルール（同タイトル）を無効化
        await db.run(
          'UPDATE recurring_rules SET enabled = 0 WHERE user_id = ? AND title = ?',
          oldTodo.user_id, oldTodo.title
        );
        // 新しいルールがcarry以外なら登録
        if (updates.recurrence !== 'carry') {
          // 期限オフセット: 期限が設定されていれば「期限 - 今日」の日数を保存
          let deadlineOffsetDays: number | null = null;
          const currentDeadline: number | null = updates.deadline !== undefined ? (updates.deadline as number | null) : oldTodo.deadline;
          if (currentDeadline) {
            const nowDate: Date = new Date();
            nowDate.setHours(0, 0, 0, 0);
            const deadlineDate: Date = new Date(currentDeadline);
            deadlineDate.setHours(0, 0, 0, 0);
            deadlineOffsetDays = Math.round((deadlineDate.getTime() - nowDate.getTime()) / 86400000);
            if (deadlineOffsetDays < 0) {
              deadlineOffsetDays = 0;
            }
          }
          const ruleId: string = crypto.randomUUID();
          await db.run(
            'INSERT INTO recurring_rules (id, user_id, title, est_min, detail, recurrence, category, deadline_offset_days, generated_count, completed_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)',
            ruleId, oldTodo.user_id, oldTodo.title, oldTodo.est_min, oldTodo.detail, updates.recurrence, oldTodo.category ?? '', deadlineOffsetDays
          );
          console.log('[recurring-debug] inserted rule:', { ruleId, title: oldTodo.title, recurrence: updates.recurrence });
        }
      } catch (recurringError) {
        console.error('[recurring-debug] failed to update recurring_rules:', recurringError);
        // 繰り返しルールの更新に失敗してもタスク更新自体は成功させる
      }
    }
  }

  return NextResponse.json({ ok: true });
}

/**
 * 指定IDのタスクをアーカイブに保存してからDBから削除する
 * アーカイブはユーザーごとに最大100件を保持し、超過分は古い順に削除する
 * @param _request - 未使用（Next.jsのRoute Handler規約で必要）
 * @param params - URLパスパラメータ（タスクID）
 * @returns 成功時 { ok: true }
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id }: { id: string } = await params;
  const db = await getDb();

  // 削除前にタスク情報を取得してアーカイブに保存
  const row = await db.get<{ id: string; user_id: string; title: string; est_min: number; actual_min: number; detail: string; category: string; deadline: number | null; done: number; created_at: number }>(
    'SELECT id, user_id, title, est_min, actual_min, detail, category, deadline, done, created_at FROM todos WHERE id = ?', id
  );

  if (row) {
    await db.run(
      'INSERT OR REPLACE INTO archived_todos (id, user_id, title, est_min, actual_min, detail, category, deadline, done, created_at, archived_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      row.id, row.user_id, row.title, row.est_min, row.actual_min, row.detail, row.category ?? '', row.deadline, row.done, row.created_at, Date.now()
    );

    // ユーザーごとに100件を超えたら古い順に削除
    await db.run(`
      DELETE FROM archived_todos WHERE id IN (
        SELECT id FROM archived_todos WHERE user_id = ?
        ORDER BY archived_at DESC
        LIMIT -1 OFFSET 100
      )
    `, row.user_id);

    // 完了タスクを削除した場合、繰り返しルールの達成カウントをインクリメント
    if (row.done === 1) {
      try {
        await db.run(
          'UPDATE recurring_rules SET completed_count = completed_count + 1 WHERE user_id = ? AND title = ? AND enabled = 1',
          row.user_id, row.title
        );
      } catch { /* カラム未追加の場合は無視 */ }
    }
  }

  await db.run('DELETE FROM todos WHERE id = ?', id);

  return NextResponse.json({ ok: true });
}
