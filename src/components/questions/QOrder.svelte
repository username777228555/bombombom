<script lang="ts">
  import { flip } from 'svelte/animate';
  import { GripVertical, ChevronUp, ChevronDown } from '@lucide/svelte';
  import type { QuestionProps } from './types';
  import type { Question } from '$lib/core/content/schema';
  import Button from '$lib/design/components/Button.svelte';
  import { shuffle } from '$lib/core/utils/random';
  import { haptic } from '$lib/core/platform';

  let { q, revealed, onsubmit }: QuestionProps<Extract<Question, { type: 'order' }>> = $props();

  const initial = (() => {
    let s = shuffle(q.items);
    for (let i = 0; i < 5 && s.every((x, j) => x === q.items[j]); i++) s = shuffle(q.items);
    return s;
  })();
  let items = $state<string[]>(initial);
  let dragIndex = $state<number | null>(null);
  let listEl: HTMLElement | undefined = $state();

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x!);
    items = next;
    haptic('select');
  }

  function down(e: PointerEvent, i: number) {
    if (revealed) return;
    dragIndex = i;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function moveDrag(e: PointerEvent) {
    if (dragIndex === null || !listEl) return;
    const rows = [...listEl.querySelectorAll<HTMLElement>('.item')];
    const target = rows.findIndex((r) => {
      const b = r.getBoundingClientRect();
      return e.clientY >= b.top && e.clientY <= b.bottom;
    });
    if (target >= 0 && target !== dragIndex) {
      move(dragIndex, target);
      dragIndex = target;
    }
  }
  function up() {
    dragIndex = null;
  }

  function check() {
    const correct = items.filter((x, i) => x === q.items[i]).length;
    onsubmit(correct === items.length ? 1 : correct / items.length);
  }
</script>

<p class="muted hint">Перетащите за ручку или используйте стрелки: сверху — самое раннее</p>
<ol class="list" bind:this={listEl} onpointermove={moveDrag} onpointerup={up} onpointercancel={up}>
  {#each items as item, i (item)}
    {@const ok = revealed && q.items[i] === item}
    <li class="item" class:dragging={dragIndex === i} class:right={ok} class:wrong={revealed && !ok} animate:flip={{ duration: 220 }}>
      <span class="handle" onpointerdown={(e) => down(e, i)} role="presentation"><GripVertical size={18} /></span>
      <span class="pos num">{i + 1}</span>
      <span class="txt">{item}{#if revealed && !ok}<small>на месте {q.items.indexOf(item) + 1}</small>{/if}</span>
      {#if !revealed}
        <span class="arrows">
          <button aria-label="Выше" onclick={() => move(i, i - 1)} disabled={i === 0}><ChevronUp size={18} /></button>
          <button aria-label="Ниже" onclick={() => move(i, i + 1)} disabled={i === items.length - 1}><ChevronDown size={18} /></button>
        </span>
      {/if}
    </li>
  {/each}
</ol>
{#if !revealed}
  <Button full size="lg" onclick={check}>Проверить</Button>
{/if}

<style>
  .hint { font-size: var(--text-sm); margin-bottom: var(--sp-2); }
  .list { list-style: none; padding: 0; margin: 0 0 var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-2); touch-action: none; }
  .item { display: flex; align-items: center; gap: var(--sp-2); padding: 10px 10px 10px 6px; border: 1.5px solid var(--line-strong); border-radius: var(--r-md); background: var(--surface); box-shadow: var(--shadow-1); user-select: none; }
  .dragging { border-color: var(--accent); box-shadow: var(--shadow-3); transform: scale(1.02); z-index: 2; }
  .handle { color: var(--ink-3); cursor: grab; padding: 8px 4px; touch-action: none; display: grid; }
  .pos { width: 26px; height: 26px; flex: 0 0 auto; border-radius: 8px; display: grid; place-items: center; background: var(--surface-3); font-weight: 700; font-size: var(--text-sm); }
  .txt { flex: 1; font-size: var(--text-md); line-height: 1.3; display: flex; flex-direction: column; }
  .txt small { font-size: var(--text-xs); color: var(--danger); }
  .arrows { display: flex; flex-direction: column; }
  .arrows button { border: 0; background: none; color: var(--ink-3); padding: 2px 6px; cursor: pointer; }
  .arrows button:disabled { opacity: 0.25; }
  .right { border-color: var(--success); background: var(--success-soft); }
  .right .pos { background: var(--success); color: #fff; }
  .wrong { border-color: var(--danger); background: var(--danger-soft); }
</style>
