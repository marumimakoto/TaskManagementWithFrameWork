# シーケンス図

主要ユースケースの処理フローを図示します。

---

## 1. 初期ロード（ログイン済みユーザー）

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant B as ブラウザ
    participant LS as localStorage
    participant App as page.tsx
    participant API as API Routes
    participant DB as Turso

    U->>B: アプリを開く
    B->>LS: 'kiroku:user' 取得
    alt 未ログイン
        LS-->>B: null
        App->>U: ログイン画面表示
    else ログイン済み
        LS-->>App: user
        App->>LS: todos/settings キャッシュ取得
        LS-->>App: 即座に表示（キャッシュ）
        par
            App->>API: POST /api/todos/refresh
            API->>DB: 日次リフレッシュ（必要なら）
            DB-->>API: 結果
            API-->>App: { refreshed, addedCount }
        and
            App->>API: GET /api/init?userId=X
            API->>DB: todos + settings + purchase + todayMin
            DB-->>API: 全データ
            API-->>App: { todos, settings, isPro, todayMin }
        and
            App->>API: GET /api/todo-categories?userId=X
            API-->>App: カテゴリ一覧
        end
        App->>LS: todos/settings を最新に更新
        App->>U: 画面更新
    end
```

---

## 2. タスク追加

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant Form as TaskAddForm
    participant App as TodoApp
    participant API as /api/todos
    participant DB as Turso

    U->>Form: タイトル/予定時間/カテゴリ/繰り返し入力
    U->>Form: 追加ボタン押下
    Form->>App: onAdd(data)
    App->>App: setTodos(prev => [newTodo, ...prev])
    App->>API: POST { userId, todo }
    API->>DB: INSERT INTO todos
    opt 繰り返しあり
        API->>DB: INSERT INTO recurring_rules
    end
    DB-->>API: OK
    API-->>App: { ok: true }
    Note over App: useEffectでlocalStorageも更新
```

---

## 3. 実績時間+作業ログの同時記録（recordWork）

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant Card as タスクカード
    participant App as TodoApp
    participant TodosAPI as /api/todos/[id]
    participant LogsAPI as /api/todos/[id]/logs
    participant DB as Turso

    U->>Card: +分=30、メモ="第3章"
    U->>Card: +ボタン or 記録ボタン押下
    Card->>App: recordWork(id)

    alt addMin > 0
        App->>App: setTodos(actualMin += 30, lastWorkedAt=now)
        App->>TodosAPI: PUT updates: { actualMin, lastWorkedAt, started }
        TodosAPI->>DB: UPDATE todos
        App->>App: setTodayMinMap(+30)
    end

    alt logContent あり
        App->>LogsAPI: POST { content: "+30分 第3章" }
        LogsAPI->>DB: INSERT INTO work_logs
        DB-->>LogsAPI: newLog
        LogsAPI-->>App: newLog
        App->>App: setWorkLogs(prev + newLog)
    end

    App->>App: 入力欄クリア
```

---

## 4. ポモドーロタイマー（作業→休憩サイクル）

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant P as PomodoroTimer
    participant LS as localStorage
    participant Notif as Notification API
    participant App as TodoApp

    U->>P: 🍅 ポモドーロ開始
    P->>P: phase=work, phaseStartedAt=now
    P->>LS: 状態を保存
    P->>Notif: requestPermission()
    P->>Notif: scheduleNotification(25分後)

    loop 1秒ごと
        P->>P: setSecondsLeft(計算)
    end

    Note over P: 25分経過
    P->>P: overtime=true, アラーム開始
    Notif-->>U: ブラウザ通知「作業時間終了」

    U->>P: 「アラーム停止→休憩へ」
    P->>P: phase=break, secondsLeft=5*60
    P->>P: workElapsedを確定
    P->>LS: 状態を保存
    P->>Notif: scheduleNotification(5分後)

    Note over P: 5分経過
    P->>P: overtime=true, アラーム
    U->>P: 「アラーム停止→作業へ」
    P->>P: phase=work に戻る

    U->>P: 「終了して戻る」
    P->>App: onAddMinutes(workElapsed/60)
    App->>App: 実績加算 + 作業ログ記録
    P->>LS: クリア
    P-->>U: 閉じる
```

---

## 5. タスクドラッグによる並び替え（PC版）

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant H as DragHandle
    participant Doc as document
    participant App as TodoApp
    participant API as /api/todos/[id]
    participant DB as Turso

    U->>H: ⠿ をmousedown
    H->>App: setDragId(t.id), 開始Y座標記録
    App->>App: 子孫IDを取得、ゴーストレイヤー作成
    App->>Doc: mousemove/mouseup リスナー登録

    loop mousemove
        Doc->>App: ev.clientY
        App->>App: setMouseDragY(dy)
        App->>App: ゴーストレイヤーをtranslateY
        App->>App: ドロップ先インデックス計算
        App->>App: setDropBetweenIndex(newIdx)
    end

    U->>Doc: mouseup
    Doc->>App: handleMouseUp
    App->>App: ゴーストレイヤー削除
    alt 有効なドロップ位置
        App->>App: sortOrder再計算（親+子孫一括）
        App->>App: setTodos(更新)
        App->>API: PUT { updates: { sortOrder } } × N
        API->>DB: UPDATE todos
    end
    App->>App: dragId/mouseDragY/dropBetweenIndex リセット
