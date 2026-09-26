<script lang="ts">
  import { Settings, Package, Info, Flame, Zap, Layers, Sparkles, BookOpen, ChevronRight, Pencil, Trophy, CalendarDays } from '@lucide/svelte';
  import PageHeader from '$lib/design/components/PageHeader.svelte';
  import IconButton from '$lib/design/components/IconButton.svelte';
  import Card from '$lib/design/components/Card.svelte';
  import StatTile from '$lib/design/components/StatTile.svelte';
  import ProgressBar from '$lib/design/components/ProgressBar.svelte';
  import OrderBadge from '$lib/design/components/OrderBadge.svelte';
  import Ornament from '$lib/design/components/Ornament.svelte';
  import OrderSheet from './OrderSheet.svelte';
  import { progress, currentRank, nextRank, rankIndex } from '$lib/core/progress.svelte';
  import { ORDERS, RANKS } from '$lib/core/achievements';
  import { settings } from '$lib/core/settings.svelte';
  import { openSheet } from '$lib/core/ui.svelte';
  import { navigate } from '$lib/core/router.svelte';
  import { dayKeyOffset, toRoman, pluralN } from '$lib/core/utils/format';

  let editing = $state(false);
  const rank = $derived(currentRank());
  const next = $derived(nextRank());
  const toNext = $derived(next ? (progress.xpTotal - rank.xp) / (next.xp - rank.xp) : 1);
  const stats = $derived(progress.stats);

  const WEEKS = 18;
  const heat = $derived.by(() => {
    const byDate = new Map(progress.days.map((d) => [d.date, d.xp]));
    const today = new Date();
    const dow = (today.getDay() + 6) % 7;
    const cells: { date: string; xp: number; col: number; row: number }[] = [];
    const total = WEEKS * 7;
    for (let i = 0; i < total; i++) {
      const offset = i - (total - 1 - (6 - dow));
      if (offset > 0) continue;
      const date = dayKeyOffset(offset);
      cells.push({ date, xp: byDate.get(date) ?? 0, col: Math.floor(i / 7), row: i % 7 });
    }
    return cells;
  });
  const level = (xp: number) => (xp <= 0 ? 0 : xp < settings.dailyGoal / 2 ? 1 : xp < settings.dailyGoal ? 2 : xp < settings.dailyGoal * 2 ? 3 : 4);
  const unlockedCount = $derived(ORDERS.filter((o) => progress.unlocked[o.id]).length);
</script>

