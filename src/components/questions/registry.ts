/** Question-type registry: add a new type = schema entry + a component here. */
import type { Component } from 'svelte';
import type { QuestionType } from '$lib/core/content/schema';
import QSingle from './QSingle.svelte';
import QMultiple from './QMultiple.svelte';
import QOrder from './QOrder.svelte';
import QMatch from './QMatch.svelte';
import QYear from './QYear.svelte';
import QText from './QText.svelte';
import QHints from './QHints.svelte';
import QErrors from './QErrors.svelte';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const QUESTION_COMPONENTS: Record<QuestionType, Component<any>> = {
  single: QSingle,
  multiple: QMultiple,
  order: QOrder,
  match: QMatch,
  year: QYear,
  text: QText,
  hints: QHints,
  errors: QErrors,
};

export const QUESTION_TYPE_INFO: Record<QuestionType, { title: string; description: string }> = {
  single: { title: 'Один ответ', description: 'Классический выбор из вариантов' },
  multiple: { title: 'Несколько ответов', description: 'Выберите все верные варианты' },
  order: { title: 'Хронология', description: 'Расставьте события по порядку' },
  match: { title: 'Соответствие', description: 'Соедините пары: события, даты, деятели' },
  year: { title: 'Точная дата', description: 'Введите год события' },
  text: { title: 'Термин', description: 'Назовите понятие по определению' },
  hints: { title: 'По подсказкам', description: 'Узнайте деятеля за минимум подсказок' },
  errors: { title: 'Найди ошибки', description: 'Отметьте неверные факты в тексте' },
};
