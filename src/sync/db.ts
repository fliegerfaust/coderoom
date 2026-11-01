// Минимальный интерфейс базы, который нужен комнате (SY.1).
// Две реализации: Firebase Realtime Database и локальная (вкладки одного браузера).
// Логика комнаты не знает, какая под ней.

export type Unsub = () => void;

export interface Db {
  readonly kind: 'firebase' | 'local';
  get(path: string): Promise<unknown>;
  set(path: string, value: unknown): Promise<void>;
  /** Несколько детей сразу; null удаляет ребёнка. */
  update(path: string, values: Record<string, unknown>): Promise<void>;
  /** Новый ребёнок с ключом по времени, ключи сортируются в порядке добавления. */
  push(path: string, value: unknown): Promise<string>;
  onValue(path: string, cb: (value: unknown) => void): Unsub;
  /** Дети по порядку ключей; startAfter — пропустить ключи ≤ данного. */
  onChildAdded(path: string, cb: (key: string, value: unknown) => void, startAfter?: string | null): Unsub;
  /** Удалить путь, когда этот клиент отключится (закрыл вкладку, пропала сеть). */
  removeOnDisconnect(path: string): void;
  onConnected(cb: (online: boolean) => void): Unsub;
}

// Ключи как у Firebase push(): 8 символов времени + 12 случайных, лексикографически по времени.
const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
let lastPushTime = 0;
let lastRand: number[] = [];
export function pushKey(now = Date.now()): string {
  const dup = now === lastPushTime;
  lastPushTime = now;
  const ts = new Array(8);
  for (let i = 7; i >= 0; i--) { ts[i] = PUSH_CHARS.charAt(now % 64); now = Math.floor(now / 64); }
  let id = ts.join('');
  if (!dup) lastRand = Array.from({ length: 12 }, () => Math.floor(Math.random() * 64));
  else {
    let i = 11;
    for (; i >= 0 && lastRand[i] === 63; i--) lastRand[i] = 0;
    if (i >= 0) lastRand[i]++;
  }
  for (const r of lastRand) id += PUSH_CHARS.charAt(r);
  return id;
}
