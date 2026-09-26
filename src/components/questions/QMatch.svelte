<script lang="ts">
  import type { QuestionProps } from './types';
  import type { Question } from '$lib/core/content/schema';
  import Button from '$lib/design/components/Button.svelte';
  import { shuffle } from '$lib/core/utils/random';
  import { haptic } from '$lib/core/platform';

  let { q, revealed, onsubmit }: QuestionProps<Extract<Question, { type: 'match' }>> = $props();

  // The component is re-created per question, so capturing the initial question is intended.
  // svelte-ignore state_referenced_locally
  const right = shuffle(q.pairs.map((p) => p[1]));
  // svelte-ignore state_referenced_locally
  let assigned = $state<(string | null)[]>(q.pairs.map(() => null));
  let active = $state(0);
  const used = $derived(new Set(assigned.filter(Boolean)));

  function place(value: string) {
    if (revealed) return;
    haptic('select');
    const next = [...assigned];
    const prev = next.indexOf(value);
    if (prev >= 0) next[prev] = null;
    next[active] = value;
    assigned = next;
    const free = next.findIndex((x) => !x);
    active = free >= 0 ? free : active;
  }
  function check() {
    const ok = assigned.filter((a, i) => a === q.pairs[i]![1]).length;
    onsubmit(ok / q.pairs.length);
  }
</script>

<p class="muted hint">Выберите строку слева, затем подходящий вариант снизу</p>
<div class="rows">
  {#each q.pairs as pair, i (i)}
    {@const ok = revealed && assigned[i] === pair[1]}
    <button class="row-m" class:active={!revealed && active === i} class:right={ok} class:wrong={revealed && !ok} onclick={() => (active = i)} disabled={revealed}>
      <span class="left">{pair[0]}</span>
      <span class="slot" class:filled={!!assigned[i]}>
        {assigned[i] ?? '—'}
        {#if revealed && !ok}<small>верно: {pair[1]}</small>{/if}
      </span>
    </button>
  {/each}
</div>
{#if !revealed}
  <div class="bank">
    {#each right as r (r)}
      <button class="chip-m" class:used={used.has(r)} onclick={() => place(r)}>{r}</button>
    {/each}
  </div>
  <Button full size="lg" disabled={assigned.some((a) => !a)} onclick={check}>Проверить</Button>
{/if}

<style>
  .hint { font-size: var(--text-sm); margin-bottom: var(--sp-2); }
  .rows { display: flex; flex-direction: column; gap: var(--sp-2); margin-bottom: var(--sp-3); }
  .row-m { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); align-items: center; padding: 12px 14px; border: 1.5px solid var(--line-strong); border-radius: var(--r-md); background: var(--surface); text-align: left; cursor: pointer; font-size: var(--text-sm); line-height: 1.3; }
  .left { font-weight: 620; }
  .slot { padding: 8px 10px; border-radius: var(--r-sm); background: var(--surface-3); color: var(--ink-3); display: flex; flex-direction: column; min-height: 38px; justify-content: center; }
  .slot.filled { background: var(--accent-soft); color: var(--ink); }
  .slot small { color: var(--danger); font-size: var(--text-2xs); margin-top: 2px; }
  .active { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent); }
  .right { border-color: var(--success); background: var(--success-soft); }
  .right .slot { background: color-mix(in srgb, var(--success) 18%, transparent); }
  .wrong { border-color: var(--danger); background: var(--danger-soft); }
  .bank { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-bottom: var(--sp-4); padding: var(--sp-3); border-radius: var(--r-md); background: var(--surface-2); border: 1px dashed var(--line-strong); }
  .chip-m { padding: 8px 12px; border-radius: var(--r-full); border: 1px solid var(--line-strong); background: var(--surface); font-size: var(--text-sm); cursor: pointer; transition: opacity var(--dur-2), transform var(--dur-1); }
  .chip-m:active { transform: scale(0.95); }
  .chip-m.used { opacity: 0.35; }
</style>
