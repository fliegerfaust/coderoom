// Модель комнаты: общий документ, текущая задача, код и ввод по задачам, общий запуск (SY.4, SY.5).
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import type { Db, Unsub } from '../sync/db';
import { YSync } from '../sync/ysync';
import type { Me } from './access';
import { PythonRunner } from '../python/runner';
import type { FriendlyError } from '../python/errors';
import type { LessonTask } from '../lessons/types';

export const OUT_LIMIT = 40_000;
const OUT_FLUSH_MS = 120;

export type RunStatus = 'running' | 'done' | 'error' | 'stopped';
export interface RunState {
  id: string;
  by: string;         // Me.id
  name: string;       // кто запустил
  task: string;
  status: RunStatus;
  out: string;
  cut?: boolean;      // начало вывода обрезано
  at: number;
  ms?: number;
  error?: FriendlyError;
  stop?: string;      // id запуска, который просят остановить
}

export interface Peer { clientId: number; id: string; name: string; color: string; teacher: boolean; task?: string }

export class Room {
  readonly doc = new Y.Doc();
  readonly awareness = new Awareness(this.doc);
  readonly meta = this.doc.getMap<unknown>('room');
  /** clientID → автор: для полоски авторства строк */
  readonly clients = this.doc.getMap<{ name: string; color: string }>('clients');
  private inited = this.doc.getMap<boolean>('inited');
  private sync: YSync;
  private unsubs: Unsub[] = [];
  run: RunState | null = null;
  private runListeners = new Set<(r: RunState | null) => void>();
  private outBuf = '';
  private outCut = false;
  private outTimer = 0;
  private myRun = '';

  constructor(readonly db: Db, readonly base: string, readonly me: Me, readonly teacher: boolean, readonly runner: PythonRunner) {
    this.sync = new YSync(db, base, this.doc, this.awareness);
  }

  static async exists(db: Db, base: string) { return !!(await db.get(`${base}/created`)); }
  static async create(db: Db, base: string, by: Me, lesson: string) {
    await db.set(`${base}/created`, { at: Date.now(), by: by.name, lesson });
  }

  async start() {
    await this.sync.start();
    const mine = this.clients.get(String(this.doc.clientID));
    if (!mine || mine.name !== this.me.name) this.clients.set(String(this.doc.clientID), { name: this.me.name, color: this.me.color });
    this.awareness.setLocalStateField('user', { id: this.me.id, name: this.me.name, color: this.me.color, colorLight: this.me.color + '33', teacher: this.teacher });
    this.unsubs.push(this.db.onValue(`${this.base}/run`, (v) => {
      this.run = (v as RunState | null) ?? null;
      if (this.run?.stop && this.run.stop === this.myRun) this.runner.stop();
      this.runListeners.forEach((f) => f(this.run));
    }));
  }

  // ── задача ──────────────────────────────────────────────
  get lessonId(): string | null { return (this.meta.get('lesson') as string) ?? null; }
  get taskId(): string | null { return (this.meta.get('task') as string) ?? null; }
  code(taskId: string) { return this.doc.getText('code:' + taskId); }
  stdin(taskId: string) { return this.doc.getText('stdin:' + taskId); }

  /** Открыть задачу у обоих. Заготовку вставляет тот, кто открыл задачу первым (ED.3). */
  openTask(task: LessonTask, lessonId: string | null) {
    this.doc.transact(() => {
      if (lessonId && this.meta.get('lesson') !== lessonId) this.meta.set('lesson', lessonId);
      this.meta.set('task', task.id);
      const key = `${lessonId ?? '-'}:${task.id}`;
      const text = this.code(task.id);
      if (!this.inited.get(key)) {
        if (text.length === 0 && task.starter) text.insert(0, task.starter);
        this.inited.set(key, true);
      }
    });
    this.awareness.setLocalStateField('task', task.id);
  }

  resetToStarter(task: LessonTask) {
    const t = this.code(task.id);
    this.doc.transact(() => { t.delete(0, t.length); if (task.starter) t.insert(0, task.starter); });
  }

  onMeta(fn: () => void): Unsub { const h = () => fn(); this.meta.observe(h); return () => this.meta.unobserve(h); }

  peers(): Peer[] {
    const out: Peer[] = [];
    this.awareness.getStates().forEach((s, clientId) => {
      const u = s.user as { id: string; name: string; color: string; teacher: boolean } | undefined;
      if (u) out.push({ clientId, ...u, task: s.task as string | undefined });
    });
    // один человек в двух вкладках — одна точка
    const seen = new Set<string>();
    return out.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
  }
  onPeers(fn: (p: Peer[]) => void): Unsub {
    const h = () => fn(this.peers());
    this.awareness.on('change', h);
    queueMicrotask(h);
    return () => this.awareness.off('change', h);
  }

  // ── общий запуск ────────────────────────────────────────
  onRun(fn: (r: RunState | null) => void): Unsub { this.runListeners.add(fn); fn(this.run); return () => this.runListeners.delete(fn); }

  async runTask(task: LessonTask, lessonId: string | null = null) {
    const code = this.code(task.id).toString();
    const stdin = this.stdin(task.id).toString();
    this.outBuf = ''; this.outCut = false;
    const id = this.runner.run(code, stdin, task.files ?? [], {
      onOut: (s) => {
        this.outBuf += s;
        if (this.outBuf.length > OUT_LIMIT) { this.outBuf = this.outBuf.slice(-OUT_LIMIT); this.outCut = true; }
        if (!this.outTimer) this.outTimer = self.setTimeout(() => this.flushOut(), OUT_FLUSH_MS);
      },
      onDone: (r) => {
        clearTimeout(this.outTimer); this.outTimer = 0;
        const st: RunStatus = r.ok ? 'done' : 'stopped' in r ? 'stopped' : 'error';
        const patch: Partial<RunState> = { status: st, out: this.outBuf, cut: this.outCut, ms: r.ms };
        if (!r.ok && 'error' in r) patch.error = r.error;
        if (this.run && this.run.id === id) void this.db.set(`${this.base}/run`, { ...this.run, ...patch, stop: null });
        this.doc.getMap('ran').set(`${lessonId ?? '-'}:${task.id}`, { status: st, by: this.me.name, at: Date.now() });
        this.myRun = '';
      },
    });
    this.myRun = id;
    const st: RunState = { id, by: this.me.id, name: this.me.name, task: task.id, status: 'running', out: '', at: Date.now() };
    this.run = st;
    await this.db.set(`${this.base}/run`, st);
  }

  private flushOut() {
    this.outTimer = 0;
    if (!this.myRun) return;
    void this.db.update(`${this.base}/run`, { out: this.outBuf, cut: this.outCut });
  }

  /** «Стоп» работает с обеих сторон: у запустившего — сразу, у другого — просьбой через базу. */
  stop() {
    if (!this.run || this.run.status !== 'running') return;
    if (this.run.id === this.myRun) this.runner.stop();
    else void this.db.update(`${this.base}/run`, { stop: this.run.id });
  }

  destroy() {
    this.unsubs.forEach((u) => u());
    this.sync.destroy();
  }
}
