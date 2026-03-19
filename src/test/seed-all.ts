/**
 * テスト環境を一括セットアップするスクリプト
 * テスト用アカウントの登録 + モックタスク + モック日記データの投入を行う
 * 使い方: npx tsx src/test/seed-all.ts
 */

import bcrypt from 'bcryptjs';
import { getDb } from '../lib/db';
import { MOCK_USERS } from './mock-users';
import { generateMockDiaryEntries } from './mock-diary-entries';
import { generateMockTodos } from './mock-todos';

const db = getDb();

// --- テスト用アカウント登録 ---
console.log('=== テスト用アカウント ===');
for (const mockUser of MOCK_USERS) {
  const existing = db.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).get(mockUser.email) as { id: string } | undefined;

  if (existing) {
    console.log(`スキップ: ${mockUser.email}（既に登録済み）`);
    continue;
  }

  const passwordHash: string = bcrypt.hashSync(mockUser.password, 10);
  db.prepare(
    'INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)'
  ).run(mockUser.id, mockUser.name, mockUser.email, passwordHash);
  console.log(`登録完了: ${mockUser.name} (${mockUser.email})`);
}

const testUserId: string = MOCK_USERS[0].id;

// --- モックタスク投入 ---
const todoCount: number = 20;
console.log(`\n=== モックタスク（${todoCount}件 → ${testUserId}） ===`);

db.prepare("DELETE FROM todos WHERE id LIKE 'mock-todo-%'").run();

const todos = generateMockTodos(todoCount);
const insertTodo = db.prepare(
  'INSERT INTO todos (id, user_id, title, est_min, actual_min, stuck_hours, last_worked_at, deadline, recurrence, detail, done) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
);
const insertAllTodos = db.transaction(() => {
  for (const t of todos) {
    insertTodo.run(
      t.id,
      testUserId,
      t.title,
      t.estMin,
      t.actualMin,
      t.stuckHours,
      t.lastWorkedAt ?? null,
      t.deadline ?? null,
      t.recurrence,
      t.detail ?? '',
      t.done ? 1 : 0,
    );
  }
});
insertAllTodos();
console.log(`${todos.length} 件のモックタスクを投入しました`);

// --- モック日記投入 ---
const diaryCount: number = 30;
console.log(`\n=== モック日記（${diaryCount}件 → ${testUserId}） ===`);

db.prepare("DELETE FROM diary_entries WHERE id LIKE 'mock-diary-%'").run();

const entries = generateMockDiaryEntries(diaryCount, testUserId);
const insertDiary = db.prepare(
  'INSERT INTO diary_entries (id, user_id, title, date, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
);
const insertAllDiaries = db.transaction(() => {
  for (const e of entries) {
    insertDiary.run(e.id, testUserId, e.title, e.date, e.content, e.createdAt, e.updatedAt);
  }
});
insertAllDiaries();
console.log(`${entries.length} 件のモック日記を投入しました`);

// --- モック作業ログ投入 ---
console.log('\n=== モック作業ログ ===');

db.prepare("DELETE FROM work_logs WHERE id LIKE 'mock-log-%'").run();

const mockLogs: { id: string; todoId: string; content: string; date: string }[] = [
  { id: 'mock-log-1', todoId: 'mock-todo-4', content: 'ログイン画面のバリデーション修正に着手。メールアドレスの形式チェックを追加した。', date: '2026-03-17' },
  { id: 'mock-log-2', todoId: 'mock-todo-4', content: 'パスワード入力時のエラーメッセージ表示を改善。ユーザビリティテストも実施。', date: '2026-03-18' },
  { id: 'mock-log-3', todoId: 'mock-todo-4', content: 'エッジケース（空入力・特殊文字）のテストケースを追加。残りはCSRF対策のみ。', date: '2026-03-19' },
  { id: 'mock-log-4', todoId: 'mock-todo-5', content: 'テーブル設計のER図を作成。正規化の見直しポイントを3つ特定した。', date: '2026-03-16' },
  { id: 'mock-log-5', todoId: 'mock-todo-5', content: 'インデックス設計を検討。user_idへのインデックス追加でクエリ速度が改善する見込み。', date: '2026-03-18' },
  { id: 'mock-log-6', todoId: 'mock-todo-8', content: 'GitHub Actionsのワークフロー定義ファイルを作成。ビルド・テスト・デプロイの3ステージ構成。', date: '2026-03-15' },
  { id: 'mock-log-7', todoId: 'mock-todo-8', content: 'テストステージでJestの並列実行を設定。実行時間が40%短縮。', date: '2026-03-17' },
  { id: 'mock-log-8', todoId: 'mock-todo-8', content: 'デプロイステージのキャッシュ戦略を最適化。node_modulesのキャッシュで2分短縮。', date: '2026-03-19' },
  { id: 'mock-log-9', todoId: 'mock-todo-18', content: '依存パッケージのセキュリティ監査を実施。critical脆弱性が2件見つかったので更新。', date: '2026-03-14' },
  { id: 'mock-log-10', todoId: 'mock-todo-18', content: 'メジャーバージョンアップ対象のパッケージについて互換性テストを実施。', date: '2026-03-16' },
  { id: 'mock-log-11', todoId: 'mock-todo-19', content: 'API層のエラーハンドリングパターンを統一。カスタムエラークラスを導入。', date: '2026-03-17' },
  { id: 'mock-log-12', todoId: 'mock-todo-19', content: 'フロントエンドのエラーバウンダリを追加。未キャッチエラーの表示を改善。', date: '2026-03-19' },
];

