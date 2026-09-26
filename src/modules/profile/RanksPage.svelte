<script lang="ts">
  import PageHeader from '$lib/design/components/PageHeader.svelte';
  import { RANKS } from '$lib/core/achievements';
  import { progress, rankIndex } from '$lib/core/progress.svelte';
  import { toRoman } from '$lib/core/utils/format';
  const current = $derived(rankIndex());
</script>

<div class="page">
  <PageHeader title="Табель о рангах" back="/profile" />
  <p class="muted intro">Табель о рангах, введённая Петром I в 1722 году, делила службу на 14 классов. Здесь — гражданские чины XIX века (классы XIII и XI к тому времени почти не присваивались). Чин растёт с опытом за занятия.</p>
  <ol class="ranks">
    {#each [...RANKS].reverse() as r, ri (r.cls)}
      {@const i = RANKS.length - 1 - ri}
      <li class:done={i < current} class:current={i === current} class:locked={i > current}>
        <span class="cls">{toRoman(r.cls)}</span>
        <span class="t"><strong>{r.title}</strong><small class="num">{r.xp} опыта</small></span>
        {#if i === current}<span class="you">вы здесь</span>{/if}
      </li>
    {/each}
  </ol>
  <p class="muted foot num">Ваш опыт: {progress.xpTotal}</p>
</div>

<style>
  .intro { font-size: var(--text-sm); margin-bottom: var(--sp-4); }
  .ranks { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--sp-2); }
  li { display: flex; align-items: center; gap: var(--sp-3); padding: 12px 14px; border-radius: var(--r-md); background: var(--surface); border: 1px solid var(--line); }
  .cls { width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; font-family: var(--font-display); font-weight: 700; background: var(--surface-3); color: var(--ink-3); flex: 0 0 auto; }
  .t { flex: 1; display: flex; flex-direction: column; }
  .t small { color: var(--ink-3); font-size: var(--text-xs); }
  .done .cls { background: var(--gold-soft); color: var(--gold); }
  .current { border-color: var(--gold); background: var(--gold-soft); box-shadow: var(--shadow-2); }
  .current .cls { background: radial-gradient(circle at 35% 30%, #f6dc98, #b0822f 70%); color: #3d2a08; }
  .locked { opacity: 0.6; }
  .you { font-size: var(--text-2xs); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--gold); }
  .foot { text-align: center; margin-top: var(--sp-4); }
</style>
