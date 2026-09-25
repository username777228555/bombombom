<script lang="ts">
  interface Props {
    value: number;
    color?: string;
    height?: number;
    label?: string;
  }
  let { value, color = 'var(--accent)', height = 8, label }: Props = $props();
</script>

<div
  class="bar"
  style:height="{height}px"
  role="progressbar"
  aria-label={label}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-valuenow={Math.round(value * 100)}
>
  <span style:width="{Math.max(0, Math.min(1, value)) * 100}%" style:background={color}></span>
</div>

<style>
  .bar { width: 100%; border-radius: var(--r-full); background: var(--surface-3); overflow: hidden; }
  span { display: block; height: 100%; border-radius: inherit; transition: width var(--dur-4) var(--ease-out); }
</style>
