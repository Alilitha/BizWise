export type WebSource = { id: number; title: string; url: string; content: string; published?: string; retrieved: string };
export type Advice = { answer: string; goal: string; extraction?: string; evidence: { limitations: string; owner_question?: string; web_sources?: WebSource[]; web_searched?: boolean; image_confirmed?: boolean } };
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export function safeWebUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}
