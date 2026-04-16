# 画面遷移図

## 全体フロー

```mermaid
flowchart TB
    Start([アプリ起動]) --> AuthCheck{ログイン済み?}

    AuthCheck -->|No| Login[ログイン画面]
    AuthCheck -->|Yes| Welcome[Welcome メッセージ<br/>3秒表示]

    Login -->|新規登録タブ| Register[新規登録画面]
    Register -->|登録完了| Welcome
    Login -->|パスワード忘れ| Forgot[パスワード再設定<br/>/forgot-password]
    Forgot --> Reset[/reset-password]
    Reset --> Login

    Login -->|認証成功| Welcome
    Welcome --> Home[タスク画面<br/>activeTab=tasks]

    Home --> Menu{ハンバーガーメニュー}

    Menu -->|タスク管理| TaskGroup
    Menu -->|記録| RecordGroup
    Menu -->|日記| DiaryGroup
    Menu -->|アカウント| AccountGroup
    Menu -->|サポート| SupportGroup

    subgraph TaskGroup [タスク管理]
        Home2[タスク tasks]
        Today[今日やること today]
        Calendar[カレンダー calendar]
        TaskSets[タスクセット task-sets]
        Matrix[マトリクス matrix 🔒Pro]
        GTD[GTD gtd]
        Recurring[繰り返し recurring]
        Bucket[やりたいこと bucket-list]
        Archived[削除タスク archived]
    end

    subgraph RecordGroup [記録]
        Activity[作業記録 activity]
        Analytics[分析 analytics]
        CategoryStats[カテゴリ別実績 category-stats]
    end

    subgraph DiaryGroup [日記]
        DiaryWrite[書く diary-write]
        DiaryView[履歴 diary-view]
        DiaryPublic[みんなの日記 diary-public 🔒Pro]
    end

    subgraph AccountGroup [アカウント]
        MyPage[マイページ mypage]
        Settings[設定 settings]
    end

    subgraph SupportGroup [サポート]
        Help[ヘルプ help]
        BugReport[バグ報告 bug-report]
        Admin[管理 admin 👑管理者のみ]
    end

    Home -.->|ログアウト| Login
```

---

## タブ切替フロー（ログイン後）

```mermaid
stateDiagram-v2
    [*] --> tasks
    state tasks {
        [*] --> detail
        detail --> compact : ≡ 押下
        compact --> grid : ⊞ 押下
        grid --> kanban : ☰☰ 押下
        kanban --> detail : ☰ 押下
    }

    state today {
        [*] --> TaskSelect
        TaskSelect --> TimeBlock : タブ切替
        TimeBlock --> TaskSelect : タブ切替
    }

    state activity {
        [*] --> list
        list --> stats : 📊
        stats --> chart : 📈
        chart --> pareto : 📐 🔒Pro
        pareto --> list
    }

    state analytics {
        [*] --> estimation
        estimation --> burndown
        burndown --> weekly
        weekly --> estimation
    }

    state gtd {
        [*] --> inbox
        inbox --> next_action
        next_action --> waiting
        waiting --> someday
        someday --> inbox
    }

    tasks --> today
    today --> calendar
    calendar --> recurring
    recurring --> task-sets
    task-sets --> matrix
    matrix --> gtd

    tasks --> activity
    activity --> analytics
    analytics --> category-stats

    tasks --> diary-write
    diary-write --> diary-view
    diary-view --> diary-public

    tasks --> bucket-list
    tasks --> mypage
    tasks --> settings
    tasks --> help
    tasks --> bug-report
```

---

## タスク操作フロー（tasks タブ内）

```mermaid
flowchart TB
    TasksHome[タスク一覧表示] --> CardClick{カードクリック}

    CardClick -->|チェックボックス| Toggle[完了/未完了切替]
    Toggle --> UndoToast1[Undo トースト 5秒]
    UndoToast1 --> TasksHome

    CardClick -->|カード本体| Expand[展開表示]
    Expand --> ExpandedCard[詳細・作業ログ・ポモドーロ表示]

    ExpandedCard -->|🍅 ポモドーロ| Pomodoro[ポモドーロタイマー<br/>全画面オーバーレイ]
    Pomodoro -->|終了| ExpandedCard

    ExpandedCard -->|タイトルダブルクリック| InlineEdit[インライン編集]
    InlineEdit -->|Enter/Blur| ExpandedCard
    InlineEdit -->|Esc| ExpandedCard

    ExpandedCard -->|+ボタン/記録ボタン| RecordWork[recordWork<br/>実績+ログ同時登録]
    RecordWork --> ExpandedCard

    CardClick -->|🗑 削除| DeleteUndo[Undo トースト 5秒]
    DeleteUndo -->|元に戻す| TasksHome
    DeleteUndo -->|5秒経過| Archive[archived_todos に移動]

    CardClick -->|⠿ ドラッグ| DragMode[ドラッグモード<br/>ゴーストレイヤー表示]
    DragMode -->|ドロップ| Reorder[sortOrder 更新]
    Reorder --> TasksHome

    CardClick -->|▲▼ 上下移動| MoveUpDown[兄弟間で並び替え]
    MoveUpDown --> TasksHome

    CardClick -->|▶ 階層化| MoveRight[上のタスクの子に]
    MoveRight --> TasksHome

    CardClick -->|◀ 階層戻す| MoveLeft[親の兄弟に]
    MoveLeft --> TasksHome
```

---

## タスク追加フロー

