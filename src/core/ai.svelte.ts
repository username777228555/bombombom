/**
 * Помощь Василия (ИИ): the app's only requests that carry the student's own text. They go to the app's proxy
 * (server/ai-proxy.mjs, address from VITE_AI_URL at build time), which holds the model key and builds the prompt;
 * nothing else is sent — no name, no progress, only an anonymous install id for the daily limit.
 * Without VITE_AI_URL (local builds, forks) the AI buttons are hidden. The first use asks for consent (settings.ai).
 *
 *   aiConfigured                         // the build knows a proxy
 *   if (await aiConsent()) await askAi('retell', { lesson, points, text })
 *   cardText(id)                         // «[[id]] Название (год): кратко» — context for the model
 */
import { kvGet, kvSet } from './db';
import { settings, persistSettings } from './settings.svelte';
import { confirmDialog } from './ui.svelte';
import { kb } from './content/kb.svelte';

const AI_URL = (import.meta.env.VITE_AI_URL ?? '').replace(/\/+$/, '');
export const aiConfigured = !!AI_URL;

export interface RetellResult {
  covered: number[];
  missed: number[];
  errors: { quote: string; fix: string }[];
  feedback: string;
}
export interface AiTasks {
  retell: { req: { lesson: string; points: string[]; text: string }; res: RetellResult };
  why: { req: { question: string; right: string; given: string; cards: string[] }; res: { text: string } };
  fork: { req: { role: string; situation: string; choice: string; cards: string[] }; res: { story: string; reality: string; ids: string[] } };
  ask: { req: { question: string; cards: string[] }; res: { text: string; ids: string[] } };
}

/** Why a request failed, in words for a toast. */
export class AiError extends Error {}

/** The first time: what is sent and where; «Нет» keeps the buttons, the question comes back next time. */
export async function aiConsent(): Promise<boolean> {
  if (settings.ai) return true;
  const ok = await confirmDialog('Спросить Василия?', {
    message:
      'Проверку делает модель ИИ через сервер приложения. Туда уйдёт только этот текст ответа и задание — без имени и прогресса. ' +
      'Нужен интернет. Выключить можно в настройках.',
    ok: 'Разрешить',
  });
  if (ok) {
    settings.ai = true;
    persistSettings();
  }
  return ok;
}

async function installId(): Promise<string> {
  let id = await kvGet<string>('ai-install', '');
  if (!id) {
    id = crypto.randomUUID();
    await kvSet('ai-install', id);
  }
  return id;
}

export async function askAi<T extends keyof AiTasks>(task: T, body: AiTasks[T]['req']): Promise<AiTasks[T]['res']> {
  if (!aiConfigured) throw new AiError('Помощь Василия в этой сборке выключена');
  if (!navigator.onLine) throw new AiError('Нет интернета — Василию не дозвониться');
  let r: Response;
  try {
    r = await fetch(`${AI_URL}/ai/${task}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Install': await installId() },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    throw new AiError('Сервер Василия не отвечает — попробуйте позже');
  }
  if (r.status === 429) throw new AiError('На сегодня вопросы к Василию закончились — завтра снова');
  if (r.status === 503) throw new AiError('Василий сегодня перегружен — попробуйте завтра');
  if (!r.ok) throw new AiError('Василий не смог ответить — попробуйте ещё раз');
  return (await r.json()) as AiTasks[T]['res'];
}

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
