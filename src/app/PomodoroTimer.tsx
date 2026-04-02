'use client';

import { useEffect, useRef, useState } from 'react';
import type { Todo } from './types';
import { minutesToText } from './utils';
import styles from './page.module.css';

type Phase = 'work' | 'break';
type TimerMode = 'pomodoro' | 'stopwatch';

const STORAGE_KEY: string = 'kiroku:pomodoro';

/** localStorage に保存するタイマー状態 */
interface PomodoroState {
  todoId: string;
  timerMode: TimerMode;
  phase: Phase;
  running: boolean;
  /** フェーズ開始時のタイムスタンプ（ms） */
  phaseStartedAt: number;
  /** フェーズ開始時点での残り秒数 */
  phaseSecondsAtStart: number;
  /** 作業フェーズの累計経過秒数（休憩は含まない） */
  workElapsed: number;
  /** 一時停止中に消費済みの秒数 */
  pausedConsumed: number;
  workSeconds: number;
  breakSeconds: number;
}

/** 保存された状態を読み込む */
function loadState(todoId: string): PomodoroState | null {
  try {
    const raw: string | null = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const state: PomodoroState = JSON.parse(raw) as PomodoroState;
    if (state.todoId !== todoId) {
      return null;
    }
    return state;
  } catch {
    return null;
  }
}

/** 状態を保存する */
function saveState(state: PomodoroState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

/** 状態を削除する */
function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}

