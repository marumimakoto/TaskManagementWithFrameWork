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
}

/**
 * ユーザーのプロフィール情報を取得する
 * @param request - クエリパラメータに userId を含むリクエスト
 * @returns ユーザーの公開情報
 */
export function GET(request: NextRequest): NextResponse {
  const userId: string | null = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const db: import('better-sqlite3').Database = getDb();
  const row: UserRow | undefined = db.prepare(
    'SELECT id, name, email, birthday, avatar FROM users WHERE id = ?'
  ).get(userId) as UserRow | undefined;

  if (!row) {
    return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 });
  }

  return NextResponse.json({
    user: {
      id: row.id,
      name: row.name,
      email: row.email,
      birthday: row.birthday ?? undefined,
      avatar: row.avatar ?? undefined,
    },
  });
}

/**
 * プロフィール情報を更新する（名前・メールアドレス・誕生日・アイコン）
 * @param request - { userId, name, email, birthday } を含むJSONリクエスト
 * @returns 更新後のユーザー情報
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const body: { userId?: string; name?: string; email?: string; birthday?: string; avatar?: string } = await request.json();
  const { userId, name, email, birthday } = body;

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }
  if (!name || !name.trim()) {
    return NextResponse.json({ error: '名前は必須です' }, { status: 400 });
  }
  if (!email || !email.trim()) {
    return NextResponse.json({ error: 'メールアドレスは必須です' }, { status: 400 });
  }

  const db: import('better-sqlite3').Database = getDb();

  // メールアドレスの重複チェック（自分以外）
  const existing: { id: string } | undefined = db.prepare(
    'SELECT id FROM users WHERE email = ? AND id != ?'
  ).get(email.trim(), userId) as { id: string } | undefined;

  if (existing) {
    return NextResponse.json({ error: 'このメールアドレスは既に使用されています' }, { status: 409 });
  }

  const birthdayValue: string | null = birthday?.trim() || null;
  const avatarValue: string | null = body.avatar ?? null;

  db.prepare(
    'UPDATE users SET name = ?, email = ?, birthday = ?, avatar = ? WHERE id = ?'
  ).run(name.trim(), email.trim(), birthdayValue, avatarValue, userId);

  return NextResponse.json({
    user: {
      id: userId,
      name: name.trim(),
      email: email.trim(),
      birthday: birthdayValue ?? undefined,
      avatar: avatarValue ?? undefined,
    },
  });
}
