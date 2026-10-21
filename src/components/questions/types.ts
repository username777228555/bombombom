import type { Question } from '$lib/core/content/schema';

/** Contract of every question component: render, collect the answer, report a score 0..1. */
export interface QuestionProps<Q extends Question = Question> {
  q: Q;
  /** After checking: show correct answers and lock input. */
  revealed: boolean;
  /** Called when the user presses «Проверить»; `given` — the answer in words, for «Почему я ошибся?» (core/ai.svelte.ts). */
  onsubmit: (score: number, given?: string) => void;
}
