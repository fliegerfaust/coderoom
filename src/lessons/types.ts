// Формат задач на сайте (LS.1). Ответов и разборов здесь нет: сайт публичный.

export type TaskKind = 'predict' | 'bug' | 'make' | 'ege' | 'free';

export interface LessonTask {
  /** Уникален внутри занятия: «a1-3», «e10-b4» */
  id: string;
  /** Короткая метка на списке: «А1 · 3», «№10 · Б4» */
  label: string;
  kind: TaskKind;
  /** «Предскажи вывод», «Маска · адрес сети» */
  topic: string;
  /** Номер ЕГЭ, если это задача ЕГЭ */
  ege?: string;
  /** Уровень 1–4 */
  level?: number;
  /** Markdown: `код`, ```python```, $формулы$, таблицы */
  statement: string;
  /** Общее вступление к задаче (определения), сворачивается */
  intro?: string;
  image?: string;
  files?: Array<{ name: string; url: string }>;
  /** Что вставляется в редактор при первом открытии */
  starter: string;
}

export interface LessonGroup { id: string; title: string; tasks: LessonTask[] }

export interface Lesson {
  id: string;            // «01»
  title: string;         // «Занятие 01 · А1 Переменные, print и арифметика + №10»
  short: string;         // «Занятие 01»
  groups: LessonGroup[];
}

export interface LessonIndexItem { id: string; title: string; short: string; file: string }

export const FREE_TASK: LessonTask = {
  id: 'free', label: 'Лист', kind: 'free', topic: 'Свободный лист',
  statement: 'Чистый лист: пиши любой код и запускай.', starter: '',
};

export async function loadIndex(base = ''): Promise<LessonIndexItem[]> {
  const r = await fetch(`${base}lessons/index.json`, { cache: 'no-cache' });
  return r.ok ? r.json() : [];
}

export async function loadLesson(item: LessonIndexItem, base = ''): Promise<Lesson> {
  const r = await fetch(`${base}lessons/${item.file}`, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`Не загрузилось занятие ${item.id}`);
  return r.json();
}

export function findTask(lesson: Lesson | null, id: string): LessonTask | null {
  if (id === 'free') return FREE_TASK;
  for (const g of lesson?.groups ?? []) for (const t of g.tasks) if (t.id === id) return t;
  return null;
}
