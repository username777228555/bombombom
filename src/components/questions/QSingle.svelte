<script lang="ts">
  import type { QuestionProps } from './types';
  import type { Question } from '$lib/core/content/schema';
  import Button from '$lib/design/components/Button.svelte';
  import { haptic } from '$lib/core/platform';

  let { q, revealed, onsubmit }: QuestionProps<Extract<Question, { type: 'single' }>> = $props();
  let picked = $state<number | null>(null);
</script>

<div class="opts">
  {#each q.options as opt, i (i)}
    <button
      class="opt"
      class:sel={picked === i}
      class:right={revealed && i === q.answer}
      class:wrong={revealed && picked === i && i !== q.answer}
      disabled={revealed}
      onclick={() => {
        haptic('select');
        picked = i;
      }}
    >
      <span class="n">{String.fromCharCode(1040 + i)}</span>
      <span>{opt}</span>
    </button>
  {/each}
</div>
{#if !revealed}
  <Button full size="lg" disabled={picked === null} onclick={() => onsubmit(picked === q.answer ? 1 : 0)}>Проверить</Button>
{/if}

<style>
  .opts { display: flex; flex-direction: column; gap: var(--sp-2); margin-bottom: var(--sp-4); }
  .opt {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: 14px 16px;
    border: 1.5px solid var(--line-strong);
    border-radius: var(--r-md);
    background: var(--surface);
    text-align: left;
    font-size: var(--text-md);
    line-height: 1.35;
    cursor: pointer;
    transition: border-color var(--dur-2), background-color var(--dur-2), transform var(--dur-1);
  }
  .opt:active:not(:disabled) { transform: scale(0.985); }
  .n { width: 28px; height: 28px; flex: 0 0 auto; border-radius: 8px; display: grid; place-items: center; background: var(--surface-3); font-weight: 700; font-size: var(--text-sm); color: var(--ink-3); font-family: var(--font-display); }
  .sel { border-color: var(--accent); background: var(--accent-soft); }
  .sel .n { background: var(--accent); color: var(--on-accent); }
  .right { border-color: var(--success); background: var(--success-soft); }
  .right .n { background: var(--success); color: #fff; }
  .wrong { border-color: var(--danger); background: var(--danger-soft); }
  .wrong .n { background: var(--danger); color: #fff; }
</style>
