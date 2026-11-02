// Сообщения между страницей и воркером Python.

export interface RunFile { name: string; url: string }

export type ToWorker =
  | { t: 'init'; indexURL: string }
  | { t: 'run'; id: string; code: string; stdin: string; files: RunFile[] };

/** Запись Черепахи: отрезки [x1,y1,x2,y2,цвет,толщина], точки [x,y,размер,цвет], заливки [[точки], цвет] */
export interface TurtleDraw {
  segs: number[][]; dots: number[][]; fills: Array<[number[][], number]>; colors: string[]; cut: boolean;
  turtle: [number, number, number, boolean];
}

export type FromWorker =
  | { t: 'ready'; ms: number }
  | { t: 'out'; id: string; s: string }
  | { t: 'err'; id: string; s: string }
  | { t: 'draw'; id: string; d: TurtleDraw }
  | { t: 'done'; id: string; ms: number }
  | { t: 'exc'; id: string; raw: string; ms: number }
  | { t: 'fatal'; s: string };
