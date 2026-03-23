import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';

/**
 * パスワードを変更する
 * 現在のパスワードを確認した上で新しいパスワードに更新する
 * @param request - { userId, currentPassword, newPassword } を含むJSONリクエスト
 * @returns 成功時 { ok: true }、失敗時 { error }
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const body: {
    userId?: string;
    currentPassword?: string;
    newPassword?: string;
  } = await request.json();
  const { userId, currentPassword, newPassword } = body;

  if (!userId || !currentPassword || !newPassword) {
    return NextResponse.json({ error: '全ての項目を入力してください' }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: '新しいパスワードは6文字以上で入力してください' }, { status: 400 });
  }

  const db = await getDb();
  const row: { password_hash: string } | undefined = await db.get<{ password_hash: string }>(
    'SELECT password_hash FROM users WHERE id = ?', userId
  );

  if (!row) {
    return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 });
  }

  const isValid: boolean = await bcrypt.compare(currentPassword, row.password_hash);
  if (!isValid) {
    return NextResponse.json({ error: '現在のパスワードが正しくありません' }, { status: 401 });
  }

  const newHash: string = await bcrypt.hash(newPassword, 10);
  await db.run('UPDATE users SET password_hash = ? WHERE id = ?', newHash, userId);

  return NextResponse.json({ ok: true });
}
