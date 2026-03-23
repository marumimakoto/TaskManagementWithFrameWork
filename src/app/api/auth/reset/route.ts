import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';

/** DBのpassword_reset_tokensテーブルの行データ */
interface TokenRow {
  id: string;
  user_id: string;
  token: string;
  expires_at: number;
  used: number;
}

/**
 * リセットトークンを使ってパスワードを再設定する
 * トークンが有効期限内かつ未使用の場合のみパスワードを更新する
 * @param request - { token, newPassword } を含むJSONリクエスト
 * @returns 成功時 { ok: true }、失敗時 { error }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body: { token?: string; newPassword?: string } = await request.json();
  const { token, newPassword } = body;

  if (!token || !newPassword) {
    return NextResponse.json({ error: '必要な情報が不足しています' }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: 'パスワードは6文字以上で入力してください' }, { status: 400 });
  }

  const db = await getDb();
  const row: TokenRow | undefined = await db.get<TokenRow>(
    'SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0', token
  );

  if (!row) {
    return NextResponse.json({ error: '無効なリセットリンクです' }, { status: 400 });
  }

  if (Date.now() > row.expires_at) {
    return NextResponse.json({ error: 'リセットリンクの有効期限が切れています' }, { status: 400 });
  }

  const newHash: string = await bcrypt.hash(newPassword, 10);

  await db.run('UPDATE users SET password_hash = ? WHERE id = ?', newHash, row.user_id);
  await db.run('UPDATE password_reset_tokens SET used = 1 WHERE id = ?', row.id);

  return NextResponse.json({ ok: true });
}
