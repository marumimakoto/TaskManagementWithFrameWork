import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/**
 * 初期化API: タスク一覧・設定・購入状態を一括取得する
 * 起動時の複数API呼び出しを1回にまとめてパフォーマンスを向上させる
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId: string | null = request.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const db = await getDb();

    // タスク一覧
    const todoRows = await db.all(
      'SELECT * FROM todos WHERE user_id = ? ORDER BY sort_order ASC',
      userId,
    );
    const todos = todoRows.map((row: Record<string, unknown>) => ({
      id: row.id,
      parentId: row.parent_id || undefined,
      title: row.title,
      estMin: row.est_min,
      actualMin: row.actual_min,
      stuckHours: row.stuck_hours,
      lastWorkedAt: row.last_worked_at,
      deadline: row.deadline,
      recurrence: row.recurrence,
      detail: row.detail,
      started: row.started === 1,
      done: row.done === 1,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
    }));

    // 設定
    let settingsRow = await db.get(
      'SELECT * FROM user_settings WHERE user_id = ?',
      userId,
    );
    const settings = settingsRow ? {
      darkMode: settingsRow.dark_mode === 1,
      fontSize: settingsRow.font_size,
      fontFamily: settingsRow.font_family,
      butlerAvatar: settingsRow.butler_avatar ?? '',
      butlerPrompt: settingsRow.butler_prompt ?? 'ユーザーを励ませ',
      butlerMaxChars: settingsRow.butler_max_chars ?? 80,
    } : null;

    // 購入状態（管理者チェック含む）
    const userRow = await db.get(
      'SELECT role FROM users WHERE id = ?',
      userId,
    );
    let isPro: boolean = false;
    if (userRow && (userRow as Record<string, unknown>).role === 'admin') {
      isPro = true;
    } else {
      const purchase = await db.get(
        'SELECT id FROM user_purchases WHERE user_id = ?',
        userId,
      );
      isPro = !!purchase;
    }

    return NextResponse.json({ todos, settings, isPro });
  } catch (e: unknown) {
    const message: string = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
