'use client';

import { useEffect, useRef, useState } from 'react';
import type { Todo } from './types';
import { minutesToText } from './utils';
import styles from './page.module.css';

type Phase = 'work' | 'break';

/**
 * ポモドーロタイマー（全画面表示）
 * @param todo - 対象タスク
 * @param onClose - 閉じるコールバック
 * @param onAddMinutes - 実績追加コールバック（分）
 * @param workMinutes - 作業時間（分）デフォルト25
 * @param breakMinutes - 休憩時間（分）デフォルト5
 */
export default function PomodoroTimer({
  todo,
  onClose,
  onAddMinutes,
  workMinutes = 25,
  breakMinutes = 5,
}: {
  todo: Todo;
  onClose: () => void;
  onAddMinutes: (minutes: number) => void;
  workMinutes?: number;
  breakMinutes?: number;
}): React.ReactElement {
  const WORK_SECONDS: number = workMinutes * 60;
  const BREAK_SECONDS: number = breakMinutes * 60;
  const [phase, setPhase] = useState<Phase>('work');
  const [secondsLeft, setSecondsLeft] = useState<number>(WORK_SECONDS);
  const [running, setRunning] = useState<boolean>(false);
  const [workElapsed, setWorkElapsed] = useState<number>(0);
  const [overtime, setOvertime] = useState<boolean>(false);
  const [overtimeSeconds, setOvertimeSeconds] = useState<number>(0);
  const intervalRef = useRef<number | null>(null);
  const alarmIntervalRef = useRef<number | null>(null);

  /** Web Audio APIでアラーム音を1回鳴らす */
  function playAlarmOnce(): void {
    try {
      const ctx: AudioContext = new AudioContext();
      const frequencies: number[] = phase === 'work'
        ? [523, 659, 784, 1047]
        : [1047, 784, 659, 523];
      frequencies.forEach((freq: number, i: number) => {
        const osc: OscillatorNode = ctx.createOscillator();
        const gain: GainNode = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.2);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.2 + 0.4);
        osc.start(ctx.currentTime + i * 0.2);
        osc.stop(ctx.currentTime + i * 0.2 + 0.4);
      });
    } catch {
      // AudioContextが使えない環境では無視
    }
  }

  /** アラームを繰り返し鳴らす（2秒間隔） */
  function startAlarmLoop(): void {
    if (alarmIntervalRef.current) {
      return;
    }
    playAlarmOnce();
    alarmIntervalRef.current = window.setInterval(() => {
      playAlarmOnce();
    }, 2000);
  }

  /** アラームを停止する */
  function stopAlarmLoop(): void {
    if (alarmIntervalRef.current) {
      window.clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
  }

  useEffect(() => {
    if (running) {
      intervalRef.current = window.setInterval(() => {
        // 作業フェーズのみ実績カウント（超過中も含む）
        if (phase === 'work') {
          setWorkElapsed((prev) => prev + 1);
        }
        if (overtime) {
          setOvertimeSeconds((prev) => prev + 1);
        } else {
          setSecondsLeft((prev) => {
            if (prev <= 1) {
              // 時間終了 → 超過モードに移行、アラーム開始
              setOvertime(true);
              setOvertimeSeconds(0);
              startAlarmLoop();
              return 0;
            }
            return prev - 1;
          });
        }
      }, 1000);
    }
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, [running, overtime, phase]);

  // コンポーネントアンマウント時にアラーム停止
  useEffect(() => {
    return () => {
      stopAlarmLoop();
    };
  }, []);

  /** 作業終了 → 休憩へ */
  function goToBreak(): void {
    stopAlarmLoop();
    setOvertime(false);
    setOvertimeSeconds(0);
    setPhase('break');
    setSecondsLeft(BREAK_SECONDS);
  }

  /** 休憩終了 → 作業へ */
  function goToWork(): void {
    stopAlarmLoop();
    setOvertime(false);
    setOvertimeSeconds(0);
    setPhase('work');
    setSecondsLeft(WORK_SECONDS);
  }

  /** 閉じるときに作業経過分を実績に加算（休憩は含まない） */
  function handleClose(): void {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
    }
    stopAlarmLoop();
    const minutes: number = Math.round(workElapsed / 60);
    if (minutes > 0) {
      onAddMinutes(minutes);
    }
    onClose();
  }

  const displaySeconds: number = overtime ? overtimeSeconds : secondsLeft;
  const min: number = Math.floor(displaySeconds / 60);
  const sec: number = displaySeconds % 60;
  const display: string = `${overtime ? '+' : ''}${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;

  const phaseLabel: string = overtime
    ? (phase === 'work' ? '⏰ 作業時間超過！' : '⏰ 休憩時間超過！')
    : (phase === 'work' ? '作業中' : '☕ 休憩中');

  const phaseColor: string = overtime
    ? '#ef4444'
    : (phase === 'work' ? '#3b82f6' : '#22c55e');

  return (
    <div className={styles.pomodoroOverlay}>
      <div className={styles.pomodoroContent}>
        <div className={styles.pomodoroPhase} style={overtime ? { color: '#ef4444', animation: 'pulse 1s infinite' } : { color: phaseColor }}>
          {phaseLabel}
        </div>
        <h2 className={styles.pomodoroTitle}>{todo.title}</h2>
        <p className={styles.pomodoroInfo}>
          予定 {minutesToText(todo.estMin)} / 実績 {minutesToText(todo.actualMin)}
        </p>
        <div className={styles.pomodoroTimer}>{display}</div>
        <div className={styles.pomodoroControls}>
          {overtime ? (
            phase === 'work' ? (
              <button type="button" onClick={goToBreak} className={styles.primaryBtn}>
                🔕 アラーム停止 → 休憩へ
              </button>
            ) : (
              <button type="button" onClick={goToWork} className={styles.primaryBtn}>
                🔕 アラーム停止 → 作業へ
              </button>
            )
          ) : !running ? (
            <button type="button" onClick={() => setRunning(true)} className={styles.primaryBtn}>
              スタート
            </button>
          ) : (
            <button type="button" onClick={() => setRunning(false)} className={styles.iconBtn}>
              一時停止
            </button>
          )}
          <button type="button" onClick={handleClose} className={styles.dangerIconBtn}>
            終了して戻る
          </button>
        </div>
        <p className={styles.pomodoroElapsed}>
          作業実績 {Math.round(workElapsed / 60)} 分
        </p>
      </div>
    </div>
  );
}
