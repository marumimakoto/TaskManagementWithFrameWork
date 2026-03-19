import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';

/** DBのusersテーブルの行データ */
interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  birthday: string | null;
  avatar: string | null;
  role: string;
  created_at: number;
}

/**
 * メールアドレスとパスワードでログインする
 * パスワードはbcryptでハッシュ比較する
 * @param request - { email, password } を含むJSONリクエスト
 * @returns 成功時: { user: { id, name, email } }、失敗時: { error }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body: { email?: string; password?: string } = await request.json();
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json({ error: 'メールアドレスとパスワードは必須です' }, { status: 400 });
  }

  const db: import('better-sqlite3').Database = getDb();
  const row: UserRow | undefined = db.prepare(
    'SELECT * FROM users WHERE email = ?'
  ).get(email) as UserRow | undefined;

  if (!row) {
    return NextResponse.json({ error: 'メールアドレスまたはパスワードが違います' }, { status: 401 });
  }

  const isValid: boolean = await bcrypt.compare(password, row.password_hash);
  if (!isValid) {
    return NextResponse.json({ error: 'メールアドレスまたはパスワードが違います' }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: row.id,
      name: row.name,
      email: row.email,
      birthday: row.birthday ?? undefined,
      avatar: row.avatar ?? undefined,
      role: row.role ?? 'user',
    },
  });
}
