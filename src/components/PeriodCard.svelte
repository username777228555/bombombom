<script lang="ts">
  import type { Period } from '$lib/core/content/schema';
  import { kb } from '$lib/core/content/kb.svelte';
  import { century, toRoman } from '$lib/core/utils/format';
  import { navigate } from '$lib/core/router.svelte';
  import { haptic } from '$lib/core/platform';

  interface Props {
    period: Period;
    variant?: 'compact' | 'wide';
    index?: number;
  }
  let { period, variant = 'compact', index = 0 }: Props = $props();
  const cover = $derived(kb.periodCover(period));
  const counts = $derived.by(() => {
    void kb.version;
    return { events: kb.eventsIn(period.id).length, persons: kb.personsIn(period.id).length, culture: kb.cultureIn(period.id).length };
  });
  const numeral = $derived(toRoman(century(Math.max(period.from, 1) + 1)));
</script>

<button
  class="pc {variant}"
  style:--c={period.color}
  style:--delay="{index * 40}ms"
  onclick={() => {
    haptic('tap');
    navigate(`/period/${period.id}`);
  }}
>
  <div class="art" aria-hidden="true">
    {#if cover}
      <img src={cover} alt="" loading="lazy" />
    {:else}
      <svg viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="pat-{period.id}" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <path d="M0 12 H24 M12 0 V24" stroke="white" stroke-opacity="0.07" stroke-width="1" />
            <circle cx="12" cy="12" r="2" fill="white" fill-opacity="0.08" />
          </pattern>
        </defs>
        <rect width="200" height="120" fill="url(#pat-{period.id})" />
        <circle cx="170" cy="20" r="60" fill="white" fill-opacity="0.06" />
        <circle cx="170" cy="20" r="40" fill="none" stroke="white" stroke-opacity="0.12" />
      </svg>
    {/if}
    <span class="numeral">{numeral}</span>
  </div>
  <div class="shade"></div>
  <div class="txt">
    <span class="range">{period.range}</span>
    <strong>{period.title}</strong>
    {#if variant === 'wide'}
      <span class="desc clamp-2">{period.description}</span>
      <span class="counts">{counts.events} событий · {counts.persons} персоналий · {counts.culture} памятников</span>
    {/if}
  </div>
</button>

<style>
  .pc {
    position: relative;
    display: block;
    border: 0;
    padding: 0;
    border-radius: var(--r-lg);
    overflow: hidden;
    cursor: pointer;
    text-align: left;
    color: #fff;
    background: linear-gradient(145deg, color-mix(in srgb, var(--c) 92%, #fff 8%), color-mix(in srgb, var(--c) 70%, #000 30%));
    box-shadow: var(--shadow-2);
    transition: transform var(--dur-2) var(--ease-out), box-shadow var(--dur-2);
    animation: rise 520ms var(--delay) var(--ease-out) both;
  }
  .pc:active { transform: scale(0.97); }
  .compact { width: 168px; height: 212px; }
  .wide { width: 100%; min-height: 176px; }
  .art { position: absolute; inset: 0; }
  .art img, .art svg { width: 100%; height: 100%; object-fit: cover; display: block; }
  .art img { filter: saturate(0.9) contrast(1.02); }
  .numeral {
    position: absolute;
    right: 10px;
    top: 2px;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 64px;
    line-height: 1;
    color: rgba(255, 255, 255, 0.16);
    letter-spacing: 0.02em;
  }
  .wide .numeral { font-size: 96px; }
  .shade {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, transparent 20%, color-mix(in srgb, var(--c) 55%, rgba(10, 6, 4, 0.9)) 100%);
  }
  .txt { position: absolute; inset: auto 0 0 0; padding: var(--sp-4); display: flex; flex-direction: column; gap: 4px; }
  .wide .txt { position: relative; padding: var(--sp-5); min-height: 176px; justify-content: flex-end; }
  .range { font-size: var(--text-2xs); font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.85; }
  strong { font-family: var(--font-display); font-size: var(--text-xl); line-height: 1.1; text-shadow: 0 1px 12px rgba(0, 0, 0, 0.35); }
  .wide strong { font-size: var(--text-2xl); }
  .desc { font-size: var(--text-sm); opacity: 0.9; line-height: 1.4; max-width: 46ch; }
  .counts { font-size: var(--text-xs); opacity: 0.8; margin-top: 4px; }
  @keyframes rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
</style>
