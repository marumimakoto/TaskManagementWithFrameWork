'use client';

import { useState } from 'react';
import RecurrenceSelector from './RecurrenceSelector';
import styles from './page.module.css';

/**
 * タスク追加フォーム（共通コンポーネント）
 * ホーム画面・スマホモーダル・今日やることモーダルで使用
 */
export default function TaskAddForm({
  categories,
  onAdd,
  onClose,
  userId,
}: {
  categories: { id: string; name: string }[];
  onAdd: (data: {
    title: string;
    detail: string;
    estMin: number;
    category: string;
    recurrence: string;
    deadline: string;
  }) => void;
  onClose?: () => void;
  userId: string;
}): React.ReactElement {
  const [title, setTitle] = useState<string>('');
  const [detailText, setDetailText] = useState<string>('');
  const [estText, setEstText] = useState<string>('30');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [mode, setMode] = useState<string>('carry');
  const [deadlineText, setDeadlineText] = useState<string>('');
  const [showCategoryManager, setShowCategoryManager] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [localCategories, setLocalCategories] = useState<{ id: string; name: string }[]>(categories);

  function handleSubmit(): void {
    if (!title.trim()) {
      return;
    }
    onAdd({
      title: title.trim(),
      detail: detailText.trim(),
      estMin: parseInt(estText, 10) || 30,
      category: selectedCategory,
      recurrence: mode,
      deadline: deadlineText,
    });
    setTitle('');
    setDetailText('');
    setEstText('30');
    setSelectedCategory('');
    setMode('carry');
    setDeadlineText('');
    if (onClose) {
      onClose();
    }
  }

  async function addCategory(): Promise<void> {
    const name: string = newCategoryName.trim();
    if (!name || localCategories.some((c) => c.name === name)) {
      return;
    }
    const res: Response = await fetch('/api/todo-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, name }),
    });
    const data: { id: string } = await res.json();
    setLocalCategories((prev) => [...prev, { id: data.id, name }]);
    setNewCategoryName('');
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {/* タスク名 */}
      <div>
        <label className={styles.fieldLabel}>タスク名</label>
        <input
          placeholder="例: レポートを書く"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { handleSubmit(); } }}
          className={styles.input}
          autoFocus
        />
      </div>

      {/* 詳細 */}
      <div>
        <label className={styles.fieldLabel}>詳細（任意）</label>
        <textarea
          placeholder="例: 第3章の結論部分を仕上げる"
          value={detailText}
          onChange={(e) => setDetailText(e.target.value)}
          className={styles.textarea}
          rows={2}
        />
      </div>

      {/* カテゴリ */}
      <div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>カテゴリ（任意）</span>
          <button type="button" onClick={() => setShowCategoryManager(!showCategoryManager)} style={{ fontSize: 12, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer' }}>
            {showCategoryManager ? '閉じる' : '管理'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setSelectedCategory('')} style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer', border: selectedCategory === '' ? '2px solid #3b82f6' : '1px solid var(--card-border)', background: selectedCategory === '' ? '#dbeafe' : 'var(--card-bg)', color: selectedCategory === '' ? '#1d4ed8' : 'var(--foreground)', fontWeight: selectedCategory === '' ? 600 : 400 }}>
            なし
          </button>
          {localCategories.map((cat) => (
            <button key={cat.id} type="button" onClick={() => setSelectedCategory(cat.name)} style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer', border: selectedCategory === cat.name ? '2px solid #3b82f6' : '1px solid var(--card-border)', background: selectedCategory === cat.name ? '#dbeafe' : 'var(--card-bg)', color: selectedCategory === cat.name ? '#1d4ed8' : 'var(--foreground)', fontWeight: selectedCategory === cat.name ? 600 : 400 }}>
              {cat.name}
            </button>
          ))}
        </div>
        {showCategoryManager && (
          <div style={{ marginTop: 6, padding: 8, background: '#f8fafc', borderRadius: 8, border: '1px solid var(--card-border)' }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <input
                placeholder="新しいカテゴリ名"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCategory(); } }}
                className={styles.input}
                style={{ flex: 1 }}
              />
              <button type="button" className={styles.primaryBtn} style={{ padding: '4px 10px', fontSize: 12 }} onClick={addCategory}>追加</button>
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {localCategories.map((cat) => (
                <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: '#e2e8f0', fontSize: 12 }}>
                  <span>{cat.name}</span>
                  <button type="button" onClick={() => {
                    fetch('/api/todo-categories', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: cat.id, userId }) }).then(() => {
                      setLocalCategories((prev) => prev.filter((c) => c.id !== cat.id));
                    });
                  }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 13, lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 予定時間 */}
      <div>
        <label className={styles.fieldLabel}>予定時間（分）</label>
        <input
          placeholder="例: 60"
          value={estText}
          onChange={(e) => setEstText(e.target.value)}
          className={styles.input}
        />
      </div>

      {/* 繰り返し */}
      <div>
        <label className={styles.fieldLabel}>繰り返し</label>
        <RecurrenceSelector
          value={mode}
          onChange={(v) => setMode(v)}
          showSaveButton={false}
        />
      </div>

      {/* 締切 */}
      <div>
        <label className={styles.fieldLabel}>締切（任意）</label>
        <input
          type="date"
          value={deadlineText}
          onChange={(e) => setDeadlineText(e.target.value)}
          className={styles.input}
        />
      </div>

      {/* 追加ボタン */}
      <button
        type="button"
        onClick={handleSubmit}
        className={styles.primaryBtn}
        style={{ width: '100%' }}
        disabled={!title.trim()}
      >
        追加
      </button>
    </div>
  );
}
