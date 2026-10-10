<script lang="ts">
  /**
   * «Тренажёр» — writing a ВсОШ-style historical essay step by step, as the handbook teaches (EssayGuide):
   * topic/quote → justification → 4 tasks → problem → for each task thesis, 3 arguments, a historian's view
   * and a conclusion → final conclusion. Quick checks follow the handbook's rules (a task starts with a verb,
   * the problem with a noun, a view names the historian and the work); the score estimate is by its criteria.
   * Drafts are saved on the device (kv `essay-drafts`) and can be copied or saved as a text file.
   */
  import { onMount } from 'svelte';
  import { Plus, Trash2, Copy, Download, Timer, Check, X } from '@lucide/svelte';
  import Card from '$lib/design/components/Card.svelte';
  import Button from '$lib/design/components/Button.svelte';
  import { kvGet, kvSet } from '$lib/core/db';
  import { exportFile } from '$lib/core/platform';
  import { toast, confirmDialog } from '$lib/core/ui.svelte';
  import { formatDuration } from '$lib/core/utils/format';
  import { guide } from './EssayGuide.svelte';

  interface Task {
    task: string;
    thesis: string;
    args: [string, string, string];
    view: string;
    viewAuthor: string;
    conclusion: string;
  }
  interface Draft {
    id: string;
    topic: string;
    intro: string;
    problem: string;
    tasks: Task[];
    final: string;
    creative: string;
    ms: number;
    updated: number;
  }
  const KEY = 'essay-drafts';
  const emptyTask = (): Task => ({ task: '', thesis: '', args: ['', '', ''], view: '', viewAuthor: '', conclusion: '' });
  const newDraft = (): Draft => ({ id: crypto.randomUUID(), topic: '', intro: '', problem: '', tasks: [emptyTask(), emptyTask(), emptyTask(), emptyTask()], final: '', creative: '', ms: 0, updated: Date.now() });

  let drafts = $state<Draft[]>([]);
  let d = $state<Draft>(newDraft());
  let running = $state(false);
  let startedAt = 0;
  let base = 0;
  let now = $state(Date.now());

  onMount(() => {
    void kvGet<Draft[]>(KEY, []).then((list) => {
      drafts = list;
      if (list[0]) d = structuredClone(list[0]);
    });
    const t = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(t);
  });

  // Autosave a second after the last change.
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const snapshot = JSON.stringify(d);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void save(JSON.parse(snapshot) as Draft), 1000);
  });
  async function save(x: Draft) {
    if (!x.topic && !x.intro && !x.tasks.some((t) => t.task)) return;
    x.updated = Date.now();
    drafts = [x, ...drafts.filter((y) => y.id !== x.id)].slice(0, 30);
    await kvSet(KEY, $state.snapshot(drafts));
  }

  const elapsed = $derived(d.ms + (running ? now - startedAt : 0));
  function toggleTimer() {
    if (running) {
      d.ms = base + (Date.now() - startedAt);
      running = false;
    } else {
      base = d.ms;
      startedAt = Date.now();
      running = true;
    }
  }

  // ——— Checks by the handbook ———
  const first = (s: string) => s.trim().split(/[\s,.:;—-]+/)[0]?.toLowerCase() ?? '';
  const isVerb = (s: string) => /(ть|ться|ти)$/.test(first(s));
  const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
  const tasks = $derived(d.tasks.filter((t) => t.task.trim()));
  /** Views with the historian named (a «ритуальная» view without author or work earns almost nothing). */
  const views = $derived(d.tasks.filter((t) => t.view.trim() && t.viewAuthor.trim()).length);
  const checks = $derived([
    { ok: words(d.intro) >= 25, text: 'Введение обосновывает выбор темы (почему она важна и интересна)' },
    { ok: tasks.length >= 3, text: 'Поставлено 3–4 задачи' },
    { ok: tasks.length > 0 && tasks.every((t) => isVerb(t.task)), text: 'Каждая задача начинается с глагола («Проанализировать…», «Выявить…»)' },
    { ok: !!d.problem.trim() && !isVerb(d.problem), text: 'Проблема сформулирована одним вопросом или существительным и охватывает все задачи' },
    { ok: tasks.length > 0 && tasks.every((t) => t.thesis.trim() && t.args.filter((a) => words(a) >= 8).length >= 3), text: 'В каждой задаче тезис и три аргумента (факт + анализ + вывод)' },
    { ok: tasks.length > 0 && tasks.every((t) => words(t.conclusion) >= 8), text: 'После каждой задачи — вывод' },
    { ok: views >= 2, text: 'Не меньше двух точек зрения историков с автором и работой' },
    { ok: words(d.final) >= 20, text: 'Итоговый вывод отвечает на проблему' },
  ]);
  const viewPoints = $derived(views >= 4 ? 8 : views === 3 ? 6 : views === 2 ? 4 : views === 1 ? 2 : 0);
  const done = $derived(checks.filter((c) => c.ok).length);

  const text = $derived(
    [
      d.topic && `Тема: ${d.topic}`,
      d.intro && `\n${d.intro}`,
      tasks.length && `\nЗадачи:\n${tasks.map((t, i) => `${i + 1}. ${t.task}`).join('\n')}`,
      d.problem && `\nПроблема: ${d.problem}`,
      ...tasks.map((t, i) => [`\nЗадача ${i + 1}. ${t.task}`, t.thesis, ...t.args.filter(Boolean), t.view && `${t.viewAuthor ? `${t.viewAuthor}: ` : ''}${t.view}`, t.conclusion && `Вывод: ${t.conclusion}`].filter(Boolean).join('\n')),
      d.final && `\nВывод: ${d.final}`,
      d.creative && `\n${d.creative}`,
    ].filter(Boolean).join('\n'),
  );
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast('Эссе скопировано', 'success');
    } catch {
      toast('Не удалось скопировать — сохраните файлом', 'error');
    }
  }
  const saveFile = () => exportFile(`Эссе — ${(d.topic || 'черновик').slice(0, 40)}.txt`, text, 'text/plain');
  function open(x: Draft) {
    running = false;
    d = structuredClone($state.snapshot(x));
  }
  async function remove(x: Draft) {
    if (!(await confirmDialog('Удалить черновик?', { ok: 'Удалить', danger: true }))) return;
    drafts = drafts.filter((y) => y.id !== x.id);
    await kvSet(KEY, $state.snapshot(drafts));
    if (d.id === x.id) d = newDraft();
  }
