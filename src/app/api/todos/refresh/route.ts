import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { todayStr, refreshUserTodos } from '@/lib/refresh';

/**
 * 日次リフレッシュ処理（クライアントから呼び出し用）
 * 1. 完了タスクをアーカイブに移動して削除
 * 2. 繰り返し設定のあるタスクで今日が該当日なら新規追加（同名未完了が無い場合のみ）
 * 3. ユーザーのlast_refresh_dateを今日に更新
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body: { userId?: string } = await request.json();
  const { userId } = body;

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const db = await getDb();

  // ユーザーのタイムゾーン設定を取得
  let timezone: string = 'Asia/Tokyo';
  try {
    const row = await db.get<{ timezone: string }>('SELECT timezone FROM user_settings WHERE user_id = ?', userId);
    if (row?.timezone) {
      timezone = row.timezone;
    }
  } catch { /* カラム未追加時は無視 */ }

  const today: string = todayStr(timezone);

  const result = await refreshUserTodos(db, userId, today);

  if (result === null) {
    return NextResponse.json({ refreshed: false, reason: 'already refreshed today' });
  }

  return NextResponse.json({
    refreshed: true,
    archivedCount: result.archivedCount,
    addedCount: result.addedCount,
  });
}
