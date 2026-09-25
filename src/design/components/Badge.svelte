<script lang="ts">
  import type { Snippet } from 'svelte';
  interface Props {
    tone?: 'neutral' | 'accent' | 'gold' | 'success' | 'danger' | 'warning' | 'info';
    color?: string;
    children?: Snippet;
  }
  let { tone = 'neutral', color, children }: Props = $props();
</script>

<span class="badge {tone}" class:custom={!!color} style:--c={color}>{@render children?.()}</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 22px;
    padding: 0 8px;
    border-radius: var(--r-full);
    font-size: var(--text-2xs);
    font-weight: 650;
    letter-spacing: 0.03em;
    white-space: nowrap;
    background: var(--surface-3);
    color: var(--ink-2);
  }
  .accent { background: var(--accent-soft); color: var(--accent); }
  .gold { background: var(--gold-soft); color: var(--gold); }
  .success { background: var(--success-soft); color: var(--success); }
  .danger { background: var(--danger-soft); color: var(--danger); }
  .warning { background: var(--warning-soft); color: var(--warning); }
  .info { background: var(--info-soft); color: var(--info); }
  .custom { background: color-mix(in srgb, var(--c) 15%, transparent); color: color-mix(in srgb, var(--c) 85%, var(--ink)); }
</style>
