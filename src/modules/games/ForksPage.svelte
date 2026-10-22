<script lang="ts">
  /**
   * «Развилки»: pick a moment (forks.ts), decide for the figure — a ready choice or your own words — and Василий
   * (AI, task `fork`) judges it like a strict historian (success / mixed / failure) and tells what would follow;
   * «Как было на самом деле» is the fork's checked `truth`, with links to its cards.
   * Needs the AI key in the settings (or a proxy build); without it the screen points there.
   */
  import { fly, fade } from 'svelte/transition';
  import { X, Split, ArrowLeft, Sparkles, RotateCcw, BookOpen, KeyRound } from '@lucide/svelte';
  import IconButton from '$lib/design/components/IconButton.svelte';
  import Button from '$lib/design/components/Button.svelte';
  import TextField from '$lib/design/components/TextField.svelte';
  import Chip from '$lib/design/components/Chip.svelte';
  import Vasily from '$lib/design/components/Vasily.svelte';
  import { kb } from '$lib/core/content/kb.svelte';
  import { router, navigate } from '$lib/core/router.svelte';
  import { toast } from '$lib/core/ui.svelte';
  import { motionOK } from '$lib/core/settings.svelte';
  import { aiReady, aiConsent, askAi, AiError, cardText, type AiTasks } from '$lib/core/ai.svelte';
  import { FORKS, type Fork } from './forks';

  let fork = $state<Fork | null>(null);
  let choice = $state('');
  let busy = $state(false);
  let result = $state<AiTasks['fork']['res'] | null>(null);
  const VERDICT = { success: 'Удача', mixed: 'С оговорками', failure: 'Провал' } as const;

  const facts = (f: Fork) => f.facts.filter((id) => kb.get(id));

  function open(f: Fork) {
    fork = f;
    choice = '';
    result = null;
  }

  async function decide() {
    if (!fork || choice.trim().length < 3 || !(await aiConsent())) return;
    busy = true;
    try {
      result = await askAi('fork', {
        role: fork.role,
        when: fork.when,
        situation: fork.situation,
        stakes: fork.stakes,
        truth: fork.truth,
        choice: choice.trim(),
        cards: facts(fork).map(cardText).filter((x): x is string => !!x),
      });
    } catch (e) {
      toast(e instanceof AiError ? e.message : 'Василий не смог ответить', 'error', 3600);
    } finally {
      busy = false;
    }
  }
</script>

