<script lang="ts">
  /**
   * Василий на главной — как тамагочи: его настроение — это ваши занятия. Сыт и доволен, когда цель дня выполнена,
   * ждёт продолжения серии, скучает, если вас долго не было, ночью спит. «Сытость» — доля цели дня.
   * Один раз предлагает напоминания (если их не выбрали при знакомстве). Его можно погладить.
   *   <VasilyCard due={cardsDue} />
   */
  import { Fish, BellRing } from '@lucide/svelte';
  import Vasily, { type VasilyMood } from '$lib/design/components/Vasily.svelte';
  import Button from '$lib/design/components/Button.svelte';
  import { progress } from '$lib/core/progress.svelte';
  import { settings } from '$lib/core/settings.svelte';
  import { enableReminders, reminderToast } from '$lib/core/reminders';
  import { pluralN, WORDS, todayKey } from '$lib/core/utils/format';

  /** Cards waiting for review now (due + new for today). */
  let { due = 0 }: { due?: number } = $props();

  const verb = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? 'ждёт' : 'ждут');
  const hour = new Date().getHours();
  const goal = $derived(Math.max(1, settings.dailyGoal));
  const xp = $derived(progress.today.xp);
  const fed = $derived(Math.min(1, xp / goal));
  // Days since the last day with any study; undefined — never studied.
  const gap = $derived.by(() => {
    const last = [...progress.days].reverse().find((d) => d.xp > 0 && d.date !== todayKey())?.date;
    if (!last) return undefined;
    return Math.round((new Date(`${todayKey()}T00:00:00`).getTime() - new Date(`${last}T00:00:00`).getTime()) / 86_400_000);
  });

  const state = $derived.by<{ mood: VasilyMood; say: string }>(() => {
    if (hour >= 23 || hour < 6) return { mood: 'sleep', say: `Тсс… я сплю.${due ? ` Утром нас ${verb(due)} ${pluralN(due, WORDS.card)}.` : ' Утром почитаем.'}` };
    if (xp >= goal) return { mood: 'happy', say: 'Я сыт и доволен — цель дня выполнена! Можно отдохнуть или пройти ещё урок.' };
    if (xp > 0) return { mood: 'smile', say: `Хорошее начало! До цели дня — ещё ${pluralN(goal - xp, WORDS.point)} опыта.` };
    if (gap === undefined) return { mood: 'smile', say: 'Начнём с первого урока? Я буду рядом.' };
    if (gap <= 1) {
      const streak = progress.streak ? `Серия — ${pluralN(progress.streak, WORDS.day)}. ` : '';
      return { mood: 'idle', say: `${streak}${due ? `${pluralN(due, WORDS.card)} ${verb(due)} повторения — покормите меня знаниями?` : 'Продолжим? План на сегодня — чуть ниже.'}` };
    }
    if (gap <= 6) return { mood: 'sad', say: 'Я соскучился… Начнём с малого — пять минут?' };
    return { mood: 'sad', say: 'Давно не виделись! Я успел дочитать книгу. Вернёмся с одного урока?' };
  });

  const offer = $derived(settings.onboarded && !settings.remindAsked && !settings.remindAt);
  async function remind() {
    reminderToast(await enableReminders('19:00'), '19:00');
  }
</script>

<section class="vcard">
  <Vasily mood={state.mood} size={92} interactive />
  <div class="talk">
    <p class="bubble">{state.say}</p>
    <div class="fed" title="Сытость — доля цели дня">
      <Fish size={14} />
      <span class="bar"><i style:width="{fed * 100}%"></i></span>
      <small class="num">{fed >= 1 ? 'сыт' : `${Math.round(fed * 100)}%`}</small>
    </div>
    {#if offer}
      <div class="offer">
        <small>Напоминать вам о повторениях? Раз в день и по делу.</small>
        <div class="row">
          <Button size="sm" variant="soft" icon={BellRing} onclick={remind}>В 19:00</Button>
          <Button size="sm" variant="ghost" onclick={() => (settings.remindAsked = true)}>Не надо</Button>
        </div>
      </div>
    {/if}
  </div>
</section>

<style>
  .vcard { display: flex; align-items: flex-end; gap: var(--sp-2); margin: calc(-1 * var(--sp-2)) 0 var(--sp-4); }
  .talk { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--sp-2); padding-bottom: var(--sp-2); }
  .bubble {
    position: relative;
    margin: 0;
    padding: var(--sp-3) var(--sp-4);
    border-radius: var(--r-lg);
    border: 1px solid var(--line);
    background: var(--surface);
    box-shadow: var(--shadow-1);
    font-size: var(--text-sm);
    line-height: 1.45;
  }
  .bubble::before {
    content: '';
    position: absolute;
    left: -7px;
    bottom: 18px;
    width: 12px;
    height: 12px;
    background: var(--surface);
    border-left: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
    transform: rotate(45deg);
  }
  .fed { display: flex; align-items: center; gap: 6px; padding: 0 var(--sp-2); color: var(--gold); }
  .bar { flex: 1; height: 6px; border-radius: var(--r-full); background: var(--surface-3); box-shadow: inset 0 0 0 1px var(--line); overflow: hidden; }
  .bar i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--gold), #f0cf82); transition: width var(--dur-4) var(--ease-out); }
  .fed small { min-width: 30px; text-align: right; font-size: var(--text-2xs); color: var(--ink-3); }
  .offer { display: flex; flex-direction: column; gap: 6px; padding: var(--sp-2) var(--sp-3); border-radius: var(--r-md); background: var(--accent-soft); }
  .offer small { font-size: var(--text-xs); color: var(--ink-2); }
  .offer .row { display: flex; gap: 6px; }
</style>
