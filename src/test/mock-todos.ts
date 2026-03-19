/**
 * テスト用モックタスクデータ
 * 大量のタスクが存在する場合の表示テストに使用する
 */

import type { Todo } from '../app/types';

/**
 * 指定件数分のモックタスクを生成する
 * @param count - 生成する件数
 * @returns モックタスクの配列
 */
export function generateMockTodos(count: number): Todo[] {
  const todos: Todo[] = [];
  const now: number = Date.now();
  const DAY: number = 24 * 60 * 60 * 1000;

  const titles: string[] = [
    'APIドキュメントを書く',
    'ユニットテストを追加',
    'デザインレビュー',
    'パフォーマンス改善',
    'バグ修正: ログイン画面',
    'データベース設計の見直し',
    'コードレビュー対応',
    'ミーティング資料作成',
    'CI/CDパイプライン構築',
    'セキュリティ監査対応',
    'モバイル対応',
    'アクセシビリティ改善',
    'ログ監視の設定',
    'キャッシュ戦略の検討',
    'リファクタリング: 認証モジュール',
    '新機能: 通知システム',
    'E2Eテスト作成',
    'ドキュメント更新',
    '依存パッケージの更新',
    'エラーハンドリングの強化',
  ];

  const details: string[] = [
    'REST APIのエンドポイント一覧と使用例をまとめる',
    'カバレッジ80%以上を目指す',
    'Figmaのモックアップと実装を比較して差分を洗い出す',
    '初回ロード時間を3秒以内に改善する',
    'メールアドレスにドットが含まれると認証できない問題',
    'テーブル正規化の再検討とインデックス追加',
    '先週のPRに対するフィードバックを反映',
    '来週のスプリントレビュー用の発表資料',
    'GitHub Actionsでビルド・テスト・デプロイを自動化',
    'OWASP Top 10に基づくチェックリスト対応',
    'レスポンシブデザインの実装とタッチ操作の最適化',
    'WAI-ARIAの属性追加とスクリーンリーダーテスト',
    'Grafanaでエラーレートとレイテンシのダッシュボード作成',
    'CDNの設定とブラウザキャッシュのmax-age調整',
    '認証ミドルウェアの責務分離と型安全性の向上',
    'WebSocketによるリアルタイム通知の仕組みを設計',
    'Playwrightで主要フローのE2Eテストを書く',
    'READMEとCONTRIBUTINGの内容を最新にする',
    'npm auditで報告された脆弱性を修正',
    'try-catchの統一とカスタムエラークラスの導入',
  ];

  const recurrences: ('carry' | 'daily')[] = ['carry', 'carry', 'carry', 'daily'];

  for (let i: number = 0; i < count; i++) {
    const estMin: number = [15, 30, 45, 60, 90, 120][i % 6];
    const actualMin: number = Math.floor(Math.random() * estMin);
    const stuckHours: number = i % 7 === 0 ? 3.5 : i % 5 === 0 ? 1.2 : 0;
    const daysAgo: number = Math.floor(Math.random() * 5);
    const deadlineDaysAhead: number = Math.floor(Math.random() * 10) - 2;
    const done: boolean = i % 8 === 0;

    todos.push({
      id: `mock-todo-${i}`,
      title: titles[i % titles.length],
      detail: details[i % details.length],
      estMin,
      actualMin,
      stuckHours,
      lastWorkedAt: now - daysAgo * DAY,
      deadline: now + deadlineDaysAhead * DAY,
      recurrence: recurrences[i % recurrences.length],
      started: i % 3 !== 0,
      done,
      sortOrder: i,
    });
  }

  return todos;
}

/** 20件のモックタスクデータ */
export const MOCK_TODOS_20: Todo[] = generateMockTodos(20);

/** 50件のモックタスクデータ */
export const MOCK_TODOS_50: Todo[] = generateMockTodos(50);
