<script lang="ts">
  import { onMount } from 'svelte';
  import { Search, Flame, Layers, Swords, UserSearch, Crosshair, ChartGantt, Network, Sparkles, BookOpen, ArrowRight, CalendarDays } from '@lucide/svelte';
  import Emblem from '$lib/design/components/Emblem.svelte';
  import IconButton from '$lib/design/components/IconButton.svelte';
  import ProgressRing from '$lib/design/components/ProgressRing.svelte';
  import Button from '$lib/design/components/Button.svelte';
  import Card from '$lib/design/components/Card.svelte';
  import Tile from '$lib/design/components/Tile.svelte';
  import Ornament from '$lib/design/components/Ornament.svelte';
  import PeriodCard from '$lib/components/PeriodCard.svelte';
  import EntityRow from '$lib/components/EntityRow.svelte';
  import { kb } from '$lib/core/content/kb.svelte';
  import { progress, currentRank } from '$lib/core/progress.svelte';
  import { settings } from '$lib/core/settings.svelte';
  import { buildQueue } from '$lib/core/srs';
  import { db, type BookMeta } from '$lib/core/db';
  import { greeting, formatDateLong, pluralN, monthGen } from '$lib/core/utils/format';
  import { hashString, mulberry32, pick } from '$lib/core/utils/random';
  import { navigate } from '$lib/core/router.svelte';

  let due = $state(0);
  let fresh = $state(0);
  let lastBook = $state<BookMeta | null>(null);

  onMount(async () => {
    const q = await buildQueue({ newLimit: settings.newPerDay });
    due = q.due.length;
    fresh = q.fresh.length;
    lastBook = (await db.books.orderBy('openedAt').reverse().first()) ?? null;
  });

  const now = new Date();
  const goal = $derived(progress.today.xp / Math.max(1, settings.dailyGoal));
  const onThisDay = $derived.by(() => {
    void kb.version;
    const m = now.getMonth() + 1;
    const d = now.getDate();
    const exact = kb.events.filter((e) => e.month === m && e.day === d);
    if (exact.length) return { title: `${d} ${monthGen(m)} в истории`, items: exact.slice(0, 3) };
    const month = kb.events.filter((e) => e.month === m);
    const rng = mulberry32(hashString(now.toDateString()));
    if (month.length) return { title: `Было в ${['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'][m - 1]}`, items: [pick(month, rng)] };
    return kb.events.length ? { title: 'Событие дня', items: [pick(kb.events, rng)] } : null;
  });
</script>

