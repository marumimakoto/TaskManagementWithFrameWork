'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppUser } from './types';
import { minutesToText } from './utils';
import { useIsMobile } from './useIsMobile';
import { Pagination } from './SharedComponents';
import styles from './page.module.css';

/** 統一アクティビティエントリ */
interface ActivityEntry {
  id: string;
  type: 'work_log' | 'created' | 'completed' | 'deleted';
  title: string;
  content: string;
  date: string;
  timestamp: number;
}

/** 日別統計 */
interface DailyStat {
  date: string;
  workLogs: number;
  created: number;
  completed: number;
  deleted: number;
  workedMin: number;
}

/** パレート分析用のタスク別実績 */
interface ParetoItem {
  title: string;
  actualMin: number;
}

/** 種別ごとのラベルと色 */
const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  work_log: { label: '作業ログ', color: '#3b82f6' },
  completed: { label: '完了', color: '#a855f7' },
};

/**
 * 作業記録一覧パネル
 * 一覧モードと統計モードを切り替えて表示できる
 */
export default function ActivityPanel({ user, isPro, onShowProModal }: { user: AppUser; isPro?: boolean; onShowProModal?: () => void }): React.ReactElement {
  const isMobile: boolean = useIsMobile();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [categoryData, setCategoryData] = useState<{ category: string; totalMin: number }[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [paretoData, setParetoData] = useState<ParetoItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [viewMode, setViewMode] = useState<'list' | 'stats' | 'chart' | 'pareto'>('list');
  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set(['work_log', 'completed']));
  const [currentPage, setCurrentPage] = useState<number>(1);
  const PAGE_SIZE: number = 20;

  /** アクティビティを取得する */
  const fetchEntries = useCallback(async (from?: string, to?: string): Promise<void> => {
    setLoading(true);
    try {
      let url: string = '/api/activity?userId=' + user.id;
      if (from) {
        url += '&from=' + from;
      }
      if (to) {
        url += '&to=' + to;
      }
      const res: Response = await fetch(url);
      const data: { entries: ActivityEntry[]; dailyStats: DailyStat[]; paretoData: ParetoItem[] } = await res.json();
      setEntries(data.entries ?? []);
      setDailyStats(data.dailyStats ?? []);
      setParetoData(data.paretoData ?? []);

      // カテゴリ別実績を集計（todosとアーカイブから）
      try {
        const [todosRes, archiveRes] = await Promise.all([
          fetch('/api/todos?userId=' + user.id),
          fetch('/api/todos/archive?userId=' + user.id),
        ]);
        const todos = await todosRes.json();
        const archived = await archiveRes.json();
        const catMap: Map<string, number> = new Map();
        for (const t of [...todos, ...archived]) {
          const cat: string = t.category || '未分類';
          catMap.set(cat, (catMap.get(cat) ?? 0) + (t.actualMin ?? 0));
        }
        const catData: { category: string; totalMin: number }[] = [...catMap.entries()]
          .map(([category, totalMin]) => ({ category, totalMin }))
          .filter((d) => d.totalMin > 0)
          .sort((a, b) => b.totalMin - a.totalMin);
        setCategoryData(catData);
      } catch { /* ignore */ }
    } catch (e) {
      console.warn('Failed to fetch activity', e);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  /** 期間フィルターを適用する */
  function applyFilter(): void {
    fetchEntries(fromDate || undefined, toDate || undefined);
  }

  /** フィルターをクリアする */
  function clearFilter(): void {
    setFromDate('');
    setToDate('');
    fetchEntries();
  }

  /** 日付ごとにエントリをグループ化する */
  function groupByDate(items: ActivityEntry[]): { date: string; items: ActivityEntry[] }[] {
    const map: Map<string, ActivityEntry[]> = new Map();
    for (const entry of items) {
      const existing: ActivityEntry[] | undefined = map.get(entry.date);
      if (existing) {
        existing.push(entry);
      } else {
        map.set(entry.date, [entry]);
      }
    }
    const result: { date: string; items: ActivityEntry[] }[] = [];
    for (const [date, groupItems] of map) {
      result.push({ date, items: groupItems });
    }
    return result;
  }

  /** 種別フィルターを切り替える */
  function toggleTypeFilter(type: string): void {
    setTypeFilter((prev) => {
      const next: Set<string> = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  // フィルター適用後のエントリ
  const filteredEntries: ActivityEntry[] = entries.filter((e) => typeFilter.has(e.type));
  const grouped: { date: string; items: ActivityEntry[] }[] = groupByDate(filteredEntries);

  // ページネーション（エントリ単位で20件ずつ）
  const totalEntries: number = filteredEntries.length;
  const totalPages: number = Math.max(1, Math.ceil(totalEntries / PAGE_SIZE));
  const pagedEntries: ActivityEntry[] = filteredEntries.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pagedGrouped: { date: string; items: ActivityEntry[] }[] = groupByDate(pagedEntries);

  // フィルター適用後の統計
  const filteredStats: DailyStat[] = dailyStats.map((stat: DailyStat): DailyStat => ({
    date: stat.date,
    workLogs: typeFilter.has('work_log') ? stat.workLogs : 0,
    created: typeFilter.has('created') ? stat.created : 0,
    completed: typeFilter.has('completed') ? stat.completed : 0,
    deleted: typeFilter.has('deleted') ? stat.deleted : 0,
    workedMin: stat.workedMin,
  })).filter((stat: DailyStat): boolean => {
    return stat.workLogs > 0 || stat.created > 0 || stat.completed > 0 || stat.deleted > 0 || stat.workedMin > 0;
  });

  // チャート用データ（日付昇順）
  const chartData: DailyStat[] = [...filteredStats].reverse();

  /** Canvasに折れ線グラフを描画する */
  useEffect(() => {
    if (viewMode !== 'chart' || !chartCanvasRef.current || chartData.length === 0) {
      return;
    }
    const canvas: HTMLCanvasElement = chartCanvasRef.current;
    const ctx: CanvasRenderingContext2D | null = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const dpr: number = window.devicePixelRatio || 1;
    const rect: DOMRect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w: number = rect.width;
    const h: number = rect.height;
    const padLeft: number = 60;
    const padRight: number = 20;
    const padTop: number = 30;
    const padBottom: number = 50;
    const chartW: number = w - padLeft - padRight;
    const chartH: number = h - padTop - padBottom;

    // 背景クリア
    ctx.clearRect(0, 0, w, h);

    const values: number[] = chartData.map((d) => d.workedMin);
    const maxVal: number = Math.max(...values, 30);
    const stepCount: number = Math.min(5, maxVal);

    // Y軸グリッド線と目盛り
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#6b7280';
    ctx.font = '11px system-ui';
    ctx.textAlign = 'right';
    for (let i: number = 0; i <= stepCount; i++) {
      const val: number = Math.round((maxVal / stepCount) * i);
      const y: number = padTop + chartH - (val / maxVal) * chartH;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(w - padRight, y);
      ctx.stroke();
      ctx.fillText(val + '分', padLeft - 8, y + 4);
    }

    if (chartData.length === 1) {
      // 1点の場合は点だけ描画
      const x: number = padLeft + chartW / 2;
      const y: number = padTop + chartH - (values[0] / maxVal) * chartH;
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      // X軸ラベル
      ctx.fillStyle = '#6b7280';
      ctx.font = '10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(chartData[0].date.slice(5), x, h - padBottom + 16);
      // 値ラベル
      ctx.fillStyle = '#3b82f6';
      ctx.font = '12px system-ui';
      ctx.fillText(values[0] + '分', x, y - 10);
    } else {
      // 折れ線
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i: number = 0; i < chartData.length; i++) {
        const x: number = padLeft + (i / (chartData.length - 1)) * chartW;
        const y: number = padTop + chartH - (values[i] / maxVal) * chartH;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // 点と値ラベル
      for (let i: number = 0; i < chartData.length; i++) {
        const x: number = padLeft + (i / (chartData.length - 1)) * chartW;
        const y: number = padTop + chartH - (values[i] / maxVal) * chartH;

        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();

        // 値ラベル
        ctx.fillStyle = '#3b82f6';
        ctx.font = '11px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(values[i] + '分', x, y - 10);

        // X軸ラベル（日付が多い場合は間引き）
        const showLabel: boolean = chartData.length <= 10 || i % Math.ceil(chartData.length / 10) === 0 || i === chartData.length - 1;
        if (showLabel) {
          ctx.fillStyle = '#6b7280';
          ctx.font = '10px system-ui';
          ctx.save();
          ctx.translate(x, h - padBottom + 14);
          ctx.rotate(-0.4);
          ctx.textAlign = 'right';
          ctx.fillText(chartData[i].date.slice(5), 0, 0);
          ctx.restore();
        }
      }
    }

    // タイトル
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 13px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('日別作業時間（分）', padLeft, 18);
  }, [viewMode, chartData]);

  return (
    <div className={styles.diaryPanel}>
      {/* 期間フィルター + 表示モード切替 */}
      <section className={styles.diaryForm}>
        <div className={styles.activityTopRow}>
          <div>
            <label className={styles.fieldLabel}>期間で絞り込み（任意）</label>
            <div className={styles.activityFilterRow}>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className={styles.input}
                style={{ maxWidth: 180 }}
              />
              <span className={styles.activityFilterSep}>〜</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className={styles.input}
                style={{ maxWidth: 180 }}
              />
              <button
                type="button"
                onClick={applyFilter}
                className={styles.primaryBtn}
                style={{ fontSize: '13px', padding: '6px 14px' }}
              >
                絞り込み
              </button>
              {(fromDate || toDate) && (
                <button
                  type="button"
                  onClick={clearFilter}
                  className={styles.iconBtn}
                >
                  クリア
                </button>
              )}
            </div>
          </div>
          <div className={styles.viewModeButtons}>
            <button
              type="button"
              className={`${styles.viewModeBtn} ${viewMode === 'list' ? styles.viewModeBtnActive : ''}`}
              onClick={() => setViewMode('list')}
              title="一覧表示"
            >
              ☰
            </button>
            <button
              type="button"
              className={`${styles.viewModeBtn} ${viewMode === 'stats' ? styles.viewModeBtnActive : ''}`}
              onClick={() => setViewMode('stats')}
              title="統計表示"
            >
              📊
            </button>
            <button
              type="button"
              className={`${styles.viewModeBtn} ${viewMode === 'chart' ? styles.viewModeBtnActive : ''}`}
              onClick={() => setViewMode('chart')}
              title="グラフ表示"
            >
              📈
            </button>
            <button
              type="button"
              className={`${styles.viewModeBtn} ${viewMode === 'pareto' ? styles.viewModeBtnActive : ''}`}
              onClick={() => {
                if (!isPro) {
                  if (onShowProModal) {
                    onShowProModal();
                  }
                  return;
                }
                setViewMode('pareto');
              }}
              title="パレート分析"
            >
              📐 {!isPro && '🔒'}
            </button>
          </div>
        </div>
        {viewMode !== 'chart' && <div className={styles.activityTypeFilterRow}>
          {(['work_log', 'completed'] as const).map((type) => {
            const config = TYPE_CONFIG[type];
            const isActive: boolean = typeFilter.has(type);
            return (
              <button
                key={type}
                type="button"
                className={styles.activityTypeFilterBtn}
                style={{
                  background: isActive ? config.color : 'transparent',
                  color: isActive ? '#ffffff' : config.color,
                  borderColor: config.color,
                }}
                onClick={() => toggleTypeFilter(type)}
              >
                {config.label}
              </button>
            );
          })}
        </div>}
      </section>

      {/* エクスポートボタン（PC版のみ） */}
      {!isMobile && filteredEntries.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button
            type="button"
            className={styles.iconBtn}
            style={{ fontSize: 13 }}
            onClick={() => {
              const lines: string[] = filteredEntries.map((entry: ActivityEntry) => {
                return `${entry.date}\t${entry.title}\t${entry.content}`;
              });
              const txt: string = lines.join('\n');
              const blob: Blob = new Blob([txt], { type: 'text/plain' });
              const url: string = URL.createObjectURL(blob);
              const a: HTMLAnchorElement = document.createElement('a');
              a.href = url;
              a.download = 'activity-log.txt';
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            エクスポート（TXT）
          </button>
        </div>
      )}

      {loading && <p className={styles.diaryEmpty}>読み込み中...</p>}

      {/* 一覧モード */}
      {!loading && viewMode === 'list' && (
        <>
          {filteredEntries.length === 0 && (
            <p className={styles.diaryEmpty}>作業記録はまだありません</p>
          )}
          {pagedGrouped.length > 0 && (
            <section className={styles.activityList}>
              {pagedGrouped.map((group: { date: string; items: ActivityEntry[] }) => (
                <div key={group.date} className={styles.activityDateGroup}>
                  <h3 className={styles.activityDateHeader}>{group.date}</h3>
                  <div className={styles.activityDateItems}>
                    {group.items.map((entry: ActivityEntry) => {
                      const config = TYPE_CONFIG[entry.type] ?? { label: entry.type, color: '#6b7280' };
                      return (
                        <div key={entry.id} className={styles.activityItem}>
                          <div className={styles.activityItemHeader}>
                            <span
                              className={styles.activityTypeBadge}
                              style={{ background: config.color }}
                            >
                              {config.label}
                            </span>
                            <span className={styles.activityTaskTitle}>{entry.title}</span>
                          </div>
                          <p className={styles.activityContent}>{entry.content}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* ページネーション */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalEntries}
            onPrevious={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            onNext={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
          />
        </>
      )}

      {/* 統計モード */}
      {!loading && viewMode === 'stats' && (
        <>
          {filteredStats.length === 0 && (
            <p className={styles.diaryEmpty}>統計データがありません</p>
          )}
          {filteredStats.length > 0 && (
            <section className={styles.activityList}>
              <div className={styles.statsTable}>
                <div className={styles.statsHeaderRow}>
                  <span className={styles.statsHeaderCell}>日付</span>
                  <span className={styles.statsHeaderCell}>作業ログ</span>
                  <span className={styles.statsHeaderCell}>完了</span>
                  <span className={styles.statsHeaderCell}>作業時間</span>
                </div>
                {filteredStats.map((stat: DailyStat) => (
                  <div key={stat.date} className={styles.statsRow}>
                    <span className={styles.statsCell}>{stat.date}</span>
                    <span className={styles.statsCell}>
                      {stat.workLogs > 0 ? stat.workLogs : '-'}
                    </span>
                    <span className={styles.statsCell}>
                      {stat.completed > 0 ? stat.completed : '-'}
                    </span>
                    <span className={styles.statsCell}>
                      {stat.workedMin > 0 ? minutesToText(stat.workedMin) : '-'}
                    </span>
                  </div>
                ))}
                {/* 合計行 */}
                <div className={`${styles.statsRow} ${styles.statsTotalRow}`}>
                  <span className={styles.statsCell}>合計</span>
                  <span className={styles.statsCell}>
                    {filteredStats.reduce((sum, s) => sum + s.workLogs, 0)}
                  </span>
                  <span className={styles.statsCell}>
                    {filteredStats.reduce((sum, s) => sum + s.completed, 0)}
                  </span>
                  <span className={styles.statsCell}>
                    {minutesToText(filteredStats.reduce((sum, s) => sum + s.workedMin, 0))}
                  </span>
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {/* グラフモード */}
      {!loading && viewMode === 'chart' && (
        <>
          {categoryData.length === 0 && (
            <p className={styles.diaryEmpty}>カテゴリ別のデータがありません</p>
          )}
          {categoryData.length > 0 && (() => {
            const COLORS: string[] = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#ec4899', '#6b7280'];
            const maxMin: number = Math.max(...categoryData.map((d) => d.totalMin), 1);
            const totalMin: number = categoryData.reduce((sum, d) => sum + d.totalMin, 0);
            return (
              <div>
                <div style={{ marginBottom: 12, padding: 12, background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--card-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>合計作業時間</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#3b82f6' }}>{minutesToText(totalMin)}</div>
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {categoryData.map((d, i) => {
                    const barWidth: number = (d.totalMin / maxMin) * 100;
                    const color: string = COLORS[i % COLORS.length];
                    return (
                      <div key={d.category} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 70, fontSize: 13, fontWeight: 600, textAlign: 'right', flexShrink: 0 }}>{d.category}</span>
                        <div style={{ flex: 1, height: 24, background: 'var(--input-border)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${barWidth}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.5s ease' }} />
                        </div>
                        <span style={{ width: 70, fontSize: 12, color: 'var(--muted)', flexShrink: 0 }}>{minutesToText(d.totalMin)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </>
      )}

      {/* パレート分析モード */}
      {!loading && viewMode === 'pareto' && (
        <>
          {paretoData.length === 0 && (
            <p className={styles.diaryEmpty}>実績データがありません</p>
          )}
          {paretoData.length > 0 && (() => {
            const totalMin: number = paretoData.reduce((sum, item) => sum + item.actualMin, 0);
            // 累積%を計算
            let cumulative: number = 0;
            const rows: { title: string; actualMin: number; percent: number; cumPercent: number }[] = paretoData.map((item) => {
              const percent: number = totalMin > 0 ? (item.actualMin / totalMin) * 100 : 0;
              cumulative += percent;
              return { title: item.title, actualMin: item.actualMin, percent, cumPercent: cumulative };
            });
            // 上位20%が何件目までか
            const top20Count: number = Math.max(1, Math.ceil(rows.length * 0.2));
            const top20Min: number = rows.slice(0, top20Count).reduce((sum, r) => sum + r.actualMin, 0);
            const top20Percent: number = totalMin > 0 ? (top20Min / totalMin) * 100 : 0;

            return (
              <>
                {/* サマリー */}
                <div className={styles.archiveCard} style={{ marginBottom: 12 }}>
                  <div className={styles.archiveCardMain}>
                    <span className={styles.activityTypeBadge} style={{ background: '#a855f7' }}>
                      パレートの法則
                    </span>
                    <span style={{ fontSize: 14, color: 'var(--foreground)' }}>
                      上位 {top20Count}件（{Math.round(top20Percent)}%の時間）が全{rows.length}タスクの上位20%
                    </span>
                  </div>
                  <p className={styles.activityContent}>
                    合計作業時間: {minutesToText(totalMin)} / 上位20%の作業時間: {minutesToText(top20Min)}
                  </p>
                </div>

                {/* 横棒グラフ + テーブル */}
                <div className={styles.statsTable}>
                  <div className={styles.statsHeaderRow} style={{ gridTemplateColumns: '2fr 1fr 3fr 0.8fr 0.8fr' }}>
                    <span className={styles.statsHeaderCell}>タスク</span>
                    <span className={styles.statsHeaderCell}>実績</span>
                    <span className={styles.statsHeaderCell}>割合</span>
                    <span className={styles.statsHeaderCell}>%</span>
                    <span className={styles.statsHeaderCell}>累積%</span>
                  </div>
                  {rows.map((row, i: number) => {
                    const isTop20: boolean = i < top20Count;
                    return (
                      <div
                        key={row.title + i}
                        className={styles.statsRow}
                        style={{
                          gridTemplateColumns: '2fr 1fr 3fr 0.8fr 0.8fr',
                          background: isTop20 ? 'rgba(168, 85, 247, 0.06)' : undefined,
                        }}
                      >
                        <span className={styles.statsCell} style={{ textAlign: 'left', fontWeight: isTop20 ? 600 : 400 }}>
                          {isTop20 ? '★ ' : ''}{row.title}
                        </span>
                        <span className={styles.statsCell}>
                          {minutesToText(row.actualMin)}
                        </span>
                        <span className={styles.statsCell} style={{ padding: '8px 4px' }}>
                          <div style={{
                            height: 16,
                            borderRadius: 4,
                            background: isTop20 ? '#a855f7' : '#d1d5db',
                            width: `${Math.max(2, row.percent)}%`,
                            transition: 'width 0.3s ease',
                          }} />
                        </span>
                        <span className={styles.statsCell}>
                          {Math.round(row.percent)}%
                        </span>
                        <span className={styles.statsCell} style={{ fontWeight: row.cumPercent >= 80 && rows[Math.max(0, i - 1)]?.cumPercent < 80 ? 700 : 400 }}>
                          {Math.round(row.cumPercent)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </>
      )}
    </div>
  );
}
