'use client';

import { useState } from 'react';
import type { AppUser } from './types';
import styles from './page.module.css';

/** タブの種別 */
export type TabType = 'tasks' | 'today' | 'calendar' | 'task-sets' | 'matrix' | 'activity' | 'analytics' | 'category-stats' | 'archived' | 'recurring' | 'diary-write' | 'diary-view' | 'diary-public' | 'bucket-list' | 'mypage' | 'settings' | 'help' | 'bug-report' | 'admin';

/** タブごとのタイトルと説明 */
const TAB_INFO: Record<TabType, { title: string; description: string }> = {
  tasks: { title: 'タスク', description: 'タスクの追加・編集・完了管理' },
  today: { title: '今日やること', description: '今日やるタスクを選んで集中する' },
  calendar: { title: 'カレンダー', description: '期限のあるタスクを月間カレンダーで確認' },
  'task-sets': { title: 'タスクセット', description: 'タスクのテンプレートを作成・管理' },
  matrix: { title: 'アイゼンハワーマトリクス', description: '緊急性と重要性でタスクを整理' },
  activity: { title: '作業記録', description: '作業ログ・統計・パレート分析' },
  analytics: { title: '分析', description: '見積もり精度・バーンダウン・週次レビュー' },
  'category-stats': { title: 'カテゴリ別実績', description: 'カテゴリごとの達成率・作業時間・月別グラフ' },
  archived: { title: '削除したタスク', description: '削除したタスクの復元' },
  recurring: { title: '繰り返しタスク', description: '繰り返しルールの管理・達成率' },
  'diary-write': { title: '日記を書く', description: 'その日の出来事を記録' },
  'diary-view': { title: '日記を見る', description: '過去の日記を検索・閲覧' },
  'diary-public': { title: 'みんなの日記', description: '他のユーザーの公開日記を閲覧' },
  'bucket-list': { title: 'やりたいことリスト', description: '人生でやりたいことを管理' },
  mypage: { title: 'マイページ', description: 'プロフィール・パスワードの変更' },
  settings: { title: '設定', description: '表示・執事・Welcomeの設定' },
  help: { title: 'ヘルプ', description: '使い方ガイドとハンズオン' },
  'bug-report': { title: 'バグ報告', description: '不具合の報告と確認' },
  admin: { title: '管理', description: '管理者用ダッシュボード' },
};

/**
 * アプリ共通ヘッダー + ハンバーガーメニュー
 */
