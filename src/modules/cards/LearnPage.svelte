<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { X, Check, ArrowRight } from '@lucide/svelte';
  import IconButton from '$lib/design/components/IconButton.svelte';
  import Button from '$lib/design/components/Button.svelte';
  import ProgressBar from '$lib/design/components/ProgressBar.svelte';
  import TextField from '$lib/design/components/TextField.svelte';
  import Ornament from '$lib/design/components/Ornament.svelte';
  import EmptyState from '$lib/design/components/EmptyState.svelte';
  import { checkTyped, findDeck, typedFormat, type StudyCard } from '$lib/core/content/cards';
  import { router } from '$lib/core/router.svelte';
  import { record, saveResult } from '$lib/core/progress.svelte';
  import { haptic } from '$lib/core/platform';
  import { sample, shuffle } from '$lib/core/utils/random';
  import { burst } from '$lib/design/confetti';

  const writeOnly = router.query.get('mode') === 'write';
  const deck = findDeck(router.params.id ?? '');
  const all: StudyCard[] = deck ? deck.cards() : [];
  // Learn at most 20 cards per session, like Quizlet rounds.
  const pool = sample(all, Math.min(20, all.length));
  const mastery = $state<Record<string, number>>(Object.fromEntries(pool.map((c) => [c.id, 0])));
  const target = writeOnly ? 1 : 2;

  type Task = { card: StudyCard; mode: 'choice' | 'write'; reverse: boolean; options?: string[] };
  let task = $state<Task | null>(null);
  let picked = $state<string | null>(null);
  let typed = $state('');
  let verdict = $state<null | boolean>(null);
  let queue: StudyCard[] = [];
  let answered = $state(0);
  let correct = $state(0);
  let finished = $state(false);
  const startedAt = Date.now();

  const masteredCount = $derived(pool.filter((c) => (mastery[c.id] ?? 0) >= target).length);
  const short = (s: string) => (s.length > 90 ? s.slice(0, 88) + '…' : s);

  function makeTask(card: StudyCard): Task {
    const m = mastery[card.id] ?? 0;
    const writeable = card.back.length <= 40 || card.front.length <= 40;
    const mode: Task['mode'] = writeOnly ? 'write' : m >= 1 && writeable ? 'write' : 'choice';
    // Long answers are typed in reverse (see the answer, type the prompt).
    const reverse = mode === 'write' && card.back.length > 40;
    if (mode === 'choice') {
      const others = sample(all.filter((c) => c.id !== card.id && c.back !== card.back), 3).map((c) => short(c.back));
      return { card, mode, reverse: false, options: shuffle([short(card.back), ...others]) };
    }
    return { card, mode, reverse };
  }

  function next() {
    picked = null;
    typed = '';
    verdict = null;
    if (!queue.length) queue = shuffle(pool.filter((c) => (mastery[c.id] ?? 0) < target)).slice(0, 7);
    const card = queue.shift();
    if (!card) {
      finish();
      return;
    }
    task = makeTask(card);
  }

  function finish() {
    finished = true;
    task = null;
    const xp = Math.max(5, correct * 2);
    void record({ xp, questions: answered });
    void saveResult({ kind: 'learn', ref: deck?.id ?? '', score: correct, total: answered, ms: Date.now() - startedAt });
    setTimeout(() => burst(), 150);
  }

  function judge(ok: boolean) {
    if (!task) return;
    verdict = ok;
    answered++;
    if (ok) correct++;
    haptic(ok ? 'success' : 'error');
    const id = task.card.id;
    mastery[id] = ok ? (mastery[id] ?? 0) + 1 : Math.max(0, (mastery[id] ?? 0) - 1);
    if (!ok) queue.splice(Math.min(2, queue.length), 0, task.card);
  }

  function choose(opt: string) {
    if (verdict !== null || !task) return;
    picked = opt;
    judge(opt === short(task.card.back));
  }

  function submit() {
    if (!task || verdict !== null || !typed.trim()) return;
    judge(checkTyped(task.card, task.reverse, typed));
  }

  function override() {
    if (!task || verdict !== false) return;
    verdict = true;
    correct++;
    mastery[task.card.id] = (mastery[task.card.id] ?? 0) + 2;
    const i = queue.indexOf(task.card);
    if (i >= 0) queue.splice(i, 1);
  }

  if (pool.length) next();
</script>

