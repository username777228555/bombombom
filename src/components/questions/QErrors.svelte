<script lang="ts">
  import type { QuestionProps } from './types';
  import type { Question } from '$lib/core/content/schema';
  import Button from '$lib/design/components/Button.svelte';
  import { haptic } from '$lib/core/platform';

  let { q, revealed, onsubmit }: QuestionProps<Extract<Question, { type: 'errors' }>> = $props();
  let marked = $state<Set<number>>(new Set());

  function toggle(i: number) {
    if (revealed) return;
    haptic('select');
    const s = new Set(marked);
    if (s.has(i)) s.delete(i);
    else s.add(i);
    marked = s;
  }
  function check() {
    const wrong = q.segments.map((s, i) => (s.wrong ? i : -1)).filter((i) => i >= 0);
    const tp = wrong.filter((i) => marked.has(i)).length;
    const fp = [...marked].filter((i) => !q.segments[i]!.wrong).length;
    onsubmit(Math.max(0, (tp - fp) / wrong.length));
  }
</script>

<p class="muted hint">Нажмите на фрагменты с ошибками</p>
<div class="text">
  {#each q.segments as s, i (i)}
    <button
      class="seg"
      class:marked={marked.has(i)}
      class:hit={revealed && s.wrong && marked.has(i)}
      class:miss={revealed && s.wrong && !marked.has(i)}
      class:false-pos={revealed && !s.wrong && marked.has(i)}
      onclick={() => toggle(i)}
    >{s.text}</button>{#if revealed && s.wrong && s.fix}<span class="fix"> [{s.fix}]</span>{/if}
  {/each}
</div>
{#if !revealed}
  <Button full size="lg" onclick={check}>Проверить</Button>
{/if}

<style>
  .hint { font-size: var(--text-sm); margin-bottom: var(--sp-2); }
  .text { padding: var(--sp-4); border-radius: var(--r-lg); background: var(--surface); border: 1px solid var(--line); font-family: var(--font-read); font-size: var(--text-lg); line-height: 1.75; margin-bottom: var(--sp-4); }
  .seg { display: inline; border: 0; background: none; padding: 2px 1px; margin: 0; font: inherit; color: inherit; cursor: pointer; border-radius: 4px; text-align: left; transition: background-color var(--dur-2); }
  .seg:hover { background: var(--surface-3); }
  .marked { background: var(--warning-soft); text-decoration: underline wavy var(--warning); text-underline-offset: 4px; }
  .hit { background: var(--success-soft); text-decoration: line-through var(--success); }
  .miss { background: var(--danger-soft); text-decoration: underline wavy var(--danger); }
  .false-pos { background: var(--danger-soft); }
  .fix { color: var(--success); font-weight: 650; font-family: var(--font-ui); font-size: var(--text-md); }
</style>
