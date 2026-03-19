'use client';

import { useEffect, useRef, useState } from 'react';
import type { Todo } from './types';
import { minutesToText } from './utils';
import styles from './page.module.css';

const WORK_SECONDS: number = 25 * 60;
const BREAK_SECONDS: number = 5 * 60;

/**
 * ポモドーロタイマー（全画面表示）
 * @param todo - 対象タスク
 * @param onClose - 閉じるコールバック
 * @param onAddMinutes - 実績追加コールバック（分）
 */
export default function PomodoroTimer({
  todo,
  onClose,
  onAddMinutes,
}: {
  todo: Todo;
  onClose: () => void;
  onAddMinutes: (minutes: number) => void;
}): React.ReactElement {
  const [phase, setPhase] = useState<'work' | 'break'>('work');
  const [secondsLeft, setSecondsLeft] = useState<number>(WORK_SECONDS);
  const [running, setRunning] = useState<boolean>(false);
  const [elapsed, setElapsed] = useState<number>(0);
  const intervalRef = useRef<number | null>(null);

  /** Web Audio APIでアラーム音を鳴らす */
  function playAlarm(): void {
    try {
      const ctx: AudioContext = new AudioContext();
      const frequencies: number[] = [523, 659, 784, 1047];
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

  useEffect(() => {
    if (running) {
      intervalRef.current = window.setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            // フェーズ終了 → アラームを鳴らす
            playAlarm();
            if (phase === 'work') {
              setElapsed((e) => e + WORK_SECONDS);
              setPhase('break');
              return BREAK_SECONDS;
            } else {
              setPhase('work');
              return WORK_SECONDS;
            }
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, [running, phase]);

  /** 閉じるときに経過分を実績に加算 */
  function handleClose(): void {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
    }
    const totalWorked: number = elapsed + (phase === 'work' ? WORK_SECONDS - secondsLeft : 0);
    const minutes: number = Math.round(totalWorked / 60);
    if (minutes > 0) {
      onAddMinutes(minutes);
    }
    onClose();
  }

  const min: number = Math.floor(secondsLeft / 60);
  const sec: number = secondsLeft % 60;
  const display: string = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;

  return (
    <div className={styles.pomodoroOverlay}>
      <div className={styles.pomodoroContent}>
        <div className={styles.pomodoroPhase}>
          {phase === 'work' ? '作業中' : '休憩中'}
        </div>
        <h2 className={styles.pomodoroTitle}>{todo.title}</h2>
        <p className={styles.pomodoroInfo}>
          予定 {minutesToText(todo.estMin)} / 実績 {minutesToText(todo.actualMin)}
        </p>
        <div className={styles.pomodoroTimer}>{display}</div>
        <div className={styles.pomodoroControls}>
          {!running ? (
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
          この作業で {Math.round((elapsed + (phase === 'work' ? WORK_SECONDS - secondsLeft : 0)) / 60)} 分経過
        </p>
      </div>
    </div>
  );
}
