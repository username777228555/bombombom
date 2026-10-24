<script lang="ts">
  import { Download, Upload, RotateCcw, Package, ChevronRight, BellRing, KeyRound, Trash2 } from '@lucide/svelte';
  import PageHeader from '$lib/design/components/PageHeader.svelte';
  import Card from '$lib/design/components/Card.svelte';
  import Segmented from '$lib/design/components/Segmented.svelte';
  import Toggle from '$lib/design/components/Toggle.svelte';
  import Button from '$lib/design/components/Button.svelte';
  import Vasily from '$lib/design/components/Vasily.svelte';
  import { settings, systemReducedMotion, type Accent } from '$lib/core/settings.svelte';
  import { exportBackup, importBackup, resetProgress } from '$lib/core/backup';
  import { pickFiles } from '$lib/core/platform';
  import { toast, confirmDialog, ui } from '$lib/core/ui.svelte';
  import { navigate } from '$lib/core/router.svelte';
  import { REMIND_TIMES, enableReminders, disableReminders, nextReminder, reminderStatus, reminderToast, syncReminders, testReminder, whenLabel, type ReminderStatus } from '$lib/core/reminders';
  import { pluralN, WORDS } from '$lib/core/utils/format';
  import TextField from '$lib/design/components/TextField.svelte';
  import { ai, aiProxy, checkAiKey, saveAiKey } from '$lib/core/ai.svelte';
  import type { PlannedReminder } from '$lib/core/reminder-plan';

  const ACCENTS: { id: Accent; name: string; color: string }[] = [
    { id: 'crimson', name: 'Кармин', color: '#7c1d2b' },
    { id: 'malachite', name: 'Малахит', color: '#1d6b57' },
    { id: 'cobalt', name: 'Кобальт', color: '#2b4f8c' },
    { id: 'gold', name: 'Золото', color: '#8f6414' },
  ];
  let scale = $state(String(settings.uiScale) as '0.9' | '1' | '1.1' | '1.2');
  let goal = $state(String(settings.dailyGoal) as '20' | '50' | '100' | '150');
  let perDay = $state(String(settings.newPerDay) as '10' | '20' | '30' | '50');
  $effect(() => {
    settings.uiScale = Number(scale);
    settings.dailyGoal = Number(goal);
    settings.newPerDay = Number(perDay);
  });

  // Reminders from Vasily: on/off, the time, the next note he would send.
  let remindOn = $state(!!settings.remindAt);
  let upcoming = $state<PlannedReminder | undefined>();
  // What Android actually holds: permission and the queue (on the phone only).
  let status = $state<ReminderStatus | undefined>();
  const refreshStatus = async () => (status = await reminderStatus());
  void refreshStatus();
  $effect(() => {
    const at = settings.remindAt;
    void nextReminder(at).then((r) => (upcoming = r));
  });
  async function remindTime(at: string) {
    const r = await enableReminders(at);
    remindOn = r !== 'denied';
    reminderToast(r, at);
    await refreshStatus();
  }
  async function toggleRemind(on: boolean) {
    if (on) await remindTime(settings.remindAt ?? '19:00');
    else await disableReminders();
    await refreshStatus();
  }
  // «Прислать пробное»: every press — another kind of note; the mock below shows the last one.
  let sample = $state<Pick<PlannedReminder, 'title' | 'body' | 'mood' | 'lines'> | undefined>();
  const shown = $derived(sample ?? upcoming);
  async function tryReminder() {
    const r = await testReminder();
    if (r === 'denied') toast('Android запретил уведомления. Разрешите их: настройки телефона → Приложения → СТОЛЫПИНЪ → Уведомления', 'error', 6000);
    else if ('sent' in r) {
      sample = r.sent;
      toast('Отправил — загляните в шторку. Нажмите ещё: пришлю другое', 'success');
    } else if ('web' in r) {
      sample = r.web;
      toast('В браузере уведомлений нет — так оно выглядело бы на телефоне');
    } else toast(`Не получилось: ${r.error}`, 'error', 6000);
  }

  // Помощь Василия: the key lives only on this device; checked against the service before saving.
  let keyInput = $state('');
  let keyBusy = $state(false);
  const keyMask = $derived(ai.key ? `${ai.key.slice(0, 5)}…${ai.key.slice(-4)}` : '');
  async function addKey() {
    const k = keyInput.trim();
    if (k.length < 10) return toast('Ключ слишком короткий — вставьте его целиком', 'error');
    keyBusy = true;
    try {
      if (!(await checkAiKey(k))) return toast('Сервис не принял ключ — проверьте, что он скопирован целиком и не отозван', 'error', 5000);
      await saveAiKey(k);
      settings.ai = true;
      keyInput = '';
      toast('Ключ сохранён — Василий готов помогать', 'success');
    } catch {
      toast('Не удалось проверить ключ — нужен интернет', 'error');
    } finally {
      keyBusy = false;
    }
  }
  async function removeKey() {
    if (!(await confirmDialog('Удалить ключ ИИ?', { message: 'Кнопки «Спросить Василия» пропадут, пока не вставите ключ снова.', ok: 'Удалить', danger: true }))) return;
    await saveAiKey('');
    toast('Ключ удалён');
  }

  async function doExport() {
    try {
      await exportBackup();
      toast('Резервная копия сохранена', 'success');
    } catch (e) {
      toast(`Не удалось: ${(e as Error).message}`, 'error');
    }
  }
  async function doImport() {
    const [file] = await pickFiles('.json,application/json');
    if (!file) return;
    if (!(await confirmDialog('Восстановить из копии?', { message: 'Текущий прогресс будет заменён данными из файла.', ok: 'Восстановить' }))) return;
    try {
      await importBackup(file);
      toast('Данные восстановлены', 'success');
      setTimeout(() => location.reload(), 600);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }
  async function doReset() {
    if (!(await confirmDialog('Сбросить весь прогресс?', { message: 'Опыт, чины, ордена и история повторений будут удалены. Книги и свои колоды останутся.', ok: 'Сбросить', danger: true }))) return;
    await resetProgress();
    toast('Прогресс сброшен');
    setTimeout(() => location.reload(), 500);
  }
</script>

<div class="page">
  <PageHeader title="Настройки" back="/profile" />

  <Card padding="sm">
    <button class="link tour" onclick={() => (ui.tour = true)}>
      <Vasily size={44} head />
      <span class="grow">Знакомство с Василием<small>обзор возможностей приложения</small></span>
      <ChevronRight size={18} />
    </button>
    <button class="link tour" onclick={() => navigate('/widgets')}>
      <Vasily size={44} head mood="happy" still />
      <span class="grow">Виджеты Василия<small>12 мемов и «Живой» для главного экрана</small></span>
      <ChevronRight size={18} />
    </button>
  </Card>

  <section class="stack">
    <h2 class="eyebrow">Оформление</h2>
    <Card padding="md">
      <div class="stack inner">
        <div class="field"><span>Тема</span><Segmented bind:value={settings.theme} options={[{ value: 'system', label: 'Как в системе' }, { value: 'light', label: 'Пергамент' }, { value: 'dark', label: 'Ночь' }]} /></div>
        <div class="field">
          <span>Акцент</span>
          <div class="swatches">
            {#each ACCENTS as a (a.id)}
              <button class="sw" class:on={settings.accent === a.id} style:--c={a.color} onclick={() => (settings.accent = a.id)} aria-label={a.name}><i></i><small>{a.name}</small></button>
            {/each}
          </div>
        </div>
        <div class="field"><span>Размер интерфейса</span><Segmented bind:value={scale} options={[{ value: '0.9', label: 'A−' }, { value: '1', label: 'A' }, { value: '1.1', label: 'A+' }, { value: '1.2', label: 'A++' }]} /></div>
        <label class="line"><span class="grow">Меньше анимаций{#if systemReducedMotion() && !settings.reducedMotion}<small>в Android анимации выключены, но здесь они идут — включите, если мешают</small>{/if}</span><Toggle bind:checked={settings.reducedMotion} label="Меньше анимаций" /></label>
        <label class="line"><span class="grow">Вибрация</span><Toggle bind:checked={settings.haptics} label="Вибрация" /></label>
      </div>
    </Card>
  </section>

  <section class="stack section">
    <h2 class="eyebrow">Учёба</h2>
    <Card padding="md">
      <div class="stack inner">
        <div class="field"><span>Цель дня (опыт)</span><Segmented bind:value={goal} options={[{ value: '20', label: '20' }, { value: '50', label: '50' }, { value: '100', label: '100' }, { value: '150', label: '150' }]} /></div>
        <div class="field"><span>Новых карточек в день</span><Segmented bind:value={perDay} options={[{ value: '10', label: '10' }, { value: '20', label: '20' }, { value: '30', label: '30' }, { value: '50', label: '50' }]} /></div>
      </div>
    </Card>
  </section>

  <section class="stack section">
    <h2 class="eyebrow">Помощь Василия (ИИ)</h2>
    <Card padding="md">
      <div class="stack inner">
        <p class="muted ai-note">Проверка пересказа урока, «Почему я ошибся?» в тестах, «Развилки» и «Спросить Василия» на карточках. Только по кнопке и с интернетом: в сервис ИИ уходит лишь текст ответа и задание — без имени и прогресса.</p>
        {#if !aiProxy}
          {#if ai.key}
            <div class="line"><KeyRound size={18} /><span class="grow">Ключ сохранён<small class="num">{keyMask}</small></span><Button size="sm" variant="ghost" icon={Trash2} onclick={removeKey}>Удалить</Button></div>
          {:else}
            <TextField bind:value={keyInput} type="password" label="Ключ ИИ" placeholder="sk-…" hint="Хранится только на этом телефоне и не попадает в резервную копию" onenter={addKey} />
            <Button full variant="secondary" icon={KeyRound} loading={keyBusy} disabled={!keyInput.trim()} onclick={addKey}>Проверить и сохранить</Button>
          {/if}
        {/if}
        {#if aiProxy || ai.key}
          <label class="line"><span class="grow">Разрешить запросы к ИИ</span><Toggle bind:checked={settings.ai} label="Разрешить запросы к ИИ" /></label>
        {/if}
      </div>
    </Card>
  </section>

  <section class="stack section">
    <h2 class="eyebrow">Напоминания от Василия</h2>
    <Card padding="md">
      <div class="stack inner">
        <label class="line"><span class="grow">Напоминать о занятиях<small>раз в день и по делу, каждый день по-разному: урок на повторение, карточки, вопрос дня, «сегодня в истории», план на день. Если долго не заходить — реже, через две недели — тишина</small></span><Toggle bind:checked={remindOn} label="Напоминать о занятиях" onchange={toggleRemind} /></label>
        {#if remindOn}
          <div class="times">
            {#each REMIND_TIMES as t (t.at)}
              <button class="time" class:on={settings.remindAt === t.at} onclick={() => remindTime(t.at)}><b>{t.label}</b><span class="num">{t.at}</span></button>
            {/each}
          </div>
          <label class="line"><span class="grow">Своё время</span><input class="clock num" type="time" value={settings.remindAt ?? '19:00'} onchange={(e) => e.currentTarget.value && remindTime(e.currentTarget.value)} /></label>
          <label class="line"><span class="grow">Спасать серию<small>вечером в 21:00 — ещё одно, если серия от двух дней сгорит в полночь, а сегодня вы не занимались</small></span><Toggle bind:checked={settings.remindStreak} label="Спасать серию" onchange={() => void syncReminders()} /></label>
          {#if shown}
            <div class="notif">
              <Vasily head size={40} mood={shown.mood} still />
              <div class="grow">
                <span class="app">{sample ? 'Пробное' : upcoming ? `Ближайшее · ${whenLabel(upcoming.at)}` : ''}</span>
                <b>{shown.title}</b>
                {#if shown.lines}
                  {#each shown.lines as l (l)}<small>• {l}</small>{/each}
                {:else}
                  <small>{shown.body}</small>
                {/if}
              </div>
            </div>
          {/if}
          {#if status}
            <p class="rstatus" class:bad={!status.allowed || status.error}>
              {#if !status.allowed}Android запретил уведомления. Разрешите их: настройки телефона → Приложения → СТОЛЫПИНЪ → Уведомления.
              {:else if status.error}Ошибка: {status.error}
              {:else}В очереди {pluralN(status.pending, WORDS.reminder)}{status.next ? `, первое — ${whenLabel(status.next)}` : ''}.{/if}
            </p>
          {/if}
          <Button variant="secondary" full icon={BellRing} onclick={tryReminder}>Прислать пробное</Button>
        {/if}
      </div>
    </Card>
  </section>

  <section class="stack section">
    <h2 class="eyebrow">Материалы и данные</h2>
    <Card padding="sm">
      <button class="link" onclick={() => navigate('/packs')}><Package size={20} /><span class="grow">Пакеты материалов</span><ChevronRight size={18} /></button>
    </Card>
    <Card padding="md">
      <div class="stack inner">
        <label class="line"><span class="grow">Сообщать о новой версии<small>раз в день спрашивает GitHub, есть ли свежий APK</small></span><Toggle bind:checked={settings.checkUpdates} label="Сообщать о новой версии" /></label>
        <p class="muted small">Прогресс хранится на этом устройстве. Делайте резервную копию, чтобы перенести его на другой телефон. Файлы книг в копию не входят.</p>
        <Button variant="secondary" full icon={Download} onclick={doExport}>Сохранить резервную копию</Button>
        <Button variant="secondary" full icon={Upload} onclick={doImport}>Восстановить из копии</Button>
        <Button variant="danger" full icon={RotateCcw} onclick={doReset}>Сбросить прогресс</Button>
      </div>
    </Card>
  </section>
</div>

<style>
  .ai-note { font-size: var(--text-sm); line-height: 1.5; margin: 0; }
  .inner { --gap: var(--sp-4); }
  .field { display: flex; flex-direction: column; gap: var(--sp-2); }
  .field > span, .line > span { font-weight: 600; font-size: var(--text-sm); }
  .line { display: flex; align-items: center; gap: var(--sp-3); cursor: pointer; }
  .line small { display: block; font-weight: 400; color: var(--ink-3); font-size: var(--text-xs); }
  .swatches { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--sp-2); }
  .sw { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 10px 4px; border-radius: var(--r-md); border: 1.5px solid var(--line); background: var(--surface); cursor: pointer; }
  .sw i { width: 28px; height: 28px; border-radius: 50%; background: var(--c); box-shadow: inset 0 -3px 6px rgba(0, 0, 0, 0.2); }
  .sw small { font-size: var(--text-2xs); font-weight: 600; }
  .sw.on { border-color: var(--c); background: color-mix(in srgb, var(--c) 10%, var(--surface)); }
  .small { font-size: var(--text-sm); }
  .link { display: flex; align-items: center; gap: var(--sp-3); width: 100%; padding: 12px; border: 0; background: none; cursor: pointer; font-size: var(--text-md); color: var(--ink); }
  .link :global(svg:first-child) { color: var(--accent); }
  .tour { padding: 6px 12px; text-align: left; }
  .times { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .time { display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 10px 12px; border-radius: var(--r-md); border: 1.5px solid var(--line); background: var(--surface); color: var(--ink); font: inherit; font-size: var(--text-sm); cursor: pointer; }
  .time .num { color: var(--ink-3); }
  .time.on { border-color: var(--accent); background: var(--accent-soft); }
  .time.on .num { color: var(--accent); }
  .clock { padding: 8px 10px; border-radius: var(--r-sm); border: 1.5px solid var(--line); background: var(--surface); color: var(--ink); font: inherit; }
  .rstatus { margin: 0; font-size: var(--text-xs); color: var(--success); }
  .rstatus.bad { color: var(--danger); }
  .notif { display: flex; gap: var(--sp-3); align-items: flex-start; padding: var(--sp-3); border-radius: var(--r-md); background: var(--surface-2); border: 1px solid var(--line); }
  .notif .grow { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .notif .app { font-size: var(--text-2xs); color: var(--ink-3); }
  .notif b { font-size: var(--text-sm); }
  .notif small { color: var(--ink-2); font-size: var(--text-xs); line-height: 1.35; }
  .tour small { display: block; color: var(--ink-3); font-size: var(--text-xs); }
</style>
