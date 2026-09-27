export type WebSource = { id: number; title: string; url: string; content: string; published?: string; retrieved: string };
export type Advice = { answer: string; goal: string; extraction?: string; evidence: { limitations: string; owner_question?: string; web_sources?: WebSource[]; web_searched?: boolean; image_confirmed?: boolean; coach_topic?: string; parent_action_id?: string; method?: string; generated_at?: string } };
export type CanvasBlock = 'customer_segments' | 'value_propositions' | 'channels' | 'customer_relationships' | 'revenue_streams' | 'key_resources' | 'key_activities' | 'key_partners' | 'cost_structure';
export type Textbook = {
  title: string; canvas: Record<CanvasBlock, string[]>;
  chapters: { title: string; summary: string; sections: { heading: string; paragraphs: string[]; checklist: string[] }[] }[];
};
export type Platform = 'linkedin' | 'instagram' | 'x' | 'facebook';
export type Campaign = {
  posts: { platform: Platform; copy: string; cta: string }[];
  hashtags: { niche: string[]; broad: string[]; local: string[] };
  personas: { name: string; profile: string; where: string }[];
  tag_categories: string[];
};
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export function safeWebUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}