export default function AppHeader({
  user,
  activeTab,
  isPro,
  menuOpen,
  onMenuOpenChange,
  onTabChange,
  onSwitchProTab,
  onLogout,
}: {
  user: AppUser;
  activeTab: TabType;
  isPro: boolean;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onTabChange: (tab: TabType) => void;
  onSwitchProTab: (tab: TabType) => void;
  onLogout: () => void;
}): React.ReactElement {
  const [taskMenuOpen, setTaskMenuOpen] = useState<boolean>(false);

  const info: { title: string; description: string } = TAB_INFO[activeTab] ?? { title: '', description: '' };

  function goTo(tab: TabType): void {
    onTabChange(tab);
    onMenuOpenChange(false);
  }

  function goToPro(tab: TabType): void {
    onSwitchProTab(tab);
    if (isPro) {
      onMenuOpenChange(false);
    }
  }

  return (
    <>
      <header className={styles.topBar}>
        <div className={styles.headerTitleGroup}>
          <h1 className={styles.headerTitle}>{info.title}</h1>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '2px 0 0' }}>
            {info.description}
          </p>
        </div>
        <div className={styles.userBar}>
          <span className={styles.userName}>{user.name}</span>
          <button type="button" onClick={onLogout} className={styles.iconBtn}>
            ログアウト
          </button>
        </div>
        <button
          type="button"
          className={styles.hamburgerBtn}
          onClick={() => onMenuOpenChange(!menuOpen)}
          aria-label="メニュー"
        >
          <span className={styles.hamburgerLine} />
          <span className={styles.hamburgerLine} />
          <span className={styles.hamburgerLine} />
        </button>
      </header>

      {/* ハンバーガーメニュー */}
      {menuOpen && (
        <div className={styles.menuOverlay} onClick={() => onMenuOpenChange(false)}>
          <nav className={styles.menuPanel} onClick={(e) => e.stopPropagation()}>
            {/* --- タスク管理グループ --- */}
            <div className={styles.menuGroupLabel}>タスク管理</div>
            <button
              type="button"
              className={`${styles.menuItem} ${activeTab === 'tasks' ? styles.menuItemActive : ''}`}
              onClick={() => goTo('tasks')}
            >
              ホーム
            </button>
            <button
              type="button"
              className={styles.menuItem}
              onClick={() => setTaskMenuOpen(!taskMenuOpen)}
            >
              その他 {taskMenuOpen ? '▾' : '▸'}
            </button>
            {taskMenuOpen && (
              <>
                <button type="button" className={`${styles.menuSubItem} ${activeTab === 'task-sets' ? styles.menuItemActive : ''}`} onClick={() => goTo('task-sets')}>
                  タスクセット
                </button>
                <button type="button" className={`${styles.menuSubItem} ${activeTab === 'matrix' ? styles.menuItemActive : ''}`} onClick={() => goToPro('matrix')}>
                  アイゼンハワーマトリクス {!isPro && '🔒'}
                </button>
                <button type="button" className={`${styles.menuSubItem} ${activeTab === 'recurring' ? styles.menuItemActive : ''}`} onClick={() => goTo('recurring')}>
                  繰り返しタスク
                </button>
                <button type="button" className={`${styles.menuSubItem} ${activeTab === 'bucket-list' ? styles.menuItemActive : ''}`} onClick={() => goTo('bucket-list')}>
                  やりたいことリスト
                </button>
                <button type="button" className={`${styles.menuSubItem} ${activeTab === 'archived' ? styles.menuItemActive : ''}`} onClick={() => goTo('archived')}>
                  削除したタスク
                </button>
              </>
            )}

            {/* --- 記録グループ --- */}
            <div className={styles.menuGroupLabel}>記録</div>
            <button type="button" className={`${styles.menuItem} ${activeTab === 'activity' ? styles.menuItemActive : ''}`} onClick={() => goTo('activity')}>
              作業記録
            </button>
            <button type="button" className={`${styles.menuItem} ${activeTab === 'category-stats' ? styles.menuItemActive : ''}`} onClick={() => goTo('category-stats')}>
              カテゴリ別実績
            </button>
            <button type="button" className={`${styles.menuItem} ${activeTab === 'analytics' ? styles.menuItemActive : ''}`} onClick={() => goTo('analytics')}>
              分析
            </button>

            {/* --- 日記グループ --- */}
            <div className={styles.menuGroupLabel}>日記</div>
            <button type="button" className={`${styles.menuItem} ${activeTab === 'diary-write' ? styles.menuItemActive : ''}`} onClick={() => goTo('diary-write')}>
              書く
            </button>
            <button type="button" className={`${styles.menuItem} ${activeTab === 'diary-view' ? styles.menuItemActive : ''}`} onClick={() => goTo('diary-view')}>
              履歴
            </button>
            <button type="button" className={`${styles.menuItem} ${activeTab === 'diary-public' ? styles.menuItemActive : ''}`} onClick={() => goToPro('diary-public')}>
              みんなの日記 {!isPro && '🔒'}
            </button>

            {/* --- アカウントグループ --- */}
            <div className={styles.menuGroupLabel}>アカウント</div>
            <button type="button" className={`${styles.menuItem} ${activeTab === 'mypage' ? styles.menuItemActive : ''}`} onClick={() => goTo('mypage')}>
              マイページ
            </button>
            <button type="button" className={`${styles.menuItem} ${activeTab === 'settings' ? styles.menuItemActive : ''}`} onClick={() => goTo('settings')}>
              設定
            </button>

            {/* --- サポートグループ --- */}
            <div className={styles.menuGroupLabel}>サポート</div>
            <button type="button" className={`${styles.menuItem} ${activeTab === 'help' ? styles.menuItemActive : ''}`} onClick={() => goTo('help')}>
              ヘルプ
            </button>
            <button type="button" className={`${styles.menuItem} ${activeTab === 'bug-report' ? styles.menuItemActive : ''}`} onClick={() => goTo('bug-report')}>
              バグ報告
            </button>
            {user.role === 'admin' && (
              <button type="button" className={`${styles.menuItem} ${activeTab === 'admin' ? styles.menuItemActive : ''}`} onClick={() => goTo('admin')}>
                管理
              </button>
            )}
          </nav>
        </div>
      )}
    </>
  );
}
