/**
 * Помощь Василия (ИИ): the app's only requests that carry the student's own text. Two ways to reach the model:
 *  - the student's own key («Настройки → Помощь Василия»): kept only on this device (kv `ai-key`, never written to
 *    a backup — backup.ts), the phone calls the model service directly;
 *  - a proxy that holds the key (server/ai-proxy.mjs, address VITE_AI_URL at build time), if the build has one.
 * Prompts and answer parsing — server/ai-tasks.mjs, shared by both. Nothing else is sent: no name, no progress.
 * The buttons show when one of the two is set (aiReady()); the first use asks for consent (settings.ai).
 *
 *   aiReady()                              // a key on the device or a proxy in the build
 *   if (await aiConsent()) await askAi('retell', { lesson, points, text })
 *   await checkAiKey(key) → saveAiKey(key) // the settings field; ai.key — the saved key ('' — none)
 *   cardText(id)                           // «[[id]] Название (год): кратко» — context for the model
 */
import { kvGet, kvSet } from './db';
import { settings, persistSettings } from './settings.svelte';
import { confirmDialog } from './ui.svelte';
import { kb } from './content/kb.svelte';
import { isNative } from './platform';
import { todayKey } from './utils/format';
import { TASKS, DEFAULT_BASE, modelsFor, timeoutFor, messagesOf } from '../../server/ai-tasks.mjs';

const AI_URL = (import.meta.env.VITE_AI_URL ?? '').replace(/\/+$/, '');
/** The build talks to a proxy: no key field in the settings. */
export const aiProxy = !!AI_URL;

/** kv row of the device key (listed in backup.ts PRIVATE_KV: it never leaves the device). */
export const AI_KEY_KV = 'ai-key';
const USAGE_KV = 'ai-usage';
/** Requests a day with the device key — a fuse against a runaway loop, not a quota. */
const DAILY = 150;

export const ai = $state({ key: '' });
void kvGet<string>(AI_KEY_KV, '').then((k) => (ai.key = k));

export const aiReady = (): boolean => aiProxy || !!ai.key;

export interface RetellResult {
  covered: number[];
  missed: number[];
  errors: { quote: string; fix: string }[];
  feedback: string;
}
export interface AiTasks {
  retell: { req: { lesson: string; points: string[]; text: string }; res: RetellResult };
  why: { req: { question: string; right: string; given: string; cards: string[] }; res: { text: string } };
  fork: {
    req: { role: string; when: string; situation: string; stakes: string; truth: string; choice: string; cards: string[] };
    res: { outcome: 'success' | 'mixed' | 'failure'; matches: boolean; headline: string; story: string };
  };
  ask: { req: { question: string; cards: string[] }; res: { text: string; ids: string[] } };
}

/** Why a request failed, in words for a toast. */
export class AiError extends Error {}

/** The first time: what is sent and where; «Нет» keeps the buttons, the question comes back next time. */
export async function aiConsent(): Promise<boolean> {
  if (settings.ai) return true;
  const ok = await confirmDialog('Спросить Василия?', {
    message:
      'Ответ проверяет модель ИИ: в сервис уйдёт только этот текст и задание — без имени и прогресса. ' +
      'Нужен интернет. Выключить можно в настройках.',
    ok: 'Разрешить',
  });
  if (ok) {
    settings.ai = true;
    persistSettings();
  }
  return ok;
}

export async function askAi<T extends keyof AiTasks>(task: T, body: AiTasks[T]['req']): Promise<AiTasks[T]['res']> {
  if (!navigator.onLine) throw new AiError('Нет интернета — Василию не дозвониться');
  if (aiProxy) return viaProxy(task, body);
  if (!ai.key) throw new AiError('Вставьте ключ ИИ в настройках');
  await countToday();
  const t = TASKS[task];
  const prompt = t.build(body);
  if (!prompt) throw new AiError('Слишком мало текста — Василию нечего проверять');
  for (const [i, m] of modelsFor(task).entries()) {
    try {
      // Grok thinks for up to a minute or two (the task's timeout), then the spare has its turn.
      const out = t.parse(await chat(m, t.maxTokens, prompt, timeoutFor(task, i)), prompt as never);
      if (out) return out as AiTasks[T]['res'];
    } catch (e) {
      if (e instanceof AiError) throw e; // a bad key: the next model will not help
    }
  }
  throw new AiError('Василий не смог ответить — попробуйте ещё раз');
}

