// Управление воркером Python со страницы: загрузка, запуск, вывод потоком, стоп (PY.1–PY.5).
import type { FromWorker, RunFile, ToWorker, TurtleDraw } from './protocol';
import { parsePythonError, type FriendlyError } from './errors';

export type RunnerState = 'loading' | 'ready' | 'running' | 'failed';

export interface RunHandlers {
  onOut(s: string, stream: 'out' | 'err'): void;
  onDraw?(d: TurtleDraw): void;
  onDone(r: { ok: true; ms: number } | { ok: false; ms: number; error: FriendlyError } | { ok: false; stopped: true; ms: number }): void;
}

export class PythonRunner {
  private worker: Worker | null = null;
  private runId = '';
  private handlers: RunHandlers | null = null;
  private t0 = 0;
  state: RunnerState = 'loading';
  loadMs = 0;
  private listeners = new Set<(s: RunnerState) => void>();

  constructor(private indexURL: string) { this.spawn(); }

  onState(fn: (s: RunnerState) => void) { this.listeners.add(fn); fn(this.state); return () => this.listeners.delete(fn); }
  private set(s: RunnerState) { this.state = s; this.listeners.forEach((f) => f(s)); }

  private spawn() {
    this.worker?.terminate();
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.worker = w;
    this.set('loading');
    w.onmessage = (ev: MessageEvent<FromWorker>) => this.onMessage(ev.data);
    w.onerror = (e) => { console.error('python worker', e); this.set('failed'); };
    w.postMessage({ t: 'init', indexURL: this.indexURL } satisfies ToWorker);
  }

  private onMessage(m: FromWorker) {
    if (m.t === 'ready') { this.loadMs = m.ms; if (this.state === 'loading') this.set('ready'); return; }
    if (m.t === 'fatal') { console.error(m.s); this.set('failed'); return; }
    if (m.id !== this.runId || !this.handlers) return;
    if (m.t === 'out' || m.t === 'err') this.handlers.onOut(m.s, m.t);
    else if (m.t === 'draw') this.handlers.onDraw?.(m.d);
    else if (m.t === 'done') this.finish({ ok: true, ms: m.ms });
    else if (m.t === 'exc') this.finish({ ok: false, ms: m.ms, error: parsePythonError(m.raw) });
  }

  private finish(r: Parameters<RunHandlers['onDone']>[0]) {
    const h = this.handlers;
    this.handlers = null;
    this.runId = '';
    if (this.state === 'running') this.set('ready');
    h?.onDone(r);
  }

  get busy() { return this.state === 'running'; }

  /** Запуск; пока Python грузится, задача ждёт в очереди воркера. */
  run(code: string, stdin: string, files: RunFile[], handlers: RunHandlers): string {
    if (this.busy) this.stop();
    this.runId = Math.random().toString(36).slice(2, 10);
    this.handlers = handlers;
    this.t0 = performance.now();
    this.set('running');
    this.worker!.postMessage({ t: 'run', id: this.runId, code, stdin, files } satisfies ToWorker);
    return this.runId;
  }

  /** Стоп: воркер убиваем и сразу поднимаем новый, комната продолжает работать. */
  stop() {
    if (!this.handlers) return;
    const ms = Math.round(performance.now() - this.t0);
    const h = this.handlers;
    this.handlers = null;
    this.runId = '';
    this.spawn();
    h.onDone({ ok: false, stopped: true, ms });
  }
}
