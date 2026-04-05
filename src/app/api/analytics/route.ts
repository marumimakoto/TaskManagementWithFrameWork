import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/**
 * 分析API: 見積もり精度・バーンダウン・週次レビューを一括返却
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId: string | null = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const db = await getDb();

  // ユーザーのタイムゾーン
  let timezone: string = 'Asia/Tokyo';
  try {
    const tzRow = await db.get<{ timezone: string }>('SELECT timezone FROM user_settings WHERE user_id = ?', userId);
    if (tzRow?.timezone) {
      timezone = tzRow.timezone;
    }
  } catch { /* ignore */ }

  const formatter: Intl.DateTimeFormat = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  // --- 見積もり精度 ---
  interface EstRow {
    title: string;
    est_min: number;
    actual_min: number;
  }
  const estRows: EstRow[] = await db.all<EstRow>(
    `SELECT title, est_min, actual_min FROM todos WHERE user_id = ? AND est_min > 0 AND actual_min > 0
     UNION ALL
     SELECT title, est_min, actual_min FROM archived_todos WHERE user_id = ? AND est_min > 0 AND actual_min > 0`,
    userId, userId
  );

  const estimation: { title: string; estMin: number; actualMin: number; ratio: number }[] = estRows.map((r) => ({
    title: r.title,
    estMin: r.est_min,
    actualMin: r.actual_min,
    ratio: r.actual_min / r.est_min,
  }));

  const avgRatio: number = estimation.length > 0
    ? estimation.reduce((sum, e) => sum + e.ratio, 0) / estimation.length
    : 1;

  // 乖離が大きい順にソート
  estimation.sort((a, b) => Math.abs(b.ratio - 1) - Math.abs(a.ratio - 1));

  // --- 週次レビュー（work_logsベース、直近8週） ---
  const weekly: { weekLabel: string; startDate: string; endDate: string; workedMin: number; completedCount: number; logCount: number }[] = [];
  try {
    // 直近8週分の日付範囲を計算
    const now: Date = new Date();
    for (let w = 0; w < 8; w++) {
      const weekEnd: Date = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - w * 7);
      const weekStart: Date = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 6);

      const startStr: string = formatter.format(weekStart);
      const endStr: string = formatter.format(weekEnd);

      // 作業時間（work_logsのcontentから分数を抽出）
      const wlRows = await db.all<{ content: string }>(
        `SELECT w.content FROM work_logs w
         LEFT JOIN todos t ON w.todo_id = t.id
         LEFT JOIN archived_todos a ON w.todo_id = a.id
         WHERE (t.user_id = ? OR a.user_id = ?) AND w.date BETWEEN ? AND ?`,
        userId, userId, startStr, endStr
      );
      let workedMin: number = 0;
      for (const row of wlRows) {
        const match: RegExpMatchArray | null = row.content.match(/\+?(\d+)分/);
        if (match) {
          workedMin += parseInt(match[1], 10);
        }
      }

      // 完了タスク数
      const completedRows = await db.all<{ id: string }>(
        `SELECT id FROM archived_todos WHERE user_id = ? AND done = 1 AND archived_at BETWEEN ? AND ?`,
        userId, new Date(startStr + 'T00:00:00').getTime(), new Date(endStr + 'T23:59:59').getTime()
      );

      const logCount: number = wlRows.length;
      const completedCount: number = completedRows.length;

      if (workedMin > 0 || completedCount > 0 || logCount > 0) {
        weekly.push({
          weekLabel: `第${8 - w}週`,
          startDate: startStr,
          endDate: endStr,
          workedMin,
          completedCount,
          logCount,
        });
      }
    }
    weekly.reverse();
  } catch (e) {
    console.warn('[analytics] weekly failed:', e);
  }

  // --- バーンダウンチャート（日別の残タスク数と累計完了数、直近30日） ---
  const burndown: { date: string; remaining: number; completed: number }[] = [];
  try {
    const now: Date = new Date();
    // 現在のタスク数
    const currentTodoCount = await db.get<{ cnt: number }>('SELECT COUNT(*) as cnt FROM todos WHERE user_id = ?', userId);
    const currentTotal: number = currentTodoCount?.cnt ?? 0;

    // 直近30日分のアーカイブ（完了削除）数を日別に取得
    const thirtyDaysAgo: Date = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const archiveRows = await db.all<{ archived_at: number; done: number }>(
      'SELECT archived_at, done FROM archived_todos WHERE user_id = ? AND archived_at >= ?',
      userId, thirtyDaysAgo.getTime()
    );

    // 日別の完了数を集計
    const dailyCompleted: Map<string, number> = new Map();
    for (const row of archiveRows) {
      if (row.done === 1) {
        const dateStr: string = formatter.format(new Date(row.archived_at));
        dailyCompleted.set(dateStr, (dailyCompleted.get(dateStr) ?? 0) + 1);
      }
    }

    // 今日から30日前まで遡って残タスク数を逆算
    let cumCompleted: number = 0;
    const points: { date: string; remaining: number; completed: number }[] = [];
    for (let d = 30; d >= 0; d--) {
      const day: Date = new Date(now);
      day.setDate(day.getDate() - d);
      const dateStr: string = formatter.format(day);
      const dayCompleted: number = dailyCompleted.get(dateStr) ?? 0;
      cumCompleted += dayCompleted;
      // 残タスク = 現在のタスク数 + これ以降に完了されたタスク数（逆算）
      const futureCompleted: number = [...dailyCompleted.entries()]
        .filter(([dt]) => dt > dateStr)
        .reduce((sum, [, cnt]) => sum + cnt, 0);
      const remaining: number = currentTotal + futureCompleted;
      points.push({ date: dateStr, remaining, completed: cumCompleted });
    }
    burndown.push(...points);
  } catch (e) {
    console.warn('[analytics] burndown failed:', e);
  }

  return NextResponse.json({ estimation, avgRatio, weekly, burndown });
}
