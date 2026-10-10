<script lang="ts">
  /**
   * «Пробники» — olympiad mock papers (Высшая проба, Изумрудный город, ВсОШ…) kept in the app's repository,
   * folder `olympiads/` (built by `pnpm olympiads`). Downloaded by button and installed as packs; their tests
   * are listed here and in «Тесты из материалов». Same GitHub source and token as the library downloads.
   * On top — «Олимпиадный вариант»: a paper assembled from the packs' quizzes (quiz/sources.ts, src=variant).
   */
  import { onMount } from 'svelte';
  import { CloudDownload, RefreshCw, Check, Play, ScrollText, Timer } from '@lucide/svelte';
  import PageHeader from '$lib/design/components/PageHeader.svelte';
  import IconButton from '$lib/design/components/IconButton.svelte';
  import Button from '$lib/design/components/Button.svelte';
  import Card from '$lib/design/components/Card.svelte';
  import ProgressBar from '$lib/design/components/ProgressBar.svelte';
  import EmptyState from '$lib/design/components/EmptyState.svelte';
  import Chip from '$lib/design/components/Chip.svelte';
  import { navigate } from '$lib/core/router.svelte';
  import { kb } from '$lib/core/content/kb.svelte';
  import { installPackBundle } from '$lib/core/content/packimport';
  import { toast } from '$lib/core/ui.svelte';
  import { pluralN, WORDS } from '$lib/core/utils/format';
  import { downloadRemote, listRemote, loadSource, type GithubSource, type RemoteFile } from '$lib/modules/library/github';

  const FOLDER = 'olympiads';
  let periods = $state<string[]>([]);
  const toggle = (id: string) => (periods = periods.includes(id) ? periods.filter((x) => x !== id) : [...periods, id]);
  function variant() {
    const p = new URLSearchParams({ src: 'variant' });
    if (periods.length) p.set('periods', periods.join(','));
    navigate(`/quiz/run?${p}`);
  }
  let source = $state<GithubSource | null>(null);
  let files = $state<RemoteFile[]>([]);
  let loading = $state(false);
  let error = $state('');
  let progress = $state<Record<string, number>>({});

  const packId = (f: RemoteFile) => f.name.replace(/\.stolypin\.json$/i, '');
  const installed = $derived.by(() => {
    void kb.version;
    return new Set(kb.packs.filter((p) => p.source !== 'builtin').map((p) => p.manifest.id));
  });
  /** Installed probe packs (also the ones whose file is no longer in the repository) with their tests. */
  const probes = $derived.by(() => {
    void kb.version;
    const ids = new Set([...files.map(packId), ...kb.packs.filter((p) => p.manifest.id.startsWith('olymp-')).map((p) => p.manifest.id)]);
    return kb.packs
      .filter((p) => ids.has(p.manifest.id) && installed.has(p.manifest.id))
      .map((p) => ({ pack: p.manifest, quizzes: kb.quizzes.filter((q) => q.pack === p.manifest.id) }));
  });
  const remote = $derived(files.filter((f) => !installed.has(packId(f))));

  async function load() {
    if (!source) return;
    loading = true;
    error = '';
    try {
      files = (await listRemote({ ...source, folder: FOLDER })).filter((f) => f.kind === 'pack' && f.from.type === 'file');
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }
  onMount(async () => {
    source = await loadSource();
    await load();
  });

  async function get(f: RemoteFile) {
    if (!source || progress[f.key] !== undefined) return;
    progress = { ...progress, [f.key]: 0 };
    try {
      const file = await downloadRemote(source, f, (x) => (progress = { ...progress, [f.key]: x }));
      const { title } = await installPackBundle(JSON.parse(await file.text()));
      toast(`«${title}» добавлен`, 'success');
    } catch (e) {
      toast(`«${f.name}»: ${(e as Error).message}`, 'error', 6000);
    } finally {
      const { [f.key]: _, ...rest } = progress;
      progress = rest;
    }
  }
</script>

<div class="page">
  <PageHeader title="Пробники" eyebrow="Олимпиадные задания" back="/quiz">
    {#snippet actions()}<IconButton icon={RefreshCw} label="Обновить список" onclick={load} />{/snippet}
  </PageHeader>

  <Card tone="gold" padding="lg">
    <div class="stack variant">
      <strong class="display">Олимпиадный вариант</strong>
      <p class="secondary small">12 тестовых заданий и 4 с развёрнутым ответом из материалов приложения, с таймером, как на олимпиаде.</p>
      <div class="chips">
        {#each kb.periods as p (p.id)}
          <Chip size="sm" color={p.color} selected={periods.includes(p.id)} onclick={() => toggle(p.id)}>{p.short}</Chip>
        {/each}
      </div>
      <Button full icon={Timer} onclick={variant}>{periods.length ? 'Собрать по выбранным эпохам' : 'Собрать по всем эпохам'}</Button>
    </div>
  </Card>

  {#each probes as p (p.pack.id)}
    <section class="section">
      <div class="section-title"><h2>{p.pack.title}</h2></div>
      {#if p.pack.description}<p class="muted small">{p.pack.description}</p>{/if}
      <div class="stack">
        {#each p.quizzes as q (q.id)}
          <Card href="/quiz/run?src=pack&id={q.id}" padding="sm">
            <div class="row q"><ScrollText size={18} class="acc" /><strong class="grow">{q.title}</strong><span class="muted">{pluralN(q.questions.length, WORDS.question)}</span><Play size={16} /></div>
          </Card>
        {/each}
      </div>
    </section>
  {/each}

  <section class="section">
    <div class="section-title"><h2>Скачать с GitHub</h2></div>
    {#if loading}
      <p class="muted small">Загружаю список…</p>
    {:else if error}
      <Card padding="md"><p class="muted small">Не удалось получить список: {error}. Токен для закрытого репозитория задаётся в «Библиотека → Скачать с GitHub».</p></Card>
    {:else if remote.length}
      <div class="stack">
        {#each remote as f (f.key)}
          <Card padding="md">
            <div class="row q">
              <strong class="grow">{f.name.replace(/\.stolypin\.json$/i, '')}</strong>
              {#if progress[f.key] !== undefined}
                <span class="bar"><ProgressBar value={progress[f.key]} /></span>
              {:else}
                <Button size="sm" icon={CloudDownload} onclick={() => get(f)}>Скачать</Button>
              {/if}
            </div>
          </Card>
        {/each}
      </div>
    {:else if probes.length}
      <p class="muted small row"><Check size={16} /> Все пробники из репозитория уже скачаны.</p>
    {:else}
      <EmptyState icon={ScrollText} title="Пробников пока нет" text="Они появятся, когда в папку olympiads репозитория добавят задания." />
    {/if}
  </section>
</div>

<style>
  .small { font-size: var(--text-sm); }
  .variant { --gap: var(--sp-3); }
  .variant strong { font-size: var(--text-xl); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .q { gap: var(--sp-3); }
  .q .muted { font-size: var(--text-xs); }
  .bar { width: 96px; }
  :global(.acc) { color: var(--accent); }
</style>
