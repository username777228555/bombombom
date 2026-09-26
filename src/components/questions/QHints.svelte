<script lang="ts">
  import { fly } from 'svelte/transition';
  import { Lightbulb } from '@lucide/svelte';
  import type { QuestionProps } from './types';
  import type { Question } from '$lib/core/content/schema';
  import Button from '$lib/design/components/Button.svelte';
  import TextField from '$lib/design/components/TextField.svelte';
  import { answerMatches } from '$lib/core/utils/text';
  import { haptic } from '$lib/core/platform';

  let { q, revealed, onsubmit }: QuestionProps<Extract<Question, { type: 'hints' }>> = $props();
  let shown = $state(1);
  let value = $state('');
  let ok = $state(false);
  let wrongTry = $state(false);

  function check() {
    if (!value.trim()) return;
    ok = answerMatches(value, q.answers);
    if (ok) {
      onsubmit((q.hints.length - shown + 1) / q.hints.length);
    } else if (shown < q.hints.length) {
      haptic('error');
      wrongTry = true;
      shown++;
      value = '';
      setTimeout(() => (wrongTry = false), 600);
    } else {
      onsubmit(0);
    }
  }
</script>

<ol class="hints">
  {#each q.hints.slice(0, revealed ? q.hints.length : shown) as h, i (i)}
    <li in:fly={{ y: 10, duration: 260 }}><span class="n">{i + 1}</span>{h}</li>
  {/each}
</ol>
{#if !revealed}
  <p class="muted pts">Сейчас за ответ: {q.hints.length - shown + 1} из {q.hints.length} баллов</p>
  <div class="wrap" class:shake={wrongTry}>
    <TextField bind:value placeholder="Кто это / что это?" autofocus onenter={check} />
  </div>
  <div class="row">
    {#if shown < q.hints.length}
      <Button variant="secondary" icon={Lightbulb} onclick={() => (shown = Math.min(q.hints.length, shown + 1))}>Подсказка</Button>
    {/if}
    <div class="grow"><Button full disabled={!value.trim()} onclick={check}>Ответить</Button></div>
  </div>
{:else if !ok}
  <p class="answer">Ответ: <b>{q.answers[0]}</b></p>
{/if}

<style>
  .hints { list-style: none; padding: 0; margin: 0 0 var(--sp-3); display: flex; flex-direction: column; gap: var(--sp-2); }
  .hints li { display: flex; gap: var(--sp-3); padding: 12px 14px; border-radius: var(--r-md); background: var(--gold-soft); border: 1px solid color-mix(in srgb, var(--gold) 25%, transparent); font-family: var(--font-read); line-height: 1.45; }
  .n { width: 24px; height: 24px; flex: 0 0 auto; border-radius: 50%; display: grid; place-items: center; background: var(--gold); color: #fff; font-size: var(--text-xs); font-weight: 700; font-family: var(--font-ui); }
  .pts { font-size: var(--text-sm); margin-bottom: var(--sp-2); }
  .wrap { margin-bottom: var(--sp-3); }
  .answer { color: var(--success); margin-top: var(--sp-2); }
</style>
