# Kiroku ドキュメント

運用準備フェーズ用の設計・運用ドキュメント。

## 目次

| ドキュメント | 内容 |
|---|---|
| [architecture.md](./architecture.md) | 全体アーキテクチャ、レイヤー構成、ディレクトリ構成 |
| [class-diagram.md](./class-diagram.md) | データモデル、コンポーネント依存、API/ライブラリ関係 |
| [sequence-diagrams.md](./sequence-diagrams.md) | 主要ユースケースのシーケンス図（10シナリオ） |
| [er-diagram.md](./er-diagram.md) | DBテーブル構造、インデックス、保持ポリシー |
| [operations.md](./operations.md) | デプロイ手順、環境変数、モニタリング、トラブルシューティング |

## Mermaid 図の閲覧方法

- GitHub / GitLab 上では自動レンダリングされます
- VSCode では [Markdown Preview Mermaid Support](https://marketplace.visualstudio.com/items?itemName=bierner.markdown-mermaid) 拡張でプレビュー可能
- ローカルで見る場合は [Mermaid Live Editor](https://mermaid.live) にコードを貼り付け

## ドキュメント更新ルール

- DB テーブル変更 → `er-diagram.md` を更新
- 新規API/コンポーネント追加 → `class-diagram.md` と `architecture.md` を更新
- 新機能の処理フロー → `sequence-diagrams.md` に追加
- 運用手順・環境変数変更 → `operations.md` を更新
