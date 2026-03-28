import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';
import { validateName, validateEmail, validatePassword, checkRateLimit, getClientIp } from '@/lib/security';

/**
 * 新規ユーザーを登録する
 * パスワードはbcryptでハッシュ化してDBに保存する
 * レート制限: 同一IPから3回/分まで
 * @param request - { name, email, password } を含むJSONリクエスト
 * @returns 成功時: { user: { id, name, email } }、失敗時: { error }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const clientIp: string = getClientIp(request);
  if (!checkRateLimit('register:' + clientIp, 3, 60000)) {
    return NextResponse.json({ error: '登録試行回数が上限に達しました。1分後にお試しください' }, { status: 429 });
  }

  const body: { name?: string; email?: string; password?: string } = await request.json();
  const { name, email, password } = body;

  const nameCheck = validateName(name);
  if (!nameCheck.ok) {
    return NextResponse.json({ error: nameCheck.message }, { status: 400 });
  }
  const emailCheck = validateEmail(email);
  if (!emailCheck.ok) {
    return NextResponse.json({ error: emailCheck.message }, { status: 400 });
  }
  const passwordCheck = validatePassword(password);
  if (!passwordCheck.ok) {
    return NextResponse.json({ error: passwordCheck.message }, { status: 400 });
  }

  const db = await getDb();

  // メールアドレスの重複チェック
  const existing: { id: string } | undefined = await db.get<{ id: string }>(
    'SELECT id FROM users WHERE email = ?', email
  );

  if (existing) {
    return NextResponse.json({ error: 'このメールアドレスは既に登録されています' }, { status: 409 });
  }

  const id: string = crypto.randomUUID();
  const passwordHash: string = await bcrypt.hash(password as string, 10);

  await db.run(
    'INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)',
    id, (name as string).trim(), (email as string).trim(), passwordHash
  );

  return NextResponse.json({
    user: {
      id,
      name,
      email,
      birthday: undefined,
    },
  });
}
