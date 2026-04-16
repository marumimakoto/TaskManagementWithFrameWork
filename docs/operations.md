# 運用準備チェックリスト

## デプロイ環境

| 項目 | 内容 |
|---|---|
| **ホスティング** | Vercel |
| **DB** | Turso Cloud SQLite |
| **ドメイン** | (TBD) |
| **フレームワーク** | Next.js 16 (App Router) |
| **Node.js** | 20.x |

## 環境変数

`.env.local` または Vercel の Environment Variables に設定:

| 変数名 | 必須 | 用途 |
|---|---|---|
| `TURSO_DATABASE_URL` | ✅ | Turso DB 接続URL |
| `TURSO_AUTH_TOKEN` | ✅ | Turso 認証トークン |
| `CRON_SECRET` | ✅ | Vercel Cron の認証シークレット |
| `STRIPE_SECRET_KEY` | Pro版を有効化するなら | Stripe API |
| `STRIPE_WEBHOOK_SECRET` | 同上 | Webhook 検証 |
| `ANTHROPIC_API_KEY` | 執事機能で使用 | Claude API |
| `NEXT_PUBLIC_APP_URL` | 任意 | Stripe リダイレクト用 |

## Vercel Cron 設定

`vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-refresh",
      "schedule": "0 0 * * *"
    }
  ]
}
```

- 毎日 UTC 0:00 (JST 9:00) に全ユーザーの日次リフレッシュを実行
- 無料プランは1日1回制限（現状の設定で問題なし）
- Cron失敗時のフォールバックとして、アプリを開いた時にも同じ処理が走る

## デプロイ前チェック

- [ ] `npm run build` が成功する
- [ ] TypeScript エラーがない
- [ ] `git status` がクリーン
- [ ] 全環境変数が Vercel に設定済み
- [ ] `CRON_SECRET` を Vercel 側にも設定（漏洩防止）
- [ ] Stripe の本番キーに切り替え（リリース時）

## DB初期セットアップ

初回デプロイ時に `src/lib/db.ts` の `initializeTables()` が以下を自動実行:

1. 全テーブルの `CREATE TABLE IF NOT EXISTS`
2. インデックスの `CREATE INDEX IF NOT EXISTS`
3. マイグレーション（`ALTER TABLE ADD COLUMN`）

新規テーブル/カラムを追加する場合:
- `tables` 配列 or `migrations` 配列に追加
- 冪等性を保つため `IF NOT EXISTS` / `ALTER TABLE ADD COLUMN` を使用

## モニタリング

### Vercel Function Logs

- ダッシュボード → Logs タブで API の実行ログ閲覧
- エラー時のスタックトレース確認
- `console.log`/`console.warn` の出力確認

### 主要なログ出力箇所

| 場所 | タグ | 内容 |
|---|---|---|
| `/api/todos/refresh` | `[refresh-api]` | 実行時のuserId/today/timezone |
| `refresh.ts` | `[refresh]` | 各ルールのshouldAddToday結果 |
| `/api/activity` | `[activity-debug]` | APIレスポンスのデバッグ |
| `/api/task-sets` | `[task-sets]` | 取得時間（getDb/query） |

### Turso メトリクス

- Turso Dashboard で以下を確認:
  - 接続数
  - クエリ実行時間
  - ストレージ使用量
  - エラー率

## セキュリティ

### 認証

- bcryptjs でパスワードハッシュ化（saltRounds=10）
- セッションは localStorage に保存（`kiroku:user`）
- 本番環境では HTTPS 必須

### 認可

- 全API で `userId` をリクエストから受け取り、DB クエリに適用
- 他ユーザーのデータにアクセス不可
- Admin 権限は `users.role = 'admin'` でチェック

### 既知の改善余地

- [ ] セッション管理を localStorage からHTTPOnly Cookie に移行
- [ ] CSRF トークン実装
- [ ] レート制限（ログイン試行回数）
- [ ] Content-Security-Policy ヘッダ
- [ ] XSS対策（日記のリッチテキストに `dangerouslySetInnerHTML` あり、要サニタイズ確認）

## バックアップ

- Turso は自動バックアップあり（DBレベル）
- ユーザーごとのデータエクスポート機能:
  - やりたいことリスト: XMLダウンロード
  - タスクセット: JSONエクスポート
  - 作業記録: TXTエクスポート
  - タイムブロック: ICSダウンロード

## トラブルシューティング

### 日次リフレッシュが動かない

1. Vercel Dashboard → Cron Jobs で実行履歴確認
2. `CRON_SECRET` 環境変数が設定されているか確認
3. Function Logs で `[refresh-api]` ログを確認
4. ユーザーがアプリを開いた時のフォールバックが動作していれば影響小

### 繰り返しタスクが生成されない

1. `recurring_rules.enabled = 1` か確認
2. `recurring_rules.recurrence` の値を確認（`'day'`, `'week:weekday'` 等）
3. `users.last_refresh_date` を今日より前の日付に更新 → 次回実行で処理
4. `lib/recurrence.ts` の定数と `shouldAddToday` が一致しているか

### パフォーマンス低下

1. Turso のレイテンシ確認（地域と Vercel デプロイリージョンが離れていないか）
2. API Routes のタイミングログ確認
3. インデックスが正しく作成されているか: `PRAGMA index_list(todos)` 等
4. localStorageキャッシュが効いているか

## Pro版の有効化（将来）

現在は Pro フラグのチェックのみ実装。課金フロー有効化には:

1. Stripe ダッシュボードで商品/価格を作成
2. `/api/purchase/route.ts` の Session 作成で `price_id` を設定
3. Webhook エンドポイント `/api/purchase/verify` を Stripe に登録
4. `user_purchases` テーブルへの記録が動作するか確認