<div class="page immersive learn">
  <header class="bar">
    <IconButton icon={X} label="Закрыть" onclick={() => router.back('/cards')} />
    <div class="grow"><ProgressBar value={pool.length ? masteredCount / pool.length : 0} color="var(--success)" /></div>
    <span class="count num">{masteredCount}/{pool.length}</span>
  </header>

  {#if !pool.length}
    <EmptyState title="В колоде нет карточек"><Button href="/cards">К колодам</Button></EmptyState>
  {:else if finished}
    <div class="summary" in:fade>
      <span class="eyebrow">{writeOnly ? 'Письмо' : 'Заучивание'} завершено</span>
      <h1>Выучено {masteredCount} из {pool.length}</h1>
      <Ornament />
      <p class="secondary">Ответов: {answered}, верных: {correct}.</p>
      <Button full onclick={() => location.reload()}>Ещё раунд</Button>
      <Button full variant="secondary" onclick={() => router.back('/cards')}>Готово</Button>
    </div>
  {:else if task}
    {#key task.card.id + answered}
      <div class="task" in:fly={{ x: 40, duration: 280 }}>
        <span class="eyebrow">{task.mode === 'choice' ? 'Выберите ответ' : task.reverse ? 'Что это? Напишите' : 'Напишите ответ'}</span>
        <div class="prompt surface">
          <p class:long={(task.reverse ? task.card.back : task.card.front).length > 70}>{task.reverse ? task.card.back : task.card.front}</p>
        </div>

        {#if task.mode === 'choice' && task.options}
          <div class="options">
            {#each task.options as opt, i (opt + i)}
              <button
                class="opt"
                class:right={verdict !== null && opt === short(task.card.back)}
                class:wrong={verdict === false && picked === opt}
                disabled={verdict !== null}
                onclick={() => choose(opt)}
              >
                <span class="n">{i + 1}</span>{opt}
              </button>
            {/each}
          </div>
        {:else}
          <TextField bind:value={typed} placeholder="Ваш ответ" hint={verdict === null ? typedFormat(task.card, task.reverse) : undefined} autofocus onenter={submit} status={verdict === null ? 'none' : verdict ? 'ok' : 'bad'} />
          {#if verdict === false}
            <div class="reveal" in:fly={{ y: 10 }}>
              <span class="eyebrow">Правильный ответ</span>
              <p>{task.reverse ? task.card.front : task.card.back}</p>
              <button class="linkish" onclick={override}>Я ответил(а) верно</button>
            </div>
          {/if}
          {#if verdict === null}<Button full onclick={submit} disabled={!typed.trim()}>Проверить</Button>{/if}
        {/if}

        {#if verdict !== null}
          <div class="verdict" class:ok={verdict} in:fly={{ y: 12, duration: 200 }}>
            <span>{#if verdict}<Check size={18} /> Верно!{:else}Не совсем — запомним{/if}</span>
            <Button size="sm" iconRight={ArrowRight} onclick={next}>Дальше</Button>
          </div>
        {/if}
      </div>
    {/key}
  {/if}
</div>

<style>
  .learn { display: flex; flex-direction: column; min-height: 100dvh; }
  .bar { display: flex; align-items: center; gap: var(--sp-3); padding: calc(var(--safe-top) + var(--sp-3)) 0 var(--sp-3); }
  .count { font-weight: 700; color: var(--ink-3); }
  .task { display: flex; flex-direction: column; gap: var(--sp-4); padding-top: var(--sp-4); }
  .prompt { padding: var(--sp-6) var(--sp-5); border-radius: var(--r-xl); min-height: 150px; display: grid; place-items: center; text-align: center; }
  .prompt p { font-family: var(--font-display); font-weight: 700; font-size: var(--text-2xl); line-height: 1.2; }
  .prompt p.long { font-family: var(--font-read); font-weight: 500; font-size: var(--text-lg); line-height: 1.45; }
  .options { display: flex; flex-direction: column; gap: var(--sp-2); }
  .opt {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: 14px 16px;
    border-radius: var(--r-md);
    border: 1.5px solid var(--line-strong);
    background: var(--surface);
    text-align: left;
    font-size: var(--text-md);
    cursor: pointer;
    transition: transform var(--dur-1), background-color var(--dur-2), border-color var(--dur-2);
  }
  .opt:active:not(:disabled) { transform: scale(0.98); }
  .n { width: 26px; height: 26px; flex: 0 0 auto; border-radius: 8px; display: grid; place-items: center; background: var(--surface-3); font-size: var(--text-xs); font-weight: 700; color: var(--ink-3); }
  .right { border-color: var(--success); background: var(--success-soft); }
  .wrong { border-color: var(--danger); background: var(--danger-soft); animation: shake 400ms; }
  .reveal { padding: var(--sp-3) var(--sp-4); border-radius: var(--r-md); background: var(--success-soft); }
  .reveal p { font-weight: 620; margin: 4px 0; }
  .linkish { border: 0; background: none; color: var(--accent); font-weight: 600; padding: 0; cursor: pointer; font-size: var(--text-sm); }
  .verdict { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); padding: var(--sp-3) var(--sp-4); border-radius: var(--r-md); background: var(--danger-soft); color: var(--danger); font-weight: 650; }
  .verdict span { display: inline-flex; align-items: center; gap: 6px; }
  .verdict.ok { background: var(--success-soft); color: var(--success); }
  .summary { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: var(--sp-3); text-align: center; }
  .summary h1 { font-size: var(--text-3xl); }
</style>
