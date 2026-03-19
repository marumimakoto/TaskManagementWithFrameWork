import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { UserSettings } from '@/app/types';
import { DEFAULT_SETTINGS } from '@/app/types';

/** DBのuser_settingsテーブルの行データ */
interface SettingsRow {
  user_id: string;
  dark_mode: number;
  font_size: number;
  font_family: string;
  butler_avatar: string;
  butler_prompt: string;
  butler_max_chars: number;
}

/**
 * DBの行データをフロント用のUserSettingsに変換する
 */
function rowToSettings(row: SettingsRow): UserSettings {
  return {
    darkMode: row.dark_mode === 1,
    fontSize: row.font_size,
    fontFamily: row.font_family,
    butlerAvatar: row.butler_avatar,
    butlerPrompt: row.butler_prompt,
    butlerMaxChars: row.butler_max_chars,
  };
}

/**
 * ユーザーの表示設定を取得する。未登録ならデフォルト値を返す
 */
export function GET(request: NextRequest): NextResponse {
  const userId: string | null = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const db: import('better-sqlite3').Database = getDb();
  const row: SettingsRow | undefined = db.prepare(
    'SELECT * FROM user_settings WHERE user_id = ?'
  ).get(userId) as SettingsRow | undefined;

  if (!row) {
    return NextResponse.json(DEFAULT_SETTINGS);
  }

  return NextResponse.json(rowToSettings(row));
}

/**
 * ユーザーの表示設定を保存する（存在すれば更新、なければ作成）
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const body: { userId?: string; settings?: UserSettings } = await request.json();
  const { userId, settings } = body;

  if (!userId || !settings) {
    return NextResponse.json({ error: 'userId and settings are required' }, { status: 400 });
  }

  const db: import('better-sqlite3').Database = getDb();
  db.prepare(`
    INSERT INTO user_settings (user_id, dark_mode, font_size, font_family, butler_avatar, butler_prompt, butler_max_chars)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      dark_mode = excluded.dark_mode,
      font_size = excluded.font_size,
      font_family = excluded.font_family,
      butler_avatar = excluded.butler_avatar,
      butler_prompt = excluded.butler_prompt,
      butler_max_chars = excluded.butler_max_chars
  `).run(
    userId,
    settings.darkMode ? 1 : 0,
    settings.fontSize,
    settings.fontFamily,
    settings.butlerAvatar ?? '',
    settings.butlerPrompt ?? 'ユーザーを励ませ',
    settings.butlerMaxChars ?? 80,
  );

  return NextResponse.json({ ok: true });
}
