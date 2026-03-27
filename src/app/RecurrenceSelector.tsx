'use client';

import { useState } from 'react';
import styles from './page.module.css';

/** 曜日のキーと日本語名 */
const DAY_KEYS: string[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_NAMES: string[] = ['日', '月', '火', '水', '木', '金', '土'];

/**
 * 繰り返し設定の選択UIコンポーネント
 * 新規作成・タスク編集・繰り返しタスク一覧で共通利用する
 */
export default function RecurrenceSelector({
  value,
  onChange,
  onSave,
  showSaveButton,
}: {
  value: string;
  onChange: (newValue: string) => void;
  onSave?: () => void;
  showSaveButton?: boolean;
}): React.ReactElement {
  const todayDayIndex: number = new Date().getDay();
  const todayDayKey: string = DAY_KEYS[todayDayIndex];
  const todayDayName: string = DAY_NAMES[todayDayIndex];

  const [customMode, setCustomMode] = useState<boolean>(value === 'custom' || value.startsWith('custom:'));
  const [customInterval, setCustomInterval] = useState<string>(() => {
    if (value.startsWith('custom:')) {
      return value.split(':')[1] || '1';
    }
    return '1';
  });
  const [customUnit, setCustomUnit] = useState<string>(() => {
    if (value.startsWith('custom:')) {
      return value.split(':')[2] || 'week';
    }
    return 'week';
  });
  const [customWeekDays, setCustomWeekDays] = useState<string[]>(() => {
    if (value.startsWith('custom:')) {
      const parts: string[] = value.split(':');
      if (parts[2] === 'week' && parts[3]) {
        return parts[3].split(',');
      }
    }
    return ['mon'];
  });
  const [customMonthMode, setCustomMonthMode] = useState<'date' | 'weekday'>(() => {
    if (value.startsWith('custom:')) {
      const parts: string[] = value.split(':');
      if (parts[2] === 'month' && parts[3] === 'nth') {
        return 'weekday';
      }
    }
    return 'date';
  });
  const [customMonthDay, setCustomMonthDay] = useState<string>(() => {
    if (value.startsWith('custom:')) {
      const parts: string[] = value.split(':');
      if (parts[2] === 'month' && parts[3] === 'date') {
        return parts[4] || '1';
      }
    }
    return '1';
  });
  const [customMonthNth, setCustomMonthNth] = useState<string>(() => {
    if (value.startsWith('custom:')) {
      const parts: string[] = value.split(':');
      if (parts[2] === 'month' && parts[3] === 'nth') {
        return parts[4] || '1';
      }
    }
    return '1';
  });
  const [customMonthNthDay, setCustomMonthNthDay] = useState<string>(() => {
    if (value.startsWith('custom:')) {
      const parts: string[] = value.split(':');
      if (parts[2] === 'month' && parts[3] === 'nth') {
        return parts[5] || 'mon';
      }
    }
    return 'mon';
  });

  /** カスタム設定からrecurrence文字列をビルドする */
  function buildCustomRecurrence(): string {
    if (customUnit === 'day') {
      return `custom:${customInterval}:day`;
    }
    if (customUnit === 'week') {
      return `custom:${customInterval}:week:${customWeekDays.join(',')}`;
    }
    if (customUnit === 'month') {
      if (customMonthMode === 'date') {
        return `custom:${customInterval}:month:date:${customMonthDay}`;
      }
      return `custom:${customInterval}:month:nth:${customMonthNth}:${customMonthNthDay}`;
    }
    if (customUnit === 'year') {
      return `custom:${customInterval}:year`;
    }
    return 'carry';
  }

  return (
    <div>
      <select
        value={customMode ? 'custom' : value}
        onChange={(e) => {
          const v: string = e.target.value;
          if (v === 'custom') {
            setCustomMode(true);
          } else {
            setCustomMode(false);
            onChange(v);
          }
        }}
        className={styles.input}
      >
        <option value="carry">繰り返さない</option>
        <option value="day">毎日</option>
        <option value="week:weekday">毎週平日（月〜金）</option>
        <option value={`week:${todayDayKey}`}>毎週{todayDayName}曜日</option>
        <option value="month:same-date">毎月同じ日</option>
        <option value="year">毎年同じ日</option>
        <option value="custom">カスタム...</option>
      </select>

      {customMode && (
        <div style={{ display: 'grid', gap: 6, marginTop: 6, padding: 10, border: '1px solid var(--input-border)', borderRadius: 8, background: 'var(--background)' }}>
          {/* n ごと */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span>繰り返す間隔:</span>
            <input
              type="number"
              min="1"
              value={customInterval}
              onChange={(e) => setCustomInterval(e.target.value)}
              className={styles.inputNarrow}
              style={{ width: 50 }}
            />
            <select
              value={customUnit}
              onChange={(e) => setCustomUnit(e.target.value)}
              className={styles.input}
              style={{ width: 80 }}
            >
              <option value="day">日</option>
              <option value="week">週</option>
              <option value="month">月</option>
              <option value="year">年</option>
            </select>
            <span>ごと</span>
          </div>

          {/* 週の場合：曜日複数選択 */}
          {customUnit === 'week' && (
            <div>
              <label className={styles.fieldLabel}>曜日</label>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {[
                  { key: 'mon', label: '月' }, { key: 'tue', label: '火' }, { key: 'wed', label: '水' },
                  { key: 'thu', label: '木' }, { key: 'fri', label: '金' }, { key: 'sat', label: '土' }, { key: 'sun', label: '日' },
                ].map((d) => {
                  const selected: boolean = customWeekDays.includes(d.key);
                  return (
                    <button
                      key={d.key}
                      type="button"
                      className={selected ? styles.primaryBtn : styles.iconBtn}
                      style={{ width: 36, height: 36, padding: 0, fontSize: 13, borderRadius: '50%' }}
                      onClick={() => {
                        if (selected) {
                          if (customWeekDays.length > 1) {
                            setCustomWeekDays(customWeekDays.filter((k) => k !== d.key));
                          }
                        } else {
                          setCustomWeekDays([...customWeekDays, d.key]);
                        }
                      }}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 月の場合：毎月n日 or 第ny曜日 */}
          {customUnit === 'month' && (
            <div style={{ display: 'grid', gap: 8 }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                <input type="radio" checked={customMonthMode === 'date'} onChange={() => setCustomMonthMode('date')} />
                毎月
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={customMonthDay}
                  onChange={(e) => setCustomMonthDay(e.target.value)}
                  className={styles.inputNarrow}
                  style={{ width: 50 }}
                />
                日
              </label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer', flexWrap: 'wrap' }}>
                <input type="radio" checked={customMonthMode === 'weekday'} onChange={() => setCustomMonthMode('weekday')} />
                第
                <select value={customMonthNth} onChange={(e) => setCustomMonthNth(e.target.value)} className={styles.input} style={{ width: 55 }}>
                  <option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option>
                </select>
                <select value={customMonthNthDay} onChange={(e) => setCustomMonthNthDay(e.target.value)} className={styles.input} style={{ width: 90 }}>
                  <option value="mon">月曜日</option><option value="tue">火曜日</option><option value="wed">水曜日</option>
                  <option value="thu">木曜日</option><option value="fri">金曜日</option><option value="sat">土曜日</option><option value="sun">日曜日</option>
                </select>
              </label>
            </div>
          )}

          {showSaveButton !== false && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                type="button"
                className={styles.primaryBtn}
                style={{ fontSize: '14px', padding: '6px 14px' }}
                onClick={() => {
                  const built: string = buildCustomRecurrence();
                  onChange(built);
                  if (onSave) {
                    onSave();
                  }
                }}
              >
                保存
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
