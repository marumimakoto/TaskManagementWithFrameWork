/**
 * テスト用アカウントをDBに登録するシードスクリプト
 * 使い方: npx tsx src/test/seed-test-user.ts
 *
 * 登録されるアカウント:
 *   メール: test@example.com
 *   パスワード: password
 *   名前: テストユーザー
 */

import bcrypt from 'bcryptjs';
import { getDb } from '../lib/db';
import { MOCK_USERS } from './mock-users';

const db = getDb();

for (const mockUser of MOCK_USERS) {
  const existing = db.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).get(mockUser.email) as { id: string } | undefined;

  if (existing) {
    console.log(`スキップ: ${mockUser.email}（既に登録済み、ID: ${existing.id}）`);
    continue;
  }

  const passwordHash: string = bcrypt.hashSync(mockUser.password, 10);

  db.prepare(
    'INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)'
  ).run(mockUser.id, mockUser.name, mockUser.email, passwordHash);

  console.log(`登録完了: ${mockUser.name} (${mockUser.email}) ID: ${mockUser.id}`);
}

console.log('\nテスト用アカウントでログインできます:');
for (const mockUser of MOCK_USERS) {
  console.log(`  メール: ${mockUser.email}  パスワード: ${mockUser.password}`);
}