/** Is the key accepted by the service (the model list costs nothing)? */
export async function checkAiKey(key: string): Promise<boolean> {
  const r = await http('GET', `${DEFAULT_BASE}/models`, key.trim(), undefined, 20_000);
  return r.status >= 200 && r.status < 300;
}

export async function saveAiKey(key: string): Promise<void> {
  ai.key = key.trim();
  await kvSet(AI_KEY_KV, ai.key);
}

async function chat(m: { name: string; effort?: string }, maxTokens: number, prompt: { sys: string; user: string }, timeout: number): Promise<string> {
  const body = { model: m.name, max_tokens: maxTokens, messages: messagesOf(prompt), ...(m.effort ? { reasoning_effort: m.effort } : {}) };
  const r = await http('POST', `${DEFAULT_BASE}/chat/completions`, ai.key, body, timeout);
  if (r.status === 401 || r.status === 403) throw new AiError('Ключ ИИ не подходит или отозван — вставьте новый в настройках');
  if (r.status < 200 || r.status >= 300) throw new Error(`model ${r.status}`);
  return (r.data as { choices?: { message?: { content?: string } }[] } | null)?.choices?.[0]?.message?.content ?? '';
}

/** On the phone — native HTTP (no CORS, long reads); in a browser — fetch. */
async function http(method: 'GET' | 'POST', url: string, key: string, body: unknown, timeout: number): Promise<{ status: number; data: unknown }> {
  const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  if (isNative) {
    const { CapacitorHttp } = await import('@capacitor/core');
    const r = await CapacitorHttp.request({ method, url, headers, data: body, connectTimeout: 15_000, readTimeout: timeout });
    return { status: r.status, data: typeof r.data === 'string' ? parse(r.data) : r.data };
  }
  const r = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(timeout) });
  return { status: r.status, data: await r.json().catch(() => null) };
}

function parse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

async function countToday(): Promise<void> {
  const u = await kvGet<{ day: string; n: number }>(USAGE_KV, { day: '', n: 0 });
  const n = u.day === todayKey() ? u.n : 0;
  if (n >= DAILY) throw new AiError('На сегодня хватит — Василий устал, завтра продолжим');
  await kvSet(USAGE_KV, { day: todayKey(), n: n + 1 });
}

// ---------- the proxy (a build with VITE_AI_URL) ----------
async function installId(): Promise<string> {
  let id = await kvGet<string>('ai-install', '');
  if (!id) {
    id = crypto.randomUUID();
    await kvSet('ai-install', id);
  }
  return id;
}

async function viaProxy<T extends keyof AiTasks>(task: T, body: AiTasks[T]['req']): Promise<AiTasks[T]['res']> {
  let r: Response;
  try {
    r = await fetch(`${AI_URL}/ai/${task}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Install': await installId() },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(200_000),
    });
  } catch {
    throw new AiError('Сервер Василия не отвечает — попробуйте позже');
  }
  if (r.status === 429) throw new AiError('На сегодня вопросы к Василию закончились — завтра снова');
  if (r.status === 503) throw new AiError('Василий сегодня перегружен — попробуйте завтра');
  if (!r.ok) throw new AiError('Василий не смог ответить — попробуйте ещё раз');
  return (await r.json()) as AiTasks[T]['res'];
}

// ---------- context for the model ----------
/** One knowledge-base entry as context: «[[id]] Название (год): summary». */
export function cardText(id: string): string | undefined {
  const e = kb.get(id);
  if (!e) return undefined;
  const it = e.item as { summary?: string; definition?: string };
  const year = kb.yearOf(e);
  return `[[${id}]] ${kb.title(id)}${year ? ` (${year})` : ''}: ${it.summary ?? it.definition ?? ''}`;
}

/** An entity whose title is exactly this answer («Сперанский», «Земская реформа») — to explain what it really is. */
export function entityByTitle(answer: string): string | undefined {
  const a = answer.trim().toLowerCase();
  if (a.length < 3) return undefined;
  for (const id of kb.byId.keys()) if (kb.title(id).toLowerCase() === a) return id;
  return undefined;
}

/** «[[id|текст]]» / «[[id]]» from the model → plain words (the answer is shown as text). */
export const plainRefs = (s: string): string =>
  s.replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, '$1').replace(/\[\[([^\]]+)\]\]/g, (_, id: string) => kb.title(id));
