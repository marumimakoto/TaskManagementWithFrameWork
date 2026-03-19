/**
 * モック日記データをDBに投入するシードスクリプト
 * 使い方: npx tsx src/test/seed-diary.ts <userId> [count]
 *   userId: 投入先のユーザーID
 *   count:  生成件数（デフォルト30）
 */

import { getDb } from '../lib/db';
import { generateMockDiaryEntries } from './mock-diary-entries';

const userId: string = process.argv[2] ?? '';
const count: number = parseInt(process.argv[3] ?? '30', 10);

if (!userId) {
  console.error('使い方: npx tsx src/test/seed-diary.ts <userId> [count]');
  console.error('  userId: DBに登録済みのユーザーID');
  console.error('  count:  生成件数（デフォルト30）');
  process.exit(1);
}

const db = getDb();
const entries = generateMockDiaryEntries(count, userId);

// 既存の日記を削除するか確認
const existingCount = (db.prepare(
  'SELECT COUNT(*) as c FROM diary_entries WHERE user_id = ?'
).get(userId) as { c: number }).c;

if (existingCount > 0) {
  console.log(`既存の日記 ${existingCount} 件を削除します...`);
  db.prepare('DELETE FROM diary_entries WHERE user_id = ?').run(userId);
}

// 投入
const insert = db.prepare(
  'INSERT INTO diary_entries (id, user_id, title, date, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
);

const insertAll = db.transaction(() => {
  for (const e of entries) {
    insert.run(e.id, userId, e.title, e.date, e.content, e.createdAt, e.updatedAt);
  }
});

insertAll();
console.log(`${entries.length} 件のモック日記を投入しました（userId: ${userId}）`);
