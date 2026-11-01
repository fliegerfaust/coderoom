// Yjs поверх Db (SY.2, SY.3).
//   <base>/snap  — снимок документа {u: base64}
//   <base>/upd   — лог правок, ещё не вошедших в снимок {u: base64, c: clientID}
//   <base>/aw/<clientID> — состояние присутствия (имя, курсор)
// Правки Yjs идемпотентны: повтор или снимок поверх уже применённого ничего не портит.
// Порядок ключей лога НЕ используется: правка, набранная без сети, приходит с ключом из прошлого,
// поэтому новый вход применяет снимок и ВЕСЬ лог, а сжатие удаляет только те ключи, что уже вошли
// в документ сжимающего (иначе запоздавшая правка пропала бы при следующем входе).
import * as Y from 'yjs';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness';
import { fromBase64, toBase64 } from 'lib0/buffer';
import type { Db, Unsub } from './db';

const REMOTE = 'remote';
const COMPACT_AFTER = 150;
const FLUSH_MS = 40;
const AW_MS = 60;

export class YSync {
  private unsubs: Unsub[] = [];
  private pending: Uint8Array[] = [];
  private flushTimer = 0;
  private awTimer = 0;
  /** Ключи лога, уже применённые к документу и ещё лежащие в базе */
  private inLog = new Set<string>();
  private compacting = false;
  synced = false;

  constructor(private db: Db, private base: string, readonly doc: Y.Doc, readonly awareness: Awareness) {}

  async start() {
    const { doc, db, base } = this;
    const snap = (await db.get(`${base}/snap`)) as { u: string } | null;
    if (snap?.u) Y.applyUpdate(doc, fromBase64(snap.u), REMOTE);
    const log = ((await db.get(`${base}/upd`)) ?? {}) as Record<string, { u: string }>;
    for (const [k, v] of Object.entries(log)) this.applyLog(k, v);
    this.synced = true;

    // все дети лога, включая уже прочитанные: дубли отсекает inLog
    this.unsubs.push(db.onChildAdded(`${base}/upd`, (k, v) => {
      if (this.applyLog(k, v as { u?: string })) this.maybeCompact();
    }));
    // снимок мог смениться, пока мы читали лог: применяем его, он только добавляет
    this.unsubs.push(db.onValue(`${base}/snap`, (v) => {
      const u = (v as { u?: string } | null)?.u;
      if (u) Y.applyUpdate(doc, fromBase64(u), REMOTE);
    }));

    const onUpdate = (u: Uint8Array, origin: unknown) => {
      if (origin === REMOTE) return;
      this.pending.push(u);
      if (!this.flushTimer) this.flushTimer = self.setTimeout(() => this.flush(), FLUSH_MS);
    };
    doc.on('update', onUpdate);
    this.unsubs.push(() => doc.off('update', onUpdate));

    this.startAwareness();
  }

  private applyLog(k: string, v: { u?: string } | null): boolean {
    if (!v?.u || this.inLog.has(k)) return false;
    Y.applyUpdate(this.doc, fromBase64(v.u), REMOTE);
    this.inLog.add(k);
    return true;
  }

  private flush() {
    this.flushTimer = 0;
    if (!this.pending.length) return;
    const u = this.pending.length === 1 ? this.pending[0] : Y.mergeUpdates(this.pending);
    this.pending = [];
    void this.db.push(`${this.base}/upd`, { u: toBase64(u), c: this.doc.clientID });
  }

  /** Сжимает лог в снимок. Делает это один клиент — с наименьшим clientID среди присутствующих. */
  private maybeCompact() {
    if (this.compacting || this.inLog.size < COMPACT_AFTER) return;
    const ids = [...this.awareness.getStates().keys()];
    if (ids.length && Math.min(...ids) !== this.doc.clientID) return;
    this.compacting = true;
    void (async () => {
      try {
        // снимок, записанный кем-то ещё, сначала вливаем к себе — наш не должен его потерять
        const cur = (await this.db.get(`${this.base}/snap`)) as { u?: string } | null;
        if (cur?.u) Y.applyUpdate(this.doc, fromBase64(cur.u), REMOTE);
        const done = [...this.inLog];
        await this.db.set(`${this.base}/snap`, { u: toBase64(Y.encodeStateAsUpdate(this.doc)), at: Date.now() });
        const del: Record<string, null> = {};
        for (const k of done) del[k] = null;
        await this.db.update(`${this.base}/upd`, del);
        for (const k of done) this.inLog.delete(k);
      } finally { this.compacting = false; }
    })();
  }

  private startAwareness() {
    const { awareness: aw, db, base, doc } = this;
    const mine = `${base}/aw/${doc.clientID}`;
    db.removeOnDisconnect(mine);
    const write = () => {
      this.awTimer = 0;
      if (aw.getLocalState() === null) void db.set(mine, null);
      else void db.set(mine, { u: toBase64(encodeAwarenessUpdate(aw, [doc.clientID])), t: Date.now() });
    };
    const onAw = (_c: unknown, origin: unknown) => {
      if (origin === REMOTE) return;
      if (!this.awTimer) this.awTimer = self.setTimeout(write, AW_MS);
    };
    aw.on('update', onAw);
    this.unsubs.push(() => aw.off('update', onAw));
    write();

    this.unsubs.push(db.onValue(`${base}/aw`, (v) => {
      const all = (v ?? {}) as Record<string, { u: string }>;
      const present = new Set<number>();
      for (const [id, s] of Object.entries(all)) {
        const n = Number(id);
        if (n === doc.clientID || !s?.u) continue;
        present.add(n);
        try { applyAwarenessUpdate(aw, fromBase64(s.u), REMOTE); } catch { /* битая запись */ }
      }
      const gone = [...aw.getStates().keys()].filter((id) => id !== doc.clientID && !present.has(id));
      if (gone.length) removeAwarenessStates(aw, gone, REMOTE);
    }));

    const bye = () => { void db.set(mine, null); };
    addEventListener('pagehide', bye);
    this.unsubs.push(() => removeEventListener('pagehide', bye));
  }

  destroy() {
    this.flush();
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    void this.db.set(`${this.base}/aw/${this.doc.clientID}`, null);
  }
}
