<script lang="ts">
  import { onMount } from 'svelte';
  import { GraduationCap, Play, Brain, Puzzle, PenLine, Sparkles, Pencil, Trash, Pause } from '@lucide/svelte';
  import PageHeader from '$lib/design/components/PageHeader.svelte';
  import Card from '$lib/design/components/Card.svelte';
  import Button from '$lib/design/components/Button.svelte';
  import IconButton from '$lib/design/components/IconButton.svelte';
  import ProgressBar from '$lib/design/components/ProgressBar.svelte';
  import EmptyState from '$lib/design/components/EmptyState.svelte';
  import PeriodTag from '$lib/components/PeriodTag.svelte';
  import { findDeck } from '$lib/core/content/cards';
  import { kb } from '$lib/core/content/kb.svelte';
  import { userData, deleteDeck } from '$lib/core/content/userdecks.svelte';
  import { deckProgress, enroll, unenroll, type DeckProgress } from '$lib/core/srs';
  import { router, navigate } from '$lib/core/router.svelte';
  import { toast, confirmDialog } from '$lib/core/ui.svelte';
  import { pluralN } from '$lib/core/utils/format';

  const id = $derived(router.params.id ?? '');
  const deck = $derived.by(() => {
    void kb.version;
    void userData.version;
    return findDeck(id);
  });
  const cards = $derived(deck?.cards() ?? []);
  let prog = $state<DeckProgress | null>(null);
  let showAll = $state(false);

  async function refresh() {
    prog = await deckProgress(id);
  }
  onMount(refresh);

  async function start() {
    const n = await enroll(id, cards.map((c) => c.id));
    toast(n ? `Добавлено в повторение: ${pluralN(n, ['карточка', 'карточки', 'карточек'])}` : 'Колода уже в повторении', 'success');
    await refresh();
  }
  async function pause() {
    await unenroll(id);
    toast('Новые карточки колоды больше не показываются');
    await refresh();
  }
  async function remove() {
    if (!deck || deck.source !== 'user') return;
    if (!(await confirmDialog('Удалить колоду?', { message: 'Карточки и их прогресс будут удалены.', ok: 'Удалить', danger: true }))) return;
    await deleteDeck(id.replace(/^user:/, ''));
    toast('Колода удалена');
    navigate('/cards', { replace: true });
  }
  const learned = $derived(prog && cards.length ? (prog.review + prog.learning) / cards.length : 0);
</script>

{#if deck}
  <div class="page">
    <PageHeader title={deck.title} back="/cards">
      {#snippet actions()}
        {#if deck.source === 'user'}
          <IconButton icon={Pencil} label="Редактировать" onclick={() => navigate(`/cards/edit/${id.replace(/^user:/, '')}`)} />
          <IconButton icon={Trash} label="Удалить" onclick={remove} />
        {/if}
      {/snippet}
    </PageHeader>

    <Card padding="lg">
      <div class="stack">
        <div class="row wrap"><PeriodTag id={deck.period} long /><span class="muted">{pluralN(cards.length, ['карточка', 'карточки', 'карточек'])}</span></div>
        {#if deck.description}<p class="secondary">{deck.description}</p>{/if}
        {#if prog}
          <ProgressBar value={learned} label="Изучено" />
          <div class="stats">
            <span><b class="num">{prog.enrolled}</b> в повторении</span>
            <span><b class="num">{prog.fresh}</b> новых</span>
            <span><b class="num">{prog.review}</b> выучено</span>
            <span><b class="num">{prog.due}</b> к повторению</span>
          </div>
        {/if}
        {#if prog && prog.enrolled < cards.length}
          <Button icon={GraduationCap} full onclick={start}>{prog.enrolled ? 'Добавить оставшиеся в повторение' : 'Учить эту колоду'}</Button>
        {/if}
        {#if prog && prog.enrolled > 0}
          <div class="row">
            <Button icon={Play} variant="secondary" full href="/cards/session?deck={encodeURIComponent(id)}">Повторение</Button>
            {#if prog.fresh > 0}<IconButton icon={Pause} label="Пауза новых" variant="surface" onclick={pause} />{/if}
          </div>
        {/if}
      </div>
    </Card>

    <section class="section">
      <div class="section-title"><h2>Режимы</h2></div>
      <div class="grid-2">
        <Card href="/cards/learn/{encodeURIComponent(id)}" padding="md">
          <div class="mode"><Brain size={22} /><strong>Заучивание</strong><span class="muted">Сначала выбор, потом ответ словами</span></div>
        </Card>
        <Card href="/cards/learn/{encodeURIComponent(id)}?mode=write" padding="md">
          <div class="mode"><PenLine size={22} /><strong>Письмо</strong><span class="muted">Пишите ответ сами</span></div>
        </Card>
        <Card href="/cards/match/{encodeURIComponent(id)}" padding="md">
          <div class="mode"><Puzzle size={22} /><strong>Подбор</strong><span class="muted">Найдите пары на время</span></div>
        </Card>
        <Card href="/quiz/run?src=deck&id={encodeURIComponent(id)}" padding="md">
          <div class="mode"><Sparkles size={22} /><strong>Тест</strong><span class="muted">10 вопросов по колоде</span></div>
        </Card>
      </div>
    </section>

    <section class="section">
      <div class="section-title"><h2>Карточки</h2></div>
      {#if cards.length}
        <div class="stack list">
          {#each showAll ? cards : cards.slice(0, 30) as c (c.id)}
            <div class="pair surface">
              <strong>{c.front}</strong>
              <span class="secondary">{c.back}</span>
            </div>
          {/each}
        </div>
        {#if !showAll && cards.length > 30}
          <Button variant="ghost" full onclick={() => (showAll = true)}>Показать все ({cards.length})</Button>
        {/if}
      {:else}
        <EmptyState title="В колоде нет карточек">
          {#if deck.source === 'user'}<Button href="/cards/edit/{id.replace(/^user:/, '')}">Добавить карточки</Button>{/if}
        </EmptyState>
      {/if}
    </section>
  </div>
{:else}
  <div class="page"><PageHeader title="Колода не найдена" back="/cards" /></div>
{/if}

<style>
  .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px var(--sp-4); font-size: var(--text-sm); color: var(--ink-3); }
  .stats b { color: var(--ink); font-size: var(--text-md); }
  .mode { display: flex; flex-direction: column; gap: 6px; color: var(--accent); }
  .mode strong { color: var(--ink); }
  .mode .muted { font-size: var(--text-xs); line-height: 1.35; }
  .list { --gap: var(--sp-2); margin-bottom: var(--sp-3); }
  .pair { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr); gap: var(--sp-3); padding: var(--sp-3) var(--sp-4); border-radius: var(--r-md); font-size: var(--text-sm); }
  .pair strong { font-weight: 620; }
</style>
