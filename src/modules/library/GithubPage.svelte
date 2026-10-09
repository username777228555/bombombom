<script lang="ts">
  /**
   * «Скачать с GitHub» — books and content packs from the student's own GitHub repository, downloaded by
   * button (no own server). Setup: repository «owner/name», optional folder, token for a private repo.
   * Books land in the library (recognised by the «Книжная полка» catalog), `*.stolypin.json` in «Пакеты».
   * Logic: ./github.ts.
   */
  import { onMount } from 'svelte';
  import { CloudDownload, Settings2, RefreshCw, Check, BookOpen, Package, KeyRound, FolderGit2 } from '@lucide/svelte';
  import PageHeader from '$lib/design/components/PageHeader.svelte';
  import IconButton from '$lib/design/components/IconButton.svelte';
  import Button from '$lib/design/components/Button.svelte';
  import Card from '$lib/design/components/Card.svelte';
  import Badge from '$lib/design/components/Badge.svelte';
  import TextField from '$lib/design/components/TextField.svelte';
  import ProgressBar from '$lib/design/components/ProgressBar.svelte';
  import EmptyState from '$lib/design/components/EmptyState.svelte';
  import { db } from '$lib/core/db';
  import { toast } from '$lib/core/ui.svelte';
  import { checkOrders } from '$lib/core/progress.svelte';
  import { formatBytes, pluralN, WORDS } from '$lib/core/utils/format';
  import { installPackBundle } from '$lib/core/content/packimport';
  import { resolveBookTitle } from './bookTitle';
  import { catalog, importBook } from './books';
  import { downloadRemote, listRemote, loadSource, saveSource, type GithubSource, type RemoteFile } from './github';

  let source = $state<GithubSource | null>(null);
  // Books come only from the app's own repository (books/ folder and releases); the form edits just the token.
  let editing = $state(false);
  let form = $state({ repo: '', folder: '', token: '' });
  let files = $state<RemoteFile[]>([]);
  let loading = $state(false);
  let error = $state('');
  /** Base names (without extension) of books already in the library. */
  let have = $state(new Set<string>());
  let progress = $state<Record<string, number>>({});
  let done = $state(new Set<string>());

  const base = (name: string) => name.toLowerCase().replace(/\.(fb2\.zip|[a-z0-9]+)$/i, '');
  const books = $derived(files.filter((f) => f.kind === 'book'));
  const packs = $derived(files.filter((f) => f.kind === 'pack'));
  const fresh = $derived(books.filter((f) => !have.has(base(f.name)) && !done.has(f.key)));
  const titleOf = (f: RemoteFile) => resolveBookTitle(f.name, {}, catalog());

  async function refreshHave() {
    have = new Set((await db.books.toArray()).map((b) => base(b.fileName ?? b.title)));
  }

  async function load() {
    if (!source) return;
    loading = true;
    error = '';
    try {
      files = await listRemote(source);
    } catch (e) {
      error = (e as Error).message;
      files = [];
    } finally {
      loading = false;
    }
  }

  onMount(async () => {
    source = await loadSource();
    await refreshHave();
    form = { repo: source.repo, folder: source.folder ?? '', token: source.token ?? '' };
    await load();
  });

  async function save() {
    if (!/^[\w.-]+\/[\w.-]+$/.test(form.repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/+$/, ''))) {
      toast('Укажите репозиторий в виде «владелец/название»', 'error');
      return;
    }
    await saveSource(form);
    source = await loadSource();
    editing = false;
    await load();
  }

  async function forgetToken() {
    form.token = '';
    if (source) {
      await saveSource({ ...source, token: '' });
      source = await loadSource();
    }
    toast('Токен удалён с устройства');
  }

  async function get(f: RemoteFile) {
    if (!source || progress[f.key] !== undefined) return;
    progress = { ...progress, [f.key]: 0 };
    try {
      const file = await downloadRemote(source, f, (x) => (progress = { ...progress, [f.key]: x }));
      if (f.kind === 'pack') {
        const { title } = await installPackBundle(JSON.parse(await file.text()));
        toast(`Пакет «${title}» добавлен`, 'success');
      } else {
        const b = await importBook(file);
        toast(`«${b.title}» добавлена в библиотеку`, 'success');
      }
      done = new Set([...done, f.key]);
    } catch (e) {
      toast(`«${f.name}»: ${(e as Error).message}`, 'error', 6000);
    } finally {
      const { [f.key]: _, ...rest } = progress;
      progress = rest;
    }
  }

  async function getAll() {
    for (const f of fresh) await get(f);
    await refreshHave();
    void checkOrders();
  }
</script>

