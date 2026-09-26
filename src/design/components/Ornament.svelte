<script lang="ts">
  let { width = 180 }: { width?: number } = $props();
</script>

<svg class="orn" viewBox="0 0 240 18" style:width="{width}px" aria-hidden="true">
  <path d="M0 9 H96" stroke="currentColor" stroke-width="1" />
  <path d="M144 9 H240" stroke="currentColor" stroke-width="1" />
  <path d="M8 12 H90" stroke="currentColor" stroke-width="0.6" stroke-opacity="0.6" />
  <path d="M150 12 H232" stroke="currentColor" stroke-width="0.6" stroke-opacity="0.6" />
  <path d="M120 1 L128 9 L120 17 L112 9 Z" fill="currentColor" />
  <path d="M120 5 L124 9 L120 13 L116 9 Z" fill="var(--bg)" />
  <circle cx="104" cy="9" r="2" fill="currentColor" />
  <circle cx="136" cy="9" r="2" fill="currentColor" />
</svg>

<style>
  .orn { display: block; color: var(--gold); height: auto; margin: 0 auto; }
</style>