const insertLog = db.prepare(
  'INSERT INTO work_logs (id, todo_id, content, date, created_at) VALUES (?, ?, ?, ?, ?)'
);
const insertAllLogs = db.transaction(() => {
  for (const l of mockLogs) {
    insertLog.run(l.id, l.todoId, l.content, l.date, Date.now());
  }
});
insertAllLogs();
console.log(`${mockLogs.length} 件のモック作業ログを投入しました`);

// --- モック公開タスクセット投入（user2: 山田太郎） ---
console.log('\n=== モック公開タスクセット ===');

const user2Id: string = MOCK_USERS[1].id;

db.prepare("DELETE FROM task_set_items WHERE set_id LIKE 'mock-set-%'").run();
db.prepare("DELETE FROM task_sets WHERE id LIKE 'mock-set-%'").run();

const mockSets: { id: string; name: string; items: { id: string; title: string; estMin: number; detail: string; recurrence: string }[] }[] = [
  {
    id: 'mock-set-1',
    name: '朝のルーティン',
    items: [
      { id: 'mock-si-1', title: 'メールチェック', estMin: 15, detail: '未読メールを確認して返信する', recurrence: 'daily' },
      { id: 'mock-si-2', title: 'タスク整理', estMin: 10, detail: '今日やることを確認して優先順位をつける', recurrence: 'daily' },
      { id: 'mock-si-3', title: '朝会', estMin: 15, detail: 'チームの進捗共有', recurrence: 'daily' },
    ],
  },
  {
    id: 'mock-set-2',
    name: '週次レビュー',
    items: [
      { id: 'mock-si-4', title: '今週の振り返り', estMin: 30, detail: '達成したこと・課題・改善点を整理', recurrence: 'weekly' },
      { id: 'mock-si-5', title: '来週の目標設定', estMin: 20, detail: '3つの重要タスクを決める', recurrence: 'weekly' },
      { id: 'mock-si-6', title: 'カレンダー確認', estMin: 10, detail: '来週の予定をチェックしてブロック', recurrence: 'weekly' },
      { id: 'mock-si-7', title: 'ツールの整理', estMin: 15, detail: '不要なファイルやブックマークを片付ける', recurrence: 'weekly' },
    ],
  },
  {
    id: 'mock-set-3',
    name: 'プレゼン準備',
    items: [
      { id: 'mock-si-8', title: '構成案を作る', estMin: 30, detail: 'アウトラインを箇条書きで整理', recurrence: 'carry' },
      { id: 'mock-si-9', title: 'スライド作成', estMin: 60, detail: 'Googleスライドで作成', recurrence: 'carry' },
      { id: 'mock-si-10', title: 'リハーサル', estMin: 20, detail: '通しで練習して時間を計る', recurrence: 'carry' },
      { id: 'mock-si-11', title: 'フィードバック反映', estMin: 30, detail: 'レビューをもらって修正', recurrence: 'carry' },
      { id: 'mock-si-12', title: '最終確認', estMin: 10, detail: '誤字脱字・リンク切れチェック', recurrence: 'carry' },
    ],
  },
  {
    id: 'mock-set-4',
    name: '新機能リリースチェックリスト',
    items: [
      { id: 'mock-si-13', title: 'テストケース作成', estMin: 45, detail: '正常系・異常系・境界値', recurrence: 'carry' },
      { id: 'mock-si-14', title: 'コードレビュー依頼', estMin: 10, detail: 'PRを作成してレビュアーをアサイン', recurrence: 'carry' },
      { id: 'mock-si-15', title: 'ステージング確認', estMin: 20, detail: 'ステージング環境で動作確認', recurrence: 'carry' },
      { id: 'mock-si-16', title: 'ドキュメント更新', estMin: 30, detail: 'README・APIドキュメントを更新', recurrence: 'carry' },
      { id: 'mock-si-17', title: 'リリース実行', estMin: 15, detail: '本番デプロイ＋動作確認', recurrence: 'carry' },
      { id: 'mock-si-18', title: 'リリースノート作成', estMin: 15, detail: '変更内容をまとめて共有', recurrence: 'carry' },
    ],
  },
];

const insertSet = db.prepare(
  'INSERT INTO task_sets (id, user_id, name, is_public) VALUES (?, ?, ?, 1)'
);
const insertSetItem = db.prepare(
  'INSERT INTO task_set_items (id, set_id, title, est_min, detail, recurrence, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
);

const insertAllSets = db.transaction(() => {
  for (const s of mockSets) {
    insertSet.run(s.id, user2Id, s.name);
    s.items.forEach((item, i: number) => {
      insertSetItem.run(item.id, s.id, item.title, item.estMin, item.detail, item.recurrence, i);
    });
  }
});
insertAllSets();
console.log(`${mockSets.length} 件の公開タスクセット（${mockSets.reduce((sum, s) => sum + s.items.length, 0)} アイテム）を投入しました`);

// --- ログイン情報 ---
console.log('\n=== ログイン情報 ===');
for (const mockUser of MOCK_USERS) {
  console.log(`  メール: ${mockUser.email}  パスワード: ${mockUser.password}`);
}
