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
  welcome_tone: string;
  show_butler: number;
  pomodoro_work: number;
  pomodoro_break: number;
  timezone: string;
  timeblock_start: number;
  timeblock_end: number;
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
    welcomeTone: row.welcome_tone ?? 'trivia',
    showButler: row.show_butler !== 0,
    pomodoroWork: row.pomodoro_work ?? 25,
    pomodoroBreak: row.pomodoro_break ?? 5,
    timezone: row.timezone ?? 'Asia/Tokyo',
    timeblockStart: row.timeblock_start ?? 6,
    timeblockEnd: row.timeblock_end ?? 22,
  };
}

/**
 * ユーザーの表示設定を取得する。未登録ならデフォルト値を返す
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId: string | null = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const db = await getDb();
  const row: SettingsRow | undefined = await db.get<SettingsRow>(
    'SELECT * FROM user_settings WHERE user_id = ?', userId
  );

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

  const db = await getDb();
  await db.run(`
    INSERT INTO user_settings (user_id, dark_mode, font_size, font_family, butler_avatar, butler_prompt, butler_max_chars, welcome_tone, show_butler, pomodoro_work, pomodoro_break, timezone, timeblock_start, timeblock_end)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      dark_mode = excluded.dark_mode,
      font_size = excluded.font_size,
      font_family = excluded.font_family,
      butler_avatar = excluded.butler_avatar,
      butler_prompt = excluded.butler_prompt,
      butler_max_chars = excluded.butler_max_chars,
      welcome_tone = excluded.welcome_tone,
      show_butler = excluded.show_butler,
      pomodoro_work = excluded.pomodoro_work,
      pomodoro_break = excluded.pomodoro_break,
      timezone = excluded.timezone,
      timeblock_start = excluded.timeblock_start,
      timeblock_end = excluded.timeblock_end
  `,
    userId,
    settings.darkMode ? 1 : 0,
    settings.fontSize,
    settings.fontFamily,
    settings.butlerAvatar ?? '',
    settings.butlerPrompt ?? 'ユーザーを励ませ',
    settings.butlerMaxChars ?? 80,
    settings.welcomeTone ?? 'trivia',
    settings.showButler !== false ? 1 : 0,
    settings.pomodoroWork ?? 25,
    settings.pomodoroBreak ?? 5,
    settings.timezone ?? 'Asia/Tokyo',
    settings.timeblockStart ?? 6,
    settings.timeblockEnd ?? 22,
  );

  return NextResponse.json({ ok: true });
}
