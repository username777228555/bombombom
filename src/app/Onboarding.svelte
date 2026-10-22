<script lang="ts">
  /**
   * «Знакомство с Василием» — обзор возможностей при первом входе (пока не стоит settings.onboarded) и по кнопке
   * в настройках (ui.tour). Василий рассказывает о разделах: реплика печатается, пока он «говорит», под ним —
   * живая мини-сцена раздела. Под конец предлагает поставить «Живого Василия» на главный экран (виджет сам листает
   * утро → день → вечер → ночь) и зовёт в чат приложения в Telegram, в конце — первый урок или главная. Назад/вперёд: кнопки, стрелки, «Назад» Android.
   */
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { backOut, cubicOut } from 'svelte/easing';
  import { ArrowLeft, ArrowRight, BookOpen, RotateCcw, Target, Check, ChartGantt, Network, Crown, ScrollText, Images, Swords, Crosshair, UserSearch, Flame, Library, MapPin, Layers, BellOff, Plus, Send, Megaphone, MessageCircleQuestionMark, Bug } from '@lucide/svelte';
  import Vasily, { type VasilyMood } from '$lib/design/components/Vasily.svelte';
  import Button from '$lib/design/components/Button.svelte';
  import TextField from '$lib/design/components/TextField.svelte';
  import OrderBadge from '$lib/design/components/OrderBadge.svelte';
  import { settings, motionOK } from '$lib/core/settings.svelte';
  import { router, navigate } from '$lib/core/router.svelte';
  import { kb } from '$lib/core/content/kb.svelte';
  import { ORDERS, RANKS } from '$lib/core/achievements';
  import { pluralN, WORDS } from '$lib/core/utils/format';
  import { haptic, isNative } from '$lib/core/platform';
  import { toast } from '$lib/core/ui.svelte';
  import { quizOn } from '$lib/core/daily';
  import { duePlan } from '$lib/modules/course/progress';
  import { REMIND_TIMES, enableReminders, disableReminders, nextReminder, reminderToast, whenLabel } from '$lib/core/reminders';
  import type { PlannedReminder } from '$lib/core/reminder-plan';
  import WidgetScene from '$lib/modules/widgets/WidgetScene.svelte';
  import { liveScene, say, type Moment } from '$lib/modules/widgets/voice';
  import { pinWidget, placedStyles } from '$lib/modules/widgets/native';
  import type { WidgetStyleId } from '$lib/modules/widgets/scenes';
  import { TELEGRAM_URL, TELEGRAM_NAME } from '$lib/core/contact';

  let { onclose }: { onclose: () => void } = $props();

  type Scene = 'hello' | 'course' | 'plan' | 'cards' | 'tests' | 'epochs' | 'games' | 'profile' | 'remind' | 'widget' | 'chat' | 'finish';
  /** `small` — a tall scene: Vasily steps back a little so the buttons stay on screen. */
  interface Step { scene: Scene; mood: VasilyMood; where?: string; small?: boolean; say: () => string }

  let name = $state(settings.name);
  const who = $derived(name.trim());
  const STEPS: Step[] = [
    { scene: 'hello', mood: 'smile', say: () => 'Здравствуйте! Я Василий, кот учёный. Раньше ходил по цепи у лукоморья, а теперь помогаю готовиться к олимпиадам по истории. Как мне к вам обращаться?' },
    { scene: 'course', mood: 'idle', where: 'Эпохи → Курс', say: () => `${who ? `Приятно познакомиться, ${who}! ` : ''}Главное здесь — «Курс»: ${pluralN(kb.lessons.length, WORDS.lesson)} от Древней Руси до 2020-х годов. Прочитали, ответили на вопросы, пересказали по памяти, выучили даты. А через 2, 7 и 21 день я напомню повторить.` },
    { scene: 'plan', mood: 'think', where: 'Главная', say: () => 'Не знаете, с чего начать? На главной каждый день готов план: урок, ошибки, которые пора повторить, и слабое место по «Карте знаний».' },
    { scene: 'cards', mood: 'idle', where: 'Практика → Карточки', say: () => 'Даты, деятели и термины живут в «Карточках». Я сам слежу, что пора повторить, а что вы и так помните, — только отвечайте честно.' },
    { scene: 'tests', mood: 'surprised', where: 'Практика → Тесты и Пробники', say: () => 'Тесты в олимпиадных форматах и настоящие пробники: ВсОШ, «Высшая проба», «Изумруд». Каждый ответ ложится в «Карту знаний» — сразу видно, где пробел.' },
    { scene: 'epochs', mood: 'think', where: 'Эпохи', say: () => 'Для любопытных — «Эпохи»: лента времени, граф связей, лестница правителей, хрестоматия и галерея картин. Я тут могу пропасть на весь вечер.' },
    { scene: 'games', mood: 'smile', where: 'Практика → Игры', say: () => 'Устанете — поиграем: «Хронология», «Год-снайпер», «Кто я?» и «При ком это было?». Тоже учёба, только незаметная.' },
    { scene: 'profile', mood: 'idle', where: 'Библиотека · Профиль', say: () => 'В «Библиотеке» — ваши книги и заметки. А в «Профиле» растут чины по Табели о рангах и жалуются ордена — разумеется, за усердие.' },
    { scene: 'remind', mood: 'smile', where: 'Профиль → Настройки', small: true, say: () => 'Хотите, я буду напоминать о занятиях? Раз в день и по делу: урок на повторение, карточки, вопрос дня. Пропадёте надолго — стану писать реже, а через две недели замолчу.' },
    { scene: 'widget', mood: 'happy', where: 'Профиль → Виджеты Василия', small: true, say: () => 'А ещё я могу жить у вас на главном экране! Утром помашу, днём задам вопрос дня, вечером подожду урок, а ночью усну в колпаке. Поставить меня туда?' },
    { scene: 'chat', mood: 'smile', where: 'Профиль → Чат в Telegram', say: () => 'И последнее: у нас есть чат в Telegram. Там новости о новых версиях, там можно задать вопрос, а если я где-то напутал с датой — скажите, исправим. Заглянете?' },
    { scene: 'finish', mood: 'happy', say: () => `Вот и всё${who ? `, ${who}` : ''}! Захотите послушать меня снова — «Настройки». С чего начнём? И да: меня можно погладить.` },
  ];

  let step = $state(0);
  let dir = $state(1);
  const cur = $derived(STEPS[step]!);
  const text = $derived(cur.say());
  const lesson = $derived(kb.lessons[0]);
  const order = ORDERS.find((o) => o.id === 'stanislav-3')!;

  // Reminders: a time or «не напоминать»; the sample shows the very note Vasily would send.
  let sample = $state<PlannedReminder | undefined>();
  async function remindAt(at: string) {
    const r = await enableReminders(at);
    if (r !== 'on') reminderToast(r, at);
    if (r === 'denied') return;
    haptic('success');
    sample = await nextReminder(at);
  }
  async function noReminders() {
    await disableReminders();
    sample = undefined;
  }
  // Opened again from the settings with reminders on: show the sample right away.
  $effect(() => {
    if (cur.scene === 'remind' && settings.remindAt && !sample) void nextReminder().then((r) => (sample = r));
  });

  // The widget: «Живой Василий» through one day — the same scenes and lines as on the phone (widgets/voice.ts).
  const quiz = quizOn(new Date());
  const dayOf = (sit: Moment['sit'], part: Moment['part'], due: number): Moment => ({ sit, part, due, streak: 3, gap: 1, xp: 0, goal: settings.dailyGoal, seed: 0, quiz, lesson: lesson && { id: lesson.id, title: lesson.title } });
  const DAY = [
    { at: '8:00', what: 'машет', m: dayOf('morning', 'morning', 12) },
    { at: '13:00', what: 'вопрос дня', m: dayOf('day', 'day', 12) },
    { at: '19:00', what: 'ждёт урок', m: dayOf('evening', 'evening', 0) },
    { at: '23:30', what: 'спит', m: dayOf('night', 'night', 0) },
  ].map((d) => {
    const scene = liveScene(d.m);
    return { ...d, scene, say: say(scene, d.m) };
  });
  let hour = $state(0);
  let paused = $state(false);
  $effect(() => {
    if (cur.scene !== 'widget' || paused || !motionOK()) return;
    const t = setInterval(() => (hour = (hour + 1) % DAY.length), 2600);
    return () => clearInterval(t);
  });
  let placed = $state<WidgetStyleId[]>([]);
  let asked = $state(false);
  $effect(() => {
    if (cur.scene === 'widget') void placedStyles().then((s) => (placed = s));
  });
  async function placeWidget() {
    const r = await pinWidget('live');
    if (r === 'pinned') {
      haptic('success');
      asked = true;
      toast('Подтвердите в окне Android — и Василий появится на главном экране', 'success', 5000);
    } else if (r === 'unsupported') toast('Этот рабочий стол не умеет ставить виджеты из приложения. Долгое нажатие на пустом месте → Виджеты → СТОЛЫПИНЪ → «Василий»', 'error', 8000);
    else toast('Виджеты работают в приложении для Android');
  }

  // The line is typed out while Vasily talks; a tap on the bubble shows it whole.
  let typed = $state(0);
  $effect(() => {
    const full = text;
    if (!motionOK()) {
      typed = full.length;
      return;
    }
    typed = 0;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      typed++;
      if (typed >= full.length) return;
      const ch = full[typed - 1]!;
      t = setTimeout(tick, /[.!?]/.test(ch) ? 280 : /[,—:]/.test(ch) ? 130 : 24);
    };
    t = setTimeout(tick, 420);
    return () => clearTimeout(t);
  });
  const talking = $derived(typed < text.length);

  function go(to: number) {
    if (to < 0 || to >= STEPS.length || to === step) return;
    if (step === 0) settings.name = who;
    haptic('select');
    dir = to > step ? 1 : -1;
    step = to;
  }
  const next = () => go(step + 1);
  const back = () => go(step - 1);

  function close() {
    settings.name = who;
    settings.onboarded = true;
    onclose();
  }
  async function firstLesson() {
    const plan = await duePlan();
    close();
    navigate(plan.next ? `/lesson/${plan.next.id}` : '/course');
  }
  function home() {
    close();
    if (router.path !== '/') navigate('/');
  }

  function onkey(e: KeyboardEvent) {
    const typing = (e.target as HTMLElement | null)?.closest?.('input, textarea');
    if (e.key === 'Escape') close();
    else if (typing) return;
    else if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') back();
  }

  let vh = $state(800);
  // Vasily takes the height left over by the bubble, the scene and the buttons (~620 px on a phone).
  const catSize = $derived(Math.round(Math.max(96, Math.min(230, (vh - 620) * 0.75)) * (cur.small ? 0.62 : 1)));

  onMount(() => {
    document.documentElement.style.overflow = 'hidden';
    const off = router.addBackGuard(() => {
      if (step > 0) back();
      else close();
      return true;
    });
    return () => {
      off();
      document.documentElement.style.overflow = '';
    };
  });
