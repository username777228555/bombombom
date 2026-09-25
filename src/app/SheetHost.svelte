<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { ui, closeSheet } from '$lib/core/ui.svelte';
  import { router } from '$lib/core/router.svelte';

  let dragY = $state(0);
  let startY = 0;
  let dragging = $state(false);

  $effect(() => {
    if (!ui.sheet) return;
    return router.addBackGuard(() => {
      if (!ui.sheet) return false;
      closeSheet();
      return true;
    });
  });
  $effect(() => {
    void router.seq;
    closeSheet();
  });

  function down(e: PointerEvent) {
    dragging = true;
    startY = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (dragging) dragY = Math.max(0, e.clientY - startY);
  }
  function up() {
    if (!dragging) return;
    dragging = false;
    if (dragY > 110) closeSheet();
    dragY = 0;
  }
</script>

{#if ui.sheet}
  {@const Sheet = ui.sheet.component}
  <div class="scrim" transition:fade={{ duration: 200 }} onclick={closeSheet} role="presentation"></div>
  <div
    class="sheet"
    role="dialog"
    aria-modal="true"
    aria-label={ui.sheet.title ?? 'Подробнее'}
    transition:fly={{ y: 500, duration: 380, easing: cubicOut, opacity: 1 }}
    style:transform={dragY ? `translateY(${dragY}px)` : undefined}
    style:transition={dragging ? 'none' : undefined}
  >
    <div class="handle-zone" onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} role="presentation">
      <span class="handle"></span>
    </div>
    <div class="content">
      <Sheet {...ui.sheet.props ?? {}} />
    </div>
  </div>
{/if}

<style>
  .scrim { position: fixed; inset: 0; z-index: 80; background: var(--scrim); }
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 81;
    max-width: 640px;
    margin: 0 auto;
    max-height: 88dvh;
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border-radius: 28px 28px 0 0;
    border: 1px solid var(--line);
    box-shadow: var(--shadow-3);
    transition: transform var(--dur-3) var(--ease-out);
  }
  .handle-zone { padding: 10px 0 6px; display: grid; place-items: center; cursor: grab; touch-action: none; }
  .handle { width: 44px; height: 5px; border-radius: 3px; background: var(--line-strong); }
  .content { overflow-y: auto; padding: 0 var(--sp-5) calc(var(--safe-bottom) + var(--sp-6)); overscroll-behavior: contain; }
</style>
