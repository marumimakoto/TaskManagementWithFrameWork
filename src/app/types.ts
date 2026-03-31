/** ログイン済みユーザーの公開情報（パスワードを含まない） */
export type AppUser = {
  /** ユーザーID */
  id: string;
  /** 表示名 */
  name: string;
  /** メールアドレス */
  email: string;
  /** 誕生日（YYYY-MM-DD形式、未設定ならundefined） */
  birthday?: string;
  /** アイコン画像（Base64 data URL） */
  avatar?: string;
  /** ユーザー権限（user=一般, admin=管理者） */
  role?: string;
};

/** タスクの繰り返し種別 */
export type Recurrence = 'carry' | 'daily' | 'weekly' | 'monthly' | 'yearly' | string;

/** ToDoタスク1件のデータ構造 */
export type Todo = {
  /** 一意なタスクID */
  id: string;
  /** 親タスクのID（ルートタスクならundefined） */
  parentId?: string;
  /** タスクのタイトル */
  title: string;
  /** 予定作業時間（分） */
  estMin: number;
  /** 実績作業時間（分） */
  actualMin: number;
  /** 詰まっている時間（時間） */
  stuckHours: number;
  /** 最後に作業した日時（ミリ秒タイムスタンプ） */
  lastWorkedAt?: number;
  /** 締切日時（ミリ秒タイムスタンプ） */
  deadline?: number;
  /** 繰り返し種別 */
  recurrence: Recurrence;
  /** タスクの詳細説明 */
  detail?: string;
  /** カテゴリ */
  category?: string;
  /** 着手済みフラグ */
  started: boolean;
  /** 完了フラグ */
  done: boolean;
  /** 表示順（小さいほど上） */
  sortOrder: number;
  /** 作成日時（ミリ秒タイムスタンプ） */
  createdAt?: number;
};

/**
 * checklist関数の戻り値
 * タスクのリスク判定結果を格納する
 */
export type ChecklistResult = {
  /** 期限内に残作業が完了できるか */
  okDeadline: boolean;
  /** 詰まり時間が3時間未満か */
  okStuck: boolean;
  /** 最終作業日から2日以上経っていないか */
  okNotIdle: boolean;
  /** 残りの作業時間（分） */
  remainingWork: number;
  /** 期限までの残り時間（分） */
  restMin: number;
  /** 最終作業日からの経過日数 */
  daysIdle: number;
};

/**
 * タスクに対するその日の作業記録
 * 日付付きで蓄積されていく
 */
export type WorkLog = {
  /** 作業記録のID */
  id: string;
  /** 対象タスクのID */
  todoId: string;
  /** 作業内容の説明 */
  content: string;
  /** 記録日（YYYY-MM-DD形式） */
  date: string;
  /** 作成日時（ミリ秒タイムスタンプ） */
  createdAt: number;
};

/**
 * 日記の1エントリ
 * タスクとは独立した、その日の一般的な記録
 */
export type DiaryEntry = {
  /** エントリのID */
  id: string;
  /** タイトル（空の場合は「無題」） */
  title: string;
  /** 日付（YYYY-MM-DD形式） */
  date: string;
  /** 日記の本文 */
  content: string;
  /** 公開フラグ */
  isPublic: boolean;
  /** 作成日時（ミリ秒タイムスタンプ） */
  createdAt: number;
  /** 更新日時（ミリ秒タイムスタンプ） */
  updatedAt: number;
};

/** ユーザーごとの表示設定 */
export type UserSettings = {
  /** ダークモード */
  darkMode: boolean;
  /** フォントサイズ（px） */
  fontSize: number;
  /** フォント種類 */
  fontFamily: string;
  /** 執事アイコン画像（Base64 data URL、未設定ならデフォルト） */
  butlerAvatar: string;
  /** 執事への指示プロンプト（100文字以内） */
  butlerPrompt: string;
  /** 執事の吹き出し最大文字数 */
  butlerMaxChars: number;
};

/** UserSettingsのデフォルト値 */
export const DEFAULT_SETTINGS: UserSettings = {
  darkMode: false,
  fontSize: 16,
  fontFamily: 'system-ui, sans-serif',
  butlerAvatar: '',
  butlerPrompt: 'ユーザーを励ませ',
  butlerMaxChars: 80,
};

/**
 * Undo（取り消し）トーストの表示データ
 * 削除や完了切り替え後に一定時間表示される
 */
export type UndoToast = {
  /** トースト自体のID */
  toastId: string;
  /** 対象のタスクID */
  todoId: string;
  /** トーストに表示するメッセージ */
  message: string;
  /** 取り消しボタンのラベル */
  undoLabel?: string;
  /** 取り消しボタン押下時のコールバック */
  undo: () => void;
};
