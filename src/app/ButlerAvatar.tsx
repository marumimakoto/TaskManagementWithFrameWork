'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Todo, UserSettings } from './types';
import { minutesToText } from './utils';
import styles from './page.module.css';

/**
 * タスク状況のサマリーを文字列で生成する
 */
function buildTaskSummary(todos: Todo[]): string {
  const total: number = todos.length;
  const done: number = todos.filter((t) => t.done).length;
  const started: number = todos.filter((t) => t.started && !t.done).length;
  const notStarted: number = todos.filter((t) => !t.started && !t.done).length;
  const totalEstMin: number = todos.filter((t) => !t.done).reduce((sum, t) => sum + t.estMin, 0);
  const totalActualMin: number = todos.filter((t) => !t.done).reduce((sum, t) => sum + t.actualMin, 0);

  const lines: string[] = [
    `全${total}件（完了${done}件、着手中${started}件、未着手${notStarted}件）`,
    `未完了タスクの合計予定: ${minutesToText(totalEstMin)}、合計実績: ${minutesToText(totalActualMin)}`,
  ];

  // 未完了タスクのタイトル一覧（最大5件）
  const undoneTitles: string[] = todos
    .filter((t) => !t.done)
    .slice(0, 5)
    .map((t) => `- ${t.title}（予定${t.estMin}分${t.started ? ', 着手済' : ', 未着手'}）`);
  if (undoneTitles.length > 0) {
    lines.push('未完了タスク:');
    lines.push(...undoneTitles);
  }

  return lines.join('\n');
}

/**
 * 静的フォールバックメッセージ
 */
function fallbackMessage(todos: Todo[]): string {
  const total: number = todos.length;
  const done: number = todos.filter((t) => t.done).length;
  const remain: number = total - done;
  if (total === 0) {
    return 'まだタスクが登録されていません。まずは今日やることを1つ追加してみましょう！';
  }
  if (done === total) {
    return `全${total}件のタスクをすべて達成しました！素晴らしい成果です。ゆっくり休んでくださいね。`;
  }
  const messages: string[] = [
    `全${total}件中${done}件達成、残り${remain}件です。着実に進んでいますね！一つずつ片付ければゴールは近いですよ。`,
    `${done}/${total}件完了。あと${remain}件、あなたならきっとやり遂げられます！応援しています。`,
    `現在${done}件達成、残り${remain}件。期限が近いタスクがあれば優先して進めましょう！`,
  ];
  const idx: number = Math.floor(Math.random() * messages.length);
  return messages[idx];
}

/**
 * 執事アバターコンポーネント
 * タスクページの右下に表示され、生成AIが励ましてくれる
 */
export default function ButlerAvatar({
  todos,
  settings,
}: {
  todos: Todo[];
  settings: UserSettings;
}): React.ReactElement {
  const [message, setMessage] = useState<string>('');
  const [visible, setVisible] = useState<boolean>(true);
  const [hidden, setHidden] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  // ドラッグ移動
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 24, y: 24 });
  const draggingRef = useRef<boolean>(false);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  /** マウスダウンでドラッグ開始 */
  function handleDragStart(e: React.MouseEvent): void {
    draggingRef.current = true;
    dragOffsetRef.current = {
      x: e.clientX - (window.innerWidth - position.x - 60),
      y: e.clientY - (window.innerHeight - position.y - 60),
    };
    e.preventDefault();

    function handleMouseMove(ev: MouseEvent): void {
      if (!draggingRef.current) {
        return;
      }
      const newX: number = window.innerWidth - (ev.clientX - dragOffsetRef.current.x) - 60;
      const newY: number = window.innerHeight - (ev.clientY - dragOffsetRef.current.y) - 60;
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - 80, newX)),
        y: Math.max(0, Math.min(window.innerHeight - 80, newY)),
      });
    }

    function handleMouseUp(): void {
      draggingRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  /** 生成AIからメッセージを取得する */
  const fetchMessage = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const summary: string = buildTaskSummary(todos);
      const res: Response = await fetch('/api/butler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPrompt: settings.butlerPrompt,
          maxChars: settings.butlerMaxChars,
          taskSummary: summary,
        }),
      });
      const data: { message: string } = await res.json();
      setMessage(data.message);
    } catch {
      setMessage(fallbackMessage(todos));
    } finally {
      setLoading(false);
    }
  }, [todos, settings.butlerPrompt, settings.butlerMaxChars]);

  useEffect(() => {
    fetchMessage();
  }, [fetchMessage]);

  if (hidden) {
    return <></>;
  }

  if (!visible) {
    return (
      <div style={{ position: 'fixed', right: position.x, bottom: position.y, zIndex: 8000 }}>
        <button
          className={styles.butlerToggle}
          onClick={() => { setVisible(true); fetchMessage(); }}
          title="執事を表示"
          style={{
            position: 'relative',
            right: 'auto',
            bottom: 'auto',
            ...(settings.butlerAvatar ? { backgroundImage: `url(${settings.butlerAvatar})`, backgroundSize: 'cover', backgroundPosition: 'center', fontSize: 0 } : {}),
          }}
          onMouseDown={handleDragStart}
        >
          {!settings.butlerAvatar && '🎩'}
        </button>
        <button
          className={styles.butlerHideBtn}
          onClick={() => setHidden(true)}
          title="執事を非表示にする"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div
      className={styles.butlerContainer}
      style={{ right: position.x, bottom: position.y }}
    >
      <div className={styles.butlerBubble}>
        <div style={{ display: 'flex', gap: 4, position: 'absolute', top: 6, right: 8 }}>
          <button
            className={styles.butlerClose}
            onClick={() => setVisible(false)}
            title="吹き出しを閉じる"
            style={{ position: 'static' }}
          >
            −
          </button>
          <button
            className={styles.butlerClose}
            onClick={() => setHidden(true)}
            title="執事を非表示にする"
            style={{ position: 'static' }}
          >
            ×
          </button>
        </div>
        <p className={styles.butlerMessage}>
          {loading ? '...' : message}
        </p>
      </div>
      <div
        className={styles.butlerAvatar}
        style={settings.butlerAvatar ? { backgroundImage: `url(${settings.butlerAvatar})`, backgroundSize: 'cover', backgroundPosition: 'center', fontSize: 0, cursor: 'grab' } : { cursor: 'grab' }}
        onClick={() => {
          if (!draggingRef.current) {
            fetchMessage();
          }
        }}
        onMouseDown={handleDragStart}
        title="ドラッグで移動 / クリックでメッセージ更新"
      >
        {!settings.butlerAvatar && '🎩'}
      </div>
    </div>
  );
}
