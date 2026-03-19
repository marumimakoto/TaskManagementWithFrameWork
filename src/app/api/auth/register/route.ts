import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';

/**
 * 新規ユーザーを登録する
 * パスワードはbcryptでハッシュ化してDBに保存する
 * @param request - { name, email, password } を含むJSONリクエスト
 * @returns 成功時: { user: { id, name, email } }、失敗時: { error }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body: { name?: string; email?: string; password?: string } = await request.json();
  const { name, email, password } = body;

  if (!name || !email || !password) {
    return NextResponse.json({ error: '名前・メールアドレス・パスワードは必須です' }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'パスワードは6文字以上で入力してください' }, { status: 400 });
  }

  const db: import('better-sqlite3').Database = getDb();

  // メールアドレスの重複チェック
  const existing: { id: string } | undefined = db.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).get(email) as { id: string } | undefined;

  if (existing) {
    return NextResponse.json({ error: 'このメールアドレスは既に登録されています' }, { status: 409 });
  }

  const id: string = crypto.randomUUID();
  const passwordHash: string = await bcrypt.hash(password, 10);

  db.prepare(
    'INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)'
  ).run(id, name, email, passwordHash);

  return NextResponse.json({
    user: {
      id,
      name,
      email,
      birthday: undefined,
    },
  });
}
