/**
 * セキュリティユーティリティ
 * XSSサニタイズ、入力バリデーション、レート制限を提供する
 */

/** HTMLの特殊文字をエスケープしてXSSを防止する */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** オブジェクトの全文字列値を再帰的にサニタイズする */
export function sanitizeObject<T>(obj: T): T {
  if (typeof obj === 'string') {
    return escapeHtml(obj) as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject) as T;
  }
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = sanitizeObject(value);
    }
    return result as T;
  }
  return obj;
}

/** バリデーション結果 */
type ValidationResult = { ok: true } | { ok: false; message: string };

/** タイトルのバリデーション（1〜200文字） */
export function validateTitle(title: unknown): ValidationResult {
  if (typeof title !== 'string' || title.trim().length === 0) {
    return { ok: false, message: 'タイトルは必須です' };
  }
  if (title.trim().length > 200) {
    return { ok: false, message: 'タイトルは200文字以内にしてください' };
  }
  return { ok: true };
}

/** コンテンツのバリデーション（最大10000文字） */
export function validateContent(content: unknown): ValidationResult {
  if (typeof content !== 'string') {
    return { ok: true };
  }
  if (content.length > 10000) {
    return { ok: false, message: 'コンテンツは10000文字以内にしてください' };
  }
  return { ok: true };
}

/** メールアドレスのバリデーション */
export function validateEmail(email: unknown): ValidationResult {
  if (typeof email !== 'string' || email.trim().length === 0) {
    return { ok: false, message: 'メールアドレスは必須です' };
  }
  const emailRegex: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return { ok: false, message: 'メールアドレスの形式が正しくありません' };
  }
  if (email.length > 254) {
    return { ok: false, message: 'メールアドレスが長すぎます' };
  }
  return { ok: true };
}

/** パスワードのバリデーション（6文字以上） */
export function validatePassword(password: unknown): ValidationResult {
  if (typeof password !== 'string' || password.length < 6) {
    return { ok: false, message: 'パスワードは6文字以上にしてください' };
  }
  if (password.length > 128) {
    return { ok: false, message: 'パスワードは128文字以内にしてください' };
  }
  return { ok: true };
}

/** 名前のバリデーション（1〜100文字） */
export function validateName(name: unknown): ValidationResult {
  if (typeof name !== 'string' || name.trim().length === 0) {
    return { ok: false, message: '名前は必須です' };
  }
  if (name.trim().length > 100) {
    return { ok: false, message: '名前は100文字以内にしてください' };
  }
  return { ok: true };
}

/** レート制限用のメモリストア */
const rateLimitStore: Map<string, { count: number; resetAt: number }> = new Map();

/**
 * レート制限をチェックする
 * @param key - 制限対象のキー（例: IPアドレス）
 * @param maxAttempts - 期間内の最大試行回数
 * @param windowMs - 期間（ミリ秒）
 * @returns true: 制限内、false: 制限超過
 */
export function checkRateLimit(key: string, maxAttempts: number, windowMs: number): boolean {
  const now: number = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxAttempts) {
    return false;
  }

  entry.count += 1;
  return true;
}

/** リクエストからクライアントIPを取得する */
export function getClientIp(request: Request): string {
  const forwarded: string | null = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return 'unknown';
}
