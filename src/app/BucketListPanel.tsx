'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AppUser } from './types';
import styles from './page.module.css';

/** やりたいことリストの1項目 */
type BucketItem = {
  id: string;
  title: string;
  detail: string;
  category: string;
  deadlineYear: number | null;
  done: boolean;
  sortOrder: number;
  createdAt: number;
};

/** カテゴリ一覧 */
const CATEGORIES: string[] = ['仕事', '私生活', '趣味', '健康', '学び', 'お金', '旅行', 'その他'];

/**
 * 人生のやりたいことリストパネル
 * シンプルなリスト形式で、タイトル・詳細・期限(西暦)・カテゴリ・完了を管理する
 */
export default function BucketListPanel({ user }: { user: AppUser }): React.ReactElement {
  const [items, setItems] = useState<BucketItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // 追加フォーム
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDetail, setNewDetail] = useState<string>('');
  const [newCategory, setNewCategory] = useState<string>('私生活');
  const [newDeadlineYear, setNewDeadlineYear] = useState<string>('');

  // フィルター
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // 編集
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editDetail, setEditDetail] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('');
  const [editDeadlineYear, setEditDeadlineYear] = useState<string>('');

  /** データ取得 */
  const fetchItems = useCallback(async (): Promise<void> => {
    try {
      const res: Response = await fetch('/api/bucket-list?userId=' + user.id);
      const data: BucketItem[] = await res.json();
      setItems(data);
    } catch {
      console.warn('Failed to fetch bucket list');
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  /** 追加 */
  async function addItem(): Promise<void> {
    const title: string = newTitle.trim();
    if (!title) {
      return;
    }

    const deadlineYear: number | null = newDeadlineYear ? parseInt(newDeadlineYear, 10) : null;

    const res: Response = await fetch('/api/bucket-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        title,
        detail: newDetail.trim(),
        category: newCategory,
        deadlineYear,
      }),
    });
    const data = await res.json();

    const newItem: BucketItem = {
      id: data.id,
      title,
      detail: newDetail.trim(),
      category: newCategory,
      deadlineYear,
      done: false,
      sortOrder: 0,
      createdAt: Date.now(),
    };
    setItems((prev) => [newItem, ...prev]);
    setNewTitle('');
    setNewDetail('');
    setNewDeadlineYear('');
  }

  /** 完了切り替え */
  async function toggleDone(id: string): Promise<void> {
    const item: BucketItem | undefined = items.find((i) => i.id === id);
    if (!item) {
      return;
    }
    const newDone: boolean = !item.done;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, done: newDone } : i)));
    await fetch('/api/bucket-list', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, updates: { done: newDone } }),
    });
  }

  /** 削除 */
  async function deleteItem(id: string): Promise<void> {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch('/api/bucket-list', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  }

  /** 編集開始 */
  function startEdit(item: BucketItem): void {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditDetail(item.detail);
    setEditCategory(item.category);
    setEditDeadlineYear(item.deadlineYear ? String(item.deadlineYear) : '');
  }

  /** 編集保存 */
  async function saveEdit(): Promise<void> {
    if (!editingId) {
      return;
    }
    const title: string = editTitle.trim();
    if (!title) {
      alert('タイトルは必須です');
      return;
    }
    const deadlineYear: number | null = editDeadlineYear ? parseInt(editDeadlineYear, 10) : null;
    const updates = {
      title,
      detail: editDetail.trim(),
      category: editCategory,
      deadlineYear,
    };
    setItems((prev) =>
      prev.map((i) =>
        i.id === editingId ? { ...i, ...updates } : i,
      ),
    );
    setEditingId(null);
    await fetch('/api/bucket-list', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingId, updates }),
    });
  }

  // フィルター適用
  const filtered: BucketItem[] = items.filter((item) => {
    if (filterCategory !== 'all' && item.category !== filterCategory) {
      return false;
    }
    if (filterStatus === 'done' && !item.done) {
      return false;
    }
    if (filterStatus === 'undone' && item.done) {
      return false;
    }
    return true;
  });

  // 達成率
  const totalCount: number = items.length;
  const doneCount: number = items.filter((i) => i.done).length;
  const achieveRate: number = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  if (loading) {
    return <div style={{ padding: 24, color: 'var(--muted)' }}>読み込み中...</div>;
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ fontSize: 20, marginBottom: 12 }}>人生のやりたいことリスト</h2>

      {/* 達成率 */}
      <div style={{ marginBottom: 16, padding: 16, background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--card-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontWeight: 600 }}>達成率</span>
          <span style={{ fontSize: 24, fontWeight: 700, color: '#3b82f6' }}>{achieveRate}%</span>
        </div>
        <div style={{ width: '100%', height: 8, background: 'var(--input-border)', borderRadius: 4 }}>
          <div style={{ width: `${achieveRate}%`, height: '100%', background: '#3b82f6', borderRadius: 4, transition: 'width 0.5s ease' }} />
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--muted)' }}>
          {doneCount} / {totalCount} 達成
        </div>
      </div>

      {/* 追加フォーム */}
      <div style={{ marginBottom: 16, padding: 16, background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--card-border)' }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <input
            placeholder="やりたいこと"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className={styles.input}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                addItem();
              }
            }}
          />
          <textarea
            placeholder="詳細（任意）"
            value={newDetail}
            onChange={(e) => setNewDetail(e.target.value)}
            className={styles.input}
            rows={2}
            style={{ resize: 'vertical' }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className={styles.input}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <input
              type="number"
              placeholder="目標年（例: 2030）"
              value={newDeadlineYear}
              onChange={(e) => setNewDeadlineYear(e.target.value)}
              className={styles.input}
            />
            <button onClick={addItem} className={styles.primaryBtn}>追加</button>
          </div>
        </div>
      </div>

      {/* フィルター */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className={styles.input}
          style={{ width: 'auto' }}
        >
          <option value="all">全カテゴリ</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className={styles.input}
          style={{ width: 'auto' }}
        >
          <option value="all">全て</option>
          <option value="undone">未達成</option>
          <option value="done">達成済み</option>
        </select>
      </div>

      {/* リスト */}
      <div style={{ display: 'grid', gap: 8 }}>
        {filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
            まだ項目がありません
          </div>
        )}
        {filtered.map((item) => (
          <div
            key={item.id}
            style={{
              padding: '12px 16px',
              background: item.done ? '#f0fdf4' : 'var(--card-bg)',
              border: `1px solid ${item.done ? '#bbf7d0' : 'var(--card-border)'}`,
              borderLeft: `4px solid ${item.done ? '#22c55e' : '#3b82f6'}`,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            {/* チェックボックス */}
            <input
              type="checkbox"
              checked={item.done}
              onChange={() => toggleDone(item.id)}
              className={styles.checkbox}
              style={{ marginTop: 4 }}
            />

            {editingId === item.id ? (
              /* 編集モード */
              <div style={{ flex: 1, display: 'grid', gap: 6 }}>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className={styles.input}
                />
                <textarea
                  value={editDetail}
                  onChange={(e) => setEditDetail(e.target.value)}
                  className={styles.input}
                  rows={2}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className={styles.input}
                    style={{ width: 'auto' }}
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="目標年"
                    value={editDeadlineYear}
                    onChange={(e) => setEditDeadlineYear(e.target.value)}
                    className={styles.input}
                    style={{ width: 100 }}
                  />
                  <button onClick={saveEdit} className={styles.primaryBtn} style={{ padding: '6px 16px' }}>保存</button>
                  <button onClick={() => setEditingId(null)} className={styles.iconBtn}>キャンセル</button>
                </div>
              </div>
            ) : (
              /* 表示モード */
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: 16,
                      textDecoration: item.done ? 'line-through' : 'none',
                      opacity: item.done ? 0.6 : 1,
                    }}
                  >
                    {item.title}
                  </span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    <span style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: '#e0f2fe',
                      color: '#0369a1',
                      fontWeight: 600,
                    }}>
                      {item.category}
                    </span>
                    {item.deadlineYear && (
                      <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                        {item.deadlineYear}年まで
                      </span>
                    )}
                  </div>
                </div>
                {item.detail && (
                  <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 4, opacity: item.done ? 0.5 : 1 }}>
                    {item.detail}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button
                    onClick={() => startEdit(item)}
                    className={styles.iconBtn}
                    style={{ fontSize: 12, padding: '2px 8px' }}
                  >
                    編集
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('削除しますか？')) {
                        deleteItem(item.id);
                      }
                    }}
                    className={styles.dangerIconBtn}
                    style={{ fontSize: 12, padding: '2px 8px' }}
                  >
                    削除
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
