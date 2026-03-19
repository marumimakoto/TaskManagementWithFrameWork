'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AppUser } from './types';
import { log } from './utils';
import styles from './page.module.css';

/** 公開日記の表示データ */
interface PublicDiaryItem {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  title: string;
  date: string;
  content: string;
  like_count: number;
  reply_count: number;
  liked: boolean;
  created_at: number;
}

/** リプライ */
interface Reply {
  id: string;
  user_name: string;
  user_avatar: string | null;
  content: string;
  created_at: number;
}

/**
 * 他の人の公開日記を閲覧するパネル（いいね・リプ機能付き）
 */
export default function PublicDiaryPanel({ user }: { user: AppUser }): React.ReactElement {
  const [entries, setEntries] = useState<PublicDiaryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [openReplyId, setOpenReplyId] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, Reply[]>>({});
  const [replyInput, setReplyInput] = useState<string>('');

  const fetchPublic = useCallback(async (): Promise<void> => {
    try {
      const res: Response = await fetch('/api/diary/public?userId=' + user.id);
      const data: PublicDiaryItem[] = await res.json();
      setEntries(data);
    } catch (e) {
      console.warn('Failed to fetch public diaries', e);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    fetchPublic();
  }, [fetchPublic]);

  /** いいねトグル */
  async function toggleLike(diaryId: string): Promise<void> {
    const res: Response = await fetch('/api/diary/' + diaryId + '/likes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    });
    const data: { count: number; liked: boolean } = await res.json();
    setEntries((prev) =>
      prev.map((e) => (e.id === diaryId ? { ...e, like_count: data.count, liked: data.liked } : e)),
    );
  }

  /** リプ展開 */
  async function toggleReply(diaryId: string): Promise<void> {
    if (openReplyId === diaryId) {
      setOpenReplyId(null);
      return;
    }
    setOpenReplyId(diaryId);
    const res: Response = await fetch('/api/diary/' + diaryId + '/replies');
    const data: Reply[] = await res.json();
    setReplies((prev) => ({ ...prev, [diaryId]: data }));
  }

  /** リプ送信 */
  async function sendReply(diaryId: string): Promise<void> {
    const content: string = replyInput.trim();
    if (!content) {
      return;
    }
    const res: Response = await fetch('/api/diary/' + diaryId + '/replies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, content }),
    });
    const newReply: Reply = await res.json();
    setReplies((prev) => ({
      ...prev,
      [diaryId]: [...(prev[diaryId] ?? []), newReply],
    }));
    setReplyInput('');
    setEntries((prev) =>
      prev.map((e) => (e.id === diaryId ? { ...e, reply_count: e.reply_count + 1 } : e)),
    );
  }

  if (loading) {
    return <p>読み込み中...</p>;
  }

  return (
    <div className={styles.diaryPanel}>
      <section className={styles.diaryList}>
        {entries.length === 0 && (
          <p className={styles.diaryEmpty}>公開されている日記はまだありません</p>
        )}
        {entries.map((entry: PublicDiaryItem) => (
          <div key={entry.id} className={styles.publicDiaryRow}>
            <div className={styles.publicDiaryAuthor}>
              <div
                className={styles.avatarSmall}
                style={entry.user_avatar ? { backgroundImage: `url(${entry.user_avatar})` } : {}}
              >
                {!entry.user_avatar && entry.user_name.charAt(0)}
              </div>
              <span className={styles.publicAuthorName}>{entry.user_name}</span>
            </div>
            <div
              className={styles.diaryCard}
              style={{ flex: 1, background: entry.user_id === user.id ? '#fdf2f8' : undefined }}
            >
              <div className={styles.diaryCardHeader}>
                <div className={styles.diaryDateTitleInline}>
                  <span className={styles.diaryDate}>{entry.date}</span>
                  <span className={styles.diaryTitle}>{entry.title}</span>
                </div>
              </div>
              <div className={styles.diaryContent} dangerouslySetInnerHTML={{ __html: entry.content }} />

              {/* いいね・リプボタン */}
              <div className={styles.socialBar}>
                <button
                  type="button"
                  className={`${styles.socialBtn} ${entry.liked ? styles.socialBtnActive : ''}`}
                  onClick={() => toggleLike(entry.id)}
                >
                  {entry.liked ? '❤️' : '🤍'} {entry.like_count}
                </button>
                <button
                  type="button"
                  className={styles.socialBtn}
                  onClick={() => toggleReply(entry.id)}
                >
                  💬 {entry.reply_count}
                </button>
              </div>

              {/* リプ欄 */}
              {openReplyId === entry.id && (
                <div className={styles.replyArea}>
                  <div className={styles.replyList}>
                    {(replies[entry.id] ?? []).map((r: Reply) => (
                      <div key={r.id} className={styles.replyItem}>
                        <div
                          className={styles.avatarTiny}
                          style={r.user_avatar ? { backgroundImage: `url(${r.user_avatar})` } : {}}
                        >
                          {!r.user_avatar && r.user_name.charAt(0)}
                        </div>
                        <div>
                          <span className={styles.replyAuthor}>{r.user_name}</span>
                          <span className={styles.replyContent}>{r.content}</span>
                        </div>
                      </div>
                    ))}
                    {(replies[entry.id] ?? []).length === 0 && (
                      <p className={styles.diaryEmpty}>まだリプライはありません</p>
                    )}
                  </div>
                  <div className={styles.replyInputRow}>
                    <input
                      type="text"
                      placeholder="リプライを書く..."
                      value={replyInput}
                      onChange={(e) => setReplyInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          sendReply(entry.id);
                        }
                      }}
                      className={styles.input}
                    />
                    <button type="button" onClick={() => sendReply(entry.id)} className={styles.iconBtn}>
                      送信
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
