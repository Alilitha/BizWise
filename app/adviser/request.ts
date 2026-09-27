import type { Advice, Campaign, Textbook } from './shared';

export class CoachRequestError extends Error {}
type RequestOptions = { url: string; key: string; token: string; body: Record<string, unknown>; origin: string; fetcher?: typeof fetch };

async function postAdviser({ url, key, token, body, origin, fetcher = fetch }: RequestOptions): Promise<Record<string, unknown> | null> {
  let response: Response;
  try {
    response = await fetcher(`${url.replace(/\/$/, '')}/functions/v1/adviser`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: key },
      body: JSON.stringify(body), signal: AbortSignal.timeout(65000),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) throw new CoachRequestError('The coach took too long to respond. Your question has been kept. Try again shortly.');
    const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    throw new CoachRequestError(local
      ? `The browser could not reach the coach from ${origin}. Check your connection and make sure this exact address is included in the Supabase adviser’s ALLOWED_ORIGINS setting.`
      : 'The browser could not reach the coach. Check your connection. If it continues, ask your administrator to check the adviser’s allowed website addresses.');
  }
  const raw: unknown = await response.json().catch(() => null);
  const data = raw && typeof raw === 'object' ? raw as Record<string, unknown> : null;
  if (response.status === 401) throw new CoachRequestError('Your sign-in has expired. Sign out and sign in again, then retry your question.');
  if (!response.ok) throw new CoachRequestError(typeof data?.error === 'string' ? data.error : `The coach is unavailable (HTTP ${response.status}). Please try again later.`);
  return data;
}

export async function requestCoach(options: RequestOptions): Promise<Advice> {
  const data = await postAdviser(options);
  const evidence = data?.evidence && typeof data.evidence === 'object' ? data.evidence as Record<string, unknown> : null;
  if (!data || typeof data.answer !== 'string' || !data.answer.trim() || typeof data.goal !== 'string' || !['money', 'customers', 'experience'].includes(data.goal) || !evidence || typeof evidence.limitations !== 'string') {
    throw new CoachRequestError('The coach returned an incomplete response. Your question has been kept; please try again.');
  }
  return data as Advice;
}

export async function requestTextbook(options: RequestOptions): Promise<Textbook> {
  const data = await postAdviser({ ...options, body: { ...options.body, goal: 'textbook' } });
  const book = data?.textbook as Textbook | undefined;
  if (!book || !Array.isArray(book.chapters) || !book.chapters.length || !book.canvas) throw new CoachRequestError('The textbook came back incomplete. Please try again.');
  return book;
}

export async function requestCampaign(options: RequestOptions): Promise<Campaign> {
  const data = await postAdviser({ ...options, body: { ...options.body, goal: 'campaign' } });
  const campaign = data?.campaign as Campaign | undefined;
  if (!campaign || !Array.isArray(campaign.posts) || !campaign.posts.length || !campaign.hashtags) throw new CoachRequestError('The campaign came back incomplete. Please try again.');
  return campaign;
}
