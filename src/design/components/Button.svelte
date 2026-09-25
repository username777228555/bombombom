<script lang="ts">
  import type { Component, Snippet } from 'svelte';
  import { haptic } from '$lib/core/platform';
  import { navigate } from '$lib/core/router.svelte';

  interface Props {
    variant?: 'primary' | 'secondary' | 'soft' | 'ghost' | 'gold' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    icon?: Component<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    iconRight?: Component<any>;
    full?: boolean;
    disabled?: boolean;
    loading?: boolean;
    type?: 'button' | 'submit';
    href?: string;
    label?: string;
    onclick?: (e: MouseEvent) => void;
    children?: Snippet;
    class?: string;
  }
  let {
    variant = 'primary', size = 'md', icon: Icon, iconRight: IconRight, full = false, disabled = false,
    loading = false, type = 'button', href, label, onclick, children, class: cls = '',
  }: Props = $props();

  function handle(e: MouseEvent) {
    if (disabled || loading) return;
    haptic('tap');
    onclick?.(e);
    if (href) navigate(href);
  }
</script>

<button
  {type}
  class="btn {variant} {size} {cls}"
  class:full
  class:loading
  disabled={disabled || loading}
  aria-label={label}
  onclick={handle}
>
  {#if loading}
    <span class="spin" aria-hidden="true"></span>
  {:else if Icon}
    <Icon size={size === 'sm' ? 16 : 18} strokeWidth={2.1} />
  {/if}
  {#if children}<span class="label">{@render children()}</span>{/if}
  {#if IconRight}<IconRight size={size === 'sm' ? 16 : 18} strokeWidth={2.1} />{/if}
</button>

<style>
  .btn {
    --h: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--sp-2);
    height: var(--h);
    padding: 0 calc(var(--h) * 0.42);
    border-radius: var(--r-full);
    border: 1px solid transparent;
    font-weight: 620;
    font-size: var(--text-md);
    letter-spacing: 0.005em;
    cursor: pointer;
    white-space: nowrap;
    user-select: none;
    transition: transform var(--dur-1) var(--ease-out), background-color var(--dur-2) var(--ease-out),
      box-shadow var(--dur-2) var(--ease-out), opacity var(--dur-2);
  }
  .btn:active:not(:disabled) {
    transform: scale(0.965);
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .sm { --h: 34px; font-size: var(--text-sm); }
  .lg { --h: 54px; font-size: var(--text-lg); }
  .full { width: 100%; }
  .label { overflow: hidden; text-overflow: ellipsis; }

  .primary {
    background: var(--accent);
    color: var(--on-accent);
    box-shadow: 0 6px 18px color-mix(in srgb, var(--accent) 30%, transparent), inset 0 1px 0 rgba(255, 255, 255, 0.14);
  }
  .primary:hover:not(:disabled) { background: var(--accent-2); }
  .secondary { background: var(--surface); color: var(--ink); border-color: var(--line-strong); box-shadow: var(--shadow-1); }
  .secondary:hover:not(:disabled) { background: var(--surface-2); }
  .soft { background: var(--accent-soft); color: var(--accent); }
  .ghost { background: transparent; color: var(--ink-2); }
  .ghost:hover:not(:disabled) { background: var(--surface-2); }
  .gold {
    background: linear-gradient(180deg, #e2bd6a, #b0822f);
    color: #2a1c05;
    border-color: color-mix(in srgb, #8c6420 60%, transparent);
    box-shadow: 0 6px 18px rgba(176, 130, 47, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.4);
  }
  .danger { background: var(--danger-soft); color: var(--danger); }

  .spin {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid currentColor;
    border-right-color: transparent;
    animation: rot 700ms linear infinite;
  }
  @keyframes rot { to { transform: rotate(360deg); } }
</style>
