<script lang="ts">
  import { fly, fade, scale } from 'svelte/transition';
  import { backOut, cubicOut } from 'svelte/easing';
  import { CircleCheck, CircleX, Info } from '@lucide/svelte';
  import { ui } from '$lib/core/ui.svelte';
  import { ORDERS, RANKS } from '$lib/core/achievements';
  import OrderBadge from '$lib/design/components/OrderBadge.svelte';
  import Button from '$lib/design/components/Button.svelte';
  import Ornament from '$lib/design/components/Ornament.svelte';
  import Emblem from '$lib/design/components/Emblem.svelte';
  import { burst } from '$lib/design/confetti';
  import { haptic } from '$lib/core/platform';
  import { toRoman } from '$lib/core/utils/format';

  const current = $derived(ui.celebrations[0]);
  const order = $derived(current?.orderId ? ORDERS.find((o) => o.id === current.orderId) : undefined);

  $effect(() => {
    if (current) {
      haptic('success');
      setTimeout(() => burst({ count: 140 }), 120);
    }
  });

  function dismiss() {
    ui.celebrations.shift();
  }
  function answer(v: boolean) {
    ui.confirm?.resolve(v);
    ui.confirm = null;
  }
</script>

<div class="toasts" aria-live="polite">
  {#each ui.toasts as t (t.id)}
    <div class="toast {t.kind}" in:fly={{ y: -24, duration: 260 }} out:fade={{ duration: 180 }}>
      {#if t.kind === 'success'}<CircleCheck size={18} />{:else if t.kind === 'error'}<CircleX size={18} />{:else}<Info size={18} />{/if}
      <span>{t.message}</span>
    </div>
  {/each}
</div>

{#if current}
  <div class="scrim" transition:fade={{ duration: 220 }} role="presentation"></div>
  <div class="dialog celebrate" role="alertdialog" aria-modal="true" aria-label={current.title} in:scale={{ start: 0.7, duration: 480, easing: backOut }} out:fade={{ duration: 160 }}>
    <div class="rays" aria-hidden="true"></div>
    <div class="visual">
      {#if order}
        <OrderBadge {order} size={96} />
      {:else if current.kind === 'rank' && current.rankIndex !== undefined}
        <div class="rank-seal">
          <span class="cls">{toRoman(RANKS[current.rankIndex]!.cls)}</span>
          <span class="eyebrow">класс</span>
        </div>
      {:else}
        <Emblem size={88} />
      {/if}
    </div>
    <span class="eyebrow">{current.kind === 'order' ? 'Высочайше пожалован' : current.kind === 'rank' ? 'Новый чин' : 'Отлично!'}</span>
    <h2>{current.title}</h2>
    <Ornament width={140} />
    {#if current.subtitle}<p class="secondary">{current.subtitle}</p>{/if}
    <Button variant="gold" full onclick={dismiss}>Служу Отечеству!</Button>
  </div>
{/if}

{#if ui.confirm}
  <div class="scrim" transition:fade={{ duration: 180 }} onclick={() => answer(false)} role="presentation"></div>
  <div class="dialog" role="alertdialog" aria-modal="true" aria-label={ui.confirm.title} transition:fly={{ y: 30, duration: 260, easing: cubicOut }}>
    <h2 class="confirm-title">{ui.confirm.title}</h2>
    {#if ui.confirm.message}<p class="secondary">{ui.confirm.message}</p>{/if}
    <div class="row actions">
      <Button variant="secondary" onclick={() => answer(false)}>Отмена</Button>
      <Button variant={ui.confirm.danger ? 'danger' : 'primary'} onclick={() => answer(true)}>{ui.confirm.ok}</Button>
    </div>
  </div>
{/if}

<style>
  .toasts {
    position: fixed;
    left: 0;
    right: 0;
    top: calc(var(--safe-top) + var(--sp-3));
    z-index: 200;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sp-2);
    pointer-events: none;
    padding: 0 var(--sp-4);
  }
  .toast {
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: 520px;
    padding: 12px 16px;
    border-radius: var(--r-md);
    background: var(--ink);
    color: var(--ink-inv);
    box-shadow: var(--shadow-3);
    font-size: var(--text-sm);
    font-weight: 560;
  }
  .toast.success :global(svg) { color: #7ddc9f; }
  .toast.error :global(svg) { color: #ff9a8f; }
  .scrim { position: fixed; inset: 0; z-index: 150; background: var(--scrim); backdrop-filter: blur(3px); }
  .dialog {
    position: fixed;
    z-index: 151;
    left: 50%;
    top: 50%;
    translate: -50% -50%;
    width: min(92vw, 420px);
    padding: var(--sp-6);
    border-radius: var(--r-xl);
    background: var(--surface);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-3);
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }
  .celebrate { align-items: center; text-align: center; overflow: hidden; }
  .celebrate h2 { font-size: var(--text-2xl); position: relative; }
  .rays {
    position: absolute;
    inset: -40% -40% auto;
    height: 380px;
    background: repeating-conic-gradient(from 0deg at 50% 50%, color-mix(in srgb, var(--gold) 16%, transparent) 0deg 8deg, transparent 8deg 20deg);
    mask-image: radial-gradient(circle at 50% 50%, #000 0 30%, transparent 62%);
    -webkit-mask-image: radial-gradient(circle at 50% 50%, #000 0 30%, transparent 62%);
    animation: spin 30s linear infinite;
    pointer-events: none;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .visual { position: relative; display: grid; place-items: center; min-height: 120px; animation: pop-in 700ms var(--ease-spring); }
  .rank-seal {
    width: 110px;
    height: 110px;
    border-radius: 50%;
    display: grid;
    place-content: center;
    background: radial-gradient(circle at 35% 30%, #f6dc98, #b0822f 70%);
    border: 3px double #7a561a;
    color: #3d2a08;
    box-shadow: 0 8px 24px rgba(120, 80, 20, 0.4);
  }
  .rank-seal .cls { font-family: var(--font-display); font-weight: 700; font-size: 38px; line-height: 1; }
  .rank-seal .eyebrow { color: #5a3f0d; }
  .confirm-title { font-size: var(--text-xl); }
  .actions { justify-content: flex-end; margin-top: var(--sp-2); }
</style>
