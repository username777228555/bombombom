/** «Ордена» — achievements themed after orders of the Russian Empire (stylised, not replicas). */
export interface Stats {
  streak: number;
  bestStreak: number;
  xpTotal: number;
  reviews: number;
  quizzes: number;
  perfectQuizzes: number;
  games: number;
  chronologyBest: number;
  books: number;
  readHours: number;
  highlights: number;
  rankIndex: number;
  activeDays: number;
}

export type OrderShape = 'cross' | 'star' | 'medal' | 'eagle';

export interface OrderDef {
  id: string;
  title: string;
  degree?: string;
  description: string;
  shape: OrderShape;
  /** Ribbon stripes from edge to centre. */
  ribbon: string[];
  enamel: string;
  test: (s: Stats) => boolean;
  progress: (s: Stats) => [number, number];
}

const STANISLAV = ['#c8102e', '#ffffff', '#c8102e'];
const ANNA = ['#f2c230', '#c8102e', '#c8102e'];
const VLADIMIR = ['#111111', '#b22222', '#b22222'];
const GEORGE = ['#111111', '#f08a24', '#111111', '#f08a24'];
const EAGLE = ['#1c3f94'];
const NEVSKY = ['#c8102e'];
const ANDREW = ['#3d8fd6'];

export const ORDERS: OrderDef[] = [
  { id: 'zeal', title: 'Медаль «За усердие»', description: 'Получить первые очки опыта', shape: 'medal', ribbon: ANNA, enamel: '#c9a14a', test: (s) => s.xpTotal > 0, progress: (s) => [Math.min(s.xpTotal, 1), 1] },
  { id: 'stanislav-3', title: 'Орден Св. Станислава', degree: 'III степени', description: 'Заниматься 3 дня подряд', shape: 'cross', ribbon: STANISLAV, enamel: '#c8102e', test: (s) => s.bestStreak >= 3, progress: (s) => [Math.min(s.bestStreak, 3), 3] },
  { id: 'stanislav-2', title: 'Орден Св. Станислава', degree: 'II степени', description: 'Заниматься 7 дней подряд', shape: 'cross', ribbon: STANISLAV, enamel: '#c8102e', test: (s) => s.bestStreak >= 7, progress: (s) => [Math.min(s.bestStreak, 7), 7] },
  { id: 'stanislav-1', title: 'Орден Св. Станислава', degree: 'I степени', description: 'Заниматься 30 дней подряд', shape: 'star', ribbon: STANISLAV, enamel: '#c8102e', test: (s) => s.bestStreak >= 30, progress: (s) => [Math.min(s.bestStreak, 30), 30] },
  { id: 'anna-3', title: 'Орден Св. Анны', degree: 'III степени', description: 'Повторить 100 карточек', shape: 'cross', ribbon: ANNA, enamel: '#c8102e', test: (s) => s.reviews >= 100, progress: (s) => [Math.min(s.reviews, 100), 100] },
  { id: 'anna-2', title: 'Орден Св. Анны', degree: 'II степени', description: 'Повторить 1000 карточек', shape: 'cross', ribbon: ANNA, enamel: '#c8102e', test: (s) => s.reviews >= 1000, progress: (s) => [Math.min(s.reviews, 1000), 1000] },
  { id: 'anna-1', title: 'Орден Св. Анны', degree: 'I степени', description: 'Повторить 5000 карточек', shape: 'star', ribbon: ANNA, enamel: '#c8102e', test: (s) => s.reviews >= 5000, progress: (s) => [Math.min(s.reviews, 5000), 5000] },
  { id: 'vladimir-4', title: 'Орден Св. Владимира', degree: 'IV степени', description: 'Пройти тест без единой ошибки', shape: 'cross', ribbon: VLADIMIR, enamel: '#b22222', test: (s) => s.perfectQuizzes >= 1, progress: (s) => [Math.min(s.perfectQuizzes, 1), 1] },
  { id: 'vladimir-3', title: 'Орден Св. Владимира', degree: 'III степени', description: 'Пройти 25 тестов', shape: 'cross', ribbon: VLADIMIR, enamel: '#b22222', test: (s) => s.quizzes >= 25, progress: (s) => [Math.min(s.quizzes, 25), 25] },
  { id: 'vladimir-2', title: 'Орден Св. Владимира', degree: 'II степени', description: 'Пройти 10 тестов без ошибок', shape: 'star', ribbon: VLADIMIR, enamel: '#b22222', test: (s) => s.perfectQuizzes >= 10, progress: (s) => [Math.min(s.perfectQuizzes, 10), 10] },
  { id: 'george-4', title: 'Орден Св. Георгия', degree: 'IV степени', description: 'Выложить 12 карточек подряд в «Хронологии»', shape: 'cross', ribbon: GEORGE, enamel: '#fdfdfd', test: (s) => s.chronologyBest >= 12, progress: (s) => [Math.min(s.chronologyBest, 12), 12] },
  { id: 'george-3', title: 'Орден Св. Георгия', degree: 'III степени', description: 'Сыграть 30 игр', shape: 'cross', ribbon: GEORGE, enamel: '#fdfdfd', test: (s) => s.games >= 30, progress: (s) => [Math.min(s.games, 30), 30] },
  { id: 'enlightenment', title: 'Медаль «За просвещение»', description: 'Добавить книгу в библиотеку', shape: 'medal', ribbon: VLADIMIR, enamel: '#c9a14a', test: (s) => s.books >= 1, progress: (s) => [Math.min(s.books, 1), 1] },
  { id: 'white-eagle', title: 'Орден Белого орла', description: 'Провести за чтением 10 часов', shape: 'eagle', ribbon: EAGLE, enamel: '#f4f4f4', test: (s) => s.readHours >= 10, progress: (s) => [Math.min(Math.floor(s.readHours), 10), 10] },
  { id: 'nevsky', title: 'Орден Св. Александра Невского', description: 'Дослужиться до статского советника', shape: 'cross', ribbon: NEVSKY, enamel: '#c8102e', test: (s) => s.rankIndex >= 7, progress: (s) => [Math.min(s.rankIndex, 7), 7] },
  { id: 'andrew', title: 'Орден Св. Андрея Первозванного', description: 'Дослужиться до канцлера', shape: 'star', ribbon: ANDREW, enamel: '#3d8fd6', test: (s) => s.rankIndex >= 11, progress: (s) => [Math.min(s.rankIndex, 11), 11] },
];

/** Civil ranks of the Table of Ranks (classes XIII and XI were out of use by the XIX century). */
export const RANKS = [
  { cls: 14, title: 'Коллежский регистратор', xp: 0 },
  { cls: 12, title: 'Губернский секретарь', xp: 150 },
  { cls: 10, title: 'Коллежский секретарь', xp: 400 },
  { cls: 9, title: 'Титулярный советник', xp: 800 },
  { cls: 8, title: 'Коллежский асессор', xp: 1400 },
  { cls: 7, title: 'Надворный советник', xp: 2200 },
  { cls: 6, title: 'Коллежский советник', xp: 3300 },
  { cls: 5, title: 'Статский советник', xp: 4800 },
  { cls: 4, title: 'Действительный статский советник', xp: 6800 },
  { cls: 3, title: 'Тайный советник', xp: 9500 },
  { cls: 2, title: 'Действительный тайный советник', xp: 13000 },
  { cls: 1, title: 'Канцлер', xp: 18000 },
] as const;

export const rankIndexFor = (xp: number) => RANKS.reduce((acc, r, i) => (xp >= r.xp ? i : acc), 0);
