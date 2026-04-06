/**
 * 繰り返し設定の共通定数・ユーティリティ
 * RecurrenceSelector と shouldAddToday の両方で使用し、値の不一致を防ぐ
 */

/** 繰り返しなし */
export const REC_CARRY: string = 'carry';

/** 毎日 */
export const REC_DAILY: string = 'day';

/** 毎週平日（月〜金） */
export const REC_WEEKDAY: string = 'week:weekday';

/** 毎月同じ日 */
export const REC_MONTHLY: string = 'month:same-date';

/** 毎年同じ日 */
export const REC_YEARLY: string = 'year';

/** 毎週特定曜日のプレフィックス（'week:mon' 等） */
export const REC_WEEK_PREFIX: string = 'week:';

/** カスタムのプレフィックス（'custom:1:week:mon,wed,fri' 等） */
export const REC_CUSTOM_PREFIX: string = 'custom:';

/** 曜日キー */
export const DAY_KEYS: string[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export const DAY_NAMES: string[] = ['日', '月', '火', '水', '木', '金', '土'];

/** 曜日キーから曜日番号（0=日）へのマップ */
export const DAY_KEY_TO_NUMBER: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

/**
 * recurrence文字列が「繰り返しあり」かどうかを判定する
 */
export function isRecurring(recurrence: string): boolean {
  return recurrence !== REC_CARRY && recurrence !== '';
}

/**
 * recurrence文字列が毎週特定曜日かどうかを判定し、曜日キーを返す
 * 'week:mon' → 'mon', 'week:weekday' → null, 'day' → null
 */
export function getWeekDayKey(recurrence: string): string | null {
  if (recurrence.startsWith(REC_WEEK_PREFIX) && recurrence !== REC_WEEKDAY) {
    return recurrence.slice(REC_WEEK_PREFIX.length);
  }
  return null;
}
