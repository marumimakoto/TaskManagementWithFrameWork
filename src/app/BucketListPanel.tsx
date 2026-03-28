'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AppUser } from './types';
import { useIsMobile } from './useIsMobile';
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

/** やりたいことリストをXMLに変換する */
function buildExportXml(items: BucketItem[], categories: BucketCategory[]): string {
  const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', '<bucketList>'];
  lines.push('  <categories>');
  for (const cat of categories) {
    lines.push(`    <category>${escapeXml(cat.name)}</category>`);
  }
  lines.push('  </categories>');
  lines.push('  <items>');
  for (const item of items) {
    lines.push('    <item>');
    lines.push(`      <title>${escapeXml(item.title)}</title>`);
    lines.push(`      <detail>${escapeXml(item.detail)}</detail>`);
    lines.push(`      <category>${escapeXml(item.category)}</category>`);
    lines.push(`      <deadlineYear>${item.deadlineYear ?? ''}</deadlineYear>`);
    lines.push(`      <done>${item.done ? 'true' : 'false'}</done>`);
    lines.push('    </item>');
  }
  lines.push('  </items>');
  lines.push('</bucketList>');
  return lines.join('\n');
}

/** XML特殊文字をエスケープする */
function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** XMLからやりたいことリストをパースする */
function parseImportXml(xml: string): { items: Array<{ title: string; detail: string; category: string; deadlineYear: number | null; done: boolean }>; categories: string[] } {
  const parser: DOMParser = new DOMParser();
  const doc: Document = parser.parseFromString(xml, 'application/xml');
  const categories: string[] = [];
  const catNodes: NodeListOf<Element> = doc.querySelectorAll('categories > category');
  catNodes.forEach((node) => {
    const name: string = node.textContent?.trim() ?? '';
    if (name) {
      categories.push(name);
    }
  });
  const items: Array<{ title: string; detail: string; category: string; deadlineYear: number | null; done: boolean }> = [];
  const itemNodes: NodeListOf<Element> = doc.querySelectorAll('items > item');
  itemNodes.forEach((node) => {
    const title: string = node.querySelector('title')?.textContent?.trim() ?? '';
    if (!title) {
      return;
    }
    const detail: string = node.querySelector('detail')?.textContent?.trim() ?? '';
    const category: string = node.querySelector('category')?.textContent?.trim() ?? '未分類';
    const yearStr: string = node.querySelector('deadlineYear')?.textContent?.trim() ?? '';
    const deadlineYear: number | null = yearStr ? parseInt(yearStr, 10) : null;
    const done: boolean = node.querySelector('done')?.textContent?.trim() === 'true';
    items.push({ title, detail, category, deadlineYear, done });
  });
  return { items, categories };
}

/**
 * 人生のやりたいことリストパネル
 */
