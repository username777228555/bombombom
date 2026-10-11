import { kb } from '$lib/core/content/kb.svelte';
import { findDeck } from '$lib/core/content/cards';
import { DRILLS, generateQuestions, type DrillId, type GeneratedQuestion } from '$lib/core/content/questions';
import { QUESTION_TYPES, type Question, type QuestionType } from '$lib/core/content/schema';
import { hashString, mulberry32, sample, shuffle } from '$lib/core/utils/random';
import { todayKey } from '$lib/core/utils/format';
import { QUESTION_TYPE_INFO } from '$lib/components/questions/registry';
import { getDueMistakes } from './mistakes';
import { SKILLS, skillOf, type Skill } from '$lib/core/mastery';

export interface QuizSpec {
  title: string;
  ref: string;
  questions: (Question | GeneratedQuestion)[];
  exam: boolean;
  fromMistakes?: boolean;
  /** Period of a pack quiz: answers to its questions count for this period on the «Карта знаний». */
  period?: string;
}

/** Training a skill: generated questions mixed with the packs' own questions of that skill and period (open answers, sources). */
function withPackQuestions(gen: GeneratedQuestion[], count: number, periods: string[] | undefined, skills: Skill[]): (Question | GeneratedQuestion)[] {
  const own = kb.quizzes
    .filter((q) => !periods?.length || (q.period && periods.includes(q.period)))
    .flatMap((q) => q.questions.map((x) => ({ ...x, period: q.period })))
    .filter((x) => { const s = skillOf(x); return !!s && skills.includes(s); });
  const take = Math.min(own.length, Math.max(count - gen.length, Math.round(count / 3)));
  return shuffle([...gen.slice(0, count - take), ...sample(own, take)]);
}

export async function buildQuiz(p: URLSearchParams): Promise<QuizSpec | null> {
  const src = p.get('src') ?? 'daily';
  const count = Math.max(3, Math.min(40, Number(p.get('count')) || 10));
  const exam = p.get('exam') === '1';
  const periods = p.get('periods')?.split(',').filter(Boolean);
  const types = p.get('types')?.split(',').filter((t): t is QuestionType => (QUESTION_TYPES as readonly string[]).includes(t));
  const skills = p.get('skills')?.split(',').filter((t): t is Skill => (SKILLS as readonly string[]).includes(t));

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
        questions: skills?.length ? withPackQuestions(generateQuestions({ count, periods, types, skills }), count, periods, skills) : generateQuestions({ count, periods, types }),
        exam,
      };
    }
    case 'drill': {
      const id = p.get('d') ?? '';
      const d = id in DRILLS ? DRILLS[id as DrillId] : null;
      if (!d) return null;
      return { title: d.title, ref: `drill:${id}`, questions: generateQuestions({ count, periods, gens: d.gens }), exam };
    }
    case 'type': {
      const t = (p.get('t') ?? 'single') as QuestionType;
      return { title: QUESTION_TYPE_INFO[t]?.title ?? 'Тренировка', ref: `type:${t}`, questions: generateQuestions({ count, types: [t], periods }), exam };
    }
    case 'pack': {
      const quiz = kb.quizzes.find((q) => q.id === p.get('id'));
      if (!quiz) return null;
      return { title: quiz.title, ref: `pack:${quiz.id}`, questions: p.get('shuffle') === '1' ? shuffle(quiz.questions) : quiz.questions, exam, period: quiz.period };
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
    case 'variant': {
      // «Олимпиадный вариант»: like a real paper — a test part and extended answers, from the packs' own quizzes.
      const pool = kb.quizzes.filter((q) => !periods?.length || (q.period && periods.includes(q.period))).flatMap((q) => q.questions);
      const short = sample(pool.filter((q) => q.type !== 'open'), 12);
      const open = sample(pool.filter((q) => q.type === 'open'), 4);
      if (!short.length && !open.length) return null;
      const names = periods?.map((id) => kb.periodById.get(id)?.short).filter(Boolean);
      return {
        title: names?.length ? `Олимпиадный вариант: ${names.join(', ')}` : 'Олимпиадный вариант',
        ref: `variant:${periods?.join(',') ?? 'all'}`,
        questions: [...short, ...open],
        exam: p.get('exam') !== '0',
      };
    }
    case 'mistakes': {
      const list = await getDueMistakes();
      return { title: 'Работа над ошибками', ref: 'mistakes', questions: shuffle(list).slice(0, count), exam, fromMistakes: true };
    }
    default:
      return null;
  }
}
