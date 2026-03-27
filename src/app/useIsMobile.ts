'use client';

import { useState, useEffect } from 'react';

/** スマホ判定のブレークポイント（px） */
const MOBILE_BREAKPOINT: number = 768;

/**
 * 画面幅がスマホサイズかどうかを判定するカスタムフック
 * @returns true: スマホ幅, false: PC幅
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    function handleResize(): void {
      setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return isMobile;
}
