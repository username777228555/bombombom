/**
 * СТОЛЫПИНЪ AI proxy — the only place that holds the model API key. The app never sees it: it sends a task name
 * and the student's text, the proxy builds the prompt itself, calls the model and returns the result.
 * Prompts and answer parsing — ai-tasks.mjs (shared with the app). Node ≥ 20, no dependencies. Deploy: server/README.md.
 *
 *   AI_KEY=sk-... node server/ai-proxy.mjs          # listens on PORT (8787)
 *   POST /ai/retell  { lesson, points[], text }     → { covered[], missed[], errors[{quote,fix}], feedback }
 *   POST /ai/why     { question, right, given, cards[] } → { text }
 *   POST /ai/fork    { role, when, situation, stakes, truth, choice, cards[] } → { outcome, matches, headline, story }
 *   POST /ai/ask     { question, cards[] }       → { text, ids[] }                     («Спросить Василия»)
 *   GET  /ai/health                                  → { ok, model }
 *
 * Abuse limits: per install (X-Install header) and per IP per day, plus a global daily token budget; the input
 * size of every field is capped, so the key cannot be used as a general-purpose chat. Texts are never logged.
 */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { TASKS, DEFAULT_BASE, DEFAULT_MODELS, parseModels } from './ai-tasks.mjs';

const env = (k, d) => process.env[k] ?? d;
const CFG = {
  port: Number(env('PORT', 8787)),
  base: env('AI_BASE', DEFAULT_BASE),
  key: env('AI_KEY', ''),
  /** Models tried in order, «model[:reasoning_effort]» — see ai-tasks.mjs for why these. */
  models: parseModels(env('AI_MODELS', DEFAULT_MODELS)),
  perInstall: Number(env('LIMIT_INSTALL', 40)),
  perIp: Number(env('LIMIT_IP', 200)),
  dailyTokens: Number(env('LIMIT_TOKENS', 20_000_000)),
  origins: env('ORIGINS', 'https://localhost,capacitor://localhost,http://localhost:5173,http://127.0.0.1:5173').split(','),
  state: env('STATE_FILE', 'data/ai-state.json'),
};
if (!CFG.key) {
  console.error('AI_KEY is not set');
  process.exit(1);
}

// ---------- daily counters (in memory, saved every minute so a restart keeps today's numbers) ----------
const today = () => new Date().toISOString().slice(0, 10);
let day = { date: today(), installs: {}, ips: {}, tokens: 0, calls: 0, errors: 0 };
try {
  const saved = JSON.parse(readFileSync(CFG.state, 'utf8'));
  if (saved.date === day.date) day = saved;
} catch {
  /* first start */
}
const roll = () => {
  if (day.date !== today()) day = { date: today(), installs: {}, ips: {}, tokens: 0, calls: 0, errors: 0 };
};
setInterval(() => {
  try {
    mkdirSync(dirname(CFG.state), { recursive: true });
    writeFileSync(CFG.state, JSON.stringify(day));
  } catch (e) {
    console.error('state save failed', e.message);
  }
}, 60_000).unref();

// ---------- model call ----------
/** The first model that answers with a usable result; the next one when a model fails or returns garbage. */
async function run(task, prompt) {
  let last;
  for (const [i, m] of CFG.models.entries()) {
    try {
      // The app waits 120 s: a hung first model gets 45 s, then the next one has the rest.
      const out = TASKS[task].parse(await complete(m, task, prompt.sys, prompt.user, i === 0 ? 45_000 : 70_000), prompt);
      if (out) return out;
      last = new Error(`${m.name}: bad output`);
    } catch (e) {
      last = new Error(`${m.name}: ${e.message}`);
    }
    console.error(task, last.message);
  }
  throw last;
}

async function complete(m, task, sys, user, timeout) {
  const body = { model: m.name, max_tokens: TASKS[task].maxTokens, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] };
  if (m.effort) body.reasoning_effort = m.effort;
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(`${CFG.base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${CFG.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    }).catch((e) => ({ ok: false, status: 0, error: e }));
    // A timeout or a dead connection: no retry on the same model, the next one is faster than waiting again.
    if (r.status === 0) throw new Error(r.error?.name === 'TimeoutError' ? 'timeout' : 'network');
    if (r.ok) {
      const d = await r.json();
      day.tokens += (d.usage?.prompt_tokens ?? 0) + (d.usage?.completion_tokens ?? 0);
      return d.choices?.[0]?.message?.content ?? '';
    }
    if ([429, 500, 502, 504].includes(r.status) && attempt < 1) {
      await new Promise((ok) => setTimeout(ok, 1500));
      continue;
    }
    throw new Error(`upstream ${r.status}`);
  }
}

// ---------- http ----------
function send(res, status, data, origin) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, X-Install',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    Vary: 'Origin',
  });
  res.end(status === 204 ? undefined : JSON.stringify(data));
}

createServer(async (req, res) => {
  const origin = CFG.origins.includes(req.headers.origin) ? req.headers.origin : CFG.origins[0];
  if (req.method === 'OPTIONS') return send(res, 204, {}, origin);
  const url = new URL(req.url, 'http://x');
  if (req.method === 'GET' && url.pathname === '/ai/health') return send(res, 200, { ok: true, models: CFG.models.map((m) => m.name) }, origin);
  const task = url.pathname.startsWith('/ai/') ? url.pathname.slice(4) : '';
  if (req.method !== 'POST' || !TASKS[task]) return send(res, 404, { error: 'not found' }, origin);

  roll();
  const install = String(req.headers['x-install'] ?? '').slice(0, 64);
  const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim();
  if (!/^[a-z0-9-]{16,64}$/i.test(install)) return send(res, 400, { error: 'install' }, origin);
  if ((day.installs[install] ?? 0) >= CFG.perInstall || (day.ips[ip] ?? 0) >= CFG.perIp) return send(res, 429, { error: 'limit' }, origin);
  if (day.tokens >= CFG.dailyTokens) return send(res, 503, { error: 'budget' }, origin);

  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 40_000) return send(res, 413, { error: 'too large' }, origin);
  }
  let b;
  try {
    b = JSON.parse(raw);
  } catch {
    return send(res, 400, { error: 'json' }, origin);
  }
  const prompt = TASKS[task].build(b);
  if (!prompt) return send(res, 400, { error: 'input' }, origin);

  day.installs[install] = (day.installs[install] ?? 0) + 1;
  day.ips[ip] = (day.ips[ip] ?? 0) + 1;
  day.calls++;
  try {
    return send(res, 200, await run(task, prompt), origin);
  } catch (e) {
    day.errors++;
    return send(res, 502, { error: 'model' }, origin);
  }
}).listen(CFG.port, () => console.log(`ai-proxy on :${CFG.port}, models ${CFG.models.map((m) => m.name).join(' → ')}`));
