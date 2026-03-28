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

type BucketCategory = {
  id: string;
  name: string;
};

/**
 * 人生のやりたいことリストパネル
 */
export default function BucketListPanel({ user }: { user: AppUser }): React.ReactElement {
  const [items, setItems] = useState<BucketItem[]>([]);
  const [categories, setCategories] = useState<BucketCategory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // 追加フォーム
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDetail, setNewDetail] = useState<string>('');
  const [newCategory, setNewCategory] = useState<string>('');
  const [newDeadlineYear, setNewDeadlineYear] = useState<string>('');

  // カテゴリ管理
  const [showCategoryManager, setShowCategoryManager] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>('');

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
      const data = await res.json();
      setItems(data.items ?? data);
      if (data.categories) {
        setCategories(data.categories);
        if (!newCategory && data.categories.length > 0) {
          setNewCategory(data.categories[0].name);
        }
      }
    } catch {
      console.warn('Failed to fetch bucket list');
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  /** アイテム追加 */
  async function addItem(): Promise<void> {
    const title: string = newTitle.trim();
    if (!title) {
      return;
    }
    const deadlineYear: number | null = newDeadlineYear ? parseInt(newDeadlineYear, 10) : null;
    const category: string = newCategory || '未分類';

    const res: Response = await fetch('/api/bucket-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, title, detail: newDetail.trim(), category, deadlineYear }),
    });
    const data = await res.json();

    setItems((prev) => [{
      id: data.id, title, detail: newDetail.trim(), category, deadlineYear,
      done: false, sortOrder: 0, createdAt: Date.now(),
    }, ...prev]);
    setNewTitle('');
    setNewDetail('');
    setNewDeadlineYear('');
  }

  /** カテゴリ追加 */
  async function addCategory(): Promise<void> {
    const name: string = newCategoryName.trim();
    if (!name) {
      return;
    }
    if (categories.some((c) => c.name === name)) {
      alert('同じ名前のカテゴリが既にあります');
      return;
    }
    const res: Response = await fetch('/api/bucket-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'category', userId: user.id, name }),
    });
    const data = await res.json();
    setCategories((prev) => [...prev, { id: data.id, name }]);
    setNewCategoryName('');
  }

  /** カテゴリ削除 */
  async function deleteCategory(catId: string, catName: string): Promise<void> {
    if (!confirm(`「${catName}」カテゴリを削除しますか？\nこのカテゴリのアイテムは「未分類」に変更されます。`)) {
      return;
    }
    setCategories((prev) => prev.filter((c) => c.id !== catId));
    setItems((prev) => prev.map((i) => (i.category === catName ? { ...i, category: '未分類' } : i)));
    await fetch('/api/bucket-list', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: catId, type: 'category' }),
    });
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
    const updates = { title, detail: editDetail.trim(), category: editCategory, deadlineYear };
    setItems((prev) => prev.map((i) => (i.id === editingId ? { ...i, ...updates } : i)));
    setEditingId(null);
    await fetch('/api/bucket-list', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingId, updates }),
    });
  }

  // フィルター
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

  // 全カテゴリ名（フィルター・表示用）
  const categoryNames: string[] = categories.map((c) => c.name);

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
            onKeyDown={(e) => { if (e.key === 'Enter') { addItem(); } }}
          />
          <textarea
            placeholder="詳細（任意）"
            value={newDetail}
            onChange={(e) => setNewDetail(e.target.value)}
            className={styles.input}
            rows={2}
            style={{ resize: 'vertical' }}
          />

          {/* カテゴリ選択（ボタン式） */}
          <div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>カテゴリ</span>
              <button
                onClick={() => setShowCategoryManager(!showCategoryManager)}
                style={{ fontSize: 12, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {showCategoryManager ? '閉じる' : '管理'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {categoryNames.map((name) => (
                <button
                  key={name}
                  onClick={() => setNewCategory(name)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 999,
                    border: newCategory === name ? '2px solid #3b82f6' : '1px solid var(--card-border)',
                    background: newCategory === name ? '#dbeafe' : 'var(--card-bg)',
                    color: newCategory === name ? '#1d4ed8' : 'var(--foreground)',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: newCategory === name ? 600 : 400,
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* カテゴリ管理 */}
          {showCategoryManager && (
            <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid var(--card-border)' }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input
                  placeholder="新しいカテゴリ名"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className={styles.input}
                  style={{ flex: 1 }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { addCategory(); } }}
                />
                <button onClick={addCategory} className={styles.primaryBtn} style={{ padding: '6px 12px', fontSize: 13 }}>
                  追加
                </button>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {categories.map((cat) => (
                  <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: '#e2e8f0', fontSize: 13 }}>
                    <span>{cat.name}</span>
                    <button
                      onClick={() => deleteCategory(cat.id, cat.name)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14, lineHeight: 1 }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
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

      {/* フィルター（カテゴリボタン式 + ステータス） */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={() => setFilterCategory('all')}
          style={{
            padding: '4px 12px', borderRadius: 999, fontSize: 13, cursor: 'pointer',
            border: filterCategory === 'all' ? '2px solid #3b82f6' : '1px solid var(--card-border)',
            background: filterCategory === 'all' ? '#dbeafe' : 'var(--card-bg)',
            color: filterCategory === 'all' ? '#1d4ed8' : 'var(--foreground)',
            fontWeight: filterCategory === 'all' ? 600 : 400,
          }}
        >
          全て
        </button>
        {categoryNames.map((name) => (
          <button
            key={name}
            onClick={() => setFilterCategory(name)}
            style={{
              padding: '4px 12px', borderRadius: 999, fontSize: 13, cursor: 'pointer',
              border: filterCategory === name ? '2px solid #3b82f6' : '1px solid var(--card-border)',
              background: filterCategory === name ? '#dbeafe' : 'var(--card-bg)',
              color: filterCategory === name ? '#1d4ed8' : 'var(--foreground)',
              fontWeight: filterCategory === name ? 600 : 400,
            }}
          >
            {name}
          </button>
        ))}
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>|</span>
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
            <input
              type="checkbox"
              checked={item.done}
              onChange={() => toggleDone(item.id)}
              className={styles.checkbox}
              style={{ marginTop: 4 }}
            />

            {editingId === item.id ? (
              <div style={{ flex: 1, display: 'grid', gap: 6 }}>
                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className={styles.input} />
                <textarea value={editDetail} onChange={(e) => setEditDetail(e.target.value)} className={styles.input} rows={2} />
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {categoryNames.map((name) => (
                    <button
                      key={name}
                      onClick={() => setEditCategory(name)}
                      style={{
                        padding: '3px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
                        border: editCategory === name ? '2px solid #3b82f6' : '1px solid var(--card-border)',
                        background: editCategory === name ? '#dbeafe' : 'var(--card-bg)',
                        color: editCategory === name ? '#1d4ed8' : 'var(--foreground)',
                        fontWeight: editCategory === name ? 600 : 400,
                      }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="number" placeholder="目標年" value={editDeadlineYear} onChange={(e) => setEditDeadlineYear(e.target.value)} className={styles.input} style={{ width: 100 }} />
                  <button onClick={saveEdit} className={styles.primaryBtn} style={{ padding: '6px 16px' }}>保存</button>
                  <button onClick={() => setEditingId(null)} className={styles.iconBtn}>キャンセル</button>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 16, textDecoration: item.done ? 'line-through' : 'none', opacity: item.done ? 0.6 : 1 }}>
                    {item.title}
                  </span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>
                      {item.category}
                    </span>
                    {item.deadlineYear && (
                      <span style={{ fontSize: 13, color: 'var(--muted)' }}>{item.deadlineYear}年まで</span>
                    )}
                  </div>
                </div>
                {item.detail && (
                  <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 4, opacity: item.done ? 0.5 : 1 }}>
                    {item.detail}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button onClick={() => startEdit(item)} className={styles.iconBtn} style={{ fontSize: 12, padding: '2px 8px' }}>編集</button>
                  <button onClick={() => { if (confirm('削除しますか？')) { deleteItem(item.id); } }} className={styles.dangerIconBtn} style={{ fontSize: 12, padding: '2px 8px' }}>削除</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
