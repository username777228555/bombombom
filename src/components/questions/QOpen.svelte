<script lang="ts">
  /**
   * «Развёрнутый ответ» — most olympiad tasks (ВсОШ, Высшая проба) want a written answer, not a word. The student
   * writes (or thinks through) the answer, opens the model answer and ticks the criteria the answer covers;
   * the score is the share of ticked criteria. Nothing is graded automatically — honest self-check, as with cards.
   */
  import type { QuestionProps } from './types';
  import type { Question } from '$lib/core/content/schema';
  import { Check } from '@lucide/svelte';
  import Button from '$lib/design/components/Button.svelte';

  let { q, revealed, onsubmit }: QuestionProps<Extract<Question, { type: 'open' }>> = $props();
  let text = $state('');
  let comparing = $state(false);
  let ticked = $state<boolean[]>([]);
  $effect(() => {
    if (ticked.length !== q.criteria.length) ticked = q.criteria.map(() => false);
  });
  const got = $derived(ticked.filter(Boolean).length);
</script>

{#if !comparing && !revealed}
  <textarea class="answer" bind:value={text} rows="7" placeholder="Напишите ответ — или продумайте его про себя, а потом сравните с эталоном"></textarea>
  <Button full size="lg" onclick={() => (comparing = true)}>Сравнить с эталоном</Button>
{:else}
  {#if text.trim()}
    <div class="mine"><span class="eyebrow">Ваш ответ</span><p>{text}</p></div>
  {/if}
  <div class="model"><span class="eyebrow">Эталон</span><p>{q.answer}</p></div>
  <span class="eyebrow">{revealed ? 'Критерии' : 'Отметьте, что есть в вашем ответе'}</span>
  <ul class="criteria">
    {#each q.criteria as c, i (i)}
      <li>
        <label class:on={ticked[i]}>
          <input type="checkbox" bind:checked={ticked[i]} disabled={revealed} />
          <span class="box">{#if ticked[i]}<Check size={14} />{/if}</span>
          <span class="grow">{c}</span>
        </label>
      </li>
    {/each}
  </ul>
  {#if !revealed}
    <Button full size="lg" onclick={() => onsubmit(got / q.criteria.length)}>Засчитать: {got} из {q.criteria.length}</Button>
  {/if}
{/if}

<style>
  .answer { width: 100%; box-sizing: border-box; resize: vertical; min-height: 140px; padding: 12px 14px; margin-bottom: var(--sp-3); border-radius: var(--r-md); border: 1.5px solid var(--line); background: var(--surface); color: var(--ink); font: inherit; font-family: var(--font-read); font-size: var(--text-md); line-height: 1.5; }
  .answer:focus { outline: none; border-color: var(--accent); }
  .mine, .model { padding: 10px 14px; border-radius: var(--r-md); margin-bottom: var(--sp-3); }
  .mine { background: var(--surface); border: 1px solid var(--line); }
  .model { background: color-mix(in srgb, var(--gold) 10%, var(--surface)); border: 1px solid color-mix(in srgb, var(--gold) 35%, transparent); }
  .mine p, .model p { margin: 4px 0 0; font-family: var(--font-read); line-height: 1.55; white-space: pre-line; }
  .criteria { list-style: none; padding: 0; margin: var(--sp-2) 0 var(--sp-4); display: flex; flex-direction: column; gap: 6px; }
  .criteria label { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border-radius: var(--r-md); border: 1.5px solid var(--line); background: var(--surface); cursor: pointer; font-size: var(--text-sm); line-height: 1.35; }
  .criteria label.on { border-color: var(--success); background: var(--success-soft); }
  .criteria input { position: absolute; opacity: 0; pointer-events: none; }
  .box { flex: 0 0 auto; width: 20px; height: 20px; border-radius: 6px; border: 1.5px solid var(--line-strong, var(--ink-3)); display: grid; place-items: center; color: #fff; }
  .on .box { background: var(--success); border-color: var(--success); }
</style>
