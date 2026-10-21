/**
 * Стили виджетов Василия: двенадцать сцен-мемов и «Живой», который сам выбирает сцену по вашему дню (как сова
 * в Duolingo). Сцена — поза и настроение Василия, шапка, фон и реквизит (рисует WidgetScene.svelte); подписи —
 * voice.ts. Картинки для Android снимает scripts/media/widget_export.py (res/drawable-nodpi/wg_<id>_sq|wd.webp),
 * каждому стилю соответствует свой виджет в списке виджетов телефона (VasilyWidget.java).
 *   SCENES.floppa.name        // «Шлёпа»
 *   STYLES                    // порядок в галерее: live первым
 */
import type { VasilyHat, VasilyMood, VasilyPose } from '$lib/design/components/Vasily.svelte';

export type SceneId = 'floppa' | 'hello' | 'yay' | 'hmm' | 'grumpy' | 'reader' | 'sleepy' | 'vzhuh' | 'zhdun' | 'shock' | 'knight' | 'tsar';
export type WidgetStyleId = SceneId | 'live';

export interface Scene {
  id: SceneId;
  name: string;
  /** One line for the gallery and the phone's widget list. */
  blurb: string;
  pose: VasilyPose;
  mood: VasilyMood;
  hat?: VasilyHat;
  /** In the wide widget the text goes on the left (Vasily lies on the right). */
  textLeft?: boolean;
}

export const SCENES: Record<SceneId, Scene> = {
  floppa: { id: 'floppa', name: 'Шлёпа', blurb: 'Большой Шлёпа на диване даёт интервью', pose: 'lie', mood: 'meh', textLeft: true },
  hello: { id: 'hello', name: 'Привет!', blurb: 'Машет лапой и зовёт на урок', pose: 'wave', mood: 'smile' },
  yay: { id: 'yay', name: 'Ура!', blurb: 'Радуется каждому дню серии', pose: 'cheer', mood: 'happy' },
  hmm: { id: 'hmm', name: 'Хм…', blurb: 'Вопрос дня — ответ вечером', pose: 'chin', mood: 'think' },
  grumpy: { id: 'grumpy', name: 'Пф!', blurb: 'Обижается, если урока нет', pose: 'cross', mood: 'angry' },
  reader: { id: 'reader', name: 'Читатель', blurb: 'Что случилось в этот день в истории', pose: 'book', mood: 'smile' },
  sleepy: { id: 'sleepy', name: 'Соня', blurb: 'Дремлет над книгой в ночном колпаке', pose: 'book', mood: 'sleep', hat: 'nightcap' },
  vzhuh: { id: 'vzhuh', name: 'Вжух', blurb: 'Вжух — и все даты выучены', pose: 'wand', mood: 'smile' },
  zhdun: { id: 'zhdun', name: 'Ждун', blurb: 'Терпеливо ждёт, когда вы откроете урок', pose: 'fold', mood: 'sad' },
  shock: { id: 'shock', name: 'В шоке', blurb: '«Крик» Мунка: серия под угрозой!', pose: 'cheeks', mood: 'surprised' },
  knight: { id: 'knight', name: 'На распутье', blurb: 'Витязь у камня: налево — карточки, направо — урок', pose: 'spear', mood: 'think', hat: 'helmet' },
  tsar: { id: 'tsar', name: 'Самодержец', blurb: 'В шапке Мономаха издаёт указы об учёбе', pose: 'orb', mood: 'meh', hat: 'crown' },
};

export const LIVE = { id: 'live' as const, name: 'Живой Василий', blurb: 'Меняет сцену вместе с вашим днём: утром машет, вечером волнуется за серию, ночью спит' };

/** Gallery order: the living one first, then the memes. */
export const STYLES: WidgetStyleId[] = ['live', 'floppa', 'hello', 'yay', 'hmm', 'grumpy', 'reader', 'sleepy', 'vzhuh', 'zhdun', 'shock', 'knight', 'tsar'];
export const SCENE_IDS = STYLES.filter((s): s is SceneId => s !== 'live');

export const styleName = (id: WidgetStyleId) => (id === 'live' ? LIVE.name : SCENES[id].name);
export const styleBlurb = (id: WidgetStyleId) => (id === 'live' ? LIVE.blurb : SCENES[id].blurb);