/**
 * ポモドーロタイマー（全画面表示）
 * 開始時刻ベースで計算するため、バックグラウンドやタブ閉じにも対応
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

  // localStorageから復元、なければ初期状態
  const restored: PomodoroState | null = loadState(todo.id);

  const [timerMode, setTimerMode] = useState<TimerMode>(restored?.timerMode ?? 'pomodoro');
  const [phase, setPhase] = useState<Phase>(restored?.phase ?? 'work');
  const [running, setRunning] = useState<boolean>(restored?.running ?? false);
  const [workElapsed, setWorkElapsed] = useState<number>(restored?.workElapsed ?? 0);

  // 開始時刻ベースの状態
  const phaseStartedAtRef = useRef<number>(restored?.phaseStartedAt ?? 0);
  const phaseSecondsAtStartRef = useRef<number>(
    restored?.phaseSecondsAtStart ?? WORK_SECONDS
  );
  const pausedConsumedRef = useRef<number>(restored?.pausedConsumed ?? 0);

  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    if (!restored || !restored.running) {
      return restored?.phaseSecondsAtStart ?? WORK_SECONDS;
    }
    // 実時間で残り秒数を計算
    const elapsed: number = Math.floor((Date.now() - restored.phaseStartedAt) / 1000);
    return Math.max(0, restored.phaseSecondsAtStart - elapsed);
  });

  const [overtime, setOvertime] = useState<boolean>(() => {
    if (!restored || !restored.running) {
      return false;
    }
    const elapsed: number = Math.floor((Date.now() - restored.phaseStartedAt) / 1000);
    return elapsed >= restored.phaseSecondsAtStart;
  });

  const [overtimeSeconds, setOvertimeSeconds] = useState<number>(() => {
    if (!restored || !restored.running) {
      return 0;
    }
    const elapsed: number = Math.floor((Date.now() - restored.phaseStartedAt) / 1000);
    const over: number = elapsed - restored.phaseSecondsAtStart;
    return over > 0 ? over : 0;
  });

  const intervalRef = useRef<number | null>(null);
  const alarmIntervalRef = useRef<number | null>(null);
  const notifyTimeoutRef = useRef<number | null>(null);

  // 初回マウント時にNotification許可をリクエスト
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

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
    } catch { /* ignore */ }
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

  /** ブラウザ通知を送る（バックグラウンドでも表示される） */
  function sendNotification(title: string, body: string): void {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const notification: Notification = new Notification(title, {
        body,
        icon: '/next.svg',
        tag: 'kiroku-pomodoro',
        requireInteraction: true,
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }
  }

  /** フェーズ終了時刻にsetTimeoutで通知を予約する */
  function scheduleNotification(remainingMs: number, phaseType: Phase): void {
    cancelNotification();
    if (remainingMs <= 0) {
      return;
    }
    notifyTimeoutRef.current = window.setTimeout(() => {
      const msg: string = phaseType === 'work'
        ? '作業時間が終了しました。休憩に入りましょう。'
        : '休憩時間が終了しました。作業を再開しましょう。';
      sendNotification('Kiroku ポモドーロ', msg);
      // フォアグラウンドに戻った時のためにアラームも開始
      startAlarmLoop();
    }, remainingMs);
  }

  /** 予約済みの通知をキャンセルする */
  function cancelNotification(): void {
    if (notifyTimeoutRef.current) {
      window.clearTimeout(notifyTimeoutRef.current);
      notifyTimeoutRef.current = null;
    }
  }

  /** 現在の状態をlocalStorageに保存する */
  function persistState(overrides?: Partial<PomodoroState>): void {
    const state: PomodoroState = {
      todoId: todo.id,
      timerMode,
      phase,
      running,
      phaseStartedAt: phaseStartedAtRef.current,
      phaseSecondsAtStart: phaseSecondsAtStartRef.current,
      workElapsed,
      pausedConsumed: pausedConsumedRef.current,
      workSeconds: WORK_SECONDS,
      breakSeconds: BREAK_SECONDS,
      ...overrides,
    };
    saveState(state);
  }

  // メインのtickループ: 実時間ベースで毎秒更新
  useEffect(() => {
    if (running) {
      intervalRef.current = window.setInterval(() => {
        const now: number = Date.now();
        const totalElapsed: number = Math.floor((now - phaseStartedAtRef.current) / 1000);

        if (timerMode === 'stopwatch') {
          // ストップウォッチ: カウントアップ
          setSecondsLeft(pausedConsumedRef.current + totalElapsed);
        } else {
          // ポモドーロ: カウントダウン
          const remaining: number = phaseSecondsAtStartRef.current - totalElapsed;
          if (remaining <= 0) {
            setSecondsLeft(0);
            setOvertime(true);
            setOvertimeSeconds(Math.abs(remaining));
            startAlarmLoop();
          } else {
            setSecondsLeft(remaining);
            setOvertime(false);
            setOvertimeSeconds(0);
          }
        }
      }, 1000);
    }
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, [running, timerMode]);

  // workElapsedを実時間で計算するuseEffect
  useEffect(() => {
    if (!running) {
      return;
    }
    const id: number = window.setInterval(() => {
      if (phase === 'work') {
        const now: number = Date.now();
        const thisPhaseElapsed: number = Math.floor((now - phaseStartedAtRef.current) / 1000);
        setWorkElapsed(pausedConsumedRef.current + thisPhaseElapsed);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, phase]);

  // 復元時の初期化 + アンマウント時のクリーンアップ
  useEffect(() => {
    if (running && overtime) {
      // 復元時に既にオーバータイムならアラーム開始
      startAlarmLoop();
    } else if (running && !overtime) {
      // 復元時にまだ時間が残っていれば通知を予約
      const remainingMs: number = (phaseSecondsAtStartRef.current * 1000)
        - (Date.now() - phaseStartedAtRef.current);
      if (remainingMs > 0) {
        scheduleNotification(remainingMs, phase);
      }
    }
    return () => {
      stopAlarmLoop();
      cancelNotification();
    };
  }, []);

  /** スタート（ポモドーロ再開 or ストップウォッチ再開） */
  function handleStart(): void {
    const now: number = Date.now();
    phaseStartedAtRef.current = now;
    phaseSecondsAtStartRef.current = timerMode === 'stopwatch' ? 0 : secondsLeft;
    pausedConsumedRef.current = workElapsed;
    setRunning(true);
    if (timerMode !== 'stopwatch') {
      scheduleNotification(secondsLeft * 1000, phase);
    }
    persistState({
      running: true,
      phaseStartedAt: now,
      phaseSecondsAtStart: timerMode === 'stopwatch' ? 0 : secondsLeft,
      pausedConsumed: workElapsed,
    });
  }

  /** 一時停止 */
  function handlePause(): void {
    const now: number = Date.now();
    const elapsed: number = Math.floor((now - phaseStartedAtRef.current) / 1000);

    if (timerMode === 'stopwatch') {
      // ストップウォッチ: 累計経過秒数を保存
      const totalElapsed: number = pausedConsumedRef.current + elapsed;
      setSecondsLeft(totalElapsed);
      setWorkElapsed(totalElapsed);
      pausedConsumedRef.current = totalElapsed;
      setRunning(false);
      persistState({
        running: false,
        phaseSecondsAtStart: 0,
        workElapsed: totalElapsed,
        pausedConsumed: totalElapsed,
      });
    } else {
      // ポモドーロ: 残り秒数を確定
      const remaining: number = Math.max(0, phaseSecondsAtStartRef.current - elapsed);
      setSecondsLeft(remaining);
      phaseSecondsAtStartRef.current = remaining;

      if (phase === 'work') {
        const newWorkElapsed: number = pausedConsumedRef.current + elapsed;
        setWorkElapsed(newWorkElapsed);
        pausedConsumedRef.current = newWorkElapsed;
      }

      setRunning(false);
      stopAlarmLoop();
      cancelNotification();
      persistState({
        running: false,
        phaseSecondsAtStart: remaining,
        workElapsed: phase === 'work' ? pausedConsumedRef.current : workElapsed,
        pausedConsumed: pausedConsumedRef.current,
      });
    }
  }

  /** 作業終了 → 休憩へ */
  function goToBreak(): void {
    stopAlarmLoop();
    cancelNotification();
    setOvertime(false);
    setOvertimeSeconds(0);
    setPhase('break');
    setSecondsLeft(BREAK_SECONDS);

    // 作業の累計を確定
    const now: number = Date.now();
    const elapsed: number = Math.floor((now - phaseStartedAtRef.current) / 1000);
    const newWorkElapsed: number = pausedConsumedRef.current + elapsed;
    setWorkElapsed(newWorkElapsed);
    pausedConsumedRef.current = newWorkElapsed;

    phaseStartedAtRef.current = now;
    phaseSecondsAtStartRef.current = BREAK_SECONDS;
    scheduleNotification(BREAK_SECONDS * 1000, 'break');

    persistState({
      phase: 'break',
      phaseStartedAt: now,
      phaseSecondsAtStart: BREAK_SECONDS,
      workElapsed: newWorkElapsed,
      pausedConsumed: newWorkElapsed,
    });
  }

  /** 休憩終了 → 作業へ */
  function goToWork(): void {
    stopAlarmLoop();
    cancelNotification();
    setOvertime(false);
    setOvertimeSeconds(0);
    setPhase('work');
    setSecondsLeft(WORK_SECONDS);

    const now: number = Date.now();
    phaseStartedAtRef.current = now;
    phaseSecondsAtStartRef.current = WORK_SECONDS;
    scheduleNotification(WORK_SECONDS * 1000, 'work');

    persistState({
      phase: 'work',
      phaseStartedAt: now,
      phaseSecondsAtStart: WORK_SECONDS,
    });
  }

  /** 閉じるときに作業経過分を実績に加算（休憩は含まない） */
  function handleClose(): void {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
    }
    stopAlarmLoop();
    cancelNotification();

    // 最終的なworkElapsedを計算
    let finalWorkElapsed: number = workElapsed;
    if (running && phase === 'work') {
      const now: number = Date.now();
      const elapsed: number = Math.floor((now - phaseStartedAtRef.current) / 1000);
      finalWorkElapsed = pausedConsumedRef.current + elapsed;
    }

    const minutes: number = Math.round(finalWorkElapsed / 60);
    if (minutes > 0) {
      onAddMinutes(minutes);
    }
    clearState();
    onClose();
  }

  const displaySeconds: number = timerMode === 'stopwatch'
    ? secondsLeft
    : (overtime ? overtimeSeconds : secondsLeft);
  const min: number = Math.floor(displaySeconds / 60);
  const sec: number = displaySeconds % 60;
  const display: string = timerMode === 'stopwatch'
    ? `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${overtime ? '+' : ''}${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;

  const phaseLabel: string = timerMode === 'stopwatch'
    ? (running ? '⏱ 計測中' : (workElapsed > 0 ? '⏱ 一時停止中' : '⏱ ストップウォッチ'))
    : (overtime
      ? (phase === 'work' ? '⏰ 作業時間超過！' : '⏰ 休憩時間超過！')
      : (phase === 'work' ? '作業中' : '☕ 休憩中'));

  const phaseColor: string = timerMode === 'stopwatch'
    ? '#f59e0b'
    : (overtime ? '#ef4444' : (phase === 'work' ? '#3b82f6' : '#22c55e'));

  /** ストップウォッチモード: 0からカウントアップ開始 */
  function handleStopwatchStart(): void {
    const now: number = Date.now();
    phaseStartedAtRef.current = now;
    phaseSecondsAtStartRef.current = 0;
    pausedConsumedRef.current = workElapsed;
    setRunning(true);
    setPhase('work');
    persistState({
      timerMode: 'stopwatch',
      running: true,
      phase: 'work',
      phaseStartedAt: now,
      phaseSecondsAtStart: 0,
      pausedConsumed: workElapsed,
    });
  }

  const isNotStarted: boolean = !running && phaseStartedAtRef.current === 0;

  return (
    <div className={styles.pomodoroOverlay}>
      <div className={styles.pomodoroContent}>
        {/* モード切替（未開始時のみ） */}
        {isNotStarted && (
          <div style={{ display: 'flex', gap: 0, marginBottom: 16, justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => { setTimerMode('pomodoro'); setSecondsLeft(WORK_SECONDS); }}
              style={{
                padding: '8px 20px', borderRadius: '8px 0 0 8px', fontSize: 14, cursor: 'pointer',
                border: '1px solid var(--card-border)',
                background: timerMode === 'pomodoro' ? '#3b82f6' : 'var(--card-bg)',
                color: timerMode === 'pomodoro' ? 'white' : 'var(--foreground)',
                fontWeight: 600,
              }}
            >
              🍅 ポモドーロ
            </button>
            <button
              type="button"
              onClick={() => { setTimerMode('stopwatch'); setSecondsLeft(0); }}
              style={{
                padding: '8px 20px', borderRadius: '0 8px 8px 0', fontSize: 14, cursor: 'pointer',
                border: '1px solid var(--card-border)', borderLeft: 'none',
                background: timerMode === 'stopwatch' ? '#f59e0b' : 'var(--card-bg)',
                color: timerMode === 'stopwatch' ? 'white' : 'var(--foreground)',
                fontWeight: 600,
              }}
            >
              ⏱ ストップウォッチ
            </button>
          </div>
        )}

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
            <button
              type="button"
              onClick={timerMode === 'stopwatch' && isNotStarted ? handleStopwatchStart : handleStart}
              className={styles.primaryBtn}
            >
              {phaseStartedAtRef.current > 0 ? '再開' : 'スタート'}
            </button>
          ) : (
            <button type="button" onClick={handlePause} className={styles.iconBtn}>
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
