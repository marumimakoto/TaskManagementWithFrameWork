'use client';

/**
 * Interactive Mock ToDo (Next.js App Router)
 * 目的:
 * - UI/操作感を先に固める（保存や日次リセットは後）
 * - 「期限OK / 詰まり<3h / 未着手<2日」の3条件で色とバッジが変わる
 *
 * メンテ方針:
 * - ログは log() に集約して、DEBUGで一括ON/OFF
 * - 判定ロジック(checklist)は純粋関数に寄せる
 * - UIはまずインラインstyleで完結（後でCSS/Tailwindへ移行可）
 */

import { useMemo, useState } from 'react';

const DEBUG = true; // ←本番/通常運用では false 推奨（ログを止める）

function log(scope: string, data?: unknown) {
  if (!DEBUG) return;
  // console.debug を使うと、必要なときだけDevToolsで拾いやすい
  if (data !== undefined) console.debug(`[todo-mock:${scope}]`, data);
  else console.debug(`[todo-mock:${scope}]`);
}

type Recurrence = 'carry' | 'daily';

type Todo = {
  id: string;
  title: string;
  estMin: number; // 予定(分)
  actualMin: number; // 実績(分)
  stuckHours: number; // 詰まり累計(時間)
  lastWorkedAt?: number; // epoch ms（最後に触った時間）
  deadline?: number; // epoch ms（締切）
  recurrence: Recurrence;
};

// ID生成（衝突しにくい簡易版）
function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// 分→表示（UI用）
function minutesToText(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h <= 0) return `${m}分`;
  return `${h}時間${m}分`;
}

/**
 * 締切入力: "YYYY-MM-DD HH:mm"（例: 2026-02-11 18:30）
 * - 正規表現で最低限の形式チェック
 * - ローカルタイムとして Date を生成
 * - パース失敗時は undefined（＝締切未設定）
 */
function parseDeadline(text: string): number | undefined {
  const s = text.trim();
  if (!s) return undefined;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!m) return undefined;
  const [_, yy, mm, dd, HH, MM] = m;
  const d = new Date(
    Number(yy),
    Number(mm) - 1,
    Number(dd),
    Number(HH),
    Number(MM),
    0,
    0,
  );
  if (Number.isNaN(+d)) return undefined;
  return d.getTime();
}