</script>

<div class="trainer">
  <div class="row top">
    <button class="timer num" class:on={running} onclick={toggleTimer}><Timer size={16} /> {formatDuration(elapsed)}</button>
    <span class="grow"></span>
    <Button size="sm" variant="secondary" icon={Plus} onclick={() => { running = false; d = newDraft(); }}>Новое</Button>
  </div>

  <label class="f"><span>Тема или цитата</span><textarea rows="3" bind:value={d.topic} placeholder="Вставьте цитату из задания или сформулируйте тему"></textarea></label>
  <label class="f"><span>Введение: обоснование выбора темы</span><textarea rows="4" bind:value={d.intro} placeholder="Почему тема важна, чем интересна и спорна"></textarea></label>

  <div class="f"><span>Задачи (из смысловых блоков цитаты, с глагола)</span>
    {#each d.tasks as t, i (i)}
      <input bind:value={t.task} placeholder="{i + 1}. Проанализировать…" class:bad={t.task.trim() && !isVerb(t.task)} />
    {/each}
  </div>
  <label class="f"><span>Проблема (охватывает все задачи)</span><input bind:value={d.problem} placeholder="Каким было значение… / Роль… в…" /></label>

  {#each d.tasks as t, i (i)}
    {#if t.task.trim()}
      <Card padding="md">
        <h3>Задача {i + 1}. {t.task}</h3>
        <label class="f"><span>Тезис</span><textarea rows="2" bind:value={t.thesis}></textarea></label>
        {#each t.args as _, k (k)}
          <label class="f"><span>Аргумент {k + 1}: факт → анализ → вывод</span><textarea rows="3" bind:value={t.args[k]}></textarea></label>
        {/each}
        <div class="f"><span>Точка зрения историка</span>
          <input bind:value={t.viewAuthor} placeholder="Историк и работа (например: В. О. Ключевский, «Курс русской истории»)" />
          <textarea rows="2" bind:value={t.view} placeholder="Его мысль и как она подкрепляет или оспаривает тезис"></textarea>
        </div>
        <label class="f"><span>Вывод по задаче</span><textarea rows="2" bind:value={t.conclusion}></textarea></label>
      </Card>
    {/if}
  {/each}

  <label class="f"><span>Итоговый вывод — ответ на проблему</span><textarea rows="4" bind:value={d.final}></textarea></label>
  <label class="f"><span>Творчество (сравнения, синхронизация с мировой историей, ссылки на источники)</span><textarea rows="2" bind:value={d.creative}></textarea></label>

  <Card padding="md">
    <h3>Самопроверка · {done} из {checks.length}</h3>
    <ul class="checks">
      {#each checks as c (c.text)}
        <li class:ok={c.ok}>{#if c.ok}<Check size={16} />{:else}<X size={16} />{/if}<span>{c.text}</span></li>
      {/each}
    </ul>
    <p class="muted small">Точки зрения с автором: {views} — по таблице пособия до {viewPoints} из 8 баллов (полный балл — 4 работы, на каждую по 2 упоминания).</p>
    <details>
      <summary>Чек-лист пособия</summary>
      <ul class="list">{#each guide.checklist as c, i (i)}<li>{c}</li>{/each}</ul>
    </details>
    <div class="row actions">
      <Button icon={Copy} onclick={copy}>Скопировать</Button>
      <Button variant="secondary" icon={Download} onclick={saveFile}>Файлом</Button>
    </div>
  </Card>

  {#if drafts.length > 1}
    <h3 class="drafts-h">Черновики</h3>
    <div class="stack drafts">
      {#each drafts as x (x.id)}
        <div class="row draft" class:cur={x.id === d.id}>
          <button class="grow link" onclick={() => open(x)}>{x.topic.slice(0, 70) || 'Без темы'}<small class="muted">{new Date(x.updated).toLocaleDateString('ru-RU')} · {formatDuration(x.ms)}</small></button>
          <button class="icon" aria-label="Удалить" onclick={() => remove(x)}><Trash2 size={16} /></button>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .trainer { display: flex; flex-direction: column; gap: var(--sp-3); margin-top: var(--sp-3); }
  .top { gap: var(--sp-2); }
  .timer { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: var(--r-pill, 999px); border: 1.5px solid var(--line); background: var(--surface); font-weight: 700; color: var(--ink-2); cursor: pointer; }
  .timer.on { border-color: var(--accent); color: var(--accent); }
  .f { display: flex; flex-direction: column; gap: 6px; }
  .f > span { font-size: var(--text-xs); font-weight: 700; color: var(--ink-2); }
  textarea, input { width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: var(--r-md); border: 1.5px solid var(--line); background: var(--surface); color: var(--ink); font: inherit; font-family: var(--font-read); font-size: var(--text-sm); line-height: 1.45; resize: vertical; }
  textarea:focus, input:focus { outline: none; border-color: var(--accent); }
  input.bad { border-color: var(--danger); }
  h3 { font-size: var(--text-md); margin: 0 0 var(--sp-2); }
  :global(.trainer .card) { display: flex; flex-direction: column; gap: var(--sp-2); }
  .checks { list-style: none; padding: 0; margin: 0 0 var(--sp-2); display: flex; flex-direction: column; gap: 6px; font-size: var(--text-sm); }
  .checks li { display: flex; gap: 8px; align-items: flex-start; color: var(--danger); }
  .checks li span { color: var(--ink-2); }
  .checks li.ok { color: var(--success); }
  .small { font-size: var(--text-xs); }
  details summary { cursor: pointer; font-size: var(--text-sm); font-weight: 650; margin: var(--sp-2) 0; }
  .list { font-size: var(--text-xs); line-height: 1.45; padding-left: 1.2em; color: var(--ink-2); }
  .actions { gap: var(--sp-2); margin-top: var(--sp-3); }
  .drafts-h { margin-top: var(--sp-3); }
  .drafts { --gap: 4px; }
  .draft { gap: var(--sp-2); padding: 6px 8px; border-radius: var(--r-md); border: 1px solid var(--line); background: var(--surface); }
  .draft.cur { border-color: var(--accent); }
  .link { display: flex; flex-direction: column; text-align: left; background: none; border: 0; color: var(--ink); font-size: var(--text-sm); cursor: pointer; }
  .link small { font-size: var(--text-2xs); }
  .icon { background: none; border: 0; color: var(--ink-3); cursor: pointer; padding: 6px; }
</style>
