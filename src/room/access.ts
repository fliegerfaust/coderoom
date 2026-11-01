// Вход без аккаунтов: комната + PIN → путь в базе (RM.1, RM.3).

export async function sha256hex(s: string): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** rooms/<64 hex>: без PIN путь не узнать, а правила базы не дают перечислить комнаты. */
export async function roomPath(room: string, pin: string): Promise<string> {
  return 'rooms/' + (await sha256hex(`coderoom:${room.trim()}:${pin.trim()}`));
}

const ALPH = 'abcdefghijkmnpqrstuvwxyz23456789';
export function newRoomId(len = 10): string {
  const b = crypto.getRandomValues(new Uint8Array(len));
  return [...b].map((x) => ALPH[x % ALPH.length]).join('');
}
export function newPin(): string {
  const b = crypto.getRandomValues(new Uint32Array(1))[0];
  return String(b % 10000).padStart(4, '0');
}

export interface Me { id: string; name: string; color: string }
export interface SavedRoom { room: string; pin: string; teacher: boolean; title?: string; at: number }

const ME = 'coderoom-me';
const ROOMS = 'coderoom-rooms';
// фиолет — преподаватель, зелёный — ученик; красный и оранжевый заняты ошибками
const TEACHER = '#7C3AED', STUDENT = '#0F8A5F';

function read<T>(k: string, d: T): T { try { return JSON.parse(localStorage.getItem(k) ?? '') ?? d; } catch { return d; } }
function write(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* приватный режим */ } }

export function loadMe(): Me | null { return read<Me | null>(ME, null); }
export function saveMe(name: string, teacher: boolean): Me {
  const old = loadMe();
  const me: Me = { id: old?.id ?? newRoomId(8), name: name.trim(), color: teacher ? TEACHER : STUDENT };
  write(ME, me);
  return me;
}
export function savedRooms(): SavedRoom[] { return read<SavedRoom[]>(ROOMS, []); }
export function saveRoom(r: SavedRoom) {
  write(ROOMS, [r, ...savedRooms().filter((x) => x.room !== r.room)].slice(0, 20));
}
export function savedRoom(room: string): SavedRoom | null { return savedRooms().find((x) => x.room === room) ?? null; }
export function forgetRoom(room: string) { write(ROOMS, savedRooms().filter((x) => x.room !== room)); }

/** #r=<комната> в адресе; PIN в адрес не кладём. */
export function roomFromHash(hash = location.hash): string | null {
  const m = hash.match(/[#&]r=([a-z0-9]{4,32})/i);
  return m ? m[1].toLowerCase() : null;
}
export function roomLink(room: string, href = location.href): string {
  return href.split('#')[0] + '#r=' + room;
}