</script>

<svelte:window onkeydown={onkey} bind:innerHeight={vh} />

<div class="tour" class:still={!motionOK()} role="dialog" aria-modal="true" aria-label="Знакомство с приложением" transition:fade={{ duration: 260 }}>
  <div class="col">
    <header>
      <div class="dots" aria-label="Шаг {step + 1} из {STEPS.length}">
        {#each STEPS as _, i (i)}
          <button class:on={i === step} class:done={i < step} aria-label="Шаг {i + 1}" onclick={() => go(i)}></button>
        {/each}
      </div>
      <button class="skip" onclick={close}>{settings.onboarded ? 'Закрыть' : 'Пропустить'}</button>
    </header>

    <button class="bubble" onclick={() => (typed = text.length)} aria-label="Показать реплику целиком">
      <span class="who">Василий</span>
      <span class="lines">
        <span class="sizer" aria-hidden="true">{text}</span>
        <span class="typed" aria-hidden="true">{text.slice(0, typed)}{#if talking}<i class="caret"></i>{/if}</span>
        <span class="sr-only" aria-live="polite">{text}</span>
      </span>
    </button>

    <div class="cat" in:fly={{ y: motionOK() ? 80 : 0, duration: 700, delay: 120, easing: backOut }}>
      <Vasily mood={cur.mood} {talking} size={catSize} interactive />
    </div>

    <div class="scene">
      {#key step}
        <div class="pane" in:fly={{ x: motionOK() ? dir * 48 : 0, duration: 380, easing: cubicOut }} out:fade={{ duration: 140 }}>
          {#if cur.where}<span class="where"><MapPin size={13} /> {cur.where}</span>{/if}

          {#if cur.scene === 'hello'}
            <div class="card">
              <TextField bind:value={name} label="Как к вам обращаться" placeholder="Имя" onenter={next} />
              <small class="note">Имя останется только на этом устройстве — для приветствия на главной.</small>
            </div>
          {:else if cur.scene === 'course'}
            <div class="card lesson">
              <span class="kicker"><BookOpen size={15} /> Урок · {lesson ? kb.periodById.get(lesson.period)?.short : 'Древняя Русь'}</span>
              <strong class="display">{lesson?.title ?? 'Восточные славяне'}</strong>
              <div class="path">
                {#each ['Чтение', 'Пересказ', 'Даты', 'Проверка'] as s, i (s)}
                  <span class="chip" style="--d: {0.3 + i * 0.45}s">{s}</span>
                  {#if i < 3}<i class="arrow">→</i>{/if}
                {/each}
              </div>
              <div class="reviews">
                <span>Повторения:</span>
                {#each ['через 2 дня', '7', '21'] as r, i (r)}<span class="rev" style="--d: {2.2 + i * 0.3}s">{r}</span>{/each}
              </div>
            </div>
          {:else if cur.scene === 'plan'}
            <div class="card rows">
              {#each [
                { icon: BookOpen, t: `Новый урок: ${lesson?.title ?? 'Восточные славяне'}`, s: '12 мин чтения и вопросы' },
                { icon: RotateCcw, t: 'Повторение по расписанию', s: 'ошибки вернулись — запомнилось ли?', n: 5 },
                { icon: Target, t: 'Слабое место: даты', s: 'Смута · 40% верных' },
              ] as r, i (i)}
                {@const Icon = r.icon}
                <div class="row" style="--d: {0.15 + i * 0.25}s"><Icon size={19} /><span class="grow"><b>{r.t}</b><small>{r.s}</small></span>{#if r.n}<span class="num cnt">{r.n}</span>{:else}<ArrowRight size={15} />{/if}</div>
              {/each}
            </div>
          {:else if cur.scene === 'cards'}
            <div class="flip-wrap">
              <div class="flip">
                <div class="face front"><span class="eyebrow">Дата</span><strong class="display">1612</strong></div>
                <div class="face back"><span class="eyebrow">Ответ</span><strong>Освобождение Москвы ополчением Минина и Пожарского</strong></div>
              </div>
              <div class="grades">
                {#each ['Снова', 'Трудно', 'Хорошо', 'Легко'] as g (g)}<span class:hot={g === 'Хорошо'}>{g}</span>{/each}
              </div>
            </div>
          {:else if cur.scene === 'tests'}
            <div class="card quiz">
              <b>В каком году в России учреждено патриаршество?</b>
              <div class="opts">
                {#each ['1547', '1589', '1613', '1654'] as o (o)}
                  <span class="opt" class:right={o === '1589'}>{o}{#if o === '1589'}<Check size={15} />{/if}</span>
                {/each}
              </div>
              <div class="map" aria-hidden="true">
                {#each [3, 2, 3, 1, 2, 3, 0, 2, 1, 3, 2, 2] as v, i (i)}<i class="c{v}" style="--d: {1.6 + i * 0.06}s"></i>{/each}
              </div>
            </div>
          {:else if cur.scene === 'epochs' || cur.scene === 'games'}
            <div class="tiles" class:four={cur.scene === 'games'}>
              {#each cur.scene === 'epochs'
                ? [{ icon: ChartGantt, t: 'Лента времени', c: '#2b4f8c' }, { icon: Network, t: 'Граф связей', c: '#1d6b57' }, { icon: Crown, t: 'Правители', c: '#a87a28' }, { icon: ScrollText, t: 'Хрестоматия', c: '#6b4a2b' }, { icon: Images, t: 'Галерея', c: '#a87b2b' }, { icon: BookOpen, t: 'Термины', c: '#7c1d2b' }]
                : [{ icon: Swords, t: 'Хронология', c: '#2b4f8c' }, { icon: Crosshair, t: 'Год-снайпер', c: '#a3202e' }, { icon: UserSearch, t: 'Кто я?', c: '#1d6b57' }, { icon: Crown, t: 'При ком это было?', c: '#a87a28' }] as tile, i (tile.t)}
                {@const Icon = tile.icon}
                <div class="tile" style="--c: {tile.c}; --d: {0.1 + i * 0.09}s"><span class="ico"><Icon size={20} /></span><b>{tile.t}</b></div>
              {/each}
            </div>
          {:else if cur.scene === 'profile'}
            <div class="card prof">
              <div class="badge"><OrderBadge {order} size={68} /></div>
              <div class="grow">
                <span class="eyebrow">Чин</span>
                <b class="display">{RANKS[0]!.title}</b>
                <div class="xp"><i></i></div>
                <small class="muted">до чина «{RANKS[1]!.title}»</small>
                <span class="streak"><Flame size={15} /> {pluralN(7, WORDS.day)} подряд</span>
              </div>
            </div>
            <div class="card lib"><Library size={18} /><span><b>Библиотека</b><small>читалка, закладки и заметки к вашим книгам</small></span></div>
          {:else if cur.scene === 'remind'}
            <div class="card remind">
              <div class="times">
                {#each REMIND_TIMES as t (t.at)}
                  <button class="time" class:on={settings.remindAt === t.at} onclick={() => remindAt(t.at)}><span class="num">{t.at}</span><small>{t.label}</small></button>
                {/each}
              </div>
              <button class="time off" class:on={settings.remindAsked && !settings.remindAt} onclick={noReminders}><BellOff size={15} /> Не напоминать</button>
              {#if settings.remindAt && sample}
                <div class="notif" in:fly={{ y: motionOK() ? 8 : 0, duration: 260 }}>
                  <Vasily head size={40} mood={sample.mood} still />
                  <div class="grow">
                    <span class="app">СТОЛЫПИНЪ · {whenLabel(sample.at)}</span>
                    <b>{sample.title}</b>
                    <small>{sample.body}</small>
                  </div>
                </div>
              {/if}
              {#if !(settings.remindAt && sample)}<small class="note">Поменять или выключить — в настройках. Всё хранится на телефоне.</small>{/if}
            </div>
          {:else if cur.scene === 'widget'}
            <div class="card widget">
              <div class="wrow">
                <div class="wg">
                  {#key hour}
                    <div class="wg-in" in:fade={{ duration: motionOK() ? 360 : 0 }} out:fade={{ duration: motionOK() ? 360 : 0 }}>
                      <WidgetScene scene={DAY[hour]!.scene} height={136} text={{ say: DAY[hour]!.say, streak: 3 }} />
                    </div>
                  {/key}
                </div>
                <ol class="day" aria-label="Василий в течение дня">
                  {#each DAY as d, i (d.at)}
                    <li><button class:on={i === hour} onclick={() => { hour = i; paused = true; }}><span class="num">{d.at}</span> {d.what}</button></li>
                  {/each}
                </ol>
              </div>
              {#if isNative}
                <Button variant={asked || placed.includes('live') ? 'soft' : 'primary'} full icon={asked || placed.includes('live') ? Check : Plus} onclick={placeWidget}>
                  {asked ? 'Подтвердите в окне Android' : placed.includes('live') ? 'Уже на экране · поставить ещё' : 'Поставить на главный экран'}
                </Button>
                <small class="note">Это «Живой Василий». Шлёпа, Ждун, Самодержец и ещё девять — в «Профиль → Виджеты Василия».</small>
              {:else}
                <small class="note">Виджеты работают в приложении для Android. Шлёпа, Ждун, Самодержец и ещё девять стилей — в «Профиль → Виджеты Василия».</small>
              {/if}
            </div>
          {:else if cur.scene === 'chat'}
            <div class="card chat">
              <div class="tg-head">
                <span class="tg-ava"><Send size={20} /></span>
                <span class="grow"><b>СТОЛЫПИНЪ · чат</b><small>{TELEGRAM_NAME}</small></span>
              </div>
              <div class="tg-rows">
                {#each [{ icon: Megaphone, t: 'Новые версии и что в них' }, { icon: MessageCircleQuestionMark, t: 'Вопросы по приложению и истории' }, { icon: Bug, t: 'Ошибки в датах и фактах, идеи' }] as r, i (r.t)}
                  {@const Icon = r.icon}
                  <span class="tg-row" style="--d: {0.15 + i * 0.2}s"><Icon size={16} />{r.t}</span>
                {/each}
              </div>
              <a class="tg-open" href={TELEGRAM_URL} target="_blank" rel="noreferrer"><Send size={18} /> Открыть чат</a>
              <small class="note">Можно и потом: «Профиль → Чат в Telegram».</small>
            </div>
          {:else}
            <div class="finish">
              <Button variant="primary" size="lg" full icon={BookOpen} onclick={firstLesson}>Начать первый урок</Button>
              <Button variant="soft" size="lg" full icon={Layers} onclick={home}>Осмотреться самому</Button>
            </div>
          {/if}
        </div>
      {/key}
    </div>

    <footer>
      <Button variant="ghost" icon={ArrowLeft} onclick={back} disabled={step === 0} class={step === 0 ? 'hide' : ''}>Назад</Button>
      {#if step < STEPS.length - 1}
        <Button variant="primary" iconRight={ArrowRight} onclick={next}>{step === 0 ? (who ? 'Знакомьтесь' : 'Дальше') : 'Дальше'}</Button>
      {/if}
    </footer>
  </div>
</div>

<style>
  .tour {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: flex;
    overflow-y: auto;
    padding: calc(var(--safe-top) + var(--sp-2)) var(--page-x) calc(var(--safe-bottom) + var(--sp-3));
    background:
      radial-gradient(120% 60% at 50% 34%, var(--glow), transparent 70%),
      var(--bg);
  }
  .col { width: 100%; max-width: 520px; margin: 0 auto; display: flex; flex-direction: column; gap: var(--sp-2); min-height: 100%; }
  header { display: flex; align-items: center; justify-content: space-between; min-height: 44px; }
  .dots { display: flex; gap: 6px; }
  .dots button { width: 8px; height: 8px; padding: 0; border: 0; border-radius: var(--r-full); background: var(--line-strong); transition: width var(--dur-3) var(--ease-out), background var(--dur-3); }
  .dots button.done { background: color-mix(in srgb, var(--accent) 45%, var(--line-strong)); }
  .dots button.on { width: 24px; background: var(--accent); }
  .skip { border: 0; background: none; color: var(--ink-3); font: inherit; font-size: var(--text-sm); padding: var(--sp-2) var(--sp-1); }

  .bubble {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    margin-top: var(--sp-1);
    padding: var(--sp-3) var(--sp-4) var(--sp-4);
    border: 1px solid var(--line);
    border-radius: var(--r-lg);
    background: var(--surface);
    box-shadow: var(--shadow-2);
    color: var(--ink);
    font: inherit;
    text-align: left;
  }
  .bubble::after {
    content: '';
    position: absolute;
    left: 50%;
    bottom: -10px;
    width: 18px;
    height: 18px;
    background: var(--surface);
    border-right: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
    transform: translateX(-50%) rotate(45deg);
  }
  .who { font-family: var(--font-display); font-weight: 700; color: var(--accent); font-size: var(--text-sm); letter-spacing: 0.04em; }
  .lines { display: grid; font-size: var(--text-md); line-height: 1.5; }
  @media (max-height: 760px) { .lines { font-size: 15px; line-height: 1.45; } }
  .lines > span:not(.sr-only) { grid-area: 1 / 1; }
  .sizer { visibility: hidden; }
  .caret { display: inline-block; width: 2px; height: 1em; margin-left: 2px; vertical-align: -2px; background: var(--accent); animation: caret 0.8s steps(1) infinite; }
  @keyframes caret { 50% { opacity: 0; } }

  .cat { position: relative; display: flex; justify-content: center; margin-top: var(--sp-3); }
  .cat :global(.vasily) { transition: width var(--dur-3) var(--ease-out); }

  .scene { display: grid; grid-template-columns: minmax(0, 1fr); flex: 1; align-content: start; }
  .pane { grid-area: 1 / 1; min-width: 0; display: flex; flex-direction: column; gap: var(--sp-2); }
  .where { align-self: center; display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: var(--r-full); background: var(--accent-soft); color: var(--accent); font-size: var(--text-xs); font-weight: 600; }
  .card { padding: var(--sp-4); border: 1px solid var(--line); border-radius: var(--r-lg); background: var(--surface); box-shadow: var(--shadow-1); display: flex; flex-direction: column; gap: var(--sp-2); }
  .note, .card small { color: var(--ink-3); font-size: var(--text-xs); line-height: 1.35; }

  /* Pieces of a scene appear one after another (--d). */
  .chip, .rev, .row, .tile, .map i { animation: pop 420ms var(--ease-spring) backwards; animation-delay: var(--d); }
  @keyframes pop { from { opacity: 0; transform: translateY(8px) scale(0.92); } }

  .lesson .kicker { display: inline-flex; gap: 6px; align-items: center; color: var(--accent); font-size: var(--text-xs); font-weight: 600; }
  .lesson strong { font-size: var(--text-xl); line-height: 1.2; }
  .path { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  .chip { padding: 4px 10px; border-radius: var(--r-full); background: var(--surface-3); font-size: var(--text-xs); font-weight: 600; animation-name: pop, lit; animation-duration: 420ms, 500ms; animation-fill-mode: backwards, forwards; animation-delay: var(--d), calc(var(--d) + 0.2s); }
  @keyframes lit { to { background: var(--success-soft); color: var(--success); } }
  .arrow { color: var(--ink-3); font-style: normal; font-size: var(--text-xs); }
  .reviews { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: var(--text-xs); color: var(--ink-3); }
  .rev { padding: 2px 8px; border-radius: var(--r-full); border: 1px dashed var(--gold); color: var(--gold); font-weight: 600; }

  .rows { gap: 0; padding: var(--sp-2) var(--sp-3); }
  .row { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-2) 0; color: var(--accent); }
  .row + .row { border-top: 1px solid var(--line); }
  .row .grow { display: flex; flex-direction: column; color: var(--ink); min-width: 0; }
  .row b { font-size: var(--text-sm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cnt { font-family: var(--font-display); font-size: var(--text-xl); font-weight: 700; color: var(--danger); }

  .flip-wrap { display: flex; flex-direction: column; gap: var(--sp-3); align-items: center; }
  .flip { position: relative; width: min(100%, 300px); height: 140px; perspective: 900px; transform-style: preserve-3d; animation: flip 5s var(--ease-in-out) 0.8s infinite; }
  .face { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: var(--sp-4); border-radius: var(--r-lg); border: 1px solid var(--line); background: var(--surface); box-shadow: var(--shadow-2); backface-visibility: hidden; text-align: center; }
  .front strong { font-size: var(--text-4xl); color: var(--accent); }
  .back { transform: rotateY(180deg); }
  .back strong { font-size: var(--text-md); line-height: 1.35; }
  @keyframes flip { 0%, 35% { transform: rotateY(0); } 50%, 85% { transform: rotateY(180deg); } 100% { transform: rotateY(360deg); } }
  .grades { display: flex; gap: 6px; }
  .grades span { padding: 6px 10px; border-radius: var(--r-sm); background: var(--surface-3); font-size: var(--text-xs); font-weight: 600; color: var(--ink-2); }
  .grades .hot { background: var(--success-soft); color: var(--success); animation: pulse 5s var(--ease-in-out) 0.8s infinite; }
  @keyframes pulse { 0%, 55% { transform: scale(1); } 65% { transform: scale(1.12); } 75%, 100% { transform: scale(1); } }

  .quiz b { font-size: var(--text-sm); line-height: 1.35; }
  .opts { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .opt { display: flex; align-items: center; justify-content: center; gap: 4px; padding: 8px; border-radius: var(--r-sm); border: 1px solid var(--line); font-weight: 600; font-variant-numeric: tabular-nums; }
  .opt.right { animation: right 400ms var(--ease-spring) 1s backwards; background: var(--success-soft); border-color: var(--success); color: var(--success); }
  @keyframes right { from { background: transparent; border-color: var(--line); color: var(--ink); transform: scale(0.96); } }
  .map { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; margin-top: 2px; }
  .map i { height: 12px; border-radius: 3px; }
  .map .c0 { background: var(--danger-soft); } .map .c1 { background: var(--warning-soft); }
  .map .c2 { background: color-mix(in srgb, var(--success) 35%, var(--surface)); } .map .c3 { background: var(--success); }

  .tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-2); }
  .tiles.four { grid-template-columns: 1fr 1fr; }
  .tile { display: flex; flex-direction: column; gap: 6px; padding: var(--sp-3); border-radius: var(--r-md); background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow-1); }
  .tile .ico { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; color: #fff; background: var(--c); }
  .tile b { font-size: var(--text-xs); line-height: 1.25; }
  .four .tile { flex-direction: row; align-items: center; }
  .four .tile b { font-size: var(--text-sm); }

  .prof { flex-direction: row; align-items: center; gap: var(--sp-4); }
  .prof .grow { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .prof b.display { font-size: var(--text-lg); line-height: 1.15; }
  .badge { animation: pop 600ms var(--ease-spring) 0.2s backwards; }
  .xp { height: 6px; border-radius: var(--r-full); background: var(--surface-3); overflow: hidden; }
  .xp i { display: block; height: 100%; width: 72%; border-radius: inherit; background: linear-gradient(90deg, var(--gold), #f0cf82); animation: grow 1.4s var(--ease-out) 0.4s backwards; }
  @keyframes grow { from { width: 0; } }
  .streak { display: inline-flex; align-items: center; gap: 4px; color: var(--warning); font-size: var(--text-xs); font-weight: 600; }
  .lib { flex-direction: row; align-items: center; gap: var(--sp-3); color: var(--accent); }
  .lib span { display: flex; flex-direction: column; color: var(--ink); }

  .remind { gap: var(--sp-2); }
  .times { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .time { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; padding: 7px 4px; border-radius: var(--r-md); border: 1.5px solid var(--line); background: var(--surface); color: var(--ink); font: inherit; font-size: var(--text-sm); cursor: pointer; transition: border-color var(--dur-2), background var(--dur-2); }
  .time .num { font-weight: 700; font-variant-numeric: tabular-nums; }
  .time small { font-size: var(--text-2xs); color: var(--ink-3); white-space: nowrap; }
  .time.on { border-color: var(--accent); background: var(--accent-soft); }
  .time.on .num, .time.on small { color: var(--accent); }
  .time.off { flex-direction: row; gap: 6px; padding: 8px; color: var(--ink-3); }
  .time.off.on { color: var(--ink); border-color: var(--line-strong); background: var(--surface-3); }
  .notif { display: flex; gap: var(--sp-3); align-items: flex-start; padding: var(--sp-3); border-radius: var(--r-md); background: var(--surface-2); border: 1px solid var(--line); }
  .notif .grow { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .notif .app { font-size: var(--text-2xs); color: var(--ink-3); }
  .notif b { font-size: var(--text-sm); }
  .notif small { color: var(--ink-2); font-size: var(--text-xs); line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .widget { gap: var(--sp-3); }
  .wrow { display: flex; align-items: center; gap: var(--sp-3); }
  .wg { display: grid; flex-shrink: 0; }
  .wg-in { grid-area: 1 / 1; }
  .day { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
  .day button { display: flex; align-items: baseline; gap: 6px; width: 100%; padding: 5px 8px; border: 0; border-radius: var(--r-sm); background: none; color: var(--ink-3); font: inherit; font-size: var(--text-sm); text-align: left; cursor: pointer; transition: background var(--dur-2), color var(--dur-2); }
  .day .num { min-width: 40px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .day button.on { background: var(--accent-soft); color: var(--accent); }
  .chat { gap: var(--sp-3); }
  .tg-head { display: flex; align-items: center; gap: var(--sp-3); }
  .tg-head .grow { display: flex; flex-direction: column; }
  .tg-ava { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; flex: 0 0 auto; background: #2aabee; color: #fff; }
  .tg-rows { display: flex; flex-direction: column; gap: 6px; }
  .tg-row { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--text-sm); color: var(--ink-2); animation: pop 420ms var(--ease-spring) backwards; animation-delay: var(--d); }
  .tg-row :global(svg) { color: var(--accent); flex: 0 0 auto; }
  .tg-open { display: inline-flex; align-items: center; justify-content: center; gap: var(--sp-2); height: 44px; border-radius: var(--r-full); background: #2aabee; color: #fff; font-weight: 620; text-decoration: none; }
  .tg-open:active { transform: scale(0.965); }
  .finish { display: flex; flex-direction: column; gap: var(--sp-2); margin-top: var(--sp-4); }

  footer { display: flex; justify-content: space-between; align-items: center; gap: var(--sp-2); padding-top: var(--sp-3); }
  footer :global(.hide) { visibility: hidden; }

  .still .flip, .still .grades .hot, .still .caret { animation: none; }
</style>