```

---

## 6. 日次リフレッシュ（Vercel Cron）

```mermaid
sequenceDiagram
    participant Cron as Vercel Cron
    participant API as /api/cron/daily-refresh
    participant Refresh as refreshUserTodos
    participant DB as Turso

    Note over Cron: 毎日 UTC 0:00 (JST 9:00)
    Cron->>API: GET (Authorization: CRON_SECRET)
    API->>DB: SELECT id FROM users
    DB-->>API: 全ユーザーID

    loop 各ユーザー
        API->>DB: SELECT timezone FROM user_settings
        API->>Refresh: refreshUserTodos(db, userId, today)
        Refresh->>DB: SELECT last_refresh_date
        alt 今日リフレッシュ済み
            Refresh-->>API: null (スキップ)
        else 未実行
            Refresh->>DB: SELECT recurring_rules
            Refresh->>DB: SELECT existing undone todos titles

            loop 各ルール
                alt shouldAddToday=true AND 既存なし
                    Refresh->>DB: INSERT INTO todos
                    Refresh->>DB: UPDATE generated_count + 1
                else shouldAddToday=true AND 既存あり
                    Refresh->>DB: UPDATE generated_count + 1 (スキップ記録)
                end
            end

            Refresh->>DB: SELECT done=1 todos
            loop 完了タスク
                Refresh->>DB: INSERT INTO archived_todos
                alt 繰り返しルール一致
                    Refresh->>DB: UPDATE completed_count + 1
                end
                Refresh->>DB: DELETE FROM todos
            end

            Refresh->>DB: UPDATE todos SET last_worked_at=NULL WHERE done=0
            Refresh->>DB: UPDATE users SET last_refresh_date=today
            Refresh-->>API: { archivedCount, addedCount }
        end
    end
    API-->>Cron: { ok, processedCount, skippedCount }
```

---

## 7. タスク削除（Undoトースト）

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant App as TodoApp
    participant Toast as UndoToast
    participant API as /api/todos/[id]
    participant DB as Turso

    U->>App: 削除ボタン押下
    App->>App: setTodos(除外)
    App->>Toast: 表示「削除しました」+ 取り消しボタン

    alt 5秒以内にUndo
        U->>Toast: 取り消し押下
        Toast->>App: undo() 実行
        App->>App: setTodos(復元)
        App-xAPI: DELETE は送らない
    else 5秒経過
        Toast-->>App: 自動消滅
        App->>API: DELETE /api/todos/[id]
        API->>DB: INSERT INTO archived_todos
        API->>DB: DELETE FROM todos
        opt 完了タスクだった
            API->>DB: UPDATE recurring_rules completed_count + 1
        end
    end
```

---

## 8. カレンダーへのタイムブロック一括エクスポート

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant P as TimeBlockPanel
    participant B as ブラウザ
    participant G as Google Calendar

    U->>P: タイムラインにタスク配置
    U->>P: 「Googleカレンダーに登録」押下

    P->>P: buildIcsContent(blocks, todos)
    Note over P: VCALENDAR形式で<br/>全スロットをVEVENT化
    P->>B: Blob作成 + a.click()でダウンロード
    B-->>U: timeblock-YYYYMMDD.ics
    P->>B: window.open(Googleカレンダーimport画面)
    B->>G: Googleカレンダー設定画面を表示
    U->>G: ファイル選択 → インポート
    G-->>U: 全スロットが一括登録
```

---

## 9. 作業記録ページの閲覧

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant AP as ActivityPanel
    participant API as /api/activity
    participant DB as Turso

    U->>AP: 作業記録タブ開く
    AP->>API: GET /api/activity?userId=X
    API->>DB: SELECT timezone FROM user_settings
    API->>DB: SELECT id, category FROM todos + archived_todos
    Note over API: catMap 作成

    par 並列でデータ取得
        API->>DB: work_logs (with JOIN to todos/archived)
    and
        API->>DB: todos WHERE done=1 (完了タスク)
    and
        API->>DB: archived_todos WHERE done=1
    and
        API->>DB: archived_todos (削除タスク)
    and
        API->>DB: todos + archived UNION (パレート用)
    and
        API->>DB: work_logs (daily集計用)
    end

    API->>API: contentから分数抽出 (/\+?(\d+)分/)
    API->>API: 日別 workedMin / byCategory 集計
    API->>API: categorySummary 集計
    API->>DB: SELECT name FROM todo_categories
    API-->>AP: { entries, dailyStats, paretoData, dailyCategoryStats, categorySummary, userCategories }

    AP->>U: 一覧/統計/グラフ/パレート表示
```

---

## 10. ユーザー認証（新規登録）

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant Page as page.tsx
    participant API as /api/auth/register
    participant DB as Turso

    U->>Page: 名前/メール/パスワード入力
    U->>Page: 登録ボタン押下
    Page->>API: POST { name, email, password }
    API->>DB: SELECT * FROM users WHERE email=?
    alt 既に存在
        API-->>Page: { error: 'すでに登録済み' }
        Page->>U: エラー表示
    else 新規
        API->>API: bcrypt.hash(password)
        API->>DB: INSERT INTO users (id, name, email, password_hash)
        API-->>Page: { user }
        Page->>Page: setUser(), saveSession()
        Page->>U: ホーム画面へ遷移
    end
```
