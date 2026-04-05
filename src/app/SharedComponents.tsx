'use client';

import { useState } from 'react';
import styles from './page.module.css';

/**
 * ドラッグハンドル
 * ドラッグ開始時に onDragStart を呼び出す
 */
export function DragHandle({
  onDragStart,
  onDragEnd,
  onMouseDown,
}: {
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
}): React.ReactElement {
  return (
    <div
      className={styles.dragHandle}
      draggable
      onMouseDown={(e) => {
        e.stopPropagation();
        if (onMouseDown) {
          onMouseDown(e);
        }
      }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      title="ドラッグして移動・階層化"
    >
      ⠿
    </div>
  );
}

/**
 * 移動操作ボタンバー（▲上 ▼下 ▶階層化 ◀階層戻す）
 */
export function MoveButtonBar({
  onUp,
  onDown,
  onNest,
  onUnnest,
  hasParent,
}: {
  onUp: () => void;
  onDown: () => void;
  onNest: () => void;
  onUnnest: () => void;
  hasParent: boolean;
}): React.ReactElement {
  return (
    <div className={styles.moveButtonBar}>
      <button type="button" className={styles.moveBtn} onClick={onUp} title="上に移動">
        ▲ 上
      </button>
      <button type="button" className={styles.moveBtn} onClick={onDown} title="下に移動">
        ▼ 下
      </button>
      <button type="button" className={styles.moveBtn} onClick={onNest} title="子タスクにする（右に階層化）">
        ▶ 階層化
      </button>
      <button type="button" className={styles.moveBtn} onClick={onUnnest} disabled={!hasParent} title="親の階層に戻す（左に移動）">
        ◀ 階層戻す
      </button>
    </div>
  );
}

/**
 * ダブルクリックでインライン編集できるテキスト
 * 通常時はテキスト表示、ダブルクリックでinputに切り替わる
 */
export function InlineEditText({
  value,
  displayValue,
  onSave,
  className,
  inputType,
  inputClassName,
  placeholder,
}: {
  value: string;
  displayValue?: string;
  onSave: (newValue: string) => void;
  className?: string;
  inputType?: string;
  inputClassName?: string;
  placeholder?: string;
}): React.ReactElement {
  const [editing, setEditing] = useState<boolean>(false);
  const [editValue, setEditValue] = useState<string>(value);

  function startEdit(e: React.MouseEvent): void {
    e.stopPropagation();
    setEditValue(value);
    setEditing(true);
  }

  function save(): void {
    onSave(editValue);
    setEditing(false);
  }

  function cancel(): void {
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        type={inputType ?? 'text'}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { save(); }
          if (e.key === 'Escape') { cancel(); }
        }}
        onClick={(e) => e.stopPropagation()}
        className={inputClassName ?? styles.input}
        placeholder={placeholder}
        autoFocus
      />
    );
  }

  return (
    <span
      className={className}
      onDoubleClick={startEdit}
      title="ダブルクリックで編集"
    >
      {displayValue ?? value}
    </span>
  );
}

/**
 * ダブルクリックでインライン編集できるテキストエリア
 */
export function InlineEditTextarea({
  value,
  displayValue,
  onSave,
  className,
  placeholder,
}: {
  value: string;
  displayValue?: string;
  onSave: (newValue: string) => void;
  className?: string;
  placeholder?: string;
}): React.ReactElement {
  const [editing, setEditing] = useState<boolean>(false);
  const [editValue, setEditValue] = useState<string>(value);

  function startEdit(e: React.MouseEvent): void {
    e.stopPropagation();
    setEditValue(value);
    setEditing(true);
  }

  function save(): void {
    onSave(editValue);
    setEditing(false);
  }

  if (editing) {
    return (
      <textarea
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setEditing(false); }
        }}
        onClick={(e) => e.stopPropagation()}
        className={styles.textarea}
        rows={2}
        placeholder={placeholder}
        autoFocus
      />
    );
  }

  return (
    <p
      className={className}
      onDoubleClick={startEdit}
      style={{ cursor: 'pointer' }}
    >
      {displayValue ?? (value || placeholder || '')}
    </p>
  );
}

/**
 * 削除ボタン
 */
export function DeleteButton({
  onClick,
}: {
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={styles.dangerIconBtn}
      title="削除"
    >
      🗑
    </button>
  );
}

/**
 * モード切替バー（タブバー）
 */
export function ModeBar({
  modes,
  current,
  onChange,
}: {
  modes: { key: string; label: string }[];
  current: string;
  onChange: (key: string) => void;
}): React.ReactElement {
  return (
    <div className={styles.diaryModeBar}>
      {modes.map((mode) => (
        <button
          key={mode.key}
          type="button"
          className={`${styles.diaryModeBtn} ${current === mode.key ? styles.diaryModeBtnActive : ''}`}
          onClick={() => onChange(mode.key)}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}

/**
 * ページネーション
 */
export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  onPrevious,
  onNext,
}: {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  onPrevious: () => void;
  onNext: () => void;
}): React.ReactElement | null {
  if (totalPages <= 1) {
    return null;
  }
  return (
    <div className={styles.pagination}>
      <button
        type="button"
        className={styles.iconBtn}
        onClick={onPrevious}
        disabled={currentPage === 1}
      >
        ← 前へ
      </button>
      <span className={styles.paginationInfo}>
        {currentPage} / {totalPages} ページ{totalItems !== undefined ? `（全${totalItems}件）` : ''}
      </span>
      <button
        type="button"
        className={styles.iconBtn}
        onClick={onNext}
        disabled={currentPage === totalPages}
      >
        次へ →
      </button>
    </div>
  );
}

/**
 * 空状態メッセージ
 */
export function EmptyState({ message }: { message: string }): React.ReactElement {
  return <p className={styles.diaryEmpty}>{message}</p>;
}