```mermaid
flowchart LR
    subgraph PC版
        FormPC[ヘッダー下の<br/>Add Form 常時表示]
        FormPC -->|追加ボタン| AddPC[todos に INSERT]
    end

    subgraph スマホ版
        FAB[右下 FAB + ボタン]
        FAB -->|タップ| Modal[モーダル表示]
        Modal -->|TaskAddForm| AddMobile[todos に INSERT]
    end

    subgraph 今日やること画面
        TodayPlus[未完了リスト横の<br/>+ ボタン]
        TodayPlus -->|タップ| TodayModal[モーダル表示]
        TodayModal -->|TaskAddForm| AddToday[todos に INSERT]
    end

    AddPC --> RefreshView[画面更新]
    AddMobile --> RefreshView
    AddToday --> RefreshView
```

---

## ポモドーロタイマー遷移

```mermaid
stateDiagram-v2
    [*] --> Idle : カード展開から起動
    Idle --> ModeSelect : 表示
    state ModeSelect {
        [*] --> Pomodoro : 🍅 ポモドーロ選択
        [*] --> Stopwatch : ⏱ ストップウォッチ選択
    }

    ModeSelect --> Running : スタート押下

    state Running {
        [*] --> WorkPhase
        WorkPhase --> Paused : 一時停止
        Paused --> WorkPhase : 再開
        WorkPhase --> OvertimeWork : 時間終了<br/>アラーム+通知
        OvertimeWork --> BreakPhase : 休憩へ
        OvertimeWork --> AlarmStopped : アラームだけ停止
        AlarmStopped --> BreakPhase : 休憩へ
        BreakPhase --> OvertimeBreak : 休憩終了
        OvertimeBreak --> WorkPhase : 作業へ
    }

    Running --> Closed : 終了して戻る
    Closed --> [*] : 作業実績を todos に加算
    Closed --> LocalStorage : 状態クリア

    note right of Running
        localStorage に状態を保存
        タブ閉じても復元可能
        バックグラウンドでも正確に計測
    end note
```

---

## 今日やること画面（サブビュー）

```mermaid
flowchart TB
    TodayTab[今日やること タブ] --> SubView{サブビュー}

    SubView -->|タスク選択| TaskView[タスク選択ビュー]
    SubView -->|タイムブロック| TimeView[タイムブロックビュー]

    subgraph TaskView
        Summary[サマリー: 予定/本日実績/残り]
        Selected[選択中タスク]
        Undone[未完了タスク一覧]
        AddBtn[+ 新規作成ボタン]
    end

    subgraph TimeView
        Slots[タイムライン スロット]
        TaskList[タスクリスト]
        RangeSelect[範囲設定 6:00〜22:00]
        IcsExport[ICSダウンロード]
        GoogleExport[Googleカレンダーに登録]
    end

    Selected -->|+分 + 記録| RecordWork[実績+ログ記録]
    Undone -->|+ 選択| Selected
    Selected -->|✕ 解除| Undone
    AddBtn -->|タップ| TaskAddFormModal[TaskAddForm モーダル]

    TaskList -->|タップ選択| TaskSelected[タスク選択状態]
    TaskSelected --> Slots
    Slots -->|タップ配置| Assigned[スロットに割当]
    TaskList -->|ドラッグ PC| Slots

    Assigned --> IcsExport
    Assigned --> GoogleExport
```

---

## タブバー配置（レスポンシブ）

### PC版

```
┌─────────────────────────────────────────────┐
│ [タイトル]   [ユーザー名] [ログアウト] [☰]   │
├─────────────────────────────────────────────┤
│ [タスク][今日][カレンダー][セット][繰り返し] │ ← diaryModeBar（該当タブのみ）
├─────────────────────────────────────────────┤
│                                              │
│          メインコンテンツ                     │
│                                              │
└─────────────────────────────────────────────┘
```

### スマホ版

```
┌────────────────────────┐
│ [タイトル]          [☰]│
├────────────────────────┤
│                        │
│   メインコンテンツ      │
│                        │
│                  [＋FAB]│ ← tasksタブのみ
├────────────────────────┤
│[タスク][日記][記録][My][☰]│ ← ボトムタブバー
└────────────────────────┘
```

---

## モーダル・オーバーレイ一覧

| 名前 | 起動条件 | 閉じる方法 |
|---|---|---|
| **ハンバーガーメニュー** | ☰ タップ | 外側タップ or メニュー項目選択 |
| **スマホ追加モーダル** | FAB + タップ | × or 外側タップ |
| **タスク新規作成モーダル**（今日やること） | + タップ | × or 外側タップ |
| **ポモドーロタイマー** | 🍅 ポモドーロ開始 | 終了して戻る |
| **Pro版アップグレード** | Pro機能アクセス（未購入） | × or 購入 |
| **チュートリアル吹き出し** | ヘルプのハンズオン開始 | ← ハンズオンに戻る |
| **Undoトースト** | 削除/完了切替 | 元に戻す or 5秒自動消滅 |
| **やりたいことリスト削除確認** | 削除ボタン | 元に戻す or 5秒経過 |

---

## 権限によるアクセス制御

```mermaid
flowchart LR
    User[ユーザー] --> CheckRole{role?}

    CheckRole -->|user| Normal[一般機能]
    CheckRole -->|admin| AdminAccess[管理機能<br/>admin タブ]

    Normal --> CheckPro{isPro?}
    CheckPro -->|No| FreeFeatures[無料機能]
    CheckPro -->|Yes| ProFeatures[Pro機能]

    FreeFeatures -.->|アクセス試行| ProModal[Pro版アップグレード<br/>モーダル]

    ProFeatures --> Matrix[アイゼンハワーマトリクス]
    ProFeatures --> Pareto[パレート分析]
    ProFeatures --> PublicDiary[みんなの日記]

    AdminAccess --> UserList[全ユーザー一覧]
    AdminAccess --> BugMgmt[バグ報告管理]
```
