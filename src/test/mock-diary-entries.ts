/**
 * テスト用モック日記データ
 * たくさんの日記が存在する場合の表示テストに使用する
 */

import type { DiaryEntry } from '../app/types';

/**
 * 指定日数分のモック日記エントリを生成する
 * @param count - 生成するエントリ数
 * @param userId - ユーザーID
 * @returns モック日記エントリの配列（日付降順）
 */
export function generateMockDiaryEntries(count: number, userId: string): DiaryEntry[] {
  const entries: DiaryEntry[] = [];
  const now: Date = new Date();

  for (let i: number = 0; i < count; i++) {
    const date: Date = new Date(now);
    date.setDate(date.getDate() - i);

    const pad = (n: number): string => String(n).padStart(2, '0');
    const dateStr: string = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    const timestamp: number = date.getTime();

    const titles: string[] = [
      '今日の振り返り',
      'プロジェクト進捗',
      'ミーティングメモ',
      '勉強ノート',
      'アイデアメモ',
      '無題',
      '読書感想',
      'ランチの記録',
      '週次レビュー',
      '目標の確認',
    ];

    const contents: string[] = [
      '今日はタスク管理アプリの開発を進めた。日記機能の実装が完了し、作業ログとの連携もうまくいっている。明日はUIの微調整を行う予定。',
      '朝からミーティングが3件あり、午後にようやくコーディングに取りかかれた。集中力が必要な作業は午前中にできるようスケジュールを調整したい。',
      'TypeScriptの型システムについて学び直した。ユニオン型とインターセクション型の使い分けが以前より明確になった。実際のプロジェクトにも活かせそう。',
      '新しいカフェを見つけた。Wi-Fiも電源もあるので、リモートワークに良さそう。コーヒーも美味しかった。',
      'チームメンバーからのコードレビューで、エラーハンドリングの改善点を指摘された。確かにその通りなので、明日修正する。',
      'ランニングを30分。最近少し運動不足だったので、週3回は走るようにしたい。天気が良くて気持ちよかった。',
      '「Clean Code」の第5章を読了。関数は小さく、1つのことだけをするべきという原則を改めて意識しようと思う。',
      '今日は特に大きな進捗はなかったが、細かいバグ修正を5件ほど片付けた。こういう地道な作業も大事。',
      'デザインチームとUIの方向性について議論。ダークモードの実装を検討することになった。ユーザーからの要望も多いらしい。',
      '週末の予定を立てた。土曜日は買い物、日曜日はのんびり過ごす予定。平日の疲れをしっかり取りたい。',
    ];

    entries.push({
      id: `mock-diary-${i}`,
      title: titles[i % titles.length],
      date: dateStr,
      content: contents[i % contents.length],
      isPublic: i % 5 === 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  return entries;
}

/** 30日分のモック日記データ */
export const MOCK_DIARY_30: DiaryEntry[] = generateMockDiaryEntries(30, 'user1');

/** 100日分のモック日記データ */
export const MOCK_DIARY_100: DiaryEntry[] = generateMockDiaryEntries(100, 'user1');
