<script lang="ts">
  import { FileUp, Trash, Package, Sparkles } from '@lucide/svelte';
  import PageHeader from '$lib/design/components/PageHeader.svelte';
  import Card from '$lib/design/components/Card.svelte';
  import Toggle from '$lib/design/components/Toggle.svelte';
  import Button from '$lib/design/components/Button.svelte';
  import Badge from '$lib/design/components/Badge.svelte';
  import IconButton from '$lib/design/components/IconButton.svelte';
  import { kb } from '$lib/core/content/kb.svelte';
  import { PackBundleSchema } from '$lib/core/content/schema';
  import { validateContent } from '$lib/core/content/validate';
  import { settings } from '$lib/core/settings.svelte';
  import { db } from '$lib/core/db';
  import { pickFiles } from '$lib/core/platform';
  import { toast, confirmDialog } from '$lib/core/ui.svelte';

  const packs = $derived.by(() => {
    void kb.version;
    return kb.packs;
  });
  const LABELS: Record<string, string> = { events: 'событий', persons: 'персоналий', culture: 'памятников', terms: 'терминов', links: 'связей', quizzes: 'тестов', decks: 'колод', sources: 'источников', maps: 'карт' };

  async function toggle(id: string, on: boolean) {
    settings.packs = { ...settings.packs, [id]: on };
    await kb.reload();
  }

  async function importPack() {
    const [file] = await pickFiles('.json,application/json');
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      const bundle = PackBundleSchema.parse(raw);
      const res = validateContent(kb.periods, [
        { manifestFile: 'pack.json', manifest: bundle.pack, fragments: bundle.fragments.map((f, i) => ({ file: `fragment-${i + 1}`, data: f })) },
      ], { lenientRefs: true });
      const errors = res.issues.filter((i) => i.level === 'error');
      if (errors.length) {
        toast(`Ошибки в пакете: ${errors.slice(0, 2).map((e) => `${e.path} ${e.message}`).join('; ')}`, 'error', 6000);
        return;
      }
      if (kb.packs.some((p) => p.source === 'builtin' && p.manifest.id === bundle.pack.id)) {
        toast('Пакет с таким id уже встроен в приложение', 'error');
        return;
      }
      await db.userPacks.put({ id: bundle.pack.id, bundle, importedAt: Date.now() });
      await kb.reload();
      toast(`Пакет «${bundle.pack.title}» добавлен`, 'success');
    } catch (e) {
      toast(`Не удалось импортировать: ${(e as Error).message.slice(0, 120)}`, 'error', 5000);
    }
  }

  async function remove(id: string, title: string) {
    if (!(await confirmDialog(`Удалить пакет «${title}»?`, { ok: 'Удалить', danger: true }))) return;
    await db.userPacks.delete(id);
    await kb.reload();
    toast('Пакет удалён');
  }
</script>

<div class="page">
  <PageHeader title="Пакеты материалов" back="/profile" />
  <p class="muted intro">Все материалы — события, персоналии, тесты, колоды — приходят в виде пакетов. Встроенные пакеты обновляются вместе с приложением, свои можно импортировать файлом <code>.stolypin.json</code>.</p>

  <div class="stack">
    {#each packs as p (p.manifest.id)}
      <Card padding="md">
        <div class="pack">
          <div class="row top">
            <span class="ico"><Package size={20} /></span>
            <div class="grow">
              <strong>{p.manifest.title}</strong>
              <div class="row wrap badges">
                <Badge>{p.source === 'builtin' ? 'встроенный' : 'импортирован'}</Badge>
                <Badge>v{p.manifest.version}</Badge>
                {#if p.manifest.generated === 'ai' || p.manifest.generated === 'mixed'}<Badge tone="warning"><Sparkles size={11} /> ИИ</Badge>{/if}
                {#if p.skipped}<Badge tone="danger">пропущено файлов: {p.skipped}</Badge>{/if}
              </div>
            </div>
            <Toggle checked={p.enabled} label="Включён" onchange={(v) => toggle(p.manifest.id, v)} />
          </div>
          {#if p.manifest.description}<p class="secondary small">{p.manifest.description}</p>{/if}
          <p class="muted small">{Object.entries(p.counts).filter(([k]) => LABELS[k]).map(([k, v]) => `${v} ${LABELS[k]}`).join(' · ')}</p>
          {#if p.source === 'user'}
            <div class="row end"><IconButton icon={Trash} label="Удалить пакет" onclick={() => remove(p.manifest.id, p.manifest.title)} /></div>
          {/if}
        </div>
      </Card>
    {/each}
  </div>

  <div class="section">
    <Button full size="lg" icon={FileUp} onclick={importPack}>Импортировать пакет</Button>
    <p class="muted small hint">Пакет собирается командой <code>pnpm content:bundle &lt;id&gt;</code> — см. docs/content-format.md.</p>
  </div>
</div>

<style>
  .intro { font-size: var(--text-sm); margin-bottom: var(--sp-4); }
  .pack { display: flex; flex-direction: column; gap: var(--sp-2); }
  .top { gap: var(--sp-3); align-items: flex-start; }
  .ico { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); flex: 0 0 auto; }
  .badges { gap: 4px; margin-top: 4px; }
  .small { font-size: var(--text-sm); }
  .end { justify-content: flex-end; }
  .hint { margin-top: var(--sp-3); text-align: center; }
  code { font-size: 0.9em; background: var(--surface-3); padding: 1px 5px; border-radius: 4px; }
</style>
