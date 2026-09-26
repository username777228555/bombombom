<script lang="ts">
  import type { Component, Snippet } from 'svelte';
  interface Props {
    title: string;
    text?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    icon?: Component<any>;
    children?: Snippet;
  }
  let { title, text, icon: Icon, children }: Props = $props();
</script>

<div class="empty">
  <div class="medallion">
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" stroke-opacity="0.25" stroke-width="1.5" />
      <circle cx="60" cy="60" r="49" fill="none" stroke="currentColor" stroke-opacity="0.35" stroke-dasharray="2 5" />
      {#each Array.from({ length: 8 }) as _, i (i)}
        <path d="M60 4 l3 6 h-6z" fill="currentColor" fill-opacity="0.35" transform="rotate({i * 45} 60 60)" />
      {/each}
    </svg>
    {#if Icon}<span class="ico"><Icon size={34} strokeWidth={1.6} /></span>{/if}
  </div>
  <h3>{title}</h3>
  {#if text}<p class="secondary">{text}</p>{/if}
  {#if children}<div class="actions">{@render children()}</div>{/if}
</div>

<style>
  .empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: var(--sp-3); padding: var(--sp-10) var(--sp-4); }
  .medallion { position: relative; width: 120px; height: 120px; color: var(--gold); }
  .medallion svg { position: absolute; inset: 0; }
  .ico { position: absolute; inset: 0; display: grid; place-items: center; color: var(--accent); }
  h3 { font-size: var(--text-xl); }
  p { max-width: 34ch; }
  .actions { margin-top: var(--sp-2); display: flex; gap: var(--sp-2); flex-wrap: wrap; justify-content: center; }
</style>
