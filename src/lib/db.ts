import Database from 'better-sqlite3';
import path from 'path';

/** SQLiteデータベースファイルの保存先パス */
const DB_PATH: string = path.join(process.cwd(), 'data', 'todos.db');

/** DB接続のシングルトンインスタンス。初回呼び出し時に初期化される */
let db: Database.Database | null = null;

/**
 * SQLiteデータベースの接続を取得する（シングルトン）
 * 初回呼び出し時にDBファイルの作成・テーブル作成・マイグレーションを行う
 * @returns better-sqlite3のDatabaseインスタンス
 */
export function getDb(): Database.Database {
  if (db) {
    return db;
  }

  const fs = require('fs');
  const dir: string = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      birthday TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )
  `);

  // 既存DBに users.birthday カラムがない場合に追加
  const userColumns = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  const hasBirthday: boolean = userColumns.some((col) => col.name === 'birthday');
  if (!hasBirthday) {
    db.exec("ALTER TABLE users ADD COLUMN birthday TEXT");
  }
  const hasAvatar: boolean = userColumns.some((col) => col.name === 'avatar');
  if (!hasAvatar) {
    db.exec("ALTER TABLE users ADD COLUMN avatar TEXT");
  }
  const hasRole: boolean = userColumns.some((col) => col.name === 'role');
  if (!hasRole) {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
  }
  const hasLastRefresh: boolean = userColumns.some((col) => col.name === 'last_refresh_date');
  if (!hasLastRefresh) {
    db.exec("ALTER TABLE users ADD COLUMN last_refresh_date TEXT");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS task_set_likes (
      id TEXT PRIMARY KEY,
      set_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      UNIQUE(set_id, user_id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS bug_reports (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      admin_reply TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS todos (
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
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS work_logs (
      id TEXT PRIMARY KEY,
      todo_id TEXT NOT NULL,
      content TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS matrix_positions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '無題',
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS archived_todos (
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
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS diary_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '無題',
      date TEXT NOT NULL,
      content TEXT NOT NULL,
      is_public INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS task_sets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      is_public INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 既存DBに task_sets.is_public カラムがない場合に追加
  {
    const cols = db.prepare("PRAGMA table_info(task_sets)").all() as { name: string }[];
    if (!cols.some((col) => col.name === 'is_public')) {
      db.exec("ALTER TABLE task_sets ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0");
    }
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS task_set_items (
      id TEXT PRIMARY KEY,
      set_id TEXT NOT NULL,
      parent_id TEXT,
      title TEXT NOT NULL,
      est_min INTEGER NOT NULL DEFAULT 30,
      detail TEXT NOT NULL DEFAULT '',
      recurrence TEXT NOT NULL DEFAULT 'carry',
      deadline TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (set_id) REFERENCES task_sets(id) ON DELETE CASCADE
    )
  `);

  // 既存DBに task_set_items の不足カラムを追加
  {
    const cols = db.prepare("PRAGMA table_info(task_set_items)").all() as { name: string }[];
    if (!cols.some((col) => col.name === 'parent_id')) {
      db.exec("ALTER TABLE task_set_items ADD COLUMN parent_id TEXT");
    }
    if (!cols.some((col) => col.name === 'deadline')) {
      db.exec("ALTER TABLE task_set_items ADD COLUMN deadline TEXT");
    }
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS diary_replies (
      id TEXT PRIMARY KEY,
      diary_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      FOREIGN KEY (diary_id) REFERENCES diary_entries(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS diary_likes (
      id TEXT PRIMARY KEY,
      diary_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      FOREIGN KEY (diary_id) REFERENCES diary_entries(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(diary_id, user_id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY,
      dark_mode INTEGER NOT NULL DEFAULT 0,
      font_size INTEGER NOT NULL DEFAULT 16,
      font_family TEXT NOT NULL DEFAULT 'system-ui, sans-serif',
      butler_avatar TEXT NOT NULL DEFAULT '',
      butler_prompt TEXT NOT NULL DEFAULT 'ユーザーを励ませ',
      butler_max_chars INTEGER NOT NULL DEFAULT 80,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 既存DBに detail カラムがない場合に追加
  const todoColumns = db.prepare("PRAGMA table_info(todos)").all() as { name: string }[];
  const hasDetail: boolean = todoColumns.some((col) => col.name === 'detail');
  if (!hasDetail) {
    db.exec("ALTER TABLE todos ADD COLUMN detail TEXT NOT NULL DEFAULT ''");
  }

  // 既存DBに todos.started カラムがない場合に追加
  const hasStarted: boolean = todoColumns.some((col) => col.name === 'started');
  if (!hasStarted) {
    db.exec("ALTER TABLE todos ADD COLUMN started INTEGER NOT NULL DEFAULT 0");
  }

  // 既存DBに todos.parent_id カラムがない場合に追加
  const hasParentId: boolean = todoColumns.some((col) => col.name === 'parent_id');
  if (!hasParentId) {
    db.exec("ALTER TABLE todos ADD COLUMN parent_id TEXT");
  }

  // 既存DBに todos.sort_order カラムがない場合に追加
  const hasSortOrder: boolean = todoColumns.some((col) => col.name === 'sort_order');
  if (!hasSortOrder) {
    db.exec("ALTER TABLE todos ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0");
  }

  // 既存DBに diary_entries.title カラムがない場合に追加
  const diaryColumns = db.prepare("PRAGMA table_info(diary_entries)").all() as { name: string }[];
  const hasDiaryTitle: boolean = diaryColumns.some((col) => col.name === 'title');
  if (!hasDiaryTitle) {
    db.exec("ALTER TABLE diary_entries ADD COLUMN title TEXT NOT NULL DEFAULT '無題'");
  }

  // 既存DBに diary_entries.is_public カラムがない場合に追加
  const hasIsPublic: boolean = diaryColumns.some((col) => col.name === 'is_public');
  if (!hasIsPublic) {
    db.exec("ALTER TABLE diary_entries ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0");
  }

  // 既存DBに user_settings の執事カラムがない場合に追加
  const settingsColumns = db.prepare("PRAGMA table_info(user_settings)").all() as { name: string }[];
  const hasButlerAvatar: boolean = settingsColumns.some((col) => col.name === 'butler_avatar');
  if (!hasButlerAvatar) {
    db.exec("ALTER TABLE user_settings ADD COLUMN butler_avatar TEXT NOT NULL DEFAULT ''");
    db.exec("ALTER TABLE user_settings ADD COLUMN butler_prompt TEXT NOT NULL DEFAULT 'ユーザーを励ませ'");
    db.exec("ALTER TABLE user_settings ADD COLUMN butler_max_chars INTEGER NOT NULL DEFAULT 80");
  }

  return db;
}
