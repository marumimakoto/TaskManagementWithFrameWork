/**
 * テスト用モックユーザーデータ
 * 以前のモック認証で使用していたアカウント情報
 * テストやシードスクリプトで使用する
 */

/** テスト用ユーザーの型（パスワードを含む） */
export type MockUser = {
  /** ユーザーID */
  id: string;
  /** 表示名 */
  name: string;
  /** メールアドレス */
  email: string;
  /** 平文パスワード（テスト用） */
  password: string;
};

/** テスト用モックアカウント一覧 */
export const MOCK_USERS: MockUser[] = [
  {
    id: 'user1',
    name: 'テストユーザー',
    email: 'test@example.com',
    password: 'password',
  },
  {
    id: 'user2',
    name: '山田太郎',
    email: 'yamada@example.com',
    password: 'password',
  },
];
