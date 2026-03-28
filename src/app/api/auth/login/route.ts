import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';
import { validateEmail, validatePassword, checkRateLimit, getClientIp } from '@/lib/security';

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
 * レート制限: 同一IPから5回/分まで
 * @param request - { email, password } を含むJSONリクエスト
 * @returns 成功時: { user: { id, name, email } }、失敗時: { error }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // レート制限（5回/分）
  const clientIp: string = getClientIp(request);
  if (!checkRateLimit('login:' + clientIp, 5, 60000)) {
    return NextResponse.json({ error: 'ログイン試行回数が上限に達しました。1分後にお試しください' }, { status: 429 });
  }

  const body: { email?: string; password?: string } = await request.json();
  const { email, password } = body;

  // バリデーション
  const emailCheck = validateEmail(email);
  if (!emailCheck.ok) {
    return NextResponse.json({ error: emailCheck.message }, { status: 400 });
  }
  const passwordCheck = validatePassword(password);
  if (!passwordCheck.ok) {
    return NextResponse.json({ error: passwordCheck.message }, { status: 400 });
  }

  const db = await getDb();
  const row: UserRow | undefined = await db.get<UserRow>(
    'SELECT * FROM users WHERE email = ?', email
  );

  if (!row) {
    return NextResponse.json({ error: 'このメールアドレスは登録されていません' }, { status: 401 });
  }

  const isValid: boolean = await bcrypt.compare(password as string, row.password_hash);
  if (!isValid) {
    return NextResponse.json({ error: 'パスワードが違います' }, { status: 401 });
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
