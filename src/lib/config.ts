import configJson from '../../config/app.json';

/** アプリ全体の設定（config/app.json から読み込み） */
export interface AppConfig {
  toast: {
    undoDurationMs: number;
    bucketListUndoDurationMs: number;
  };
  pomodoro: {
    defaultWorkMin: number;
    defaultBreakMin: number;
    alarmIntervalMs: number;
  };
  drag: {
    longPressMs: number;
    moveThresholdPx: number;
    swipeThresholdPx: number;
    swipeNestThresholdPx: number;
  };
  archive: {
    maxItems: number;
  };
  pagination: {
    pageSize: number;
  };
  timeblock: {
    defaultStartHour: number;
    defaultEndHour: number;
  };
  analytics: {
    weeklyReviewWeeks: number;
    burndownDays: number;
    lineChartMaxPoints: number;
  };
  butler: {
    defaultMaxChars: number;
    defaultPrompt: string;
  };
}

export const config: AppConfig = configJson as AppConfig;
