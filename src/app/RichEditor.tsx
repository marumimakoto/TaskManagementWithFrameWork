'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { useEffect } from 'react';
import styles from './page.module.css';

/**
 * リッチテキストエディタコンポーネント
 * 太字・イタリック・見出し・リスト・画像挿入に対応
 * @param content - 初期HTML文字列
 * @param onChange - 内容変更時のコールバック（HTML文字列）
 * @param placeholder - プレースホルダーテキスト
 */
export default function RichEditor({
  content,
  onChange,
  placeholder,
}: {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}): React.ReactElement {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
    ],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  /** 画像をURLで挿入する */
  function insertImage(): void {
    if (!editor) {
      return;
    }
    const url: string | null = window.prompt('画像のURLを入力');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }

  /** ファイル選択から画像をBase64で挿入する */
  function uploadImage(): void {
    if (!editor) {
      return;
    }
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
        const result: string = reader.result as string;
        editor.chain().focus().setImage({ src: result }).run();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  return (
    <div className={styles.richEditor}>
      {/* ツールバー */}
      <div className={styles.richToolbar}>
        <button
          type="button"
          className={`${styles.richToolBtn} ${editor?.isActive('bold') ? styles.richToolBtnActive : ''}`}
          onClick={() => editor?.chain().focus().toggleBold().run()}
          title="太字"
        >
          B
        </button>
        <button
          type="button"
          className={`${styles.richToolBtn} ${editor?.isActive('italic') ? styles.richToolBtnActive : ''}`}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          title="斜体"
        >
          I
        </button>
        <button
          type="button"
          className={`${styles.richToolBtn} ${editor?.isActive('heading', { level: 2 }) ? styles.richToolBtnActive : ''}`}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          title="見出し"
        >
          H
        </button>
        <button
          type="button"
          className={`${styles.richToolBtn} ${editor?.isActive('bulletList') ? styles.richToolBtnActive : ''}`}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          title="箇条書き"
        >
          ・
        </button>
        <span className={styles.richToolSep} />
        <button
          type="button"
          className={styles.richToolBtn}
          onClick={uploadImage}
          title="画像を挿入（ファイル）"
        >
          画像
        </button>
        <button
          type="button"
          className={styles.richToolBtn}
          onClick={insertImage}
          title="画像を挿入（URL）"
        >
          URL
        </button>
      </div>

      {/* エディタ本体 */}
      <EditorContent editor={editor} className={styles.richContent} />
    </div>
  );
}
