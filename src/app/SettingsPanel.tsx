'use client';

import { useState } from 'react';
import type { UserSettings } from './types';
import { log } from './utils';
import styles from './page.module.css';

/** 選択可能なフォント一覧 */
const FONT_OPTIONS: { label: string; value: string }[] = [
  { label: 'システム標準', value: 'system-ui, sans-serif' },
  { label: 'ゴシック体', value: '"Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif' },
  { label: '明朝体', value: '"Hiragino Mincho ProN", "Noto Serif JP", serif' },
  { label: 'モノスペース', value: '"Fira Code", "Source Code Pro", monospace' },
];

/**
 * 設定パネルコンポーネント
 * ダークモード・フォントサイズ・フォント種類を変更し、即座に反映する
 * @param settings - 現在の設定
 * @param onUpdate - 設定変更時のコールバック
 * @param userId - ログイン中のユーザーID
 */
export default function SettingsPanel({
  settings,
  onUpdate,
  userId,
}: {
  settings: UserSettings;
  onUpdate: (updated: UserSettings) => void;
  userId: string;
}): React.ReactElement {
  const [localSettings, setLocalSettings] = useState<UserSettings>(settings);
  const [msg, setMsg] = useState<string>('');

  /**
   * 設定を変更し、即座にAPIに保存する
   * @param patch - 変更するフィールド
   */
  async function updateSetting(patch: Partial<UserSettings>): Promise<void> {
    const updated: UserSettings = { ...localSettings, ...patch };
    setLocalSettings(updated);
    onUpdate(updated);

    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, settings: updated }),
    });

    setMsg('保存しました');
    window.setTimeout(() => setMsg(''), 2000);
    log('settings:update', patch);
  }

  return (
    <div className={styles.myPage}>
      <section className={styles.myPageSection}>
        <h2 className={styles.myPageHeading}>表示設定</h2>
        <div className={styles.myPageForm}>

          {/* ダークモード */}
          <div className={styles.settingsRow}>
            <span className={styles.settingsLabel}>ダークモード</span>
            <button
              type="button"
              className={localSettings.darkMode ? styles.toggleBtnOn : styles.toggleBtnOff}
              onClick={() => updateSetting({ darkMode: !localSettings.darkMode })}
            >
              {localSettings.darkMode ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* フォントサイズ */}
          <div>
            <label className={styles.fieldLabel}>文字の大きさ</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              {[{ label: '小', value: 14 }, { label: '中', value: 16 }, { label: '大', value: 19 }].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateSetting({ fontSize: opt.value })}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
                    border: localSettings.fontSize === opt.value ? '2px solid #3b82f6' : '1px solid var(--card-border)',
                    background: localSettings.fontSize === opt.value ? '#dbeafe' : 'var(--card-bg)',
                    color: localSettings.fontSize === opt.value ? '#1d4ed8' : 'var(--foreground)',
                    fontSize: opt.value + 'px',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* フォント種類 */}
          <div>
            <label className={styles.fieldLabel}>フォント</label>
            <select
              value={localSettings.fontFamily}
              onChange={(e) => updateSetting({ fontFamily: e.target.value })}
              className={styles.input}
            >
              {FONT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* プレビュー */}
          <div>
            <label className={styles.fieldLabel}>プレビュー</label>
            <div
              className={styles.settingsPreview}
              style={{
                fontSize: localSettings.fontSize + 'px',
                fontFamily: localSettings.fontFamily,
                background: localSettings.darkMode ? '#1a1a2e' : '#ffffff',
                color: localSettings.darkMode ? '#e5e7eb' : '#1a1a2e',
              }}
            >
              これはプレビューテキストです。ABCabc123
            </div>
          </div>

          {msg && <p className={styles.myPageSuccess}>{msg}</p>}
        </div>
      </section>

      {/* 執事設定 */}
      <section className={styles.myPageSection}>
        <h2 className={styles.myPageHeading}>執事キャラクター</h2>
        <div className={styles.myPageForm}>

          {/* 表示ON/OFF */}
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={localSettings.showButler !== false}
                onChange={(e) => updateSetting({ showButler: e.target.checked })}
              />
              執事を表示する
            </label>
          </div>

          {/* アイコン */}
          <div className={styles.avatarSection}>
            <div
              className={styles.butlerPreviewIcon}
              style={localSettings.butlerAvatar ? { backgroundImage: `url(${localSettings.butlerAvatar})` } : {}}
            >
              {!localSettings.butlerAvatar && '🎩'}
            </div>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => {
                const input: HTMLInputElement = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = () => {
                  const file: File | undefined = input.files?.[0];
                  if (!file) {
                    return;
                  }
                  const reader: FileReader = new FileReader();
                  reader.onload = () => {
                    updateSetting({ butlerAvatar: reader.result as string });
                  };
                  reader.readAsDataURL(file);
                };
                input.click();
              }}
            >
              画像を変更
            </button>
            {localSettings.butlerAvatar && (
              <button
                type="button"
                className={styles.dangerIconBtn}
                onClick={() => updateSetting({ butlerAvatar: '' })}
              >
                デフォルトに戻す
              </button>
            )}
          </div>

          {/* プロンプト */}
          <div>
            <label className={styles.fieldLabel}>
              励ましの指示（{localSettings.butlerPrompt.length}/100文字）
            </label>
            <input
              type="text"
              value={localSettings.butlerPrompt}
              onChange={(e) => {
                if (e.target.value.length <= 100) {
                  updateSetting({ butlerPrompt: e.target.value });
                }
              }}
              className={styles.input}
              placeholder="例: ユーザーを励ませ"
              maxLength={100}
            />
          </div>

          {/* 最大文字数 */}
          <div>
            <label className={styles.fieldLabel}>
              吹き出しの最大文字数: {localSettings.butlerMaxChars}文字
            </label>
            <input
              type="range"
              min={30}
              max={200}
              step={10}
              value={localSettings.butlerMaxChars}
              onChange={(e) => updateSetting({ butlerMaxChars: parseInt(e.target.value, 10) })}
              className={styles.rangeInput}
            />
            <div className={styles.settingsRangeLabels}>
              <span>30文字</span>
              <span>200文字</span>
            </div>
          </div>
        </div>
      </section>

      {/* ポモドーロ */}
      <section className={styles.settingsSection}>
        <h3 className={styles.settingsSectionTitle}>ポモドーロタイマー</h3>
        <div className={styles.settingsRow}>
          <label className={styles.fieldLabel}>作業時間（分）</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="range"
              min="5"
              max="60"
              step="5"
              value={localSettings.pomodoroWork ?? 25}
              onChange={(e) => updateSetting({ pomodoroWork: parseInt(e.target.value, 10) })}
              style={{ flex: 1 }}
            />
            <span style={{ minWidth: 40, textAlign: 'right', fontWeight: 600 }}>{localSettings.pomodoroWork ?? 25}分</span>
          </div>
        </div>
        <div className={styles.settingsRow}>
          <label className={styles.fieldLabel}>休憩時間（分）</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="range"
              min="1"
              max="30"
              step="1"
              value={localSettings.pomodoroBreak ?? 5}
              onChange={(e) => updateSetting({ pomodoroBreak: parseInt(e.target.value, 10) })}
              style={{ flex: 1 }}
            />
            <span style={{ minWidth: 40, textAlign: 'right', fontWeight: 600 }}>{localSettings.pomodoroBreak ?? 5}分</span>
          </div>
        </div>
      </section>

      {/* Welcomeメッセージ */}
      <section className={styles.settingsSection}>
        <h3 className={styles.settingsSectionTitle}>Welcomeメッセージ</h3>
        <div className={styles.settingsRow}>
          <label className={styles.fieldLabel}>メッセージのトーン</label>
          <select
            value={localSettings.welcomeTone ?? 'trivia'}
            onChange={(e) => updateSetting({ welcomeTone: e.target.value })}
            className={styles.input}
          >
            <option value="trivia">豆知識</option>
            <option value="beauty">美容</option>
            <option value="mindset">マインドセット</option>
            <option value="productivity">生産性</option>
            <option value="history">歴史</option>
          </select>
        </div>
      </section>
    </div>
  );
}
