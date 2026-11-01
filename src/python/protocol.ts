// Сообщения между страницей и воркером Python.

export interface RunFile { name: string; url: string }

export type ToWorker =
  | { t: 'init'; indexURL: string }
  | { t: 'run'; id: string; code: string; stdin: string; files: RunFile[] };

export type FromWorker =
  | { t: 'ready'; ms: number }
  | { t: 'out'; id: string; s: string }
  | { t: 'err'; id: string; s: string }
  | { t: 'done'; id: string; ms: number }
  | { t: 'exc'; id: string; raw: string; ms: number }
  | { t: 'fatal'; s: string };
