import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { todayStr, refreshUserTodos, RefreshResult } from '@/lib/refresh';

interface UserRow {
  id: string;
}

interface UserRefreshResult {
  userId: string;
  archivedCount: number;
  addedCount: number;
}

/**
 * Vercel Cron Jobから呼び出される日次リフレッシュ処理
 * 全ユーザーに対してリフレッシュを実行する
 *
 * CRON_SECRET環境変数による認証で不正アクセスを防止する
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Vercel Cron認証チェック
  const authHeader: string | null = request.headers.get('authorization');
  const cronSecret: string | undefined = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = await getDb();

  // 全ユーザーを取得（タイムゾーン設定含む）
  const users: UserRow[] = await db.all<UserRow>('SELECT id FROM users');

  const results: UserRefreshResult[] = [];
  let skippedCount: number = 0;

  for (const user of users) {
    // ユーザーごとのタイムゾーンで日付を判定
    let timezone: string = 'Asia/Tokyo';
    try {
      const row = await db.get<{ timezone: string }>('SELECT timezone FROM user_settings WHERE user_id = ?', user.id);
      if (row?.timezone) {
        timezone = row.timezone;
      }
    } catch { /* ignore */ }
    const today: string = todayStr(timezone);

    const result: RefreshResult | null = await refreshUserTodos(db, user.id, today);

    if (result === null) {
      skippedCount++;
      continue;
    }

    results.push({
      userId: user.id,
      archivedCount: result.archivedCount,
      addedCount: result.addedCount,
    });
  }

  return NextResponse.json({
    ok: true,
    date: todayStr(),
    processedCount: results.length,
    skippedCount,
    results,
  });
}
