// Firebase Realtime Database за интерфейсом Db (SY.2).
import { initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  getDatabase, ref, get, set, update, push, onValue, onChildAdded, onDisconnect,
  query, orderByKey, startAfter as startAfterKey, type Database,
} from 'firebase/database';
import type { Db, Unsub } from './db';

export class FirebaseDb implements Db {
  readonly kind = 'firebase' as const;
  private db: Database;
  constructor(config: FirebaseOptions) {
    this.db = getDatabase(initializeApp(config));
  }
  async get(path: string) { return (await get(ref(this.db, path))).val(); }
  async set(path: string, value: unknown) { await set(ref(this.db, path), value); }
  async update(path: string, values: Record<string, unknown>) { await update(ref(this.db, path), values); }
  async push(path: string, value: unknown) {
    const r = push(ref(this.db, path));
    await set(r, value);
    return r.key!;
  }
  onValue(path: string, cb: (v: unknown) => void): Unsub {
    return onValue(ref(this.db, path), (s) => cb(s.val()));
  }
  onChildAdded(path: string, cb: (k: string, v: unknown) => void, after: string | null = null): Unsub {
    const q = after ? query(ref(this.db, path), orderByKey(), startAfterKey(after)) : query(ref(this.db, path), orderByKey());
    return onChildAdded(q, (s) => cb(s.key!, s.val()));
  }
  removeOnDisconnect(path: string) { void onDisconnect(ref(this.db, path)).remove(); }
  onConnected(cb: (online: boolean) => void): Unsub {
    return onValue(ref(this.db, '.info/connected'), (s) => cb(!!s.val()));
  }
}
