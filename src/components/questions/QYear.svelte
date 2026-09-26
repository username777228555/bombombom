<script lang="ts">
  import { Delete } from '@lucide/svelte';
  import type { QuestionProps } from './types';
  import type { Question } from '$lib/core/content/schema';
  import Button from '$lib/design/components/Button.svelte';
  import { haptic } from '$lib/core/platform';

  let { q, revealed, onsubmit }: QuestionProps<Extract<Question, { type: 'year' }>> = $props();
  let value = $state('');
  const diff = $derived(value ? Number(value) - q.answer : 0);

  function key(k: string) {
    if (revealed) return;
    haptic('select');
    if (k === '⌫') value = value.slice(0, -1);
    else if (value.length < 4) value += k;
  }
  function check() {
    const tol = q.tolerance ?? 0;
    onsubmit(Math.abs(Number(value) - q.answer) <= tol ? 1 : 0);
  }
</script>

<svelte:window onkeydown={(e) => {
  if (/^\d$/.test(e.key)) key(e.key);
  else if (e.key === 'Backspace') key('⌫');
  else if (e.key === 'Enter' && value && !revealed) check();
}} />

<div class="display" class:right={revealed && Math.abs(diff) <= (q.tolerance ?? 0)} class:wrong={revealed && Math.abs(diff) > (q.tolerance ?? 0)}>
  <span class="num">{value || '____'}</span>
  {#if revealed}
    <small>{diff === 0 ? 'Точно!' : `Верно: ${q.answer} (${diff > 0 ? '+' : ''}${diff})`}</small>
  {/if}
</div>
{#if !revealed}
  <div class="pad">
    {#each ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'] as k (k || 'blank')}
      {#if k}
        <button onclick={() => key(k)} aria-label={k === '⌫' ? 'Стереть' : k}>{#if k === '⌫'}<Delete size={20} />{:else}{k}{/if}</button>
      {:else}<span></span>{/if}
    {/each}
  </div>
  <Button full size="lg" disabled={!value} onclick={check}>Проверить</Button>
{/if}

<style>
  .display { display: flex; flex-direction: column; align-items: center; padding: var(--sp-4); margin-bottom: var(--sp-3); border-radius: var(--r-lg); background: var(--surface); border: 1.5px solid var(--line-strong); }
  .display span { font-family: var(--font-display); font-size: var(--text-4xl); font-weight: 700; letter-spacing: 0.08em; }
  .display small { font-weight: 650; }
  .right { border-color: var(--success); background: var(--success-soft); color: var(--success); }
  .wrong { border-color: var(--danger); background: var(--danger-soft); color: var(--danger); }
  .pad { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-2); margin-bottom: var(--sp-4); }
  .pad button { height: 54px; border-radius: var(--r-md); border: 1px solid var(--line); background: var(--surface); font-size: var(--text-xl); font-weight: 600; cursor: pointer; display: grid; place-items: center; transition: transform var(--dur-1), background-color var(--dur-2); }
  .pad button:active { transform: scale(0.94); background: var(--surface-3); }
</style>
