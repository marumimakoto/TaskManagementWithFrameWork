'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type SharedItem = {
  id: string;
  title: string;
  detail: string;
  category: string;
  deadlineYear: number | null;
  done: boolean;
};

/**
 * 公開やりたいことリスト閲覧ページ
 * ログイン不要。共有リンクのトークンでアクセスする
 */
export default function SharedBucketPage(): React.ReactElement {
  const params = useParams();
  const token: string = params.token as string;

  const [ownerName, setOwnerName] = useState<string>('');
  const [ownerAvatar, setOwnerAvatar] = useState<string>('');
  const [items, setItems] = useState<SharedItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  useEffect(() => {
    async function fetchData(): Promise<void> {
      try {
        const res: Response = await fetch('/api/bucket-list/share?token=' + token);
        if (!res.ok) {
          setError('このリンクは無効です');
          setLoading(false);
          return;
        }
        const data = await res.json();
        setOwnerName(data.ownerName);
        setOwnerAvatar(data.ownerAvatar ?? '');
        setItems(data.items);
        setCategories(data.categories ?? []);
      } catch {
        setError('読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [token]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa' }}>
        読み込み中...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: 18, color: '#ef4444' }}>{error}</p>
        <a href="/" style={{ color: '#3b82f6' }}>トップページへ</a>
      </div>
    );
  }

  const totalCount: number = items.length;
  const doneCount: number = items.filter((i) => i.done).length;
  const achieveRate: number = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const filtered: SharedItem[] = filterCategory === 'all'
    ? items
    : items.filter((i) => i.category === filterCategory);

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', padding: 24 }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        {/* ヘッダー */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          {ownerAvatar ? (
            <img src={ownerAvatar} alt="" style={{ width: 64, height: 64, borderRadius: '50%', marginBottom: 8 }} />
          ) : (
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#e2e8f0', margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>👤</div>
          )}
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>{ownerName} のやりたいことリスト</h1>
        </div>

        {/* 達成率 */}
        <div style={{ marginBottom: 16, padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>達成率</span>
            <span style={{ fontSize: 24, fontWeight: 700, color: '#3b82f6' }}>{achieveRate}%</span>
          </div>
          <div style={{ width: '100%', height: 8, background: '#e5e7eb', borderRadius: 4 }}>
            <div style={{ width: `${achieveRate}%`, height: '100%', background: '#3b82f6', borderRadius: 4 }} />
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: '#6b7280' }}>
            {doneCount} / {totalCount} 達成
          </div>
        </div>

        {/* カテゴリフィルター */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilterCategory('all')}
            style={{
              padding: '4px 12px', borderRadius: 999, fontSize: 13, cursor: 'pointer',
              border: filterCategory === 'all' ? '2px solid #3b82f6' : '1px solid #e5e7eb',
              background: filterCategory === 'all' ? '#dbeafe' : '#fff',
              color: filterCategory === 'all' ? '#1d4ed8' : '#1a1a2e',
              fontWeight: filterCategory === 'all' ? 600 : 400,
            }}
          >
            全て
          </button>
          {categories.map((name) => (
            <button
              key={name}
              onClick={() => setFilterCategory(name)}
              style={{
                padding: '4px 12px', borderRadius: 999, fontSize: 13, cursor: 'pointer',
                border: filterCategory === name ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                background: filterCategory === name ? '#dbeafe' : '#fff',
                color: filterCategory === name ? '#1d4ed8' : '#1a1a2e',
                fontWeight: filterCategory === name ? 600 : 400,
              }}
            >
              {name}
            </button>
          ))}
        </div>

        {/* リスト */}
        <div style={{ display: 'grid', gap: 8 }}>
          {filtered.map((item) => (
            <div
              key={item.id}
              style={{
                padding: '12px 16px',
                background: item.done ? '#f0fdf4' : '#fff',
                border: `1px solid ${item.done ? '#bbf7d0' : '#e5e7eb'}`,
                borderLeft: `4px solid ${item.done ? '#22c55e' : '#3b82f6'}`,
                borderRadius: 10,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <span style={{ fontSize: 18, marginTop: 2 }}>{item.done ? '✅' : '⬜'}</span>
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
                      <span style={{ fontSize: 13, color: '#6b7280' }}>{item.deadlineYear}年</span>
                    )}
                  </div>
                </div>
                {item.detail && (
                  <div style={{ fontSize: 14, color: '#6b7280', marginTop: 4, opacity: item.done ? 0.5 : 1 }}>
                    {item.detail}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* フッター */}
        <div style={{ textAlign: 'center', marginTop: 32, color: '#9ca3af', fontSize: 13 }}>
          <a href="/" style={{ color: '#3b82f6' }}>Kiroku</a> で作成
        </div>
      </div>
    </div>
  );
}
