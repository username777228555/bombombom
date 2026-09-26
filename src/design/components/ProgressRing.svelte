<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';

  interface Props {
    value: number;
    size?: number;
    stroke?: number;
    color?: string;
    track?: string;
    children?: Snippet;
  }
  let { value, size = 72, stroke = 7, color = 'var(--accent)', track = 'var(--surface-3)', children }: Props = $props();
  const t = new Tween(0, { duration: 900, easing: cubicOut });
  $effect(() => {
    t.target = Math.max(0, Math.min(1, value));
  });
  const r = $derived((size - stroke) / 2);
  const c = $derived(2 * Math.PI * r);
</script>

<div class="ring" style:width="{size}px" style:height="{size}px">
  <svg width={size} height={size} viewBox="0 0 {size} {size}" aria-hidden="true">
    <circle cx={size / 2} cy={size / 2} {r} fill="none" stroke={track} stroke-width={stroke} />
    <circle
      cx={size / 2}
      cy={size / 2}
      {r}
      fill="none"
      stroke={color}
      stroke-width={stroke}
      stroke-linecap="round"
      stroke-dasharray={c}
      stroke-dashoffset={c * (1 - t.current)}
      transform="rotate(-90 {size / 2} {size / 2})"
    />
  </svg>
  <div class="inner">{@render children?.()}</div>
</div>

<style>
  .ring { position: relative; flex: 0 0 auto; }
  svg { display: block; }
  .inner { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; }
</style>
