<script lang="ts">
  import { Plus, Trash, FileUp, Save } from '@lucide/svelte';
  import PageHeader from '$lib/design/components/PageHeader.svelte';
  import Card from '$lib/design/components/Card.svelte';
  import Button from '$lib/design/components/Button.svelte';
  import IconButton from '$lib/design/components/IconButton.svelte';
  import TextField from '$lib/design/components/TextField.svelte';
  import Segmented from '$lib/design/components/Segmented.svelte';
  import { userData, createDeck, updateDeck, addCards, updateCard, deleteCard, parseCardText } from '$lib/core/content/userdecks.svelte';
  import { router, navigate } from '$lib/core/router.svelte';
  import { pickFiles } from '$lib/core/platform';
  import { toast } from '$lib/core/ui.svelte';
  import { pluralN } from '$lib/core/utils/format';

  const isNew = router.params.id === 'new';
  const existing = userData.decks.find((d) => d.id === router.params.id);
  let title = $state(existing?.title ?? '');
  let description = $state(existing?.description ?? '');
  let drafts = $state<{ front: string; back: string }[]>([{ front: '', back: '' }, { front: '', back: '' }, { front: '', back: '' }]);
  let importText = $state('');
  let sep = $state<'auto' | 'tab' | 'semicolon' | 'dash'>('auto');
  let saving = $state(false);
  const cards = $derived(userData.cards.filter((c) => c.deckId === existing?.id));
  const parsed = $derived(importText.trim() ? parseCardText(importText, sep) : []);

  async function pickFile() {
    const [file] = await pickFiles('.txt,.tsv,.csv,text/plain');
    if (file) importText = await file.text();
  }

  async function save() {
    if (!title.trim()) {
      toast('Введите название колоды', 'error');
      return;
    }
    saving = true;
    try {
      const deck = existing ?? (await createDeck(title.trim(), description.trim() || undefined));
      if (existing) await updateDeck(existing.id, { title: title.trim(), description: description.trim() || undefined });
      const n = await addCards(deck.id, [...drafts, ...parsed]);
      toast(n ? `Сохранено, добавлено ${pluralN(n, ['карточка', 'карточки', 'карточек'])}` : 'Сохранено', 'success');
      navigate(`/cards/deck/user:${deck.id}`, { replace: true });
    } finally {
      saving = false;
    }
  }
</script>

<div class="page">
  <PageHeader title={isNew ? 'Новая колода' : 'Редактирование'} back="/cards" />
  <div class="stack form">
    <TextField bind:value={title} label="Название" placeholder="Например: Лекция 3 — Смута" />
    <TextField bind:value={description} label="Описание (необязательно)" placeholder="О чём эта колода" />

    {#if cards.length}
      <section class="stack">
        <h2 class="eyebrow">Карточки в колоде · {cards.length}</h2>
        {#each cards as c (c.id)}
          <Card padding="sm">
            <div class="edit-row">
              <input value={c.front} aria-label="Вопрос" onchange={(e) => updateCard(c.id, { front: e.currentTarget.value })} />
              <input value={c.back} aria-label="Ответ" onchange={(e) => updateCard(c.id, { back: e.currentTarget.value })} />
              <IconButton icon={Trash} label="Удалить" size={34} onclick={() => deleteCard(c.id)} />
            </div>
          </Card>
        {/each}
      </section>
    {/if}

    <section class="stack">
      <h2 class="eyebrow">Новые карточки</h2>
      {#each drafts as d, i (i)}
        <Card padding="sm">
          <div class="edit-row">
            <input bind:value={d.front} placeholder="Термин / вопрос" aria-label="Вопрос" />
            <input bind:value={d.back} placeholder="Определение / ответ" aria-label="Ответ" />
            <IconButton icon={Trash} label="Убрать" size={34} onclick={() => drafts.splice(i, 1)} />
          </div>
        </Card>
      {/each}
      <Button variant="ghost" icon={Plus} onclick={() => drafts.push({ front: '', back: '' })}>Ещё карточка</Button>
    </section>

    <Card padding="md" tone="sunken">
      <div class="stack">
        <strong>Импорт из Quizlet / Anki</strong>
        <p class="muted small">Quizlet: «Экспорт» → скопируйте текст. Anki: «Экспорт» → «Заметки в виде простого текста». Одна карточка — одна строка, вопрос и ответ через Tab, «;» или « - ».</p>
        <TextField bind:value={importText} multiline rows={5} placeholder={'Полюдье\tОбъезд князем подвластных земель\nВече\tНародное собрание'} />
        <div class="row wrap">
          <Button size="sm" variant="secondary" icon={FileUp} onclick={pickFile}>Из файла</Button>
          <div class="grow">
            <Segmented bind:value={sep} options={[{ value: 'auto', label: 'Авто' }, { value: 'tab', label: 'Tab' }, { value: 'semicolon', label: ';' }, { value: 'dash', label: ' - ' }]} />
          </div>
        </div>
        {#if parsed.length}<p class="ok small">Распознано: {pluralN(parsed.length, ['карточка', 'карточки', 'карточек'])}. Первая: «{parsed[0]!.front}» → «{parsed[0]!.back}»</p>{/if}
      </div>
    </Card>

    <Button size="lg" full icon={Save} loading={saving} onclick={save}>Сохранить</Button>
  </div>
</div>

<style>
  .form { --gap: var(--sp-4); }
  .edit-row { display: grid; grid-template-columns: 1fr 1.3fr auto; gap: var(--sp-2); align-items: center; }
  .edit-row input {
    width: 100%;
    min-width: 0;
    border: 1px solid var(--line);
    background: var(--surface-2);
    border-radius: var(--r-sm);
    padding: 10px 12px;
    font-size: var(--text-sm);
    outline: none;
  }
  .edit-row input:focus { border-color: var(--accent); }
  .small { font-size: var(--text-sm); }
  .ok { color: var(--success); }
</style>
