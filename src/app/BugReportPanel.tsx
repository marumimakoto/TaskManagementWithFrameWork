'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AppUser } from './types';
import { formatDateTime } from './utils';
import styles from './page.module.css';

interface BugReport {
  id: string;
  userId: string;
  userName: string;
  title: string;
  description: string;
  status: string;
  adminReply?: string;
  createdAt: number;
  updatedAt: number;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open: { label: '未対応', color: '#ef4444' },
  in_progress: { label: '対応中', color: '#f59e0b' },
  resolved: { label: '解決済み', color: '#22c55e' },
  closed: { label: 'クローズ', color: '#6b7280' },
};

/**
 * バグ報告ページ
 * 一般ユーザー: 自分の報告一覧 + 新規投稿
 * 管理者: 全報告一覧 + 返信・ステータス変更
 */
export default function BugReportPanel({ user }: { user: AppUser }): React.ReactElement {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<string>('');
  const [replyStatus, setReplyStatus] = useState<string>('in_progress');

  const isAdmin: boolean = user.role === 'admin';

  const fetchReports = useCallback(async (): Promise<void> => {
    try {
      let url: string = '/api/bug-reports?userId=' + user.id;
      if (isAdmin) {
        url += '&role=admin';
      }
      const res: Response = await fetch(url);
      const data: BugReport[] = await res.json();
      setReports(data);
    } catch (e) {
      console.error('Failed to fetch bug reports', e);
    } finally {
      setLoading(false);
    }
  }, [user.id, isAdmin]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  async function submitReport(): Promise<void> {
    if (!title.trim() || !description.trim()) {
      return;
    }
    try {
      await fetch('/api/bug-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          userName: user.name,
          title: title.trim(),
          description: description.trim(),
        }),
      });
      setTitle('');
      setDescription('');
      setMessage('バグ報告を送信しました');
      setTimeout(() => setMessage(''), 3000);
      await fetchReports();
    } catch (e) {
      console.error('Failed to submit bug report', e);
    }
  }

  async function submitReply(id: string): Promise<void> {
    try {
      await fetch('/api/bug-reports', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          status: replyStatus,
          adminReply: replyText.trim(),
        }),
      });
      setReplyingId(null);
      setReplyText('');
      await fetchReports();
    } catch (e) {
      console.error('Failed to reply', e);
    }
  }

  return (
    <div className={styles.diaryPanel}>
      {/* 新規報告フォーム */}
      {!isAdmin && (
        <section className={styles.diaryForm}>
          <h3 className={styles.panelTitle}>バグ・問い合わせを報告</h3>
          <label className={styles.fieldLabel}>タイトル</label>
          <input
            type="text"
            placeholder="例: ドラッグ操作ができない"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={styles.input}
          />
          <label className={styles.fieldLabel}>詳細</label>
          <textarea
            placeholder="発生した問題の詳細を記入してください"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={styles.textarea}
            rows={4}
          />
          <button
            type="button"
            onClick={submitReport}
            className={styles.primaryBtn}
            disabled={!title.trim() || !description.trim()}
          >
            送信
          </button>
          {message && (
            <p style={{ color: '#22c55e', fontSize: '13px', marginTop: 8 }}>{message}</p>
          )}
        </section>
      )}

      {isAdmin && (
        <h3 className={styles.panelTitle}>バグ報告一覧（管理者）</h3>
      )}

      {loading && <p className={styles.diaryEmpty}>読み込み中...</p>}

      {!loading && reports.length === 0 && (
        <p className={styles.diaryEmpty}>報告はありません</p>
      )}

      {!loading && reports.length > 0 && (
        <div className={styles.archiveList}>
          {reports.map((r: BugReport) => {
            const statusInfo = STATUS_LABELS[r.status] ?? { label: r.status, color: '#6b7280' };
            return (
              <div key={r.id} className={styles.archiveCard}>
                <div className={styles.archiveCardMain}>
                  <span
                    className={styles.activityTypeBadge}
                    style={{ background: statusInfo.color }}
                  >
                    {statusInfo.label}
                  </span>
                  <span className={styles.archiveTitle}>{r.title}</span>
                  {isAdmin && (
                    <span className={styles.archiveDeadline}>{r.userName}</span>
                  )}
                </div>
                <p className={styles.activityContent}>{r.description}</p>
                <span className={styles.archiveMetaText}>
                  {formatDateTime(r.createdAt)}
                </span>

                {/* 管理者からの返信 */}
                {r.adminReply && (
                  <div className={styles.helpStepHint} style={{ marginTop: 8 }}>
                    <span className={styles.helpStepHintLabel}>管理者からの返信</span>
                    <p className={styles.helpStepHintText}>{r.adminReply}</p>
                  </div>
                )}

                {/* 管理者用: 返信フォーム */}
                {isAdmin && replyingId === r.id && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <select
                      value={replyStatus}
                      onChange={(e) => setReplyStatus(e.target.value)}
                      className={styles.input}
                      style={{ maxWidth: 200 }}
                    >
                      <option value="open">未対応</option>
                      <option value="in_progress">対応中</option>
                      <option value="resolved">解決済み</option>
                      <option value="closed">クローズ</option>
                    </select>
                    <textarea
                      placeholder="返信内容"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      className={styles.textarea}
                      rows={2}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className={styles.primaryBtn}
                        style={{ fontSize: '12px', padding: '4px 12px' }}
                        onClick={() => submitReply(r.id)}
                      >
                        送信
                      </button>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => setReplyingId(null)}
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                )}

                {isAdmin && replyingId !== r.id && (
                  <button
                    type="button"
                    className={styles.iconBtn}
                    style={{ marginTop: 6, fontSize: '12px' }}
                    onClick={() => { setReplyingId(r.id); setReplyText(r.adminReply ?? ''); setReplyStatus(r.status); }}
                  >
                    返信・ステータス変更
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
