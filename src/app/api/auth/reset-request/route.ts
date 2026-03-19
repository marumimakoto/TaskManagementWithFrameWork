import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/**
 * パスワードリセットを申請する
 * 登録済みメールアドレスに対してリセットトークンを生成する
 * 本番ではメールでリンクを送信するが、現在はコンソールにURLを出力する
 * @param request - { email } を含むJSONリクエスト
 * @returns 成功時 { ok: true }（メールアドレスが存在しない場合もセキュリティ上同じ応答を返す）
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body: { email?: string } = await request.json();
  const { email } = body;

  if (!email || !email.trim()) {
    return NextResponse.json({ error: 'メールアドレスを入力してください' }, { status: 400 });
  }

  const db: import('better-sqlite3').Database = getDb();
  const user: { id: string } | undefined = db.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).get(email.trim()) as { id: string } | undefined;

  // セキュリティ上、ユーザーが存在しない場合も同じレスポンスを返す
  if (!user) {
    return NextResponse.json({ ok: true });
  }

  const token: string = crypto.randomUUID();
  const id: string = crypto.randomUUID();
  const expiresAt: number = Date.now() + 60 * 60 * 1000; // 1時間後に有効期限切れ

  db.prepare(
    'INSERT INTO password_reset_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)'
  ).run(id, user.id, token, expiresAt);

  // TODO: 本番ではメール送信サービスでリンクを送る
  const resetUrl: string = `${request.nextUrl.origin}/reset-password?token=${token}`;
  console.log(`[パスワードリセット] ${email} → ${resetUrl}`);

  return NextResponse.json({ ok: true });
}
