'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AppUser } from './types';
import { log, uid } from './utils';
import styles from './page.module.css';
import { DragHandle, MoveButtonBar, InlineEditText, InlineEditTextarea, DeleteButton } from './SharedComponents';

/** タスクセットのアイテム */
interface TaskSetItem {
  id: string;
  parentId?: string;
  title: string;
  estMin: number;
  detail?: string;
  recurrence: string;
  deadline?: string;
  sortOrder: number;
}

/** タスクセット */
interface TaskSet {
  id: string;
  name: string;
  isPublic?: boolean;
  items: TaskSetItem[];
}

/** 公開タスクセット */
interface PublicTaskSet {
  id: string;
  name: string;
  userName: string;
  likeCount: number;
  liked: boolean;
  items: { title: string; estMin: number; detail?: string; recurrence: string; deadline?: string }[];
}

/**
 * タスクセット管理パネル
 * メインページと同じカード風UIでアイテムを管理。追加は上、一覧は下。階層化対応。
 */
export default function TaskSetPanel({
  user,
  onApply,
}: {
  user: AppUser;
  onApply: (items: { title: string; estMin: number; detail?: string; recurrence: string; deadline?: string }[]) => void;
}): React.ReactElement {
  const [sets, setSets] = useState<TaskSet[]>([]);
  const [publicSets, setPublicSets] = useState<PublicTaskSet[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [publicLoading, setPublicLoading] = useState<boolean>(false);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editingSetName, setEditingSetName] = useState<string | null>(null);
  const [editSetNameValue, setEditSetNameValue] = useState<string>('');
  const [viewMode, setViewMode] = useState<'mine' | 'public'>('mine');
  const [publicSearch, setPublicSearch] = useState<string>('');
  const [publicSort, setPublicSort] = useState<'newest' | 'likes'>('newest');

  // 新規セット作成
  const [newSetName, setNewSetName] = useState<string>('');

  // アイテム追加フォーム（editingSetId のセットに追加）
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDetail, setNewDetail] = useState<string>('');
  const [newEstMin, setNewEstMin] = useState<string>('30');
  const [newRecurrence, setNewRecurrence] = useState<string>('carry');
  const [newDeadline, setNewDeadline] = useState<string>('');

  // ドラッグ
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [dragOverMode, setDragOverMode] = useState<'child' | 'above' | 'below' | null>(null);

  // 展開中のアイテム
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  /** タスクセット一覧を取得 */
  const fetchSets: () => Promise<void> = useCallback(async (): Promise<void> => {
    try {
      const res: Response = await fetch('/api/task-sets?userId=' + user.id);
      const data: TaskSet[] = await res.json();
      setSets(data);
    } catch (e) {
      console.warn('Failed to fetch task sets', e);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    fetchSets();
  }, [fetchSets]);

  /** セットを作成し、自動で編集モードに入る */
  async function createSet(): Promise<void> {
    const name: string = newSetName.trim();
    if (!name) {
      console.warn('[TaskSet] createSet: name is empty');
      return;
    }
    console.debug('[TaskSet] createSet: sending', { userId: user.id, name });
    try {
      const res: Response = await fetch('/api/task-sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, name, items: [] }),
      });
      console.debug('[TaskSet] createSet: status', res.status);
      const data: { ok: boolean; id?: string; error?: string } = await res.json();
      console.debug('[TaskSet] createSet: response', data);
      if (!data.ok) {
        console.error('[TaskSet] createSet: failed', data.error);
        return;
      }
      setNewSetName('');
      await fetchSets();
      if (data.id) {
        setEditingSetId(data.id);
      }
    } catch (e) {
      console.error('[TaskSet] createSet: exception', e);
    }
  }

  /** セットを削除 */
  async function deleteSet(id: string): Promise<void> {
    await fetch('/api/task-sets/' + id, { method: 'DELETE' });
    setSets((prev) => prev.filter((s) => s.id !== id));
    if (editingSetId === id) {
      setEditingSetId(null);
    }
  }

  /** 公開切り替え */
  async function togglePublic(id: string, current: boolean): Promise<void> {
    await fetch('/api/task-sets/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublic: !current }),
    });
    setSets((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isPublic: !current } : s)),
    );
  }

  /** セットにアイテムを追加 */
  async function addItemToSet(setId: string): Promise<void> {
    const title: string = newTitle.trim();
    if (!title) {
      return;
    }
    const item = {
      title,
      detail: newDetail.trim() || undefined,
      estMin: Math.max(1, parseInt(newEstMin || '30', 10)),
      recurrence: newRecurrence,
      deadline: newDeadline || undefined,
    };

    await fetch('/api/task-sets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, name: '__add_item__', setId, items: [item] }),
    });

    setNewTitle('');
    setNewDetail('');
    setNewEstMin('30');
    setNewRecurrence('carry');
    setNewDeadline('');
    fetchSets();
  }

  /** アイテムを削除する */
  async function deleteItem(setId: string, itemId: string): Promise<void> {
    setSets((prev) => prev.map((s) => {
      if (s.id !== setId) { return s; }
      return { ...s, items: s.items.filter((it) => it.id !== itemId) };
    }));
    fetch('/api/task-sets/' + setId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deleteItem', itemId }),
    });
  }

  /** アイテムのフィールドを更新する */
  function updateItemField(setId: string, itemId: string, updates: Record<string, unknown>): void {
    setSets((prev) => prev.map((s) => {
      if (s.id !== setId) { return s; }
      return {
        ...s,
        items: s.items.map((it) => {
          if (it.id !== itemId) { return it; }
          return {
            ...it,
            ...(updates.title !== undefined ? { title: updates.title as string } : {}),
            ...(updates.detail !== undefined ? { detail: updates.detail as string } : {}),
            ...(updates.estMin !== undefined ? { estMin: updates.estMin as number } : {}),
          };
        }),
      };
    }));
    fetch('/api/task-sets/' + setId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'updateItem', itemId, updates }),
    });
  }

  /** アイテムを上に移動する */
  function moveItemUp(setId: string, itemId: string): void {
    setSets((prev) => prev.map((s) => {
      if (s.id !== setId) { return s; }
      const sorted: TaskSetItem[] = [...s.items].sort((a, b) => a.sortOrder - b.sortOrder);
      const current: TaskSetItem | undefined = sorted.find((it) => it.id === itemId);
      if (!current) { return s; }
      const siblings: TaskSetItem[] = sorted.filter((it) => (it.parentId ?? null) === (current.parentId ?? null));
      const idx: number = siblings.findIndex((it) => it.id === itemId);
      if (idx <= 0) { return s; }
      const target: TaskSetItem = siblings[idx - 1];
      fetch('/api/task-sets/' + setId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'swapOrder', itemId1: current.id, itemId2: target.id }),
      });
      return {
        ...s,
        items: s.items.map((it) => {
          if (it.id === current.id) { return { ...it, sortOrder: target.sortOrder }; }
          if (it.id === target.id) { return { ...it, sortOrder: current.sortOrder }; }
          return it;
        }),
      };
    }));
  }

  /** アイテムを下に移動する */
  function moveItemDown(setId: string, itemId: string): void {
    setSets((prev) => prev.map((s) => {
      if (s.id !== setId) { return s; }
      const sorted: TaskSetItem[] = [...s.items].sort((a, b) => a.sortOrder - b.sortOrder);
      const current: TaskSetItem | undefined = sorted.find((it) => it.id === itemId);
      if (!current) { return s; }
      const siblings: TaskSetItem[] = sorted.filter((it) => (it.parentId ?? null) === (current.parentId ?? null));
      const idx: number = siblings.findIndex((it) => it.id === itemId);
      if (idx < 0 || idx >= siblings.length - 1) { return s; }
      const target: TaskSetItem = siblings[idx + 1];
      fetch('/api/task-sets/' + setId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'swapOrder', itemId1: current.id, itemId2: target.id }),
      });
      return {
        ...s,
        items: s.items.map((it) => {
          if (it.id === current.id) { return { ...it, sortOrder: target.sortOrder }; }
          if (it.id === target.id) { return { ...it, sortOrder: current.sortOrder }; }
          return it;
        }),
      };
    }));
  }

  /** アイテムを階層化する（直前の兄弟の子にする） */
  function nestItem(setId: string, itemId: string): void {
    const set: TaskSet | undefined = sets.find((s) => s.id === setId);
    if (!set) { return; }
    const sorted: TaskSetItem[] = [...set.items].sort((a, b) => a.sortOrder - b.sortOrder);
    const current: TaskSetItem | undefined = sorted.find((it) => it.id === itemId);
    if (!current) { return; }
    const siblings: TaskSetItem[] = sorted.filter((it) => (it.parentId ?? null) === (current.parentId ?? null));
    const idx: number = siblings.findIndex((it) => it.id === itemId);
    if (idx <= 0) { return; }
    const newParent: TaskSetItem = siblings[idx - 1];
    setSets((prev) => prev.map((s) => {
      if (s.id !== setId) { return s; }
      return { ...s, items: s.items.map((it) => it.id === itemId ? { ...it, parentId: newParent.id } : it) };
    }));
    fetch('/api/task-sets/' + setId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'setParent', itemId, parentId: newParent.id }),
    });
  }

  /** アイテムの階層を解除する */
  function unnestItem(setId: string, itemId: string): void {
    const set: TaskSet | undefined = sets.find((s) => s.id === setId);
    if (!set) { return; }
    const current: TaskSetItem | undefined = set.items.find((it) => it.id === itemId);
    if (!current || !current.parentId) { return; }
    const parent: TaskSetItem | undefined = set.items.find((it) => it.id === current.parentId);
    const newParentId: string | null = parent?.parentId ?? null;
    setSets((prev) => prev.map((s) => {
      if (s.id !== setId) { return s; }
      return { ...s, items: s.items.map((it) => it.id === itemId ? { ...it, parentId: newParentId ?? undefined } : it) };
    }));
    fetch('/api/task-sets/' + setId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'setParent', itemId, parentId: newParentId }),
    });
  }

  /** セットを適用 */
  function applySet(set: TaskSet): void {
    onApply(set.items.map((item: TaskSetItem) => ({
      title: item.title,
      estMin: item.estMin,
      detail: item.detail,
      recurrence: item.recurrence,
      deadline: item.deadline,
    })));
    log('taskSet:apply', { setId: set.id, count: set.items.length });
  }

  /** 公開セット取得（自分のセットを除外） */
  async function fetchPublicSets(): Promise<void> {
    setPublicLoading(true);
    try {
      const res: Response = await fetch('/api/task-sets/public?userId=' + user.id);
      const data: PublicTaskSet[] = await res.json();
      setPublicSets(data);
    } catch (e) {
      console.warn('Failed to fetch public sets', e);
    } finally {
      setPublicLoading(false);
    }
  }

  /** 公開タスクセットのいいねをトグルする */
  async function toggleSetLike(setId: string): Promise<void> {
    try {
      const res: Response = await fetch('/api/task-sets/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, setId }),
      });
      const data: { liked: boolean; likeCount: number } = await res.json();
      setPublicSets((prev) => prev.map((ps) => {
        if (ps.id !== setId) { return ps; }
        return { ...ps, liked: data.liked, likeCount: data.likeCount };
      }));
    } catch (e) {
      console.error('Failed to toggle like', e);
    }
  }

  /** タスクセットをJSONファイルとしてエクスポートする */
  function exportSet(set: TaskSet): void {
    const exportData = {
      name: set.name,
      exportedAt: new Date().toISOString(),
      items: [...set.items].sort((a, b) => a.sortOrder - b.sortOrder).map((item: TaskSetItem) => ({
        title: item.title,
        estMin: item.estMin,
        detail: item.detail ?? '',
        recurrence: item.recurrence,
        deadline: item.deadline ?? null,
        parentId: item.parentId ?? null,
        sortOrder: item.sortOrder,
      })),
    };
    const blob: Blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url: string = URL.createObjectURL(blob);
    const a: HTMLAnchorElement = document.createElement('a');
    a.href = url;
    a.download = `taskset-${set.name.replace(/[^a-zA-Z0-9\u3040-\u9FFF]/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** JSONファイルからタスクセットをインポートする */
  async function importSet(): Promise<void> {
    const input: HTMLInputElement = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file: File | undefined = input.files?.[0];
      if (!file) { return; }
      try {
        const text: string = await file.text();
        const data = JSON.parse(text) as {
          name?: string;
          items?: { title: string; estMin?: number; detail?: string; recurrence?: string; deadline?: string | null; parentId?: string | null; sortOrder?: number }[];
        };
        if (!data.name || !data.items || !Array.isArray(data.items)) {
          alert('無効なファイル形式です。name と items が必要です。');
          return;
        }
        // セットを新規作成
        const res: Response = await fetch('/api/task-sets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            name: data.name,
            items: data.items.map((item, i: number) => ({
              title: item.title,
              estMin: item.estMin ?? 30,
              detail: item.detail ?? '',
              recurrence: item.recurrence ?? 'carry',
              deadline: item.deadline ?? undefined,
            })),
          }),
        });
        const result: { ok: boolean; id?: string } = await res.json();
        if (result.ok) {
          await fetchSets();
          if (result.id) {
            setEditingSetId(result.id);
          }
          log('taskSet:import', { name: data.name, itemCount: data.items.length });
        }
      } catch (e) {
        console.error('Failed to import task set', e);
        alert('ファイルの読み込みに失敗しました。');
      }
    };
    input.click();
  }

  /** 現在編集中のセット */
  const currentSet: TaskSet | undefined = sets.find((s) => s.id === editingSetId);

  if (loading) {
    return <p>読み込み中...</p>;
  }

  return (
    <div className={styles.diaryPanel}>
      {/* モード切替バー */}
      <div className={styles.diaryModeBar}>
        <button
          type="button"
          className={`${styles.diaryModeBtn} ${viewMode === 'mine' ? styles.diaryModeBtnActive : ''}`}
          onClick={() => setViewMode('mine')}
        >
          自分のセット
        </button>
        <button
          type="button"
          className={`${styles.diaryModeBtn} ${viewMode === 'public' ? styles.diaryModeBtnActive : ''}`}
          onClick={() => { setViewMode('public'); fetchPublicSets(); }}
        >
          みんなのセット
        </button>
      </div>

      {/* === 自分のセット === */}
      {viewMode === 'mine' && (
      <>
      <section className={styles.diaryForm}>
        <label className={styles.fieldLabel}>新しいタスクセットを作成</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            placeholder="セット名（例: 朝のルーティン）"
            value={newSetName}
            onChange={(e) => setNewSetName(e.target.value)}
            className={styles.input}
            onKeyDown={(e) => { if (e.key === 'Enter') { createSet(); } }}
          />
          <button type="button" onClick={createSet} className={styles.primaryBtn}>
            作成
          </button>
          <button
            type="button"
            onClick={importSet}
            className={styles.iconBtn}
            title="JSONファイルからインポート"
          >
            インポート
          </button>
        </div>
      </section>

      {/* セット一覧 */}
      <section className={styles.diaryList}>
        <label className={styles.fieldLabel}>作ったタスクセット</label>
        {sets.length === 0 && (
          <p className={styles.diaryEmpty}>タスクセットはまだありません</p>
        )}
        {sets.map((set: TaskSet) => (
          <article
            key={set.id}
            className={styles.diaryCard}
            style={{ cursor: 'pointer' }}
            onClick={() => setEditingSetId(editingSetId === set.id ? null : set.id)}
          >
            <div className={styles.diaryCardHeader}>
              <span className={styles.diaryTitle}>
                {editingSetId === set.id ? '▾ ' : '▸ '}
                {editingSetName === set.id ? (
                  <input
                    value={editSetNameValue}
                    onChange={(e) => setEditSetNameValue(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const newName: string = editSetNameValue.trim();
                        if (newName) {
                          setSets((prev) => prev.map((s) => (s.id === set.id ? { ...s, name: newName } : s)));
                          fetch('/api/task-sets/' + set.id, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'rename', name: newName }),
                          });
                        }
                        setEditingSetName(null);
                      } else if (e.key === 'Escape') {
                        setEditingSetName(null);
                      }
                    }}
                    onBlur={() => {
                      const newName: string = editSetNameValue.trim();
                      if (newName && newName !== set.name) {
                        setSets((prev) => prev.map((s) => (s.id === set.id ? { ...s, name: newName } : s)));
                        fetch('/api/task-sets/' + set.id, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'rename', name: newName }),
                        });
                      }
                      setEditingSetName(null);
                    }}
                    className={styles.input}
                    style={{ width: 200, fontSize: 14 }}
                    autoFocus
                  />
                ) : (
                  <span
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingSetName(set.id);
                      setEditSetNameValue(set.name);
                    }}
                    title="ダブルクリックで名前を変更"
                  >
                    {set.name}
                  </span>
                )}
                <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--muted)', fontWeight: 400 }}>
                  ({set.items.length}件)
                </span>
              </span>
              <div className={styles.diaryActions} onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => applySet(set)}
                  className={styles.primaryBtn}
                  style={{ fontSize: 12, padding: '4px 10px' }}
                >
                  タスクに追加
                </button>
                <button
                  type="button"
                  onClick={() => exportSet(set)}
                  className={styles.iconBtn}
                  style={{ fontSize: 12 }}
                  title="JSONエクスポート"
                >
                  エクスポート
                </button>
                <button
                  type="button"
                  onClick={() => togglePublic(set.id, !!set.isPublic)}
                  className={set.isPublic ? styles.primaryBtn : styles.iconBtn}
                  style={{ fontSize: 12, padding: '4px 8px' }}
                >
                  {set.isPublic ? '非公開' : '公開'}
                </button>
                <button type="button" onClick={() => deleteSet(set.id)} className={styles.dangerIconBtn}>
                  削除
                </button>
              </div>
            </div>

            {/* セット展開中：アイテム追加フォーム + アイテム一覧 */}
            {editingSetId === set.id && (
              <div style={{ marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
                {/* 追加フォーム */}
                <div style={{ border: '1px solid var(--input-border)', borderRadius: 10, padding: 10, marginBottom: 10, background: 'var(--background)' }}>
                  <label className={styles.fieldLabel}>タスクを追加</label>
                  <input
                    placeholder="タスク名"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className={styles.input}
                  />
                  <textarea
                    placeholder="詳細（任意）"
                    value={newDetail}
                    onChange={(e) => setNewDetail(e.target.value)}
                    className={styles.textarea}
                    rows={2}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 4 }}>
                    <div>
                      <label className={styles.fieldLabel}>予定（分）</label>
                      <input
                        value={newEstMin}
                        onChange={(e) => setNewEstMin(e.target.value)}
                        className={styles.input}
                      />
                    </div>
                    <div>
                      <label className={styles.fieldLabel}>繰り返し</label>
                      <select
                        value={newRecurrence}
                        onChange={(e) => setNewRecurrence(e.target.value)}
                        className={styles.input}
                      >
                        <option value="carry">繰り返さない</option>
                        <option value="day">毎日</option>
                        <option value="week:mon">毎週月曜</option>
                        <option value="week:weekday">毎週平日</option>
                        <option value="month:same-date">毎月同じ日</option>
                        <option value="year">毎年</option>
                      </select>
                    </div>
                    <div>
                      <label className={styles.fieldLabel}>締切</label>
                      <input
                        type="date"
                        value={newDeadline}
                        onChange={(e) => setNewDeadline(e.target.value)}
                        className={styles.input}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => addItemToSet(set.id)}
                    className={styles.primaryBtn}
                    style={{ marginTop: 6 }}
                  >
                    追加
                  </button>
                </div>

                {/* アイテム一覧 */}
                <div className={styles.todoList}>
                  {set.items.length === 0 && (
                    <p className={styles.diaryEmpty}>アイテムがありません</p>
                  )}
                  {[...set.items].sort((a, b) => a.sortOrder - b.sortOrder).map((item: TaskSetItem) => {
                    const depth: number = item.parentId ? 1 : 0;
                    const isItemExpanded: boolean = expandedItemId === item.id;
                    const isDragTarget: boolean = dragOverItemId === item.id && dragItemId !== item.id;
                    return (
                      <div key={item.id} style={{ marginLeft: depth * 24 }}>
                        <article
                          className={`${styles.compactCard} ${styles.cardInProgress} ${isItemExpanded ? styles.compactCardExpanded : ''} ${isDragTarget && dragOverMode === 'child' ? styles.cardDragOverChild : ''} ${isDragTarget && dragOverMode === 'above' ? styles.cardDragOverTop : ''} ${isDragTarget && dragOverMode === 'below' ? styles.cardDragOverBottom : ''}`}
                          onClick={() => setExpandedItemId(isItemExpanded ? null : item.id)}
                          onDragOver={(e) => {
                            e.preventDefault();
                            if (!dragItemId || dragItemId === item.id) { return; }
                            const rect: DOMRect = e.currentTarget.getBoundingClientRect();
                            const third: number = rect.height / 3;
                            const relY: number = e.clientY - rect.top;
                            setDragOverItemId(item.id);
                            if (relY < third) {
                              setDragOverMode('above');
                            } else if (relY > rect.height - third) {
                              setDragOverMode('below');
                            } else {
                              setDragOverMode('child');
                            }
                          }}
                          onDragLeave={() => {
                            if (dragOverItemId === item.id) {
                              setDragOverItemId(null);
                              setDragOverMode(null);
                            }
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (!dragItemId || dragItemId === item.id) { return; }
                            if (dragOverMode === 'child') {
                              // 階層化
                              setSets((prev) => prev.map((s) => {
                                if (s.id !== set.id) { return s; }
                                return { ...s, items: s.items.map((it) => it.id === dragItemId ? { ...it, parentId: item.id } : it) };
                              }));
                              fetch('/api/task-sets/' + set.id, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'setParent', itemId: dragItemId, parentId: item.id }),
                              });
                            } else {
                              // 上 or 下に挿入移動
                              const newOrder: number = dragOverMode === 'above' ? item.sortOrder - 1 : item.sortOrder + 1;
                              const newParentId: string | null = item.parentId ?? null;
                              setSets((prev) => prev.map((s) => {
                                if (s.id !== set.id) { return s; }
                                return { ...s, items: s.items.map((it) => it.id === dragItemId ? { ...it, parentId: newParentId ?? undefined, sortOrder: newOrder } : it) };
                              }));
                              fetch('/api/task-sets/' + set.id, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'updateItem', itemId: dragItemId, updates: { parentId: newParentId, sortOrder: newOrder } }),
                              });
                            }
                            setDragItemId(null);
                            setDragOverItemId(null);
                            setDragOverMode(null);
                          }}
                        >
                          <div className={styles.compactCardRow}>
                            <DragHandle
                              onDragStart={(e) => { setDragItemId(item.id); e.dataTransfer.setData('text/plain', item.id); }}
                              onDragEnd={() => setDragItemId(null)}
                            />
                            <InlineEditText
                              value={item.title}
                              onSave={(v) => updateItemField(set.id, item.id, { title: v.trim() || '無題' })}
                              className={styles.compactTitle}
                              inputClassName={styles.input}
                            />
                            <InlineEditText
                              value={String(item.estMin)}
                              displayValue={`${item.estMin}分`}
                              onSave={(v) => updateItemField(set.id, item.id, { estMin: Math.max(1, parseInt(v || '30', 10)) })}
                              className={styles.compactDeadline}
                              inputType="number"
                              inputClassName={styles.inputNarrow}
                            />
                            <DeleteButton onClick={() => deleteItem(set.id, item.id)} />
                          </div>

                          {isItemExpanded && (
                            <div className={styles.compactDetailInner} onClick={(e) => e.stopPropagation()}>
                              <MoveButtonBar
                                onUp={() => moveItemUp(set.id, item.id)}
                                onDown={() => moveItemDown(set.id, item.id)}
                                onNest={() => nestItem(set.id, item.id)}
                                onUnnest={() => unnestItem(set.id, item.id)}
                                hasParent={!!item.parentId}
                              />
                              <InlineEditTextarea
                                value={item.detail ?? ''}
                                displayValue={item.detail || '（詳細なし — ダブルクリックで編集）'}
                                onSave={(v) => updateItemField(set.id, item.id, { detail: v })}
                                className={styles.compactDetailText}
                                placeholder="詳細を入力..."
                              />
                              <span className={styles.compactDetailMeta}>
                                繰り返し: {item.recurrence === 'carry' ? 'なし' : item.recurrence}
                                {item.deadline && ` / 締切: ${item.deadline}`}
                              </span>
                            </div>
                          )}
                        </article>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 折り畳み時：アイテムプレビュー */}
            {editingSetId !== set.id && set.items.length > 0 && (
              <ul className={styles.workLogList} style={{ marginTop: 6 }}>
                {[...set.items].sort((a, b) => a.sortOrder - b.sortOrder).slice(0, 5).map((item: TaskSetItem) => (
                  <li key={item.id} className={styles.workLogItem}>
                    <span className={styles.workLogContent}>{item.title}</span>
                    <span className={styles.workLogDate}>{item.estMin}分</span>
                  </li>
                ))}
                {set.items.length > 5 && (
                  <li className={styles.workLogItem}>
                    <span className={styles.workLogContent} style={{ color: 'var(--muted)' }}>
                      ...他 {set.items.length - 5}件
                    </span>
                  </li>
                )}
              </ul>
            )}
          </article>
        ))}
      </section>

      </>
      )}

      {/* === みんなのセット === */}
      {viewMode === 'public' && (
        <section>
          {/* 検索・ソート */}
          <div className={styles.activityFilterRow} style={{ marginBottom: 12 }}>
            <input
              type="text"
              placeholder="セット名・タスク名で検索..."
              value={publicSearch}
              onChange={(e) => setPublicSearch(e.target.value)}
              className={styles.input}
              style={{ flex: 1, maxWidth: 300 }}
            />
            <button
              type="button"
              className={`${styles.viewModeBtn} ${publicSort === 'newest' ? styles.viewModeBtnActive : ''}`}
              onClick={() => setPublicSort('newest')}
              style={{ width: 'auto', height: 'auto', padding: '6px 12px', fontSize: 12 }}
            >
              新着順
            </button>
            <button
              type="button"
              className={`${styles.viewModeBtn} ${publicSort === 'likes' ? styles.viewModeBtnActive : ''}`}
              onClick={() => setPublicSort('likes')}
              style={{ width: 'auto', height: 'auto', padding: '6px 12px', fontSize: 12 }}
            >
              いいね順
            </button>
          </div>

          {publicLoading && <p className={styles.diaryEmpty}>読み込み中...</p>}
          {!publicLoading && publicSets.length === 0 && (
            <p className={styles.diaryEmpty}>公開されているタスクセットはまだありません</p>
          )}
          {!publicLoading && publicSets.length > 0 && (() => {
            const keyword: string = publicSearch.trim().toLowerCase();
            const filtered: PublicTaskSet[] = publicSets.filter((ps: PublicTaskSet) => {
              if (!keyword) { return true; }
              if (ps.name.toLowerCase().includes(keyword)) { return true; }
              if (ps.userName.toLowerCase().includes(keyword)) { return true; }
              if (ps.items.some((item) => item.title.toLowerCase().includes(keyword))) { return true; }
              return false;
            });
            const sorted: PublicTaskSet[] = [...filtered].sort((a: PublicTaskSet, b: PublicTaskSet) => {
              if (publicSort === 'likes') {
                return b.likeCount - a.likeCount;
              }
              return 0;
            });
            if (sorted.length === 0) {
              return <p className={styles.diaryEmpty}>該当するセットがありません</p>;
            }
            return (
            <div className={styles.diaryList}>
              {sorted.map((ps: PublicTaskSet) => (
                <article key={ps.id} className={styles.diaryCard}>
                  <div className={styles.diaryCardHeader}>
                    <div>
                      <span className={styles.diaryTitle}>{ps.name}</span>
                      <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--muted)' }}>by {ps.userName}</span>
                    </div>
                    <div className={styles.diaryActions}>
                      <button
                        type="button"
                        onClick={() => toggleSetLike(ps.id)}
                        className={styles.iconBtn}
                        style={{ fontSize: 13, color: ps.liked ? '#ef4444' : 'var(--muted)' }}
                      >
                        {ps.liked ? '♥' : '♡'} {ps.likeCount}
                      </button>
                      <button
                        type="button"
                        onClick={() => onApply(ps.items)}
                        className={styles.primaryBtn}
                        style={{ fontSize: 12, padding: '4px 10px' }}
                      >
                        インポート
                      </button>
                    </div>
                  </div>
                  <ul className={styles.workLogList}>
                    {ps.items.map((item, i: number) => (
                      <li key={i} className={styles.workLogItem}>
                        <span className={styles.workLogContent}>{item.title}</span>
                        <span className={styles.workLogDate}>{item.estMin}分</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            );
          })()}
        </section>
      )}
    </div>
  );
}
