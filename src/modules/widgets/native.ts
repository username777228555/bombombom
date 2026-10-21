/**
 * Виджеты на главном экране Android: отдаёт телефону ленту подписей (plan.ts) и ставит виджет по кнопке. Нативная
 * сторона — плагин VasilyWidget (android/…/widget/WidgetPlugin.java): хранит ленту в SharedPreferences, сама
 * меняет подпись в нужный час и открывает приложение по нажатию. В браузере всё молча ничего не делает.
 *   initWidgets()            // App.svelte после загрузки: пересборка при запуске и при уходе, переход по нажатию
 *   syncWidgets()            // пересобрать сейчас (после первого занятия за день и цели дня — App.svelte)
 *   pinWidget('floppa')      // системный диалог «Добавить виджет?»: 'pinned' | 'unsupported' | 'web'
 *   placedStyles()           // какие стили уже стоят на экране
 *   widgetPreview()          // лента для превью в галерее (то же, что увидит телефон)
 *
 * Плагин импортируется один раз и никогда не возвращается из async-функции: прокси Capacitor отвечает на `then`.
 */
import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { isNative } from '$lib/core/platform';
import { navigate } from '$lib/core/router.svelte';
import { outlook } from '$lib/core/outlook';
import { factOn, quizOn } from '$lib/core/daily';
import { planWidgets, WIDGET_DAYS, type WidgetPlan } from './plan';
import type { WidgetStyleId } from './scenes';

interface VasilyWidgetPlugin {
  update(o: { plan: string }): Promise<void>;
  pin(o: { style: WidgetStyleId }): Promise<{ ok: boolean }>;
  placed(): Promise<{ styles: WidgetStyleId[] }>;
  /** A tap on a widget: the screen to open (kept until listened to, so a cold start does not lose it). */
  addListener(event: 'open', cb: (e: { route: string }) => void): Promise<PluginListenerHandle>;
}
const native = registerPlugin<VasilyWidgetPlugin>('VasilyWidget');
const DAY = 86_400_000;

/** The plan the phone would get now. */
export async function widgetPreview(now = new Date()): Promise<WidgetPlan> {
  const o = await outlook(WIDGET_DAYS + 1, now);
  const day = (d: number) => new Date(now.getTime() + d * DAY);
  return planWidgets({
    ...o,
    quiz: Array.from({ length: WIDGET_DAYS + 1 }, (_, d) => quizOn(day(d), o.met)),
    fact: Array.from({ length: WIDGET_DAYS + 1 }, (_, d) => factOn(day(d))),
  });
}

let chain: Promise<void> = Promise.resolve();
export function syncWidgets(): Promise<void> {
  if (!isNative) return chain;
  chain = chain
    .then(async () => {
      const plan = await widgetPreview();
      await native.update({ plan: JSON.stringify(plan) });
    })
    .catch((e) => console.warn('widgets:', e));
  return chain;
}

export async function pinWidget(style: WidgetStyleId): Promise<'pinned' | 'unsupported' | 'web'> {
  if (!isNative) return 'web';
  await syncWidgets();
  try {
    return (await native.pin({ style })).ok ? 'pinned' : 'unsupported';
  } catch {
    return 'unsupported';
  }
}

export async function placedStyles(): Promise<WidgetStyleId[]> {
  if (!isNative) return [];
  try {
    return (await native.placed()).styles;
  } catch {
    return [];
  }
}

export function initWidgets(): void {
  if (!isNative) return;
  void native.addListener('open', ({ route }) => navigate(route)).catch(() => {});
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) void syncWidgets();
  });
  void syncWidgets();
}