<div class="page immersive game">
  <header class="bar">
    {#if fork}
      <IconButton icon={ArrowLeft} label="К развилкам" onclick={() => (fork = null)} />
    {:else}
      <IconButton icon={X} label="Выйти" onclick={() => router.back('/practice')} />
    {/if}
    <span class="grow muted">{fork ? fork.when : 'Развилки истории'}</span>
  </header>

  {#if !aiReady()}
    <div class="need" in:fade>
      <Vasily size={150} mood="think" />
      <h1 class="display">Развилки</h1>
      <p class="secondary">Решите за Минина, Петра или Столыпина — Василий расскажет, что могло бы выйти, и как было на самом деле. Для этого нужен ключ ИИ.</p>
      <Button full icon={KeyRound} onclick={() => navigate('/settings')}>Вставить ключ в настройках</Button>
    </div>
  {:else if !fork}
    <div class="intro">
      <Split size={22} />
      <p class="secondary">Моменты, когда история могла пойти иначе. Примите решение — Василий расскажет, к чему бы оно привело, а потом — как было на самом деле.</p>
    </div>
    <div class="list">
      {#each FORKS as f, i (f.id)}
        {@const p = kb.periodById.get(f.period)}
        <button class="fork" style="--c: {p?.color ?? 'var(--accent)'}" onclick={() => open(f)} in:fly={{ y: motionOK() ? 12 : 0, delay: i * 40, duration: 260 }}>
          <span class="when num">{f.when}</span>
          <strong>{f.title}</strong>
          <span class="who">{f.you}</span>
        </button>
      {/each}
    </div>
  {:else}
    {#key fork.id}
      <article class="scene" in:fly={{ x: motionOK() ? 24 : 0, duration: 280 }}>
        <span class="eyebrow">{fork.you}</span>
        <h1 class="display title">{fork.title}</h1>
        <p class="situation">{fork.situation}</p>

        {#if !result}
          <div class="choices">
            {#each fork.choices as c (c)}
              <button class="choice" class:on={choice === c} onclick={() => (choice = c)}>{c}</button>
            {/each}
          </div>
          <TextField bind:value={choice} multiline rows={3} label="Ваше решение" placeholder="Или напишите своё…" />
          <Button full size="lg" icon={Sparkles} loading={busy} disabled={choice.trim().length < 3} onclick={decide}>{busy ? 'Василий представляет…' : 'Решить'}</Button>
        {:else}
          <div class="mine"><span class="eyebrow">Ваше решение</span><p>{choice}</p></div>
          <div class="story" in:fly={{ y: motionOK() ? 12 : 0, duration: 300 }}>
            <Vasily head size={48} mood={result.outcome === 'success' ? 'happy' : result.outcome === 'failure' ? 'sad' : 'think'} still />
            <div class="grow">
              <div class="verdict">
                <span class="badge {result.outcome}">{VERDICT[result.outcome]}</span>
                {#if result.matches}<span class="badge same">Как в истории</span>{/if}
              </div>
              {#if result.headline}<strong class="headline">{result.headline}</strong>{/if}
              <p>{result.story}</p>
            </div>
          </div>
          <div class="reality" in:fly={{ y: motionOK() ? 12 : 0, duration: 300, delay: 150 }}>
            <span class="eyebrow"><BookOpen size={14} /> Как было на самом деле</span>
            <p>{fork.truth}</p>
            <div class="chips">
              {#each facts(fork) as id (id)}<Chip size="sm" onclick={() => navigate(`/entity/${id}`)}>{kb.title(id)}</Chip>{/each}
            </div>
          </div>
          <Button full icon={RotateCcw} onclick={() => (result = null)}>Решить иначе</Button>
          <Button full variant="secondary" onclick={() => (fork = null)}>Другая развилка</Button>
        {/if}
      </article>
    {/key}
  {/if}
</div>

<style>
  .game { display: flex; flex-direction: column; gap: var(--sp-3); padding-bottom: var(--sp-6); }
  .bar { display: flex; align-items: center; gap: var(--sp-3); padding: calc(var(--safe-top) + var(--sp-3)) 0 var(--sp-2); }
  .need { display: flex; flex-direction: column; align-items: center; text-align: center; gap: var(--sp-3); padding-top: var(--sp-6); }
  .need h1 { font-size: var(--text-3xl); margin: 0; }
  .intro { display: flex; gap: var(--sp-3); align-items: flex-start; color: var(--accent); }
  .intro :global(svg) { flex: 0 0 auto; margin-top: 2px; }
  .intro p { margin: 0; font-size: var(--text-sm); line-height: 1.5; }
  .list { display: flex; flex-direction: column; gap: var(--sp-2); }
  .fork { display: flex; flex-direction: column; gap: 2px; padding: 14px 16px; border: 1px solid var(--line); border-left: 4px solid var(--c); border-radius: var(--r-md); background: var(--surface); box-shadow: var(--shadow-1); text-align: left; cursor: pointer; color: var(--ink); }
  .fork:active { transform: scale(0.99); }
  .when { font-size: var(--text-xs); font-weight: 700; color: var(--c); letter-spacing: 0.04em; text-transform: uppercase; }
  .fork strong { font-family: var(--font-display); font-size: var(--text-lg); }
  .who { font-size: var(--text-sm); color: var(--ink-3); }
  .scene { display: flex; flex-direction: column; gap: var(--sp-3); }
  .title { font-size: var(--text-2xl); margin: 0; line-height: 1.15; }
  .situation { margin: 0; padding: var(--sp-3) var(--sp-4); border-left: 3px solid var(--gold); border-radius: var(--r-sm); background: var(--surface); font-family: var(--font-read); font-size: var(--text-md); line-height: 1.55; }
  .choices { display: flex; flex-direction: column; gap: var(--sp-2); }
  .choice { padding: 12px 14px; border: 1.5px solid var(--line-strong); border-radius: var(--r-md); background: var(--surface); color: var(--ink); text-align: left; font: inherit; font-size: var(--text-sm); line-height: 1.4; cursor: pointer; }
  .choice.on { border-color: var(--accent); background: var(--accent-soft); }
  .mine p { margin: 2px 0 0; font-size: var(--text-sm); color: var(--ink-2); font-style: italic; }
  .story { display: flex; gap: var(--sp-3); align-items: flex-start; padding: var(--sp-4); border-radius: var(--r-lg); background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow-1); }
  .story p, .reality p { margin: 4px 0 0; font-family: var(--font-read); font-size: var(--text-md); line-height: 1.55; }
  .verdict { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 4px; }
  .badge { padding: 2px 10px; border-radius: var(--r-full); font-size: var(--text-xs); font-weight: 700; }
  .badge.success { background: var(--success-soft); color: var(--success); }
  .badge.mixed { background: color-mix(in srgb, var(--warning) 16%, transparent); color: var(--warning); }
  .badge.failure { background: var(--danger-soft); color: var(--danger); }
  .badge.same { background: var(--gold-soft); color: var(--ink-2); }
  .headline { display: block; font-family: var(--font-display); font-size: var(--text-lg); line-height: 1.25; }
  .reality { padding: var(--sp-4); border-radius: var(--r-lg); background: var(--gold-soft); }
  .reality .eyebrow { display: inline-flex; align-items: center; gap: 6px; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: var(--sp-3); }
</style>
