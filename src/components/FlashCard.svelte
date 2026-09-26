<script lang="ts">
  import type { StudyCard } from '$lib/core/content/cards';
  import PeriodTag from './PeriodTag.svelte';

  interface Props {
    card: StudyCard;
    flipped: boolean;
    onflip?: () => void;
  }
  let { card, flipped, onflip }: Props = $props();
  const longBack = $derived(card.back.length > 60);
</script>

<div
  class="scene"
  role="button"
  tabindex="0"
  aria-label={flipped ? 'Ответ' : 'Вопрос — нажмите, чтобы перевернуть'}
  onclick={() => onflip?.()}
  onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onflip?.())}
>
  <div class="card3d" class:flipped>
    <div class="face front">
      <div class="top">
        {#if card.frontSub}<span class="eyebrow">{card.frontSub}</span>{/if}
        <PeriodTag id={card.period} />
      </div>
      {#if card.image}<img src={card.image} alt="" />{/if}
      <p class="main" class:long={card.front.length > 70}>{card.front}</p>
      {#if card.hint}<p class="hint muted">Подсказка: {card.hint}</p>{/if}
      <span class="tap muted">нажмите, чтобы перевернуть</span>
    </div>
    <div class="face back">
      <div class="top"><span class="eyebrow">{card.front.length > 60 ? card.front.slice(0, 60) + '…' : card.front}</span></div>
      <p class="main answer" class:long={longBack}>{card.back}</p>
      {#if card.backSub}<p class="sub">{card.backSub}</p>{/if}
    </div>
  </div>
</div>

<style>
  .scene { perspective: 1400px; width: 100%; height: 100%; cursor: pointer; outline: none; }
  .card3d {
    position: relative;
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
    transition: transform 560ms var(--ease-out);
  }
  .flipped { transform: rotateY(180deg); }
  .face {
    position: absolute;
    inset: 0;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    border-radius: var(--r-xl);
    background: var(--surface);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-2);
    padding: var(--sp-6) var(--sp-5);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--sp-4);
    text-align: center;
    overflow: hidden;
  }
  .face::before {
    content: '';
    position: absolute;
    inset: 10px;
    border: 1px solid color-mix(in srgb, var(--gold) 40%, transparent);
    border-radius: calc(var(--r-xl) - 10px);
    pointer-events: none;
  }
  .back { transform: rotateY(180deg); background: linear-gradient(180deg, var(--surface), var(--surface-2)); }
  .top { position: absolute; top: var(--sp-5); left: var(--sp-5); right: var(--sp-5); display: flex; justify-content: space-between; gap: var(--sp-2); text-align: left; }
  .main { font-family: var(--font-display); font-weight: 700; font-size: var(--text-3xl); line-height: 1.15; max-width: 20ch; }
  .main.long { font-family: var(--font-read); font-weight: 500; font-size: var(--text-lg); line-height: 1.45; max-width: 36ch; }
  .answer { color: var(--accent); }
  .sub { font-family: var(--font-read); font-size: var(--text-md); line-height: 1.5; color: var(--ink-2); max-width: 40ch; overflow-y: auto; max-height: 45%; }
  img { max-height: 40%; border-radius: var(--r-md); }
  .hint { font-size: var(--text-sm); }
  .tap { position: absolute; bottom: var(--sp-5); font-size: var(--text-xs); letter-spacing: 0.05em; }
</style>
