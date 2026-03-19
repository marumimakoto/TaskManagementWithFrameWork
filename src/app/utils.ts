import type { AppUser, ChecklistResult, Todo } from './types';

/** ログインセッションをlocalStorageに保存するときのキー名 */
export const SESSION_KEY: string = 'daily-todo-risk:session';

/**
 * localStorageからログイン済みユーザー情報を復元する
 * @returns 保存されていればユーザー情報、なければnull
 */
export function loadSession(): AppUser | null {
  try {
    const raw: string | null = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as AppUser;
  } catch {
    return null;
  }
}

/**
 * ログインしたユーザー情報をlocalStorageに保存する
 * @param user - 保存するユーザー情報（パスワードを含まない）
 */
export function saveSession(user: AppUser): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

/** localStorageからログインセッションを削除する（ログアウト用） */
export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

/** デバッグログの有効/無効フラグ */
const DEBUG: boolean = true;

/**
 * デバッグ用ログを出力する。DEBUG=falseなら何も出力しない
 * @param scope - ログのスコープ名（例: 'addTodo:ok'）
 * @param data - ログに付与する追加データ
 */
export function log(scope: string, data?: unknown): void {
  if (!DEBUG) {
    return;
  }
  if (data !== undefined) {
    console.debug(`[todo-mock:${scope}]`, data);
  } else {
    console.debug(`[todo-mock:${scope}]`);
  }
}

/**
 * ランダムな一意IDを生成する
 * @returns ランダム文字列 + タイムスタンプの組み合わせ
 */
export function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * 分数を「○時間○分」形式の日本語テキストに変換する
 * @param min - 変換する分数
 * @returns 例: 90 → '1時間30分'、25 → '25分'
 */
export function minutesToText(min: number): string {
  const h: number = Math.floor(min / 60);
  const m: number = min % 60;
  if (h <= 0) {
    return `${m}分`;
  }
  return `${h}時間${m}分`;
}

/**
 * 締切入力: "YYYY-MM-DD"
 * ローカル日付として解釈し「その日の終わり(23:59:59)」を返す
 */
export function parseDeadline(text: string): number | undefined {
  const s: string = text.trim();
  if (!s) {
    return undefined;
  }

  const m: RegExpMatchArray | null = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    return undefined;
  }

  const [, yy, mm, dd]: string[] = m;
  const d: Date = new Date(Number(yy), Number(mm) - 1, Number(dd), 23, 59, 59, 999);
  if (Number.isNaN(+d)) {
    return undefined;
  }
  return d.getTime();
}

/**
 * ミリ秒タイムスタンプをHTMLのdate input用 'YYYY-MM-DD' 文字列に変換する
 * @param ts - ミリ秒タイムスタンプ
 * @returns 'YYYY-MM-DD' 形式の文字列
 */
export function toInputDeadline(ts: number): string {
  const d: Date = new Date(ts);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 締切のタイムスタンプを画面表示用の 'MM/DD' 文字列に変換する
 * @param ts - ミリ秒タイムスタンプ。未指定なら「今日中」を返す
 * @returns 表示用の締切文字列
 */
export function formatDeadline(ts?: number): string {
  if (!ts) {
    return '今日中';
  }
  const d :Date= new Date(ts);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

/** 期限までの残り時間（分）。締切なしは「今日中」扱い */
export function minutesUntil(deadline?: number): number {
  const now: number = Date.now();
  const end: number =
    deadline === undefined || deadline === null
      ? new Date().setHours(23, 59, 59, 999)
      : deadline;
  return Math.max(0, Math.floor((end - now) / 60000));
}

/** N日前のタイムスタンプを返す */
export function nowMinusDays(days: number): number {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

/**
 * リスク判定（中心ロジック）
 * - 「期限OK」: 残作業が残り時間に収まるか
 * - 「未着手」: lastWorkedAt ベース（未設定は大昔扱い）
 */
export function checklist(t: Todo): ChecklistResult {
  const remainingWork: number = Math.max(0, t.estMin - t.actualMin);
  const restMin: number = minutesUntil(t.deadline);

  const okDeadline: boolean = remainingWork <= restMin;
  const okStuck: boolean = t.stuckHours < 3;

  const last: number = t.lastWorkedAt ?? nowMinusDays(9999);
  const daysIdle: number = Math.floor((Date.now() - last) / (1000 * 60 * 60 * 24));
  const okNotIdle: boolean = daysIdle < 2;

  return { okDeadline, okStuck, okNotIdle, remainingWork, restMin, daysIdle };
}

/**
 * リスクランク（ソート用）
 * 0: いずれかNG / 1: 全OK・未完了 / 2: done（チェックボックスで明示的に完了）
 */
export function riskRank(t: Todo): number {
  if (t.done) {
    return 2;
  }
  const c = checklist(t);
  const okAll = c.okDeadline && c.okStuck && c.okNotIdle;
  if (!okAll) {
    return 0;
  }
  return 1;
}

/**
 * カード背景のCSSクラス名を返す
 * - 完了 → cardDone（緑）
 * - 未着手のまま3日経過 or 期限が今日以前 → cardDanger（赤）
 * - それ以外 → cardInProgress（青）
 */
export function cardBgClass(t: Todo): 'cardDone' | 'cardDanger' | 'cardInProgress' {
  if (t.done) {
    return 'cardDone';
  }

  const now: number = Date.now();
  const DAY_MS: number = 24 * 60 * 60 * 1000;

  // 未着手のまま作成から3日経過
  if (!t.started && t.createdAt) {
    const daysSinceCreated: number = (now - t.createdAt) / DAY_MS;
    if (daysSinceCreated >= 3) {
      return 'cardDanger';
    }
  }

  // 期限が今日以前
  if (t.deadline) {
    const todayEnd: number = new Date().setHours(23, 59, 59, 999);
    if (t.deadline <= todayEnd) {
      return 'cardDanger';
    }
  }

  const c: ChecklistResult = checklist(t);
  const okAll: boolean = c.okDeadline && c.okStuck && c.okNotIdle;
  if (!okAll) {
    return 'cardDanger';
  }
  return 'cardInProgress';
}

/**
 * タイムスタンプを「YYYY/MM/DD HH:MM」形式の文字列に変換する
 * @param ts - ミリ秒タイムスタンプ
 * @returns 表示用の日時文字列
 */
export function formatDateTime(ts: number): string {
  const d: Date = new Date(ts);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * タイムスタンプを「YYYY/MM/DD」形式の文字列に変換する
 * @param ts - ミリ秒タイムスタンプ
 * @returns 表示用の日付文字列
 */
export function formatDateShort(ts: number): string {
  const d: Date = new Date(ts);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

/**
 * 今日の日付をYYYY-MM-DD形式で返す
 * @returns 今日の日付文字列
 */
export function todayString(): string {
  const now: Date = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

