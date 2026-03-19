import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/**
 * 日記エントリの内容を更新する
 * @param request - { content } を含むJSONリクエスト
 * @param params - URLパスパラメータ（エントリID）
 * @returns 成功時 { ok: true }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id }: { id: string } = await params;
  const body: { title?: string; content?: string; isPublic?: boolean } = await request.json();

  const db: import('better-sqlite3').Database = getDb();
  const now: number = Date.now();

  // 公開切り替えのみの場合
  if (body.isPublic !== undefined && body.content === undefined) {
    db.prepare(
      'UPDATE diary_entries SET is_public = ?, updated_at = ? WHERE id = ?'
    ).run(body.isPublic ? 1 : 0, now, id);
    return NextResponse.json({ ok: true });
  }

  const { content } = body;
  if (!content || !content.trim()) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  const title: string = body.title?.trim() || '無題';
  db.prepare(
    'UPDATE diary_entries SET title = ?, content = ?, updated_at = ? WHERE id = ?'
  ).run(title, content.trim(), now, id);

  return NextResponse.json({ ok: true });
}

/**
 * 日記エントリを削除する
 * @param _request - 未使用
 * @param params - URLパスパラメータ（エントリID）
 * @returns 成功時 { ok: true }
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id }: { id: string } = await params;
  const db: import('better-sqlite3').Database = getDb();
  db.prepare('DELETE FROM diary_entries WHERE id = ?').run(id);

  return NextResponse.json({ ok: true });
}