<div class="page">
  <header class="top">
    <div class="brand">
      <Emblem size={40} />
      <div>
        <strong class="display">СТОЛЫПИНЪ</strong>
        <span class="eyebrow">учёба истории</span>
      </div>
    </div>
    <IconButton icon={Search} label="Поиск" variant="surface" onclick={() => navigate('/search')} />
  </header>

  <section class="greet">
    <h1>{greeting()}{settings.name ? `, ${settings.name}` : ''}</h1>
    <p class="muted">{formatDateLong(now)}</p>
  </section>

  <section class="hero">
    <div class="hero-bg" aria-hidden="true"></div>
    <div class="hero-row">
      <ProgressRing value={goal} size={96} stroke={9} color="#f0cf82" track="rgba(255,255,255,.16)">
        <div class="ring-txt">
          <strong class="num">{progress.today.xp}</strong>
          <span>из {settings.dailyGoal}</span>
        </div>
      </ProgressRing>
      <div class="hero-info">
        <span class="eyebrow light">Чин</span>
        <strong class="rank">{currentRank().title}</strong>
        <span class="streak"><Flame size={16} /> {pluralN(progress.streak, ['день', 'дня', 'дней'])} подряд</span>
      </div>
    </div>
    <div class="hero-actions">
      {#if due + fresh > 0}
        <Button variant="gold" full icon={Layers} href="/cards/session">
          Повторить {pluralN(due + fresh, ['карточку', 'карточки', 'карточек'])}
        </Button>
      {:else}
        <Button variant="gold" full icon={Sparkles} href="/cards">Выбрать колоду и начать</Button>
      {/if}
    </div>
  </section>

  {#if lastBook}
    <Card href="/read/{lastBook.id}" class="continue">
      <div class="row">
        <span class="book-ico"><BookOpen size={20} /></span>
        <div class="grow">
          <span class="eyebrow">Продолжить чтение</span>
          <strong class="clamp-2">{lastBook.title}</strong>
        </div>
        <span class="pct num">{Math.round((lastBook.progress ?? 0) * 100)}%</span>
      </div>
    </Card>
  {/if}

  <section class="section">
    <div class="section-title">
      <h2>Эпохи</h2>
      <a href="#/explore" class="more">Все <ArrowRight size={14} /></a>
    </div>
    <div class="hscroll">
      {#each kb.periods as p, i (p.id)}
        <PeriodCard period={p} index={i} />
      {/each}
    </div>
  </section>

  <section class="section">
    <div class="section-title"><h2>Практика</h2></div>
    <div class="grid-2 wide-3">
      <Tile icon={Layers} title="Карточки" description="Интервальные повторения" href="/cards" tint="#7c1d2b" badge={due || null} />
      <Tile icon={Sparkles} title="Тест дня" description="10 вопросов по всем эпохам" href="/quiz/run?src=daily" tint="#a87a28" />
      <Tile icon={Swords} title="Хронология" description="Выложи события по порядку" href="/games/chronology" tint="#2b4f8c" />
      <Tile icon={UserSearch} title="Кто я?" description="Угадай по подсказкам" href="/games/whoami" tint="#1d6b57" />
      <Tile icon={Crosshair} title="Год-снайпер" description="Попади в дату" href="/games/sniper" tint="#a3202e" />
      <Tile icon={ChartGantt} title="Лента времени" description="Синхронная хронология" href="/timeline" tint="#56627a" />
    </div>
  </section>

  {#if onThisDay}
    <section class="section">
      <div class="section-title">
        <h2 class="row"><CalendarDays size={20} /> {onThisDay.title}</h2>
      </div>
      <Card padding="sm">
        {#each onThisDay.items as e (e.id)}
          <EntityRow entity={{ kind: 'event', item: e, pack: kb.get(e.id)?.pack ?? '' }} />
        {/each}
      </Card>
    </section>
  {/if}

  <section class="section explore-more">
    <Card href="/graph" padding="lg" tone="sunken">
      <div class="row">
        <Network size={28} class="accent-ico" />
        <div class="grow">
          <strong>Граф связей</strong>
          <p class="muted">Кто кому наследовал, что к чему привело — вся история одной сетью.</p>
        </div>
        <ArrowRight size={18} />
      </div>
    </Card>
    <Ornament />
    <p class="foot muted">
      {kb.events.length} событий · {kb.persons.length} персоналий · {kb.culture.length} памятников · {kb.terms.length} терминов
    </p>
  </section>
</div>

<style>
  .top { display: flex; align-items: center; justify-content: space-between; padding: calc(var(--safe-top) + var(--sp-4)) 0 var(--sp-2); }
  .brand { display: flex; align-items: center; gap: var(--sp-3); }
  .brand strong { display: block; font-size: var(--text-lg); letter-spacing: 0.14em; line-height: 1.1; }
  .greet { margin: var(--sp-4) 0 var(--sp-5); }
  .greet h1 { font-size: var(--text-3xl); }
  .greet p::first-letter { text-transform: uppercase; }
  .hero {
    position: relative;
    overflow: hidden;
    border-radius: var(--r-xl);
    padding: var(--sp-5);
    color: #fff8ea;
    background: linear-gradient(150deg, #8f2233 0%, #6a1623 55%, #3f0c15 100%);
    box-shadow: 0 18px 40px rgba(94, 19, 32, 0.35);
  }
  .hero-bg {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at 90% 0%, rgba(240, 207, 130, 0.25), transparent 45%),
      repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.035) 0 2px, transparent 2px 14px);
    pointer-events: none;
  }
  .hero::after {
    content: '';
    position: absolute;
    inset: 8px;
    border: 1px solid rgba(240, 207, 130, 0.35);
    border-radius: calc(var(--r-xl) - 8px);
    pointer-events: none;
  }
  .hero-row { position: relative; display: flex; align-items: center; gap: var(--sp-5); }
  .ring-txt { display: flex; flex-direction: column; line-height: 1.05; }
  .ring-txt strong { font-family: var(--font-display); font-size: var(--text-2xl); }
  .ring-txt span { font-size: var(--text-2xs); opacity: 0.75; }
  .hero-info { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .eyebrow.light { color: rgba(255, 240, 210, 0.7); }
  .rank { font-family: var(--font-display); font-size: var(--text-xl); line-height: 1.15; }
  .streak { display: inline-flex; align-items: center; gap: 6px; font-size: var(--text-sm); color: #f0cf82; font-weight: 600; }
  .hero-actions { position: relative; margin-top: var(--sp-5); }
  :global(.continue) { margin-top: var(--sp-4); }
  .book-ico { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); flex: 0 0 auto; }
  .pct { font-family: var(--font-display); font-weight: 700; color: var(--accent); }
  .more { display: inline-flex; align-items: center; gap: 4px; font-size: var(--text-sm); font-weight: 600; }
  .explore-more { display: flex; flex-direction: column; gap: var(--sp-6); }
  .explore-more :global(.accent-ico) { color: var(--accent); flex: 0 0 auto; }
  .foot { text-align: center; font-size: var(--text-xs); }
</style>
