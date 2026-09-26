import { kb } from '$lib/core/content/kb.svelte';
import { findDeck } from '$lib/core/content/cards';
import { generateQuestions, type GeneratedQuestion } from '$lib/core/content/questions';
import { QUESTION_TYPES, type Question, type QuestionType } from '$lib/core/content/schema';
import { hashString, mulberry32, sample, shuffle } from '$lib/core/utils/random';
import { todayKey } from '$lib/core/utils/format';
import { QUESTION_TYPE_INFO } from '$lib/components/questions/registry';
import { getMistakes } from './mistakes';

export interface QuizSpec {
  title: string;
  ref: string;
  questions: (Question | GeneratedQuestion)[];
  exam: boolean;
  fromMistakes?: boolean;
}

export async function buildQuiz(p: URLSearchParams): Promise<QuizSpec | null> {
  const src = p.get('src') ?? 'daily';
  const count = Math.max(3, Math.min(40, Number(p.get('count')) || 10));
  const exam = p.get('exam') === '1';
  const periods = p.get('periods')?.split(',').filter(Boolean);
  const types = p.get('types')?.split(',').filter((t): t is QuestionType => (QUESTION_TYPES as readonly string[]).includes(t));

  switch (src) {
    case 'daily': {
      const rng = mulberry32(hashString(`daily-${todayKey()}`));
      return { title: 'Тест дня', ref: `daily:${todayKey()}`, questions: generateQuestions({ count: 10, rng }), exam };
    }
    case 'gen': {
      const names = periods?.map((id) => kb.periodById.get(id)?.short).filter(Boolean);
      return {
        title: names?.length ? `Тест: ${names.join(', ')}` : 'Тест по всем эпохам',
        ref: `gen:${periods?.join(',') ?? 'all'}`,
        questions: generateQuestions({ count, periods, types }),
        exam,
      };
    }
    case 'type': {
      const t = (p.get('t') ?? 'single') as QuestionType;
      return { title: QUESTION_TYPE_INFO[t]?.title ?? 'Тренировка', ref: `type:${t}`, questions: generateQuestions({ count, types: [t], periods }), exam };
    }
    case 'pack': {
      const quiz = kb.quizzes.find((q) => q.id === p.get('id'));
      if (!quiz) return null;
      return { title: quiz.title, ref: `pack:${quiz.id}`, questions: p.get('shuffle') === '1' ? shuffle(quiz.questions) : quiz.questions, exam };
    }
    case 'deck': {
      const deck = findDeck(p.get('id') ?? '');
      if (!deck) return null;
      const cards = deck.cards();
      const cut = (s: string) => (s.length > 110 ? s.slice(0, 108) + '…' : s);
      const questions: Question[] = sample(cards, Math.min(count, cards.length)).map((c) => {
        const others = sample(cards.filter((x) => x.id !== c.id && x.back !== c.back), 3).map((x) => cut(x.back));
        const options = shuffle([cut(c.back), ...others]);
        return { type: 'single', prompt: c.front, options, answer: options.indexOf(cut(c.back)), explain: c.backSub ?? c.back };
      });
      return { title: `Тест: ${deck.title}`, ref: `deck:${deck.id}`, questions, exam };
    }
    case 'mistakes': {
      const list = await getMistakes();
      return { title: 'Работа над ошибками', ref: 'mistakes', questions: shuffle(list).slice(0, count), exam, fromMistakes: true };
    }
    default:
      return null;
  }
}
