'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AppUser } from './types';
import { minutesToText } from './utils';
import styles from './page.module.css';

/** 見積もり精度データ */
interface EstimationItem {
  title: string;
  estMin: number;
  actualMin: number;
  ratio: number;
}

/** 週次データ */
interface WeeklyData {
  weekLabel: string;
  startDate: string;
  endDate: string;
  workedMin: number;
  completedCount: number;
  logCount: number;
}

/** バーンダウンデータ */
interface BurndownPoint {
  date: string;
  remaining: number;
  completed: number;
}

/**
 * 分析パネル: 見積もり精度・バーンダウンチャート・週次レビュー
 */
export default function AnalyticsPanel({ user }: { user: AppUser }): React.ReactElement {
  const [viewMode, setViewMode] = useState<'estimation' | 'burndown' | 'weekly'>('estimation');
  const [loading, setLoading] = useState<boolean>(true);
  const [estimationData, setEstimationData] = useState<EstimationItem[]>([]);
  const [avgRatio, setAvgRatio] = useState<number>(1);
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [burndownData, setBurndownData] = useState<BurndownPoint[]>([]);

  const fetchData = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res: Response = await fetch('/api/analytics?userId=' + user.id);
      const data: {
        estimation: EstimationItem[];
        avgRatio: number;
        weekly: WeeklyData[];
        burndown: BurndownPoint[];
      } = await res.json();
      setEstimationData(data.estimation ?? []);
      setAvgRatio(data.avgRatio ?? 1);
      setWeeklyData(data.weekly ?? []);
      setBurndownData(data.burndown ?? []);
    } catch (e) {
      console.warn('Failed to fetch analytics', e);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className={styles.diaryPanel}>
      {/* ビュー切替 */}
      <div className={styles.helpModeBar} style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={`${styles.viewModeBtn} ${viewMode === 'estimation' ? styles.viewModeBtnActive : ''}`}
          onClick={() => setViewMode('estimation')}
        >
          見積もり精度
        </button>
        <button
          type="button"
          className={`${styles.viewModeBtn} ${viewMode === 'burndown' ? styles.viewModeBtnActive : ''}`}
          onClick={() => setViewMode('burndown')}
        >
          バーンダウン
        </button>
        <button
          type="button"
          className={`${styles.viewModeBtn} ${viewMode === 'weekly' ? styles.viewModeBtnActive : ''}`}
          onClick={() => setViewMode('weekly')}
        >
          週次レビュー
        </button>
      </div>

      {loading && <p className={styles.diaryEmpty}>読み込み中...</p>}

      {/* 見積もり精度 */}
      {!loading && viewMode === 'estimation' && (
        <div>
          {/* サマリー */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20,
            padding: 16, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12,
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>平均精度</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: Math.abs(avgRatio - 1) < 0.2 ? '#22c55e' : '#f59e0b' }}>
                {Math.round(avgRatio * 100)}%
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>傾向</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: avgRatio > 1.2 ? '#ef4444' : avgRatio < 0.8 ? '#3b82f6' : '#22c55e' }}>
                {avgRatio > 1.2 ? '過少見積もり' : avgRatio < 0.8 ? '過大見積もり' : '適正'}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>対象タスク</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--foreground)' }}>{estimationData.length}件</div>
            </div>
          </div>

          {estimationData.length === 0 ? (
            <p className={styles.diaryEmpty}>予定時間と実績時間の両方があるタスクがありません</p>
          ) : (
            <div className={styles.statsTable}>
              <div className={styles.statsHeaderRow} style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 2fr' }}>
                <span className={styles.statsHeaderCell}>タスク</span>
                <span className={styles.statsHeaderCell}>予定</span>
                <span className={styles.statsHeaderCell}>実績</span>
                <span className={styles.statsHeaderCell}>精度</span>
                <span className={styles.statsHeaderCell}>乖離</span>
              </div>
              {estimationData.map((item: EstimationItem, i: number) => {
                const ratioPercent: number = Math.round(item.ratio * 100);
                const diff: number = item.actualMin - item.estMin;
                const barWidth: number = Math.min(100, Math.abs(diff) / Math.max(item.estMin, 1) * 100);
                const isOver: boolean = diff > 0;
                return (
                  <div
                    key={item.title + i}
                    className={styles.statsRow}
                    style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 2fr' }}
                  >
                    <span className={styles.statsCell} style={{ textAlign: 'left' }}>{item.title}</span>
                    <span className={styles.statsCell}>{minutesToText(item.estMin)}</span>
                    <span className={styles.statsCell}>{minutesToText(item.actualMin)}</span>
                    <span className={styles.statsCell} style={{ color: Math.abs(item.ratio - 1) < 0.2 ? '#22c55e' : '#f59e0b', fontWeight: 600 }}>
                      {ratioPercent}%
                    </span>
                    <span className={styles.statsCell} style={{ padding: '8px 4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{
                          height: 12, borderRadius: 3,
                          width: `${Math.max(4, barWidth)}%`,
                          background: isOver ? '#ef4444' : '#3b82f6',
                        }} />
                        <span style={{ fontSize: 11, color: isOver ? '#ef4444' : '#3b82f6' }}>
                          {isOver ? '+' : ''}{diff}分
                        </span>
                      </div>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* バーンダウンチャート */}
      {!loading && viewMode === 'burndown' && (
        <div>
          {burndownData.length === 0 ? (
            <p className={styles.diaryEmpty}>データがありません</p>
          ) : (() => {
            const maxVal: number = Math.max(...burndownData.map((d) => d.remaining + d.completed), 1);
            const svgW: number = 800;
            const svgH: number = 300;
            const padL: number = 50;
            const padR: number = 10;
            const padT: number = 20;
            const padB: number = 40;
            const chartW: number = svgW - padL - padR;
            const chartH: number = svgH - padT - padB;
            const data: BurndownPoint[] = burndownData;

            function toX(i: number): number {
              return padL + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2);
            }
            function toY(v: number): number {
              return padT + chartH - (v / maxVal) * chartH;
            }

            const remainingPath: string = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(d.remaining)}`).join(' ');
            const completedPath: string = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(d.completed)}`).join(' ');

            return (
              <div>
                <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 13 }}>
                  <span><span style={{ color: '#ef4444', fontWeight: 600 }}>―</span> 残タスク数</span>
                  <span><span style={{ color: '#22c55e', fontWeight: 600 }}>―</span> 累計完了数</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', maxWidth: svgW, height: 'auto' }}>
                    {/* グリッド */}
                    {[0, 1, 2, 3, 4].map((i) => {
                      const y: number = toY((maxVal / 4) * i);
                      return (
                        <g key={i}>
                          <line x1={padL} y1={y} x2={svgW - padR} y2={y} stroke="#e5e7eb" />
                          <text x={padL - 5} y={y + 4} textAnchor="end" fontSize="10" fill="#6b7280">
                            {Math.round((maxVal / 4) * i)}
                          </text>
                        </g>
                      );
                    })}
                    {/* 残タスクライン */}
                    {data.length > 1 && <path d={remainingPath} fill="none" stroke="#ef4444" strokeWidth="2" />}
                    {data.map((d, i) => (
                      <circle key={'r-' + d.date} cx={toX(i)} cy={toY(d.remaining)} r={3} fill="#ef4444" />
                    ))}
                    {/* 完了ライン */}
                    {data.length > 1 && <path d={completedPath} fill="none" stroke="#22c55e" strokeWidth="2" />}
                    {data.map((d, i) => (
                      <circle key={'c-' + d.date} cx={toX(i)} cy={toY(d.completed)} r={3} fill="#22c55e" />
                    ))}
                    {/* X軸ラベル */}
                    {data.map((d, i) => {
                      if (data.length > 15 && i % Math.ceil(data.length / 10) !== 0) {
                        return null;
                      }
                      return (
                        <text key={d.date} x={toX(i)} y={svgH - 10} textAnchor="middle" fontSize="9" fill="#6b7280">
                          {d.date.slice(5)}
                        </text>
                      );
                    })}
                  </svg>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* 週次レビュー */}
      {!loading && viewMode === 'weekly' && (
        <div>
          {weeklyData.length === 0 ? (
            <p className={styles.diaryEmpty}>データがありません</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {weeklyData.map((week: WeeklyData) => (
                <div
                  key={week.weekLabel}
                  style={{
                    padding: '14px 18px', borderRadius: 10,
                    background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{week.weekLabel}</h4>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{week.startDate} 〜 {week.endDate}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>作業時間</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#3b82f6' }}>{minutesToText(week.workedMin)}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>完了タスク</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#22c55e' }}>{week.completedCount}件</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>作業ログ</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b' }}>{week.logCount}件</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
