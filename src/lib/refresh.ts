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
  category: string;
  started: number;
  done: number;
  sort_order: number;
  created_at: number;
}

/**
 * 今日の日付をYYYY-MM-DD形式で返す
 */
/**
 * 指定タイムゾーンでの今日の日付をYYYY-MM-DD形式で返す
 * @param timezone - IANAタイムゾーン名（例: 'Asia/Tokyo'）。デフォルトは 'Asia/Tokyo'
 */
export function todayStr(timezone: string = 'Asia/Tokyo'): string {
  const now: Date = new Date();
  const formatter: Intl.DateTimeFormat = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/**
 * 繰り返しルールに基づいて、今日がタスク追加日かどうかを判定する
 * @param recurrence 繰り返し種別文字列
 * @returns true=今日追加すべき
 */
export function shouldAddToday(recurrence: string, timezone: string = 'Asia/Tokyo'): boolean {
  if (recurrence === 'carry') {
    return false;
  }

  // 指定タイムゾーンでの現在日時の各パーツを取得
  const now: Date = new Date();
  const parts: Record<string, string> = {};
  const formatter: Intl.DateTimeFormat = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  });
  for (const part of formatter.formatToParts(now)) {
    parts[part.type] = part.value;
  }
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dayOfWeek: number = weekdayMap[parts.weekday] ?? now.getDay();
  const dayOfMonth: number = parseInt(parts.day, 10);
  const month: number = parseInt(parts.month, 10) - 1; // 0-based
  const year: number = parseInt(parts.year, 10);

  // 'daily' / 'day' いずれも毎日
  if (recurrence === 'daily' || recurrence === 'day') {
    return true;
  }
  // 'weekly' = 毎週月曜（レガシー）、'week:weekday' = 毎週平日、'week:XXX' = 毎週特定曜日
  if (recurrence === 'weekly') {
    return dayOfWeek === 1;
  }
  if (recurrence === 'week:weekday') {
    return dayOfWeek >= 1 && dayOfWeek <= 5;
  }
  if (recurrence.startsWith('week:') && !recurrence.startsWith('week:weekday')) {
    // 'week:mon', 'week:tue' など
    const dayKey: string = recurrence.split(':')[1];
    const dayMap: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    return dayOfWeek === (dayMap[dayKey] ?? -1);
  }
  // 'monthly' / 'month:same-date' = 毎月同じ日
  if (recurrence === 'monthly' || recurrence === 'month:same-date') {
    return dayOfMonth === 1;
  }
  // 'yearly' / 'year' = 毎年1/1
  if (recurrence === 'yearly' || recurrence === 'year') {
    return month === 0 && dayOfMonth === 1;
  }

  // カスタム繰り返し: "custom:N:unit" or "custom:N:unit:options"
  if (recurrence.startsWith('custom:')) {
    const parts: string[] = recurrence.split(':');
    const interval: number = parseInt(parts[1] ?? '1', 10);
    const unit: string = parts[2] ?? 'day';

    if (unit === 'day') {
      // N日ごと: 簡易判定（年初からの日数 % interval）
      const startOfYear: Date = new Date(year, 0, 1);
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
      const startOfYear: Date = new Date(year, 0, 1);
      const weekNum: number = Math.floor((now.getTime() - startOfYear.getTime()) / (7 * 86400000));
      return weekNum % interval === 0;
    }
    if (unit === 'month') {
      // N月ごと
      if (interval > 1 && month % interval !== 0) {
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
      if (month === 0 && dayOfMonth === 1) {
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

  // 1. 繰り返しルールに基づく自動追加（完了タスク削除の前に実行する）
  // 理由: 繰り返しタスクを完了→日次処理の場合、先に新タスクを生成してから完了分を削除する
  interface RuleRow {
    id: string;
    user_id: string;
    title: string;
    est_min: number;
    detail: string;
    recurrence: string;
    category: string;
    deadline_offset_days: number | null;
  }

  const rules: RuleRow[] = await db.all<RuleRow>(
    'SELECT * FROM recurring_rules WHERE user_id = ? AND enabled = 1', userId
  );

  // 既存の未完了タスクのタイトルセット（完了タスクは含めない）
  const existingTitleRows = await db.all<{ title: string }>('SELECT title FROM todos WHERE user_id = ? AND done = 0', userId);
  const existingTitles: Set<string> = new Set(
    existingTitleRows.map((r: { title: string }) => r.title)
  );

  let addedCount: number = 0;

  for (const rule of rules) {
    if (!shouldAddToday(rule.recurrence)) {
      continue;
    }
    // 同名タスクが未完了で存在する場合はタスク生成をスキップ
    // ただし「本来やるべきだった回数」としてgenerated_countは加算する
    if (existingTitles.has(rule.title)) {
      await db.run('UPDATE recurring_rules SET generated_count = generated_count + 1 WHERE id = ?', rule.id);
      continue;
    }
    const newId: string = crypto.randomUUID();
    // 期限: deadline_offset_daysが設定されていれば、今日 + offset日の23:59:59
    let deadline: number | null = null;
    if (rule.deadline_offset_days !== null && rule.deadline_offset_days >= 0) {
      const d: Date = new Date();
      d.setDate(d.getDate() + rule.deadline_offset_days);
      d.setHours(23, 59, 59, 999);
      deadline = d.getTime();
    }
    await db.run(
      'INSERT INTO todos (id, user_id, title, est_min, recurrence, detail, category, deadline, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      newId, userId, rule.title, rule.est_min, rule.recurrence, rule.detail, rule.category ?? '', deadline, now
    );
    existingTitles.add(rule.title);
    addedCount++;
    // 生成カウントをインクリメント
    await db.run('UPDATE recurring_rules SET generated_count = generated_count + 1 WHERE id = ?', rule.id);
  }

  // 2. 完了タスクをアーカイブに移動して削除（繰り返し生成の後に実行）
  const doneTodos: TodoRow[] = await db.all<TodoRow>(
    'SELECT * FROM todos WHERE user_id = ? AND done = 1', userId
  );

  for (const t of doneTodos) {
    await db.run(
      'INSERT OR REPLACE INTO archived_todos (id, user_id, title, est_min, actual_min, detail, category, deadline, done, created_at, archived_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      t.id, t.user_id, t.title, t.est_min, t.actual_min, t.detail, t.category ?? '', t.deadline, t.done, t.created_at, now
    );
    // 繰り返しルールの達成カウントをインクリメント
    if (t.recurrence && t.recurrence !== 'carry') {
      await db.run(
        'UPDATE recurring_rules SET completed_count = completed_count + 1 WHERE user_id = ? AND title = ? AND enabled = 1',
        t.user_id, t.title
      );
    }
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

  // 3. 未完了タスクのlast_worked_atをリセット（毎日未着手に戻す。actualMinは累計なのでリセットしない）
  await db.run('UPDATE todos SET last_worked_at = NULL WHERE user_id = ? AND done = 0', userId);

  // 4. last_refresh_dateを更新
  await db.run('UPDATE users SET last_refresh_date = ? WHERE id = ?', today, userId);

  return {
    archivedCount: doneTodos.length,
    addedCount,
  };
}