export default function BucketListPanel({ user }: { user: AppUser }): React.ReactElement {
  const isMobile: boolean = useIsMobile();
  const [items, setItems] = useState<BucketItem[]>([]);
  const [categories, setCategories] = useState<BucketCategory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showMobileForm, setShowMobileForm] = useState<boolean>(false);

  // 追加フォーム
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDetail, setNewDetail] = useState<string>('');
  const [newCategory, setNewCategory] = useState<string>('');
  const currentYear: number = new Date().getFullYear();
  const defaultYear: string = String(currentYear + 5);
  const [newDeadlineYear, setNewDeadlineYear] = useState<string>(defaultYear);

  // 共有リンク
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState<boolean>(false);

  // タブ（自分 / 共有リスト閲覧）
  const [bucketTab, setBucketTab] = useState<'mine' | 'shared'>('mine');
  const [sharedUrl, setSharedUrl] = useState<string>('');
  const [sharedData, setSharedData] = useState<{ ownerName: string; ownerAvatar: string; items: Array<{ id: string; title: string; detail: string; category: string; deadlineYear: number | null; done: boolean }>; categories: string[] } | null>(null);
  const [sharedLoading, setSharedLoading] = useState<boolean>(false);
  const [sharedError, setSharedError] = useState<string | null>(null);

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
    // 既存の共有トークンを取得
    fetch('/api/bucket-list/share?userId=' + user.id)
      .then((res) => res.json())
      .then((data) => {
        if (data.shareToken) {
          setShareToken(data.shareToken);
        }
      })
      .catch(() => {});
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
    setNewDeadlineYear(defaultYear);
    setShowMobileForm(false);
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

  /** 共有リンクからトークンを抽出して閲覧する */
  async function loadSharedList(): Promise<void> {
    const url: string = sharedUrl.trim();
    if (!url) {
      return;
    }
    // URLからトークンを抽出（/share/bucket/xxxxx の xxxxx 部分）
    const match: RegExpMatchArray | null = url.match(/\/share\/bucket\/([a-f0-9]+)/);
    const token: string = match ? match[1] : url;

    setSharedLoading(true);
    setSharedError(null);
    try {
      const res: Response = await fetch('/api/bucket-list/share?token=' + token);
      if (!res.ok) {
        setSharedError('このリンクは無効です');
        return;
      }
      const data = await res.json();
      setSharedData(data);
    } catch {
      setSharedError('読み込みに失敗しました');
    } finally {
      setSharedLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ fontSize: 20, marginBottom: 12 }}>人生のやりたいことリスト</h2>

      {/* タブ切替 */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16 }}>
        <button
          onClick={() => setBucketTab('mine')}
          style={{
            flex: 1, padding: '10px 0', border: '1px solid var(--card-border)',
            borderRadius: '8px 0 0 8px', cursor: 'pointer', fontWeight: 600,
            background: bucketTab === 'mine' ? '#3b82f6' : 'var(--card-bg)',
            color: bucketTab === 'mine' ? 'white' : 'var(--foreground)',
          }}
        >
          自分のリスト
        </button>
        <button
          onClick={() => setBucketTab('shared')}
          style={{
            flex: 1, padding: '10px 0', border: '1px solid var(--card-border)',
            borderRadius: '0 8px 8px 0', cursor: 'pointer', fontWeight: 600,
            background: bucketTab === 'shared' ? '#3b82f6' : 'var(--card-bg)',
            color: bucketTab === 'shared' ? 'white' : 'var(--foreground)',
          }}
        >
          共有リストを見る
        </button>
      </div>

      {/* 共有リスト閲覧タブ */}
      {bucketTab === 'shared' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              placeholder="共有リンクのURLを貼り付け"
              value={sharedUrl}
              onChange={(e) => setSharedUrl(e.target.value)}
              className={styles.input}
              onKeyDown={(e) => { if (e.key === 'Enter') { loadSharedList(); } }}
            />
            <button onClick={loadSharedList} className={styles.primaryBtn} style={{ whiteSpace: 'nowrap' }}>
              閲覧
            </button>
          </div>
          {sharedLoading && <p style={{ color: 'var(--muted)' }}>読み込み中...</p>}
          {sharedError && <p style={{ color: '#ef4444' }}>{sharedError}</p>}
          {sharedData && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                {sharedData.ownerAvatar ? (
                  <img src={sharedData.ownerAvatar} alt="" style={{ width: 40, height: 40, borderRadius: '50%' }} />
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👤</div>
                )}
                <span style={{ fontWeight: 700, fontSize: 16 }}>{sharedData.ownerName} のやりたいことリスト</span>
              </div>
              <div style={{ marginBottom: 12, fontSize: 14, color: 'var(--muted)' }}>
                {sharedData.items.filter((i) => i.done).length} / {sharedData.items.length} 達成
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {sharedData.items.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: '10px 14px',
                      background: item.done ? '#f0fdf4' : 'var(--card-bg)',
                      border: `1px solid ${item.done ? '#bbf7d0' : 'var(--card-border)'}`,
                      borderLeft: `4px solid ${item.done ? '#22c55e' : '#3b82f6'}`,
                      borderRadius: 10,
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                    }}
                  >
                    <span style={{ fontSize: 16, marginTop: 2 }}>{item.done ? '✅' : '⬜'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, textDecoration: item.done ? 'line-through' : 'none', opacity: item.done ? 0.6 : 1 }}>
                          {item.title}
                        </span>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>
                            {item.category}
                          </span>
                          {item.deadlineYear && (
                            <span style={{ fontSize: 13, color: 'var(--muted)' }}>{item.deadlineYear}年</span>
                          )}
                        </div>
                      </div>
                      {item.detail && (
                        <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 4 }}>{item.detail}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 自分のリスト */}
      {bucketTab === 'mine' && <>

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

      {/* エクスポート/インポート（PC版のみ） */}
      {!isMobile && items.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button
            className={styles.iconBtn}
            style={{ fontSize: 13 }}
            onClick={() => {
              const xml: string = buildExportXml(items, categories);
              const blob: Blob = new Blob([xml], { type: 'application/xml' });
              const url: string = URL.createObjectURL(blob);
              const a: HTMLAnchorElement = document.createElement('a');
              a.href = url;
              a.download = 'bucket-list.xml';
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            エクスポート（XML）
          </button>
          <label className={styles.iconBtn} style={{ fontSize: 13, cursor: 'pointer' }}>
            インポート（XML）
            <input
              type="file"
              accept=".xml"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const file: File | undefined = e.target.files?.[0];
                if (!file) {
                  return;
                }
                const text: string = await file.text();
                const imported: { items: Array<{ title: string; detail: string; category: string; deadlineYear: number | null; done: boolean }>; categories: string[] } = parseImportXml(text);
                if (imported.items.length === 0) {
                  alert('インポートできる項目がありませんでした');
                  return;
                }
                // カテゴリを追加
                for (const catName of imported.categories) {
                  if (!categories.some((c) => c.name === catName)) {
                    const res: Response = await fetch('/api/bucket-list', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ type: 'category', userId: user.id, name: catName }),
                    });
                    const data = await res.json();
                    setCategories((prev) => [...prev, { id: data.id, name: catName }]);
                  }
                }
                // アイテムを追加
                for (const item of imported.items) {
                  const res: Response = await fetch('/api/bucket-list', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      userId: user.id,
                      title: item.title,
                      detail: item.detail,
                      category: item.category,
                      deadlineYear: item.deadlineYear,
                    }),
                  });
                  const data = await res.json();
                  setItems((prev) => [{
                    id: data.id,
                    title: item.title,
                    detail: item.detail,
                    category: item.category,
                    deadlineYear: item.deadlineYear,
                    done: item.done,
                    sortOrder: 0,
                    createdAt: Date.now(),
                  }, ...prev]);
                  if (item.done) {
                    await fetch('/api/bucket-list', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ id: data.id, updates: { done: true } }),
                    });
                  }
                }
                alert(`${imported.items.length}件インポートしました`);
                e.target.value = '';
              }}
            />
          </label>
          <button
            className={styles.iconBtn}
            style={{ fontSize: 13 }}
            onClick={async () => {
              const res: Response = await fetch('/api/bucket-list/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id }),
              });
              const data = await res.json();
              const token: string = data.shareToken;
              setShareToken(token);
              const shareUrl: string = window.location.origin + '/share/bucket/' + token;
              await navigator.clipboard.writeText(shareUrl);
              setShareCopied(true);
              setTimeout(() => setShareCopied(false), 2000);
            }}
          >
            {shareCopied ? 'コピーしました！' : shareToken ? '共有リンクをコピー' : '共有リンクを作成'}
          </button>
          {shareToken && (
            <button
              className={styles.dangerIconBtn}
              style={{ fontSize: 13 }}
              onClick={async () => {
                await fetch('/api/bucket-list/share', {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId: user.id }),
                });
                setShareToken(null);
              }}
            >
              共有を停止
            </button>
          )}
        </div>
      )}

      {/* 追加フォーム（共通部品） */}
      {(() => {
        const formContent = (
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
                      padding: '4px 12px', borderRadius: 999,
                      border: newCategory === name ? '2px solid #3b82f6' : '1px solid var(--card-border)',
                      background: newCategory === name ? '#dbeafe' : 'var(--card-bg)',
                      color: newCategory === name ? '#1d4ed8' : 'var(--foreground)',
                      cursor: 'pointer', fontSize: 13, fontWeight: newCategory === name ? 600 : 400,
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
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
              <div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>目標年</div>
                <select
                  value={newDeadlineYear}
                  onChange={(e) => setNewDeadlineYear(e.target.value)}
                  className={styles.input}
                >
                  <option value="">指定しない</option>
                  {Array.from({ length: 31 }, (_, i) => currentYear + i).map((year) => (
                    <option key={year} value={String(year)}>{year}年</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button onClick={addItem} className={styles.primaryBtn} style={{ width: '100%' }}>追加</button>
              </div>
            </div>
          </div>
        );

        if (isMobile) {
          return (
            <>
              {showMobileForm && (
                <div
                  style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
                  onClick={(e) => { if (e.target === e.currentTarget) { setShowMobileForm(false); } }}
                >
                  <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 20, width: '100%', maxWidth: 480, maxHeight: '80vh', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ fontWeight: 700, fontSize: 16 }}>やりたいことを追加</span>
                      <button onClick={() => setShowMobileForm(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted)' }}>×</button>
                    </div>
                    {formContent}
                  </div>
                </div>
              )}
            </>
          );
        }

        return (
          <div style={{ marginBottom: 16, padding: 16, background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--card-border)' }}>
            {formContent}
          </div>
        );
      })()}

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
                  <select value={editDeadlineYear} onChange={(e) => setEditDeadlineYear(e.target.value)} className={styles.input} style={{ width: 120 }}>
                    <option value="">指定しない</option>
                    {Array.from({ length: 31 }, (_, i) => currentYear + i).map((year) => (
                      <option key={year} value={String(year)}>{year}年</option>
                    ))}
                  </select>
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

      </>}

      {/* スマホ用＋ボタン */}
      {isMobile && bucketTab === 'mine' && (
        <button
          onClick={() => setShowMobileForm(true)}
          style={{
            position: 'fixed',
            bottom: 80,
            right: 20,
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            fontSize: 28,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(59,130,246,0.4)',
            zIndex: 8000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          +
        </button>
      )}
    </div>
  );
}
