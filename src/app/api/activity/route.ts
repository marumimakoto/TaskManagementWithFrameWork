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
  category: string;
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

  // ユーザーのタイムゾーン設定を取得
  let userTimezone: string = 'Asia/Tokyo';
  try {
    const tzRow = await db.get<{ timezone: string }>('SELECT timezone FROM user_settings WHERE user_id = ?', userId);
    if (tzRow?.timezone) {
      userTimezone = tzRow.timezone;
    }
  } catch { /* ignore */ }

  /** ヘルパー: タイムスタンプをYYYY-MM-DD文字列に変換（ユーザーのタイムゾーン） */
  function tsToDate(ts: number): string {
    const d: Date = new Date(ts);
    const formatter: Intl.DateTimeFormat = new Intl.DateTimeFormat('en-CA', {
      timeZone: userTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(d);
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

  // カテゴリ情報を事前に取得（todos + archived_todos、全セクションで共有）
  const catMap: Map<string, string> = new Map();
  try {
    const catRows = await db.all<{ id: string; category: string }>('SELECT id, category FROM todos WHERE user_id = ?', userId);
    for (const r of catRows) {
      catMap.set(r.id, r.category || '');
    }
  } catch { /* category column may not exist */ }
  try {
    const archCatRows = await db.all<{ id: string; category: string }>('SELECT id, category FROM archived_todos WHERE user_id = ?', userId);
    for (const r of archCatRows) {
      if (!catMap.has(r.id)) {
        catMap.set(r.id, r.category || '');
      }
    }
  } catch { /* ignore */ }

  // 1. 作業ログ（削除済みタスクの作業ログも含む）
  try {
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
        category: catMap.get(row.todo_id) || '未分類',
      });
    }
  } catch (e) {
    console.warn('[activity] work_logs query failed:', e);
  }

  // 2. 新規作成されたタスク
  try {
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
        category: catMap.get(row.id) || '未分類',
      });
    }
  } catch (e) {
    console.warn('[activity] created query failed:', e);
  }

  // 3. 完了したタスク（todosとarchived_todosの両方から取得）
  try {
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
        category: catMap.get(row.id) || '未分類',
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
          category: catMap.get(row.id) || '未分類',
        });
      }
    }
  } catch (e) {
    console.warn('[activity] completed query failed:', e);
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
        category: catMap.get(row.id) || '未分類',
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

  // 日別の作業時間 + カテゴリ内訳（work_logsベース — 1回のクエリで両方集計）
  const dailyCategoryStats: { date: string; total: number; byCategory: Record<string, number> }[] = [];
  {
    let wlQuery: string = `
      SELECT w.date, w.content, w.todo_id
      FROM work_logs w
      LEFT JOIN todos t ON w.todo_id = t.id
      LEFT JOIN archived_todos a ON w.todo_id = a.id
      WHERE (t.user_id = ? OR a.user_id = ?)
    `;
    const wlParams: (string | number)[] = [userId, userId];
    if (from) {
      wlQuery += ' AND w.date >= ?';
      wlParams.push(from);
    }
    if (to) {
      wlQuery += ' AND w.date <= ?';
      wlParams.push(to);
    }
    const wlRows = await db.all<{ date: string; content: string; todo_id: string }>(wlQuery, ...wlParams);

    const dcMap: Map<string, { total: number; byCategory: Record<string, number> }> = new Map();
    for (const row of wlRows) {
      const minMatch: RegExpMatchArray | null = row.content.match(/\+?(\d+)分/);
      const minutes: number = minMatch ? parseInt(minMatch[1], 10) : 0;
      if (minutes <= 0) {
        continue;
      }
      // dailyStats の workedMin に加算
      let stat = statsMap.get(row.date);
      if (!stat) {
        stat = { workLogs: 0, created: 0, completed: 0, deleted: 0, workedMin: 0 };
        statsMap.set(row.date, stat);
      }
      stat.workedMin += minutes;

      // カテゴリ内訳
      const cat: string = catMap.get(row.todo_id) || '未分類';
      let dcEntry = dcMap.get(row.date);
      if (!dcEntry) {
        dcEntry = { total: 0, byCategory: {} };
        dcMap.set(row.date, dcEntry);
      }
      dcEntry.total += minutes;
      dcEntry.byCategory[cat] = (dcEntry.byCategory[cat] ?? 0) + minutes;
    }
    const dcSorted: string[] = [...dcMap.keys()].sort();
    for (const d of dcSorted) {
      dailyCategoryStats.push({ date: d, ...dcMap.get(d)! });
    }
  }

  // MapをソートされたArray化
  const dailyStats: { date: string; workLogs: number; created: number; completed: number; deleted: number; workedMin: number }[] = [];
  const sortedDates: string[] = [...statsMap.keys()].sort((a, b) => b.localeCompare(a));
  for (const d of sortedDates) {
    const stat = statsMap.get(d)!;
    dailyStats.push({ date: d, ...stat });
  }

  // パレート分析用: タスクごとの実績時間集計（todosとアーカイブをUNIONで1クエリ）
  const paretoAllQuery: string = range
    ? `SELECT title, actual_min FROM todos WHERE user_id = ? AND actual_min > 0 AND last_worked_at BETWEEN ? AND ?
       UNION ALL
       SELECT title, actual_min FROM archived_todos WHERE user_id = ? AND actual_min > 0 AND archived_at BETWEEN ? AND ?`
    : `SELECT title, actual_min FROM todos WHERE user_id = ? AND actual_min > 0
       UNION ALL
       SELECT title, actual_min FROM archived_todos WHERE user_id = ? AND actual_min > 0`;
  const paretoParams: (string | number)[] = range
    ? [userId, range.start, range.end, userId, range.start, range.end]
    : [userId, userId];
  const paretoRows = await db.all<{ title: string; actual_min: number }>(paretoAllQuery, ...paretoParams);

  const paretoMap: Map<string, number> = new Map();
  for (const t of paretoRows) {
    paretoMap.set(t.title, (paretoMap.get(t.title) ?? 0) + t.actual_min);
  }
  const paretoData: { title: string; actualMin: number }[] = [...paretoMap.entries()]
    .map(([title, actualMin]) => ({ title, actualMin }))
    .sort((a, b) => b.actualMin - a.actualMin);

  // カテゴリ別実績（棒グラフ用）: catMapからカテゴリごとのactualMin合計を集計
  const categorySummary: { category: string; totalMin: number }[] = [];
  try {
    const catTotalMap: Map<string, number> = new Map();
    const allTasksForCat = await db.all<{ category: string; actual_min: number }>(
      `SELECT category, actual_min FROM todos WHERE user_id = ? AND actual_min > 0
       UNION ALL
       SELECT category, actual_min FROM archived_todos WHERE user_id = ? AND actual_min > 0`,
      userId, userId
    );
    for (const t of allTasksForCat) {
      const cat: string = t.category || '未分類';
      catTotalMap.set(cat, (catTotalMap.get(cat) ?? 0) + t.actual_min);
    }
    for (const [category, totalMin] of catTotalMap) {
      categorySummary.push({ category, totalMin });
    }
    categorySummary.sort((a, b) => b.totalMin - a.totalMin);
  } catch { /* ignore */ }

  // ユーザー定義カテゴリ一覧
  let userCategories: string[] = [];
  try {
    const catRows = await db.all<{ name: string }>('SELECT name FROM todo_categories WHERE user_id = ? ORDER BY sort_order ASC', userId);
    userCategories = catRows.map((r) => r.name);
  } catch { /* ignore */ }

  return NextResponse.json({ entries, dailyStats, paretoData, dailyCategoryStats, categorySummary, userCategories });
}
