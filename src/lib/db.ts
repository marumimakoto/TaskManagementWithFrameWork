import { createClient, type Client, type ResultSet } from '@libsql/client';

/**
 * libsql クライアントのシングルトンインスタンス
 */
let client: Client | null = null;

/**
 * Turso (libsql) クライアントを取得する（シングルトン）
 * 環境変数が未設定ならローカルファイルDBにフォールバック
 */
function getClient(): Client {
  if (client) {
    return client;
  }
  client = createClient({
    url: process.env.TURSO_DATABASE_URL ?? 'file:./data/todos.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  return client;
}

/**
 * 非同期DBラッパー
 * 全APIルートからこのクラスを使ってDBを操作する
 */
export class Db {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  /** SELECT文を実行して全行を返す */
  async all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T[]> {
    const rs: ResultSet = await this.client.execute({ sql, args: params as never[] });
    return rs.rows.map((row) => {
      const obj: Record<string, unknown> = {};
      rs.columns.forEach((col: string, i: number) => {
        obj[col] = row[i];
      });
      return obj as T;
    });
  }

  /** SELECT文を実行して最初の1行を返す */
  async get<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T | undefined> {
    const rows: T[] = await this.all<T>(sql, ...params);
    return rows[0];
  }

  /** INSERT/UPDATE/DELETE文を実行する */
  async run(sql: string, ...params: unknown[]): Promise<{ changes: number }> {
    const rs: ResultSet = await this.client.execute({ sql, args: params as never[] });
    return { changes: rs.rowsAffected };
  }

  /** 複数のSQL文をまとめて実行する */
  async exec(sql: string): Promise<void> {
    const statements: string[] = sql.split(';').map((s) => s.trim()).filter((s) => s.length > 0);
    for (const stmt of statements) {
      await this.client.execute(stmt);
    }
  }
}

/** テーブル初期化済みフラグ */
let initialized: boolean = false;

/**
 * DB接続を取得する（非同期）
 * 初回呼び出し時にテーブル作成を行う
 */
export async function getDb(): Promise<Db> {
  const c: Client = getClient();

  if (!initialized) {
    await initializeTables(c);
    initialized = true;
  }

  return new Db(c);
}

/**
 * テーブル初期化
 */
async function initializeTables(c: Client): Promise<void> {
  const tables: string[] = [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      birthday TEXT,
      avatar TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      last_refresh_date TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`,
    `CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      parent_id TEXT,
      title TEXT NOT NULL,
      est_min INTEGER NOT NULL DEFAULT 30,
      actual_min INTEGER NOT NULL DEFAULT 0,
      stuck_hours REAL NOT NULL DEFAULT 0,
      last_worked_at INTEGER,
      deadline INTEGER,
      recurrence TEXT NOT NULL DEFAULT 'carry',
      detail TEXT NOT NULL DEFAULT '',
      started INTEGER NOT NULL DEFAULT 0,
      done INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`,
    `CREATE TABLE IF NOT EXISTS work_logs (
      id TEXT PRIMARY KEY,
      todo_id TEXT NOT NULL,
      content TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`,
    `CREATE TABLE IF NOT EXISTS archived_todos (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      est_min INTEGER NOT NULL DEFAULT 30,
      actual_min INTEGER NOT NULL DEFAULT 0,
      detail TEXT NOT NULL DEFAULT '',
      deadline INTEGER,
      done INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      archived_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`,
    `CREATE TABLE IF NOT EXISTS diary_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '無題',
      date TEXT NOT NULL,
      content TEXT NOT NULL,
      is_public INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`,
    `CREATE TABLE IF NOT EXISTS diary_replies (
      id TEXT PRIMARY KEY,
      diary_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`,
    `CREATE TABLE IF NOT EXISTS diary_likes (
      id TEXT PRIMARY KEY,
      diary_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      UNIQUE(diary_id, user_id)
    )`,
    `CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`,
    `CREATE TABLE IF NOT EXISTS task_sets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      is_public INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`,
    `CREATE TABLE IF NOT EXISTS task_set_items (
      id TEXT PRIMARY KEY,
      set_id TEXT NOT NULL,
      parent_id TEXT,
      title TEXT NOT NULL,
      est_min INTEGER NOT NULL DEFAULT 30,
      detail TEXT NOT NULL DEFAULT '',
      recurrence TEXT NOT NULL DEFAULT 'carry',
      deadline TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS task_set_likes (
      id TEXT PRIMARY KEY,
      set_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      UNIQUE(set_id, user_id)
    )`,
    `CREATE TABLE IF NOT EXISTS matrix_positions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '無題',
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`,
    `CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY,
      dark_mode INTEGER NOT NULL DEFAULT 0,
      font_size INTEGER NOT NULL DEFAULT 16,
      font_family TEXT NOT NULL DEFAULT 'system-ui, sans-serif',
      butler_avatar TEXT NOT NULL DEFAULT '',
      butler_prompt TEXT NOT NULL DEFAULT 'ユーザーを励ませ',
      butler_max_chars INTEGER NOT NULL DEFAULT 80
    )`,
    `CREATE TABLE IF NOT EXISTS bug_reports (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      admin_reply TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`,
    `CREATE TABLE IF NOT EXISTS user_purchases (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      stripe_session_id TEXT,
      purchased_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`,
    `CREATE TABLE IF NOT EXISTS recurring_rules (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      est_min INTEGER NOT NULL DEFAULT 30,
      detail TEXT NOT NULL DEFAULT '',
      recurrence TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`,
    `CREATE TABLE IF NOT EXISTS bucket_categories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`,
    `CREATE TABLE IF NOT EXISTS bucket_shares (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      share_token TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`,
    `CREATE TABLE IF NOT EXISTS bucket_list (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '私生活',
      deadline_year INTEGER,
      done INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`,
  ];

  for (const sql of tables) {
    await c.execute(sql);
  }
}