<div class="page">
  <PageHeader title="Профиль" large>
    {#snippet actions()}
      <IconButton icon={Settings} label="Настройки" variant="surface" onclick={() => navigate('/settings')} />
    {/snippet}
  </PageHeader>

  <Card padding="lg" class="rank-card">
    <div class="rank-row">
      <button class="seal" onclick={() => navigate('/ranks')} aria-label="Табель о рангах">
        <span class="cls">{toRoman(rank.cls)}</span>
        <span class="eyebrow">класс</span>
      </button>
      <div class="grow who">
        {#if editing}
          <input class="name-input" bind:value={settings.name} placeholder="Ваше имя" onblur={() => (editing = false)} onkeydown={(e) => e.key === 'Enter' && (editing = false)} />
        {:else}
          <button class="name" onclick={() => (editing = true)}>{settings.name || 'Как к вам обращаться?'} <Pencil size={14} /></button>
        {/if}
        <strong class="rank-title">{rank.title}</strong>
        <span class="muted">{progress.xpTotal} опыта{next ? ` · до чина «${next.title}» ${next.xp - progress.xpTotal}` : ' · высший чин'}</span>
      </div>
    </div>
    <ProgressBar value={toNext} color="var(--gold)" height={10} label="До следующего чина" />
  </Card>

  <div class="grid-3 stats">
    <StatTile icon={Flame} value={progress.streak} label="дней подряд" tint="#c0631f" />
    <StatTile icon={Trophy} value={progress.bestStreak} label="лучшая серия" tint="#a87a28" />
    <StatTile icon={Zap} value={progress.xpTotal} label="опыта всего" tint="#7c1d2b" />
    <StatTile icon={Layers} value={stats?.reviews ?? 0} label="повторений" tint="#2b4f8c" />
    <StatTile icon={Sparkles} value={stats?.quizzes ?? 0} label="тестов" tint="#1d6b57" />
    <StatTile icon={BookOpen} value={(stats?.readHours ?? 0).toFixed(1).replace('.', ',')} label="часов чтения" tint="#7a3d6b" />
  </div>

  <section class="section">
    <div class="section-title"><h2 class="row"><CalendarDays size={20} /> Активность</h2><span class="muted small">{pluralN(stats?.activeDays ?? 0, ['день', 'дня', 'дней'])} занятий</span></div>
    <Card padding="md">
      <svg class="heat" viewBox="0 0 {WEEKS * 16} {7 * 16}" role="img" aria-label="Календарь активности">
        {#each heat as c (c.date)}
          <rect x={c.col * 16} y={c.row * 16} width="13" height="13" rx="3" class="l{level(c.xp)}"><title>{c.date}: {c.xp} опыта</title></rect>
        {/each}
      </svg>
      <div class="legend muted"><span>меньше</span>{#each [0, 1, 2, 3, 4] as l (l)}<i class="l{l}"></i>{/each}<span>больше</span></div>
    </Card>
  </section>

  <section class="section">
    <div class="section-title"><h2>Ордена и медали</h2><span class="muted small">{unlockedCount} из {ORDERS.length}</span></div>
    <Card padding="md">
      <div class="orders">
        {#each ORDERS as o (o.id)}
          <button class="order" onclick={() => openSheet({ component: OrderSheet, props: { id: o.id } })}>
            <OrderBadge order={o} size={48} locked={!progress.unlocked[o.id]} />
            <span class="clamp-2">{o.title.replace('Орден ', '').replace('Медаль ', '')}{o.degree ? ` ${o.degree.split(' ')[0]}` : ''}</span>
          </button>
        {/each}
      </div>
    </Card>
  </section>

  <section class="section links">
    <Card padding="sm">
      <button class="link" onclick={() => navigate('/ranks')}><Trophy size={20} /><span class="grow">Табель о рангах</span><span class="muted">{rankIndex() + 1}/{RANKS.length}</span><ChevronRight size={18} /></button>
      <button class="link" onclick={() => navigate('/packs')}><Package size={20} /><span class="grow">Пакеты материалов</span><ChevronRight size={18} /></button>
      <button class="link" onclick={() => navigate('/settings')}><Settings size={20} /><span class="grow">Настройки и резервная копия</span><ChevronRight size={18} /></button>
      <button class="link" onclick={() => navigate('/about')}><Info size={20} /><span class="grow">О приложении</span><ChevronRight size={18} /></button>
    </Card>
    <Ornament />
  </section>
</div>

<style>
  :global(.rank-card) { background: linear-gradient(160deg, var(--surface), var(--gold-soft)) !important; }
  .rank-row { display: flex; gap: var(--sp-4); align-items: center; margin-bottom: var(--sp-4); }
  .seal { width: 84px; height: 84px; flex: 0 0 auto; border-radius: 50%; display: grid; place-content: center; background: radial-gradient(circle at 35% 30%, #f6dc98, #b0822f 70%); border: 3px double #7a561a; color: #3d2a08; box-shadow: 0 6px 18px rgba(120, 80, 20, 0.35); cursor: pointer; }
  .seal .cls { font-family: var(--font-display); font-weight: 700; font-size: 28px; line-height: 1; }
  .seal .eyebrow { color: #5a3f0d; font-size: 9px; }
  .who { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .name { border: 0; background: none; padding: 0; text-align: left; font-size: var(--text-sm); color: var(--ink-3); display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
  .name-input { border: 1px solid var(--line-strong); border-radius: var(--r-sm); padding: 4px 8px; background: var(--surface); font-size: var(--text-sm); }
  .rank-title { font-family: var(--font-display); font-size: var(--text-xl); line-height: 1.15; }
  .who .muted { font-size: var(--text-xs); }
  .stats { margin-top: var(--sp-4); }
  .small { font-size: var(--text-sm); }
  .heat { width: 100%; height: auto; display: block; }
  .heat rect, .legend i { fill: var(--surface-3); background: var(--surface-3); }
  .heat .l1, .legend .l1 { fill: color-mix(in srgb, var(--accent) 25%, var(--surface-3)); background: color-mix(in srgb, var(--accent) 25%, var(--surface-3)); }
  .heat .l2, .legend .l2 { fill: color-mix(in srgb, var(--accent) 50%, var(--surface-3)); background: color-mix(in srgb, var(--accent) 50%, var(--surface-3)); }
  .heat .l3, .legend .l3 { fill: color-mix(in srgb, var(--accent) 78%, var(--surface-3)); background: color-mix(in srgb, var(--accent) 78%, var(--surface-3)); }
  .heat .l4, .legend .l4 { fill: var(--accent); background: var(--accent); }
  .legend { display: flex; align-items: center; justify-content: flex-end; gap: 4px; font-size: var(--text-2xs); margin-top: var(--sp-2); }
  .legend i { width: 11px; height: 11px; border-radius: 3px; display: inline-block; }
  .orders { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: var(--sp-3) var(--sp-2); }
  .order { display: flex; flex-direction: column; align-items: center; gap: 6px; border: 0; background: none; cursor: pointer; padding: 4px; border-radius: var(--r-sm); font-size: var(--text-2xs); line-height: 1.25; color: var(--ink-2); text-align: center; }
  .order:active { transform: scale(0.95); }
  .links { display: flex; flex-direction: column; gap: var(--sp-6); }
  .link { display: flex; align-items: center; gap: var(--sp-3); width: 100%; padding: 14px 12px; border: 0; background: none; text-align: left; cursor: pointer; border-radius: var(--r-sm); color: var(--ink); font-size: var(--text-md); }
  .link:hover { background: var(--surface-2); }
  .link :global(svg:first-child) { color: var(--accent); }
</style>