<div class="page">
  <PageHeader title="Скачать с GitHub" eyebrow="Книги и пакеты" back="/library">
    {#snippet actions()}
      {#if source && !editing}
        <IconButton icon={RefreshCw} label="Обновить список" onclick={load} />
        <IconButton icon={Settings2} label="Настройки" onclick={() => (editing = true)} />
      {/if}
    {/snippet}
  </PageHeader>

  {#if editing}
    <Card padding="md">
      <div class="form">
        <TextField label="Токен (для закрытого репозитория)" bind:value={form.token} type="password" placeholder="github_pat_…" icon={KeyRound}
          hint="Хранится только на этом телефоне и не попадает в резервную копию" />
        <div class="row gap">
          <div class="grow"><Button full onclick={save}>Сохранить</Button></div>
          <Button variant="ghost" onclick={() => (editing = false)}>Отмена</Button>
        </div>
        {#if source?.token}<button class="linkish" onclick={forgetToken}>Удалить токен с устройства</button>{/if}
      </div>
    </Card>
    <details class="howto">
      <summary>Как положить книги</summary>
      <ol>
        <li>В репозитории приложения на github.com откройте папку <code>books</code> → «Add file → Upload files» (файлы до 25 МБ).</li>
        <li>Файлы больше 25 МБ сайт в папку не пускает — их кладут в релиз (до 2 ГБ): «Releases → Draft a new release» → в «Choose a tag» впишите <code>books</code> и нажмите «Create new tag» → перетащите книги в «Attach binaries» → «Publish release». Следующие книги добавляйте в тот же релиз: «Releases → books → ✎ Edit». Такие книги скачиваются в приложении на телефоне.</li>
        <li>Здесь нажмите «Обновить список» и «Скачать». Пакеты <code>.stolypin.json</code> оттуда же попадут в «Пакеты».</li>
        <li>Репозиторий открытый: файлы из него может скачать любой. Если сделаете его закрытым, впишите сюда токен (Fine-grained, Contents: Read-only).</li>
      </ol>
      <p class="muted">Приложение только скачивает файлы по нажатию: ничего не отправляет и не следит за обновлениями.</p>
    </details>
  {:else if loading}
    <p class="muted center">Загружаю список файлов…</p>
  {:else if error}
    <EmptyState icon={CloudDownload} title="Не удалось открыть репозиторий" text={error}>
      <Button onclick={() => (editing = true)} icon={Settings2}>Проверить настройки</Button>
    </EmptyState>
  {:else if source}
    <p class="muted repo"><FolderGit2 size={14} /> {source.repo}{source.folder ? ` / ${source.folder}` : ''} · {pluralN(books.length, WORDS.book)}{packs.length ? `, ${pluralN(packs.length, WORDS.pack)}` : ''}</p>

    {#if fresh.length > 1}
      <Button full size="lg" icon={CloudDownload} onclick={getAll}>Скачать всё новое ({fresh.length})</Button>
    {/if}

    {#snippet item(f: RemoteFile)}
      {@const t = f.kind === 'book' ? titleOf(f) : { title: f.name.replace(/\.stolypin\.json$/i, ''), author: undefined }}
      {@const owned = done.has(f.key) || (f.kind === 'book' && have.has(base(f.name)))}
      <li class="file">
        <span class="ico">{#if f.kind === 'book'}<BookOpen size={18} />{:else}<Package size={18} />{/if}</span>
        <div class="grow txt">
          <strong class="clamp-2">{t.title}</strong>
          {#if t.author}<span class="muted small">{t.author}</span>{/if}
          <span class="muted tiny">{formatBytes(f.size)}{f.from.type === 'release' ? ` · релиз ${f.from.tag}` : ''}</span>
          {#if progress[f.key] !== undefined}<ProgressBar value={progress[f.key] ?? 0} height={4} label="Скачано" />{/if}
        </div>
        {#if owned}
          <Badge tone="success"><Check size={12} /> {f.kind === 'book' ? 'в библиотеке' : 'добавлен'}</Badge>
        {:else}
          <Button size="sm" variant="soft" icon={CloudDownload} loading={progress[f.key] !== undefined} onclick={() => get(f)}>Скачать</Button>
        {/if}
      </li>
    {/snippet}

    {#if books.length}
      <h2 class="section-h">Книги</h2>
      <ul class="list">{#each books as f (f.key)}{@render item(f)}{/each}</ul>
    {/if}
    {#if packs.length}
      <h2 class="section-h">Пакеты материалов</h2>
      <ul class="list">{#each packs as f (f.key)}{@render item(f)}{/each}</ul>
    {/if}
    {#if !files.length}
      <EmptyState icon={CloudDownload} title="Здесь пока пусто" text="В репозитории нет книг (EPUB, FB2, MOBI/AZW3, PDF, CBZ, TXT) и пакетов .stolypin.json{source.folder ? ' в этой папке' : ''}." />
    {/if}
    {#if books.length && !fresh.length}<p class="muted center small">Все книги из репозитория уже в библиотеке.</p>{/if}
  {/if}
</div>

<style>
  .form { display: flex; flex-direction: column; gap: var(--sp-3); }
  .gap { gap: var(--sp-2); }
  .linkish { border: 0; background: none; color: var(--danger); font-size: var(--text-sm); cursor: pointer; text-align: left; padding: 0; }
  .howto { margin-top: var(--sp-4); font-size: var(--text-sm); color: var(--ink-2); }
  .howto summary { cursor: pointer; font-weight: 600; color: var(--ink); }
  .howto ol { padding-left: 1.2em; display: flex; flex-direction: column; gap: 6px; margin: var(--sp-2) 0; line-height: 1.45; }
  code { font-size: 0.9em; background: var(--surface-3); padding: 1px 5px; border-radius: 4px; }
  .center { text-align: center; margin-top: var(--sp-5); }
  .repo { display: flex; align-items: center; gap: 6px; font-size: var(--text-sm); margin-bottom: var(--sp-3); }
  .section-h { font-size: var(--text-lg); margin: var(--sp-5) 0 var(--sp-2); }
  .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--sp-2); }
  .file { display: flex; align-items: center; gap: var(--sp-3); padding: 10px 12px; border: 1px solid var(--line); border-radius: var(--r-md); background: var(--surface); }
  .ico { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); flex: 0 0 auto; }
  .txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .txt strong { font-size: var(--text-sm); line-height: 1.3; }
  .small { font-size: var(--text-xs); }
  .tiny { font-size: var(--text-2xs); }
</style>
