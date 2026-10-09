<script lang="ts">
  import type { Component } from 'svelte';
  interface Props {
    value: string;
    placeholder?: string;
    label?: string;
    /** Small note under the field: expected answer format and the like. */
    hint?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    icon?: Component<any>;
    multiline?: boolean;
    rows?: number;
    type?: string;
    inputmode?: 'text' | 'numeric' | 'search';
    autofocus?: boolean;
    status?: 'none' | 'ok' | 'bad';
    onenter?: () => void;
    oninput?: (v: string) => void;
    el?: HTMLInputElement | HTMLTextAreaElement | null;
  }
  let {
    value = $bindable(), placeholder = '', label, hint, icon: Icon, multiline = false, rows = 4, type = 'text',
    inputmode, autofocus = false, status = 'none', onenter, oninput, el = $bindable(null),
  }: Props = $props();

  $effect(() => {
    if (autofocus && el) setTimeout(() => el?.focus(), 250);
  });
</script>

<label class="field" class:ok={status === 'ok'} class:bad={status === 'bad'}>
  {#if label}<span class="eyebrow lbl">{label}</span>{/if}
  <span class="box" class:has-icon={!!Icon}>
    {#if Icon}<span class="icon"><Icon size={18} /></span>{/if}
    {#if multiline}
      <textarea bind:this={el} bind:value {placeholder} {rows} oninput={() => oninput?.(value)}></textarea>
    {:else}
      <input
        bind:this={el}
        bind:value
        {type}
        {placeholder}
        {inputmode}
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        oninput={() => oninput?.(value)}
        onkeydown={(e) => e.key === 'Enter' && onenter?.()}
      />
    {/if}
  </span>
  {#if hint}<small class="hint">{hint}</small>{/if}
</label>

<style>
  .field { display: flex; flex-direction: column; gap: 6px; width: 100%; }
  .lbl { padding-left: 4px; }
  .hint { padding-left: 4px; font-size: var(--text-xs); color: var(--ink-3); line-height: 1.35; }
  .box { position: relative; display: block; }
  input, textarea {
    width: 100%;
    border: 1.5px solid var(--line-strong);
    background: var(--surface);
    border-radius: var(--r-md);
    padding: 12px 14px;
    font-size: var(--text-md);
    color: var(--ink);
    outline: none;
    resize: vertical;
    transition: border-color var(--dur-2), box-shadow var(--dur-2);
  }
  .has-icon input { padding-left: 42px; }
  input:focus, textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 14%, transparent); }
  .icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--ink-3); display: grid; }
  .ok input { border-color: var(--success); background: var(--success-soft); }
  .bad input { border-color: var(--danger); background: var(--danger-soft); }
</style>
