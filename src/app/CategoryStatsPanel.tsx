'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppUser } from './types';
import { minutesToText } from './utils';
import styles from './page.module.css';

/** 現在のタスク（カテゴリ情報を含む） */
interface TodoItem {
  id: string;
  title: string;
  estMin: number;
  actualMin: number;
  category?: string;
  done: boolean;
  createdAt?: number;
}

/** アーカイブされた完了タスク */
interface ArchivedTodo {
  id: string;
  title: string;
  estMin: number;
  actualMin: number;
  detail?: string;
  deadline?: number;
  done: boolean;
  createdAt: number;
  archivedAt: number;
}

/** カテゴリ別集計データ */
interface CategoryStat {
  category: string;
  taskCount: number;
  totalActualMin: number;
  totalEstMin: number;
}

/** 月別達成データ */
interface MonthlyStat {
  label: string;
  count: number;
}

/**
 * YYYY-MM形式の月ラベルを返す
 * @param date - 対象の日付
 * @returns "YYYY-MM"形式の文字列
 */
function toMonthLabel(date: Date): string {
  const year: number = date.getFullYear();
  const month: string = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * カテゴリ別実績ページ
 * アーカイブされた完了タスクと現在の完了タスクをカテゴリごとに集計して表示する
 */
export default function CategoryStatsPanel({
  user,
}: {
  user: AppUser;
}): React.ReactElement {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [archivedTodos, setArchivedTodos] = useState<ArchivedTodo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  /** 現在のタスクとアーカイブを取得する */
  const fetchData = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const [todosRes, archivedRes]: [Response, Response] = await Promise.all([
        fetch('/api/todos?userId=' + user.id),
        fetch('/api/todos/archive?userId=' + user.id),
      ]);
      const todosData: TodoItem[] = await todosRes.json();
      const archivedData: ArchivedTodo[] = await archivedRes.json();
      setTodos(todosData);
      setArchivedTodos(archivedData);
    } catch (e) {
      console.error('Failed to fetch category stats data', e);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /** 完了済みタスク一覧（現在の完了タスク + アーカイブ） */
  const completedTasks: Array<{
    id: string;
    title: string;
    category: string;
    actualMin: number;
    estMin: number;
    completedAt: number;
  }> = useMemo(() => {
    const result: Array<{
      id: string;
      title: string;
      category: string;
      actualMin: number;
      estMin: number;
      completedAt: number;
    }> = [];

    // 現在のタスクから完了済みのもの
    for (const todo of todos) {
      if (todo.done) {
        result.push({
          id: todo.id,
          title: todo.title,
          category: todo.category || '未分類',
          actualMin: todo.actualMin,
          estMin: todo.estMin,
          completedAt: todo.createdAt ?? 0,
        });
      }
    }

    // カテゴリ情報のルックアップマップ（todosのタイトルからカテゴリを取得）
    const categoryByTitle: Map<string, string> = new Map();
    for (const todo of todos) {
      if (todo.category) {
        categoryByTitle.set(todo.title, todo.category);
      }
    }

    // アーカイブされたタスク（タイトルでカテゴリを照合、なければ未分類）
    for (const archived of archivedTodos) {
      const category: string = categoryByTitle.get(archived.title) || '未分類';
      result.push({
        id: archived.id,
        title: archived.title,
        category: category,
        actualMin: archived.actualMin,
        estMin: archived.estMin,
        completedAt: archived.archivedAt,
      });
    }

    return result;
  }, [todos, archivedTodos]);

  /** カテゴリ別集計 */
  const categoryStats: CategoryStat[] = useMemo(() => {
    const map: Map<string, CategoryStat> = new Map();

    for (const task of completedTasks) {
      const existing: CategoryStat | undefined = map.get(task.category);
      if (existing) {
        existing.taskCount += 1;
        existing.totalActualMin += task.actualMin;
        existing.totalEstMin += task.estMin;
      } else {
        map.set(task.category, {
          category: task.category,
          taskCount: 1,
          totalActualMin: task.actualMin,
          totalEstMin: task.estMin,
        });
      }
    }

    const stats: CategoryStat[] = Array.from(map.values());
    stats.sort((a, b) => {
      return b.taskCount - a.taskCount;
    });
    return stats;
  }, [completedTasks]);

  /** 全体の達成率（完了タスク / 全タスク） */
  const achievementRate: number = useMemo(() => {
    const totalTodos: number = todos.length + archivedTodos.length;
    if (totalTodos === 0) {
      return 0;
    }
    const doneCount: number = completedTasks.length;
    return Math.round((doneCount / totalTodos) * 100);
  }, [todos.length, archivedTodos.length, completedTasks.length]);

  /** 直近1ヶ月の達成タスク数 */
  const recentMonthCount: number = useMemo(() => {
    const oneMonthAgo: number = Date.now() - 30 * 24 * 60 * 60 * 1000;
    let count: number = 0;
    for (const task of completedTasks) {
      if (task.completedAt >= oneMonthAgo) {
        count += 1;
      }
    }
    return count;
  }, [completedTasks]);

  /** 直近12ヶ月の月別達成数 */
  const monthlyStats: MonthlyStat[] = useMemo(() => {
    const now: Date = new Date();
    const months: MonthlyStat[] = [];

    // 直近12ヶ月分のラベルを作成
    for (let i = 11; i >= 0; i--) {
      const d: Date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        label: toMonthLabel(d),
        count: 0,
      });
    }

    // 各完了タスクを月別に集計
    for (const task of completedTasks) {
      if (task.completedAt <= 0) {
        continue;
      }
      const taskMonth: string = toMonthLabel(new Date(task.completedAt));
      const found: MonthlyStat | undefined = months.find((m) => {
        return m.label === taskMonth;
      });
      if (found) {
        found.count += 1;
      }
    }

    return months;
  }, [completedTasks]);

  /** 月別棒グラフの最大値 */
  const maxMonthlyCount: number = useMemo(() => {
    let max: number = 0;
    for (const stat of monthlyStats) {
      if (stat.count > max) {
        max = stat.count;
      }
    }
    return Math.max(max, 1);
  }, [monthlyStats]);

  if (loading) {
    return (
      <div className={styles.categoryStatsPanel}>
        <p style={{ textAlign: 'center', padding: '40px 0', color: '#888' }}>
          読み込み中...
        </p>
      </div>
    );
  }

  return (
    <div className={styles.categoryStatsPanel}>
      {/* 全体サマリー */}
      <div className={styles.catStatsSummary}>
        <div className={styles.catStatsSummaryItem}>
          <span className={styles.catStatsSummaryLabel}>全体達成率</span>
          <span className={styles.catStatsSummaryValue}>{achievementRate}%</span>
        </div>
        <div className={styles.catStatsSummaryItem}>
          <span className={styles.catStatsSummaryLabel}>達成タスク総数</span>
          <span className={styles.catStatsSummaryValue}>{completedTasks.length}件</span>
        </div>
        <div className={styles.catStatsSummaryItem}>
          <span className={styles.catStatsSummaryLabel}>直近1ヶ月</span>
          <span className={styles.catStatsSummaryValue}>{recentMonthCount}件</span>
        </div>
      </div>

      {/* カテゴリ別集計 */}
      <h3 className={styles.catStatsSectionTitle}>カテゴリ別実績</h3>
      {categoryStats.length === 0 ? (
        <p style={{ color: '#888', textAlign: 'center', padding: '20px 0' }}>
          完了タスクがありません
        </p>
      ) : (
        <div className={styles.catStatsList}>
          {categoryStats.map((stat: CategoryStat) => {
            return (
              <div key={stat.category} className={styles.catStatsCard}>
                <div className={styles.catStatsCardHeader}>
                  <span className={styles.catStatsCategory}>{stat.category}</span>
                  <span className={styles.catStatsCount}>{stat.taskCount}件</span>
                </div>
                <div className={styles.catStatsCardBody}>
                  <div className={styles.catStatsMetric}>
                    <span className={styles.catStatsMetricLabel}>合計作業時間</span>
                    <span className={styles.catStatsMetricValue}>
                      {minutesToText(stat.totalActualMin)}
                    </span>
                  </div>
                  <div className={styles.catStatsMetric}>
                    <span className={styles.catStatsMetricLabel}>予定時間</span>
                    <span className={styles.catStatsMetricValue}>
                      {minutesToText(stat.totalEstMin)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 月別達成数の棒グラフ */}
      <h3 className={styles.catStatsSectionTitle}>月別達成タスク数（直近12ヶ月）</h3>
      <div className={styles.catStatsChart}>
        <div className={styles.catStatsChartBars}>
          {monthlyStats.map((stat: MonthlyStat) => {
            const heightPercent: number = (stat.count / maxMonthlyCount) * 100;
            return (
              <div key={stat.label} className={styles.catStatsChartBarWrapper}>
                <span className={styles.catStatsChartBarCount}>
                  {stat.count > 0 ? stat.count : ''}
                </span>
                <div
                  className={styles.catStatsChartBar}
                  style={{ height: `${heightPercent}%` }}
                />
                <span className={styles.catStatsChartBarLabel}>
                  {stat.label.slice(5)}月
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
