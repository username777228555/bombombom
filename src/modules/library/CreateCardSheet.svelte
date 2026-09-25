<script lang="ts">
  import { Save } from '@lucide/svelte';
  import Button from '$lib/design/components/Button.svelte';
  import TextField from '$lib/design/components/TextField.svelte';
  import { userData, createDeck, addCards } from '$lib/core/content/userdecks.svelte';
  import { closeSheet, toast } from '$lib/core/ui.svelte';

  let { front = '', source = '' }: { front?: string; source?: string } = $props();
  // svelte-ignore state_referenced_locally
  let f = $state(front.slice(0, 300));
  let b = $state('');
  let deckId = $state(userData.decks.find((d) => d.title === 'Из книг')?.id ?? userData.decks[0]?.id ?? '__new');

  async function save() {
    if (!f.trim() || !b.trim()) {
      toast('Заполните обе стороны карточки', 'error');
      return;
    }
    let id = deckId;
    if (id === '__new') id = (await createDeck('Из книг', 'Карточки, созданные при чтении')).id;
    await addCards(id, [{ front: f, back: b, hint: source || undefined }]);
    toast('Карточка создана', 'success');
    closeSheet();
  }
</script>

<div class="stack sheet">
  <h2>Новая карточка</h2>
  <TextField bind:value={f} label="Вопрос / термин" multiline rows={3} />
  <TextField bind:value={b} label="Ответ" multiline rows={3} autofocus />
  <label class="deck">
    <span class="eyebrow">Колода</span>
    <select bind:value={deckId}>
      {#each userData.decks as d (d.id)}<option value={d.id}>{d.title}</option>{/each}
      <option value="__new">+ Новая колода «Из книг»</option>
    </select>
  </label>
  <Button full icon={Save} onclick={save}>Сохранить</Button>
</div>

<style>
  .sheet { --gap: var(--sp-3); padding-top: var(--sp-2); }
  h2 { font-size: var(--text-xl); }
  .deck { display: flex; flex-direction: column; gap: 6px; }
  select { padding: 12px; border-radius: var(--r-md); border: 1.5px solid var(--line-strong); background: var(--surface); font-size: var(--text-md); }
</style>
