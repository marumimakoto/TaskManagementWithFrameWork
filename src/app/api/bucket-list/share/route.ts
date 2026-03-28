import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import crypto from 'crypto';

/**
 * 共有トークンでやりたいことリストを閲覧する（ログイン不要）
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const token: string | null = request.nextUrl.searchParams.get('token');
    const userId: string | null = request.nextUrl.searchParams.get('userId');

    const db = await getDb();

    // トークンで閲覧（公開リンク）
    if (token) {
      const share = await db.get(
        'SELECT user_id FROM bucket_shares WHERE share_token = ?',
        token,
      );
      if (!share) {
        return NextResponse.json({ error: 'invalid or expired share link' }, { status: 404 });
      }
      const ownerId: string = share.user_id as string;

      // オーナーの名前を取得
      const owner = await db.get('SELECT name, avatar FROM users WHERE id = ?', ownerId);
      const ownerName: string = (owner?.name as string) ?? '不明';
      const ownerAvatar: string = (owner?.avatar as string) ?? '';

      // アイテム取得
      const rows = await db.all(
        'SELECT * FROM bucket_list WHERE user_id = ? ORDER BY done ASC, sort_order ASC',
        ownerId,
      );
      const items = rows.map((row: Record<string, unknown>) => ({
        id: row.id,
        title: row.title,
        detail: row.detail,
        category: row.category,
        deadlineYear: row.deadline_year,
        done: row.done === 1,
      }));

      // カテゴリ取得
      const catRows = await db.all(
        'SELECT name FROM bucket_categories WHERE user_id = ? ORDER BY sort_order ASC',
        ownerId,
      );
      const categories: string[] = catRows.map((r: Record<string, unknown>) => r.name as string);

      return NextResponse.json({ ownerName, ownerAvatar, items, categories });
    }

    // 自分の共有トークンを取得
    if (userId) {
      const existing = await db.get(
        'SELECT share_token FROM bucket_shares WHERE user_id = ?',
        userId,
      );
      return NextResponse.json({ shareToken: existing?.share_token ?? null });
    }

    return NextResponse.json({ error: 'token or userId required' }, { status: 400 });
  } catch (e: unknown) {
    const message: string = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * 共有リンクを生成する
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { userId } = body;
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const db = await getDb();

    // 既存のトークンがあればそれを返す
    const existing = await db.get(
      'SELECT share_token FROM bucket_shares WHERE user_id = ?',
      userId,
    );
    if (existing) {
      return NextResponse.json({ shareToken: existing.share_token });
    }

    // 新規トークン生成
    const shareToken: string = crypto.randomBytes(16).toString('hex');
    const id: string = crypto.randomUUID();
    await db.run(
      'INSERT INTO bucket_shares (id, user_id, share_token) VALUES (?, ?, ?)',
      id, userId, shareToken,
    );

    return NextResponse.json({ shareToken });
  } catch (e: unknown) {
    const message: string = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * 共有リンクを無効化する
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { userId } = body;
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const db = await getDb();
    await db.run('DELETE FROM bucket_shares WHERE user_id = ?', userId);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message: string = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
