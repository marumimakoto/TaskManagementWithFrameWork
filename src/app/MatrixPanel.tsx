'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppUser, Todo } from './types';
import styles from './page.module.css';

/** バッジの位置（0〜100のパーセント） */
interface Position {
  x: number;
  y: number;
}

/** 保存済みマトリクス */
interface SavedMatrix {
  id: string;
  name: string;
  data: Record<string, Position>;
  createdAt: number;
  updatedAt: number;
}

/**
 * アイゼンハワーマトリクスページ
 * 配置データをDBに保存・読み込みできる
 */
export default function MatrixPanel({ todos, user }: { todos: Todo[]; user: AppUser }): React.ReactElement {
  const [matrixView, setMatrixView] = useState<'edit' | 'history'>('edit');
  const [positions, setPositions] = useState<Record<string, Position>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const [savedList, setSavedList] = useState<SavedMatrix[]>([]);
  const [currentSaveId, setCurrentSaveId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');

  const undoneTodos: Todo[] = useMemo((): Todo[] => {
    return todos.filter((t) => !t.done);
  }, [todos]);

  const placed: Todo[] = useMemo((): Todo[] => {
    return undoneTodos.filter((t) => positions[t.id]);
  }, [undoneTodos, positions]);

  const unplaced: Todo[] = useMemo((): Todo[] => {
    return undoneTodos.filter((t) => !positions[t.id]);
  }, [undoneTodos, positions]);

  /** 保存済み一覧を取得する */
  const fetchSaved = useCallback(async (): Promise<void> => {
    try {
      const res: Response = await fetch('/api/matrix?userId=' + user.id);
      const data: SavedMatrix[] = await res.json();
      setSavedList(data);
    } catch (e) {
      console.error('Failed to fetch saved matrices', e);
    }
  }, [user.id]);

  useEffect(() => {
    fetchSaved();
  }, [fetchSaved]);

  function handleGridDrop(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    if (!dragId || !gridRef.current) {
      return;
    }
    const rect: DOMRect = gridRef.current.getBoundingClientRect();
    const x: number = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y: number = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setPositions((prev) => ({ ...prev, [dragId]: { x, y } }));
    setDragId(null);
  }

  function unplace(id: string): void {
    setPositions((prev) => {
      const next: Record<string, Position> = { ...prev };
      delete next[id];
      return next;
    });
  }

  function showMsg(msg: string): void {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  }

  /** 日時フォーマット */
  function formatDate(ts: number): string {
    const d: Date = new Date(ts);
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  /** タイムスタンプ名を生成する */
  function generateStampName(): string {
    const now: Date = new Date();
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }

  /** 新規保存する（名前はタイムスタンプ） */
  async function saveAsNew(): Promise<void> {
    const name: string = generateStampName();
    try {
      const res: Response = await fetch('/api/matrix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          name,
          data: positions,
        }),
      });
      const result: { ok: boolean; id: string } = await res.json();
      setCurrentSaveId(result.id);
      await fetchSaved();
      showMsg('保存しました');
    } catch (e) {
      console.error('Failed to save matrix', e);
    }
  }

  /** 上書き保存する */
  async function overwriteSave(): Promise<void> {
    if (!currentSaveId) {
      return;
    }
    const current: SavedMatrix | undefined = savedList.find((s) => s.id === currentSaveId);
    const name: string = current?.name ?? generateStampName();
    try {
      await fetch('/api/matrix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          id: currentSaveId,
          name,
          data: positions,
        }),
      });
      await fetchSaved();
      showMsg('上書き保存しました');
    } catch (e) {
      console.error('Failed to overwrite matrix', e);
    }
  }

  /** 名前を変更する */
  async function renameSaved(id: string, newName: string): Promise<void> {
    const trimmed: string = newName.trim();
    if (!trimmed) {
      setRenamingId(null);
      return;
    }
    const saved: SavedMatrix | undefined = savedList.find((s) => s.id === id);
    if (!saved) {
      setRenamingId(null);
      return;
    }
    try {
      await fetch('/api/matrix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          id,
          name: trimmed,
          data: saved.data,
        }),
      });
      await fetchSaved();
      setRenamingId(null);
      showMsg('名前を変更しました');
    } catch (e) {
      console.error('Failed to rename matrix', e);
    }
  }

  /** 読み込む */
  function loadMatrix(saved: SavedMatrix): void {
    setPositions(saved.data);
    setCurrentSaveId(saved.id);
    showMsg(`「${saved.name}」を読み込みました`);
  }

  /** 削除する */
  async function deleteSaved(id: string): Promise<void> {
    try {
      await fetch('/api/matrix', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, id }),
      });
      if (currentSaveId === id) {
        setCurrentSaveId(null);
      }
      await fetchSaved();
      showMsg('削除しました');
    } catch (e) {
      console.error('Failed to delete saved matrix', e);
    }
  }

  return (
    <div className={styles.matrixPanel}>
      {/* タブ切替 */}
      <div className={styles.diaryModeBar} style={{ marginBottom: 12 }}>
        <button
          type="button"
          className={`${styles.diaryModeBtn} ${matrixView === 'edit' ? styles.diaryModeBtnActive : ''}`}
          onClick={() => setMatrixView('edit')}
        >
          割り振り
        </button>
        <button
          type="button"
          className={`${styles.diaryModeBtn} ${matrixView === 'history' ? styles.diaryModeBtnActive : ''}`}
          onClick={() => setMatrixView('history')}
        >
          保存一覧
        </button>
      </div>

      {/* 保存一覧ビュー */}
      {matrixView === 'history' && (
        <div>
          {savedList.length === 0 ? (
            <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 32 }}>保存されたマトリクスはありません</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {savedList.map((saved) => (
                <div
                  key={saved.id}
                  style={{ padding: 12, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, cursor: 'pointer' }}
                  onClick={() => {
                    setPositions(saved.data);
                    setCurrentSaveId(saved.id);
                    setMatrixView('edit');
                    showMsg('「' + saved.name + '」を読み込みました');
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600 }}>{saved.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {new Date(saved.updatedAt).toLocaleDateString('ja-JP')}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                    {Object.keys(saved.data).length}件のタスクを配置
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 割り振りビュー */}
      {matrixView === 'edit' && <>
      {/* ツールバー */}
      <div className={styles.matrixToolbar}>
        {currentSaveId ? (
          <>
            <button
              type="button"
              className={styles.primaryBtn}
              style={{ fontSize: '13px', padding: '6px 14px' }}
              onClick={overwriteSave}
              disabled={Object.keys(positions).length === 0}
            >
              上書き保存
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              style={{ fontSize: '13px' }}
              onClick={saveAsNew}
              disabled={Object.keys(positions).length === 0}
            >
              新規として保存
            </button>
          </>
        ) : (
          <button
            type="button"
            className={styles.primaryBtn}
            style={{ fontSize: '13px', padding: '6px 14px' }}
            onClick={saveAsNew}
            disabled={Object.keys(positions).length === 0}
          >
            保存
          </button>
        )}
        <button
          type="button"
          className={styles.iconBtn}
          style={{ fontSize: '13px' }}
          onClick={() => { setPositions({}); setCurrentSaveId(null); }}
        >
          リセット
        </button>
        {message && (
          <span className={styles.matrixMessage}>{message}</span>
        )}
      </div>

      {/* 保存済み一覧 */}
      {savedList.length > 0 && (
        <div className={styles.matrixSavedList}>
          <span className={styles.matrixSavedLabel}>保存済み:</span>
          {savedList.map((saved: SavedMatrix) => (
            <div
              key={saved.id}
              className={`${styles.matrixSavedItem} ${currentSaveId === saved.id ? styles.matrixSavedItemActive : ''}`}
            >
              {renamingId === saved.id ? (
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => renameSaved(saved.id, renameValue)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      renameSaved(saved.id, renameValue);
                    } else if (e.key === 'Escape') {
                      setRenamingId(null);
                    }
                  }}
                  className={styles.matrixRenameInput}
                  autoFocus
                />
              ) : (
                <button
                  type="button"
                  className={styles.matrixSavedBtn}
                  onClick={() => loadMatrix(saved)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setRenamingId(saved.id);
                    setRenameValue(saved.name);
                  }}
                  title={`クリック: 読み込み / ダブルクリック: 名前変更\n更新: ${formatDate(saved.updatedAt)}`}
                >
                  {saved.name}
                </button>
              )}
              <button
                type="button"
                className={styles.matrixSavedDelete}
                onClick={() => deleteSaved(saved.id)}
                title="削除"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 未配置のタスク */}
      <div className={styles.matrixUnassigned}>
        <h3 className={styles.matrixSectionTitle}>
          タスクをドラッグしてマトリクスに配置
        </h3>
        <div className={styles.matrixChipList}>
          {unplaced.length === 0 && (
            <p className={styles.diaryEmpty}>すべて配置済みです</p>
          )}
          {unplaced.map((t: Todo) => (
            <div
              key={t.id}
              className={styles.matrixChip}
              draggable
              onDragStart={() => setDragId(t.id)}
              onDragEnd={() => setDragId(null)}
            >
              {t.title}
            </div>
          ))}
        </div>
      </div>

      {/* マトリクスエリア */}
      <div
        ref={gridRef}
        className={styles.matrixCanvas}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleGridDrop}
      >
        <div className={styles.matrixAxisLabelTop}>重要</div>
        <div className={styles.matrixAxisLabelBottom}>重要でない</div>
        <div className={styles.matrixAxisLabelLeft}>緊急でない</div>
        <div className={styles.matrixAxisLabelRight}>緊急</div>

        <div className={styles.matrixCrossH} />
        <div className={styles.matrixCrossV} />

        <div className={styles.matrixBgTL} />
        <div className={styles.matrixBgTR} />
        <div className={styles.matrixBgBL} />
        <div className={styles.matrixBgBR} />

        {placed.map((t: Todo) => {
          const pos: Position = positions[t.id];
          return (
            <div
              key={t.id}
              className={styles.matrixBadge}
              style={{ left: pos.x + '%', top: pos.y + '%' }}
              draggable
              onDragStart={() => setDragId(t.id)}
              onDragEnd={() => setDragId(null)}
              title={t.title}
            >
              <span className={styles.matrixBadgeText}>{t.title}</span>
              <button
                type="button"
                className={styles.matrixBadgeClose}
                onClick={(e) => { e.stopPropagation(); unplace(t.id); }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      </>}
    </div>
  );
}
