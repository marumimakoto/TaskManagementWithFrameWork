import { getDb, Db } from '@/lib/db';
import crypto from 'crypto';

interface TodoRow {
  id: string;
  user_id: string;
  parent_id: string | null;
  title: string;
  est_min: number;
  actual_min: number;
  stuck_hours: number;
  last_worked_at: number | null;
  deadline: number | null;
  recurrence: string;
  detail: string;
  started: number;
  done: number;
  sort_order: number;
  created_at: number;
}

/**
 * 今日の日付をYYYY-MM-DD形式で返す
 */
export function todayStr(): string {
  const now: Date = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * 繰り返しルールに基づいて、今日がタスク追加日かどうかを判定する
 * @param recurrence 繰り返し種別文字列
 * @returns true=今日追加すべき
 */
export function shouldAddToday(recurrence: string): boolean {
  if (recurrence === 'carry') {
    return false;
  }

  const now: Date = new Date();
  const dayOfWeek: number = now.getDay(); // 0=日, 1=月, ...
  const dayOfMonth: number = now.getDate();

  if (recurrence === 'daily') {
    return true;
  }
  if (recurrence === 'weekly') {
    // 毎週月曜日（デフォルト）
    return dayOfWeek === 1;
  }
  if (recurrence === 'monthly') {
    // 毎月1日（デフォルト）
    return dayOfMonth === 1;
  }
  if (recurrence === 'yearly') {
    // 毎年1/1（デフォルト）
    return now.getMonth() === 0 && dayOfMonth === 1;
  }

  // カスタム繰り返し: "custom:N:unit" or "custom:N:unit:options"
  if (recurrence.startsWith('custom:')) {
    const parts: string[] = recurrence.split(':');
    const interval: number = parseInt(parts[1] ?? '1', 10);
    const unit: string = parts[2] ?? 'day';

    if (unit === 'day') {
      // N日ごと: 簡易判定（年初からの日数 % interval）
      const startOfYear: Date = new Date(now.getFullYear(), 0, 1);
      const dayOfYear: number = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000);
      return dayOfYear % interval === 0;
    }
    if (unit === 'week') {
      // N週ごとの指定曜日
      const weekDays: string = parts[3] ?? 'mon';
      const dayNames: string[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const todayName: string = dayNames[dayOfWeek];
      const selectedDays: string[] = weekDays.split(',');
      if (!selectedDays.includes(todayName)) {
        return false;
      }
      if (interval <= 1) {
        return true;
      }
      // N週ごと: 年初からの週数 % interval
      const startOfYear: Date = new Date(now.getFullYear(), 0, 1);
      const weekNum: number = Math.floor((now.getTime() - startOfYear.getTime()) / (7 * 86400000));
      return weekNum % interval === 0;
    }
    if (unit === 'month') {
      // N月ごと
      if (interval > 1 && now.getMonth() % interval !== 0) {
        return false;
      }
      const monthMode: string = parts[3] ?? 'date';
      if (monthMode === 'date') {
        const targetDay: number = parseInt(parts[4] ?? '1', 10);
        return dayOfMonth === targetDay;
      }
      if (monthMode === 'weekday') {
        // 第N X曜日
        const nth: number = parseInt(parts[4] ?? '1', 10);
        const targetDayName: string = parts[5] ?? 'mon';
        const dayNames: string[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const targetDayIndex: number = dayNames.indexOf(targetDayName);
        if (dayOfWeek !== targetDayIndex) {
          return false;
        }
        const weekOfMonth: number = Math.ceil(dayOfMonth / 7);
        return weekOfMonth === nth;
      }
    }
    if (unit === 'year') {
      if (now.getMonth() === 0 && dayOfMonth === 1) {
        return true;
      }
    }
  }

  return false;
}

export interface RefreshResult {
  archivedCount: number;
  addedCount: number;
}

/**
 * 指定ユーザーの日次リフレッシュ処理を実行する
 * 1. 完了タスクをアーカイブに移動して削除
 * 2. 繰り返し設定のあるタスクで今日が該当日なら新規追加（同名未完了が無い場合のみ）
 * 3. ユーザーのlast_refresh_dateを今日に更新
 *
 * @param db DBインスタンス
 * @param userId ユーザーID
 * @param today 今日の日付文字列（YYYY-MM-DD）
 * @returns リフレッシュ結果。既にリフレッシュ済みの場合はnull
 */
export async function refreshUserTodos(db: Db, userId: string, today: string): Promise<RefreshResult | null> {
  // 今日既にリフレッシュ済みかチェック
  const user = await db.get<{ last_refresh_date: string | null }>('SELECT last_refresh_date FROM users WHERE id = ?', userId);
  if (user?.last_refresh_date === today) {
    return null;
  }

  const now: number = Date.now();

  // 1. 完了タスクをアーカイブに移動して削除
  const doneTodos: TodoRow[] = await db.all<TodoRow>(
    'SELECT * FROM todos WHERE user_id = ? AND done = 1', userId
  );

  for (const t of doneTodos) {
    await db.run(
      'INSERT OR REPLACE INTO archived_todos (id, user_id, title, est_min, actual_min, detail, deadline, done, created_at, archived_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      t.id, t.user_id, t.title, t.est_min, t.actual_min, t.detail, t.deadline, t.done, t.created_at, now
    );
    await db.run('DELETE FROM todos WHERE id = ?', t.id);
  }

  // アーカイブを100件に制限
  await db.run(`
    DELETE FROM archived_todos WHERE id IN (
      SELECT id FROM archived_todos WHERE user_id = ?
      ORDER BY archived_at DESC
      LIMIT -1 OFFSET 100
    )
  `, userId);

  // 2. 繰り返しタスクの自動追加
  const recurringTodos: TodoRow[] = await db.all<TodoRow>(
    "SELECT * FROM todos WHERE user_id = ? AND recurrence != 'carry' AND recurrence != ''", userId
  );

  // 既存の未完了タスクのタイトルセット
  const existingTitleRows = await db.all<{ title: string }>('SELECT title FROM todos WHERE user_id = ? AND done = 0', userId);
  const existingTitles: Set<string> = new Set(
    existingTitleRows.map((r: { title: string }) => r.title)
  );

  let addedCount: number = 0;

  for (const t of recurringTodos) {
    if (!shouldAddToday(t.recurrence)) {
      continue;
    }
    // 同名タスクが未完了で存在する場合はスキップ
    if (existingTitles.has(t.title)) {
      continue;
    }
    const newId: string = crypto.randomUUID();
    await db.run(
      'INSERT INTO todos (id, user_id, title, est_min, recurrence, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      newId, userId, t.title, t.est_min, t.recurrence, t.detail, now
    );
    existingTitles.add(t.title);
    addedCount++;
  }

  // 3. last_refresh_dateを更新
  await db.run('UPDATE users SET last_refresh_date = ? WHERE id = ?', today, userId);

  return {
    archivedCount: doneTodos.length,
    addedCount,
  };
}
