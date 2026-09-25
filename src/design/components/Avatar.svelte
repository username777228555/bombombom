<script lang="ts">
  import { initials } from '$lib/core/utils/format';
  interface Props {
    name: string;
    color?: string;
    image?: string;
    size?: number;
  }
  let { name, color = 'var(--accent)', image, size = 44 }: Props = $props();
</script>

<span class="av" style:--c={color} style:--s="{size}px">
  {#if image}
    <img src={image} alt="" loading="lazy" />
  {:else}
    {initials(name)}
  {/if}
</span>

<style>
  .av {
    width: var(--s);
    height: var(--s);
    flex: 0 0 auto;
    border-radius: 50%;
    display: grid;
    place-items: center;
    overflow: hidden;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: calc(var(--s) * 0.38);
    color: color-mix(in srgb, var(--c) 85%, var(--ink));
    background: color-mix(in srgb, var(--c) 15%, var(--surface));
    border: 1.5px solid color-mix(in srgb, var(--c) 35%, transparent);
  }
  img { width: 100%; height: 100%; object-fit: cover; }
</style>
