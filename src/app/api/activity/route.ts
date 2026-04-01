import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/**
 * 統一アクティビティエントリ
 * 全種別を同じ形式で返す
 */
interface ActivityEntry {
  id: string;
  type: 'work_log' | 'created' | 'completed' | 'deleted';
  title: string;
  content: string;
  date: string;
  timestamp: number;
}

/**
 * 全種別のアクティビティを統一形式で取得する
 * - 作業ログ（work_logs）
 * - 新規作成（todos.created_at）
 * - 完了（todos.done=1 かつ last_worked_at）
 * - 削除（archived_todos.archived_at）
 *
 * from/to で期間フィルター可能
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId: string | null = request.nextUrl.searchParams.get('userId');
  const from: string | null = request.nextUrl.searchParams.get('from');
  const to: string | null = request.nextUrl.searchParams.get('to');

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const db = await getDb();

  /** ヘルパー: タイムスタンプをYYYY-MM-DD文字列に変換 */
  function tsToDate(ts: number): string {
    const d: Date = new Date(ts);
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /** ヘルパー: 期間フィルター用のタイムスタンプ範囲を取得 */
  function getRange(): { start: number; end: number } | null {
    if (!from && !to) {
      return null;
    }
    const start: number = from ? new Date(from + 'T00:00:00').getTime() : 0;
    const end: number = to ? new Date(to + 'T23:59:59.999').getTime() : Date.now() + 86400000;
    return { start, end };
  }

  const range = getRange();
  const entries: ActivityEntry[] = [];

  // 1. 作業ログ（削除済みタスクの作業ログも含む）
  {
    let query: string = `
      SELECT w.id, w.todo_id, COALESCE(t.title, a.title, '不明なタスク') as title, w.content, w.date, w.created_at
      FROM work_logs w
      LEFT JOIN todos t ON w.todo_id = t.id
      LEFT JOIN archived_todos a ON w.todo_id = a.id
      WHERE (t.user_id = ? OR a.user_id = ?)
    `;
    const queryParams: (string | number)[] = [userId, userId];
    if (from) {
      query += ' AND w.date >= ?';
      queryParams.push(from);
    }
    if (to) {
      query += ' AND w.date <= ?';
      queryParams.push(to);
    }
    const rows = await db.all<{
      id: string; todo_id: string; title: string; content: string; date: string; created_at: number;
    }>(query, ...queryParams);
    for (const row of rows) {
      entries.push({
        id: 'wl-' + row.id,
        type: 'work_log',
        title: row.title,
        content: row.content,
        date: row.date,
        timestamp: row.created_at,
      });
    }
  }

  // 2. 新規作成されたタスク
  {
    let query: string = 'SELECT id, title, created_at FROM todos WHERE user_id = ?';
    const queryParams: (string | number)[] = [userId];
    if (range) {
      query += ' AND created_at BETWEEN ? AND ?';
      queryParams.push(range.start, range.end);
    }
    const rows = await db.all<{
      id: string; title: string; created_at: number;
    }>(query, ...queryParams);
    for (const row of rows) {
      entries.push({
        id: 'cr-' + row.id,
        type: 'created',
        title: row.title,
        content: 'タスクを作成しました',
        date: tsToDate(row.created_at),
        timestamp: row.created_at,
      });
    }
  }

  // 3. 完了したタスク（todosとarchived_todosの両方から取得）
  {
    // 現在のtodosから完了タスク
    let query1: string = 'SELECT id, title, last_worked_at FROM todos WHERE user_id = ? AND done = 1 AND last_worked_at IS NOT NULL';
    const params1: (string | number)[] = [userId];
    if (range) {
      query1 += ' AND last_worked_at BETWEEN ? AND ?';
      params1.push(range.start, range.end);
    }
    const rows1 = await db.all<{ id: string; title: string; last_worked_at: number }>(query1, ...params1);
    for (const row of rows1) {
      entries.push({
        id: 'cp-' + row.id,
        type: 'completed',
        title: row.title,
        content: 'タスクを完了しました',
        date: tsToDate(row.last_worked_at),
        timestamp: row.last_worked_at,
      });
    }
    // アーカイブから完了タスク（削除されても完了記録は残る）
    let query2: string = 'SELECT id, title, archived_at FROM archived_todos WHERE user_id = ? AND done = 1';
    const params2: (string | number)[] = [userId];
    if (range) {
      query2 += ' AND archived_at BETWEEN ? AND ?';
      params2.push(range.start, range.end);
    }
    const rows2 = await db.all<{ id: string; title: string; archived_at: number }>(query2, ...params2);
    const existingIds: Set<string> = new Set(rows1.map((r) => r.id));
    for (const row of rows2) {
      if (!existingIds.has(row.id)) {
        entries.push({
          id: 'cp-arch-' + row.id,
          type: 'completed',
          title: row.title,
          content: 'タスクを完了しました',
          date: tsToDate(row.archived_at),
          timestamp: row.archived_at,
        });
      }
    }
  }

  // 4. 削除されたタスク
  {
    let query: string = 'SELECT id, title, archived_at FROM archived_todos WHERE user_id = ?';
    const queryParams: (string | number)[] = [userId];
    if (range) {
      query += ' AND archived_at BETWEEN ? AND ?';
      queryParams.push(range.start, range.end);
    }
    const rows = await db.all<{
      id: string; title: string; archived_at: number;
    }>(query, ...queryParams);
    for (const row of rows) {
      entries.push({
        id: 'dl-' + row.id,
        type: 'deleted',
        title: row.title,
        content: 'タスクを削除しました',
        date: tsToDate(row.archived_at),
        timestamp: row.archived_at,
      });
    }
  }

  // 日付降順 → 同日内はタイムスタンプ降順でソート
  entries.sort((a: ActivityEntry, b: ActivityEntry): number => {
    if (a.date !== b.date) {
      return b.date.localeCompare(a.date);
    }
    return b.timestamp - a.timestamp;
  });

  // 日別統計を集計
  const statsMap: Map<string, { workLogs: number; created: number; completed: number; deleted: number; workedMin: number }> = new Map();

  for (const entry of entries) {
    let stat = statsMap.get(entry.date);
    if (!stat) {
      stat = { workLogs: 0, created: 0, completed: 0, deleted: 0, workedMin: 0 };
      statsMap.set(entry.date, stat);
    }
    if (entry.type === 'work_log') {
      stat.workLogs++;
    } else if (entry.type === 'created') {
      stat.created++;
    } else if (entry.type === 'completed') {
      stat.completed++;
    } else if (entry.type === 'deleted') {
      stat.deleted++;
    }
  }

  // 日別の作業時間合計
  // todosとarchived_todosの両方から、last_worked_atの日ごとにactual_minを集計
  {
    const allTasks: { last_worked_at: number; actual_min: number }[] = [];
    // 現在のタスク
    let q1: string = 'SELECT last_worked_at, actual_min FROM todos WHERE user_id = ? AND last_worked_at IS NOT NULL AND actual_min > 0';
    const p1: (string | number)[] = [userId];
    if (range) {
      q1 += ' AND last_worked_at BETWEEN ? AND ?';
      p1.push(range.start, range.end);
    }
    const rows1 = await db.all<{ last_worked_at: number; actual_min: number }>(q1, ...p1);
    allTasks.push(...rows1);
    // アーカイブ
    let q2: string = 'SELECT archived_at as last_worked_at, actual_min FROM archived_todos WHERE user_id = ? AND actual_min > 0';
    const p2: (string | number)[] = [userId];
    if (range) {
      q2 += ' AND archived_at BETWEEN ? AND ?';
      p2.push(range.start, range.end);
    }
    const rows2 = await db.all<{ last_worked_at: number; actual_min: number }>(q2, ...p2);
    allTasks.push(...rows2);

    for (const row of allTasks) {
      const d: string = tsToDate(row.last_worked_at);
      let stat = statsMap.get(d);
      if (!stat) {
        stat = { workLogs: 0, created: 0, completed: 0, deleted: 0, workedMin: 0 };
        statsMap.set(d, stat);
      }
      stat.workedMin += row.actual_min;
    }
  }

  // MapをソートされたArray化
  const dailyStats: { date: string; workLogs: number; created: number; completed: number; deleted: number; workedMin: number }[] = [];
  const sortedDates: string[] = [...statsMap.keys()].sort((a, b) => b.localeCompare(a));
  for (const d of sortedDates) {
    const stat = statsMap.get(d)!;
    dailyStats.push({ date: d, ...stat });
  }

  // パレート分析用: タスクごとの実績時間集計
  const paretoQuery: string = range
    ? 'SELECT id, title, actual_min FROM todos WHERE user_id = ? AND actual_min > 0 AND last_worked_at BETWEEN ? AND ?'
    : 'SELECT id, title, actual_min FROM todos WHERE user_id = ? AND actual_min > 0';
  const paretoParams: (string | number)[] = [userId];
  if (range) {
    paretoParams.push(range.start, range.end);
  }
  // アーカイブも含める
  const paretoQueryArchived: string = range
    ? 'SELECT id, title, actual_min FROM archived_todos WHERE user_id = ? AND actual_min > 0 AND archived_at BETWEEN ? AND ?'
    : 'SELECT id, title, actual_min FROM archived_todos WHERE user_id = ? AND actual_min > 0';

  const activeTasks = await db.all<{ id: string; title: string; actual_min: number }>(paretoQuery, ...paretoParams);
  const archivedTasks = await db.all<{ id: string; title: string; actual_min: number }>(paretoQueryArchived, ...paretoParams);

  // タイトルで集約（同名タスクの実績を合算）
  const paretoMap: Map<string, number> = new Map();
  for (const t of [...activeTasks, ...archivedTasks]) {
    paretoMap.set(t.title, (paretoMap.get(t.title) ?? 0) + t.actual_min);
  }
  const paretoData: { title: string; actualMin: number }[] = [...paretoMap.entries()]
    .map(([title, actualMin]) => ({ title, actualMin }))
    .sort((a, b) => b.actualMin - a.actualMin);

  return NextResponse.json({ entries, dailyStats, paretoData });
}
