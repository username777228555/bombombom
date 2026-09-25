<script lang="ts">
  import { Check } from '@lucide/svelte';
  import type { QuestionProps } from './types';
  import type { Question } from '$lib/core/content/schema';
  import Button from '$lib/design/components/Button.svelte';
  import { haptic } from '$lib/core/platform';

  let { q, revealed, onsubmit }: QuestionProps<Extract<Question, { type: 'multiple' }>> = $props();
  let picked = $state<Set<number>>(new Set());

  function toggle(i: number) {
    haptic('select');
    const s = new Set(picked);
    if (s.has(i)) s.delete(i);
    else s.add(i);
    picked = s;
  }
  function check() {
    const right = new Set(q.answers);
    const hits = [...picked].filter((i) => right.has(i)).length;
    const misses = [...picked].filter((i) => !right.has(i)).length;
    onsubmit(Math.max(0, (hits - misses) / right.size));
  }
</script>

<p class="muted hint">Выберите все верные варианты</p>
<div class="opts">
  {#each q.options as opt, i (i)}
    {@const isRight = q.answers.includes(i)}
    <button
      class="opt"
      class:sel={picked.has(i)}
      class:right={revealed && isRight}
      class:wrong={revealed && picked.has(i) && !isRight}
      class:missed={revealed && !picked.has(i) && isRight}
      disabled={revealed}
      onclick={() => toggle(i)}
    >
      <span class="box">{#if picked.has(i) || (revealed && isRight)}<Check size={16} strokeWidth={3} />{/if}</span>
      <span>{opt}</span>
    </button>
  {/each}
</div>
{#if !revealed}
  <Button full size="lg" disabled={picked.size === 0} onclick={check}>Проверить</Button>
{/if}

<style>
  .hint { font-size: var(--text-sm); margin-bottom: var(--sp-2); }
  .opts { display: flex; flex-direction: column; gap: var(--sp-2); margin-bottom: var(--sp-4); }
  .opt { display: flex; align-items: center; gap: var(--sp-3); padding: 14px 16px; border: 1.5px solid var(--line-strong); border-radius: var(--r-md); background: var(--surface); text-align: left; font-size: var(--text-md); line-height: 1.35; cursor: pointer; transition: border-color var(--dur-2), background-color var(--dur-2); }
  .box { width: 24px; height: 24px; flex: 0 0 auto; border-radius: 7px; border: 2px solid var(--line-strong); display: grid; place-items: center; color: #fff; }
  .sel { border-color: var(--accent); background: var(--accent-soft); }
  .sel .box { background: var(--accent); border-color: var(--accent); }
  .right { border-color: var(--success); background: var(--success-soft); }
  .right .box { background: var(--success); border-color: var(--success); }
  .wrong { border-color: var(--danger); background: var(--danger-soft); }
  .wrong .box { background: var(--danger); border-color: var(--danger); }
  .missed { border-style: dashed; }
</style>