function formatDeadline(ts?: number) {
  // 締切未設定は「今日中」扱い（仕様）
  if (!ts) return '今日中';
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 締切まで残り(分)
 * - deadline未設定 → 今日の終わり(23:59:59)を締切として扱う（仕様）
 * - 期限切れは 0 に丸める
 */
function minutesUntil(deadline?: number) {
  const now = Date.now();
  const end = deadline ?? new Date().setHours(23, 59, 59, 999);
  return Math.max(0, Math.floor((end - now) / 60000));
}

function nowMinusDays(days: number) {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

/**
 * リスク判定（中心ロジック）
 * okDeadline: 締切までの残り分 >= 残作業分（予定−実績）
 * okStuck: 詰まり累計 < 3h
 * okNotIdle: 最終作業からの経過 < 2日
 */
function checklist(t: Todo) {
  const remainingWork = Math.max(0, t.estMin - t.actualMin);
  const restMin = minutesUntil(t.deadline);

  const okDeadline = remainingWork <= restMin;
  const okStuck = t.stuckHours < 3;

  // 未作業（lastWorkedAtなし）は「未着手扱い」にしたいので、createdAtがない現状は“大昔”に倒してNGへ寄せる
  const last = t.lastWorkedAt ?? nowMinusDays(9999);
  const daysIdle = Math.floor((Date.now() - last) / (1000 * 60 * 60 * 24));
  const okNotIdle = daysIdle < 2;

  return { okDeadline, okStuck, okNotIdle, remainingWork, restMin, daysIdle };
}

function badgeBg(ok: boolean) {
  return ok ? '#16a34a' : '#ef4444';
}

/**
 * カード背景色ルール
 * - どれかNGなら危険（赤）
 * - 全OKかつ未完了なら進行中（中立）
 * - 完了（実績>=予定）で全OKならOK（緑）
 */
function cardBg(t: Todo) {
  const c = checklist(t);
  const okAll = c.okDeadline && c.okStuck && c.okNotIdle;
  if (!okAll) return '#7f1d1d';
  if (t.actualMin < t.estMin) return '#334155';
  return '#064e3b';
}

function riskRank(t: Todo) {
  const c = checklist(t);
  const okAll = c.okDeadline && c.okStuck && c.okNotIdle;
  if (!okAll) return 0;
  if (t.actualMin < t.estMin) return 1;
  return 2;
}

function inputStyle(): React.CSSProperties {
  return {
    padding: 12,
    borderRadius: 12,
    border: '1px solid #111827',
    background: '#1f2937',
    color: 'white',
  };
}

function primaryBtnStyle(): React.CSSProperties {
  return {
    padding: 12,
    borderRadius: 12,
    border: 'none',
    background: '#3b82f6',
    color: 'white',
    fontWeight: 700,
    cursor: 'pointer',
  };
}

function smallBtnStyle(): React.CSSProperties {
  return {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #111827',
    background: '#111827',
    color: 'white',
    cursor: 'pointer',
  };
}

function dangerBtnStyle(): React.CSSProperties {
  return {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #7f1d1d',
    background: '#3f0d0d',
    color: 'white',
    cursor: 'pointer',
  };
}

function badgeStyle(ok: boolean): React.CSSProperties {
  return {
    background: badgeBg(ok),
    padding: '4px 8px',
    borderRadius: 999,
    fontSize: 12,
  };
}

const initialTodos: Todo[] = [
  {
    id: uid(),
    title: 'ToDoアプリのUIを作る',
    estMin: 60,
    actualMin: 20,
    stuckHours: 0.5,
    lastWorkedAt: Date.now(),
    deadline: parseDeadline('2026-02-10 23:00'),
    recurrence: 'carry',
  },
  {
    id: uid(),
    title: '締切が近いタスク（危険）',
    estMin: 90,
    actualMin: 10,
    stuckHours: 0,
    lastWorkedAt: Date.now(),
    deadline: parseDeadline('2026-02-10 21:00'),
    recurrence: 'carry',
  },
  {
    id: uid(),
    title: '詰まり3h超（危険）',
    estMin: 45,
    actualMin: 15,
    stuckHours: 3.2,
    lastWorkedAt: Date.now(),
    deadline: parseDeadline('2026-02-11 12:00'),
    recurrence: 'carry',
  },
  {
    id: uid(),
    title: '2日未着手（危険）',
    estMin: 30,
    actualMin: 0,
    stuckHours: 0,
    lastWorkedAt: nowMinusDays(2),
    deadline: parseDeadline('2026-02-11 18:00'),
    recurrence: 'daily',
  },
];

export default function Page() {
  // 状態: 本番では reducer + 永続化(localStorage/DB)へ進化させる
  const [todos, setTodos] = useState<Todo[]>(() => {
    log('init', { count: initialTodos.length });
    return initialTodos;
  });

  // 入力フォーム（Mock→まずは触れる形）
  const [title, setTitle] = useState('');
  const [estText, setEstText] = useState('30');
  const [mode, setMode] = useState<Recurrence>('carry');
  const [deadlineText, setDeadlineText] = useState(''); // YYYY-MM-DD HH:mm

  // 並べ替え: 危険→進行中→OK、締切が近い順
  const sorted = useMemo(() => {
    const s = [...todos].sort((a, b) => {
      const ra = riskRank(a);
      const rb = riskRank(b);
      if (ra !== rb) return ra - rb;
      const da = a.deadline ?? Number.MAX_SAFE_INTEGER;
      const db = b.deadline ?? Number.MAX_SAFE_INTEGER;
      return da - db;
    });
    log('sort', { count: s.length });
    return s;
  }, [todos]);

  function addTodo() {
    const t = title.trim();
    const est = Math.max(1, parseInt(estText || '0', 10));
    if (!t) {
      log('addTodo:blocked', { reason: 'empty title' });
      return;
    }

    const d = parseDeadline(deadlineText);
    if (deadlineText.trim() && d === undefined) {
      // 形式が違ってたらユーザーに明確に知らせる（保守性のため）
      alert('締切は「YYYY-MM-DD HH:mm」形式で入力してね。例: 2026-02-11 18:30');
      log('addTodo:blocked', { reason: 'deadline parse failed', deadlineText });
      return;
    }

    const todo: Todo = {
      id: uid(),
      title: t,
      estMin: est,
      actualMin: 0,
      stuckHours: 0,
      lastWorkedAt: undefined,
      deadline: d,
      recurrence: mode,
    };

    setTodos((prev) => [todo, ...prev]);
    log('addTodo:ok', todo);

    setTitle('');
    setEstText('30');
    setDeadlineText('');
    setMode('carry');
  }

  function addLog(id: string) {
    // NOTE: 本番はModal UIにする（promptは仮）
    const mText = window.prompt('実績(分)を加算：例 15', '15');
    if (mText == null) return;
    const addMin = Math.max(0, parseInt(mText || '0', 10));

    const hText = window.prompt('詰まり(時間)を加算：例 0.5', '0');
    if (hText == null) return;
    const addHours = Math.max(0, parseFloat(hText || '0'));

    setTodos((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
            ...t,
            actualMin: t.actualMin + addMin,
            stuckHours: t.stuckHours + addHours,
            lastWorkedAt: Date.now(),
          }
          : t,
      ),
    );
    log('addLog', { id, addMin, addHours });
  }

  function markDone(id: string) {
    // 触れる用の簡易: 完了扱い＝実績を予定に合わせる
    setTodos((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, actualMin: t.estMin, lastWorkedAt: Date.now() } : t,
      ),
    );
    log('markDone', { id });
  }

  function removeTodo(id: string) {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    log('removeTodo', { id });
  }

  return (
    <main style={{ minHeight: '100vh', background: '#0b0b0c', padding: 24, color: 'white' }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Daily ToDo（Interactive Mock）</h1>
        <p style={{ margin: '6px 0 0', color: '#9ca3af' }}>
          追加 / 実績ログ / 完了 / 削除まで触れる。保存と日次リセットは次。
        </p>
      </header>

      <section style={{ display: 'grid', gap: 10, marginBottom: 18, maxWidth: 720 }}>
        <input
          placeholder="タスク名"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={inputStyle()}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <input
            placeholder="予定(分) 例: 60"
            value={estText}
            onChange={(e) => setEstText(e.target.value)}
            style={inputStyle()}
          />
          <select value={mode} onChange={(e) => setMode(e.target.value as Recurrence)} style={inputStyle()}>
            <option value="carry">持ち越し</option>
            <option value="daily">日次</option>
          </select>
          <input
            placeholder="締切 YYYY-MM-DD HH:mm（任意）"
            value={deadlineText}
            onChange={(e) => setDeadlineText(e.target.value)}
            style={inputStyle()}
          />
        </div>

        <button onClick={addTodo} style={primaryBtnStyle()}>
          追加
        </button>

        <p style={{ color: '#9ca3af', margin: 0, fontSize: 12 }}>
          締切は「2026-02-11 18:30」みたいに入力。未入力は「今日中」扱い。
        </p>
      </section>

      <section style={{ display: 'grid', gap: 12, maxWidth: 720 }}>
        {sorted.map((t) => {
          const c = checklist(t);

          return (
            <article
              key={t.id}
              style={{
                background: cardBg(t),
                borderRadius: 12,
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              {/* 左：タイトル＋進捗 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {t.title}
                </div>
                <div style={{ fontSize: 12, color: '#d1d5db' }}>
                  予定 {minutesToText(t.estMin)} / 実績 {minutesToText(t.actualMin)}
                </div>
                {/* 中央：期限・状態 */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={metaPill()}>
                    ⏰ {formatDeadline(t.deadline)}
                  </span>
                  <span style={badgeStyle(c.okDeadline)}>期限</span>
                  <span style={badgeStyle(c.okStuck)}>詰まり</span>
                  <span style={badgeStyle(c.okNotIdle)}>未着手</span>
                </div>
              </div>
              {/* 右：操作 */}
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => addLog(t.id)} style={iconBtn()}>
                  実績
                </button>
                <button onClick={() => markDone(t.id)} style={iconBtn()}>
                  ✔
                </button>
                <button onClick={() => removeTodo(t.id)} style={dangerIconBtn()}>
                  🗑
                </button>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
function metaPill(): React.CSSProperties {
  return {
    background: '#111827',
    border: '1px solid #1f2937',
    borderRadius: 999,
    padding: '4px 8px',
    fontSize: 12,
    color: '#e5e7eb',
    whiteSpace: 'nowrap',
  };
}
// アイコンボタン共通
function iconBtn(): React.CSSProperties {
  return {
    padding: '6px 8px',
    borderRadius: 8,
    border: '1px solid #1f2937',
    background: '#020617',
    color: 'white',
    cursor: 'pointer',
  };
}
// 危険系アイコンボタン
function dangerIconBtn(): React.CSSProperties {
  return {
    padding: '6px 8px',
    borderRadius: 8,
    border: '1px solid #7f1d1d',
    background: '#3f0d0d',
    color: 'white',
    cursor: 'pointer',
  };
}
