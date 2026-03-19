'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * APIからデータを取得するカスタムフック
 * @param url - APIのURL
 * @returns { data, loading, refetch }
 */
export function useFetchData<T>(url: string): { data: T | null; loading: boolean; refetch: () => Promise<void> } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchData = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res: Response = await fetch(url);
      const json: T = await res.json();
      setData(json);
    } catch (e) {
      console.error('Failed to fetch:', url, e);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, refetch: fetchData };
}

/**
 * 一時メッセージを管理するカスタムフック
 * @param duration - メッセージが消えるまでのミリ秒（デフォルト3000）
 * @returns { message, showMessage }
 */
export function useMessage(duration: number = 3000): { message: string; showMessage: (msg: string) => void } {
  const [message, setMessage] = useState<string>('');
  const timerRef = useRef<number | null>(null);

  function showMessage(msg: string): void {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    setMessage(msg);
    timerRef.current = window.setTimeout(() => {
      setMessage('');
      timerRef.current = null;
    }, duration);
  }

  return { message, showMessage };
}

/**
 * JSON APIを呼び出すユーティリティ
 * @param url - APIのURL
 * @param options - fetchオプション
 * @returns レスポンスのJSONデータ
 */
export async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res: Response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  return res.json();
}
