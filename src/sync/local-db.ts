// Локальная «база» для разработки и e2e: дерево в localStorage, изменения между вкладками —
// через BroadcastChannel. Повторяет поведение Firebase ровно настолько, насколько нужно комнате.
import { pushKey, type Db, type Unsub } from './db';

type Tree = Record<string, unknown>;
const STORE = 'coderoom-local-db';
const split = (p: string) => p.split('/').filter(Boolean);

function getAt(tree: Tree, path: string): unknown {
  let cur: unknown = tree;
  for (const k of split(path)) {
    if (cur === null || typeof cur !== 'object') return null;
    cur = (cur as Tree)[k];
  }
  return cur === undefined ? null : cur;
}

function setAt(tree: Tree, path: string, value: unknown) {
  const ks = split(path);
  let cur = tree;
  for (let i = 0; i < ks.length - 1; i++) {
    const nx = cur[ks[i]];
    if (nx === null || typeof nx !== 'object') cur[ks[i]] = {};
    cur = cur[ks[i]] as Tree;
  }
  const last = ks[ks.length - 1];
  if (value === null || value === undefined) delete cur[last];
  else cur[last] = JSON.parse(JSON.stringify(value));
}

type Op = { op: 'set'; path: string; value: unknown } | { op: 'update'; path: string; values: Record<string, unknown> };

export class LocalDb implements Db {
  readonly kind = 'local' as const;
  private tree: Tree;
  private ch = new BroadcastChannel('coderoom-local-db');
  private valueSubs = new Set<{ path: string; cb: (v: unknown) => void; last: string }>();
  private childSubs = new Set<{ path: string; cb: (k: string, v: unknown) => void; seen: Set<string>; after: string | null }>();
  private onLeave: string[] = [];

  constructor() {
    try { this.tree = JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { this.tree = {}; }
    this.ch.onmessage = (ev: MessageEvent<Op>) => this.apply(ev.data, false);
    addEventListener('pagehide', () => { for (const p of this.onLeave) this.write({ op: 'set', path: p, value: null }); });
  }

  private apply(op: Op, local: boolean) {
    if (op.op === 'set') setAt(this.tree, op.path, op.value);
    else for (const [k, v] of Object.entries(op.values)) setAt(this.tree, op.path + '/' + k, v);
    if (local) {
      try { localStorage.setItem(STORE, JSON.stringify(this.tree)); } catch { /* квота */ }
      this.ch.postMessage(op);
    }
    queueMicrotask(() => this.notify());
  }
  private write(op: Op) { this.apply(op, true); }

  private notify() {
    for (const s of this.valueSubs) {
      const v = getAt(this.tree, s.path);
      const j = JSON.stringify(v);
      if (j !== s.last) { s.last = j; s.cb(v === null ? null : JSON.parse(j)); }
    }
    for (const s of this.childSubs) this.emitChildren(s);
  }
  private emitChildren(s: { path: string; cb: (k: string, v: unknown) => void; seen: Set<string>; after: string | null }) {
    const v = getAt(this.tree, s.path);
    if (!v || typeof v !== 'object') return;
    for (const k of Object.keys(v as Tree).sort()) {
      if (s.seen.has(k) || (s.after && k <= s.after)) continue;
      s.seen.add(k);
      s.cb(k, (v as Tree)[k]);
    }
  }

  async get(path: string) { const v = getAt(this.tree, path); return v === null ? null : JSON.parse(JSON.stringify(v)); }
  async set(path: string, value: unknown) { this.write({ op: 'set', path, value }); }
  async update(path: string, values: Record<string, unknown>) { this.write({ op: 'update', path, values }); }
  async push(path: string, value: unknown) { const k = pushKey(); this.write({ op: 'set', path: path + '/' + k, value }); return k; }

  onValue(path: string, cb: (v: unknown) => void): Unsub {
    const s = { path, cb, last: '\u0000' };
    this.valueSubs.add(s);
    queueMicrotask(() => this.notify());
    return () => this.valueSubs.delete(s);
  }
  onChildAdded(path: string, cb: (k: string, v: unknown) => void, startAfter: string | null = null): Unsub {
    const s = { path, cb, seen: new Set<string>(), after: startAfter };
    this.childSubs.add(s);
    queueMicrotask(() => this.emitChildren(s));
    return () => this.childSubs.delete(s);
  }
  removeOnDisconnect(path: string) { this.onLeave.push(path); }
  onConnected(cb: (online: boolean) => void): Unsub { queueMicrotask(() => cb(true)); return () => {}; }
}
