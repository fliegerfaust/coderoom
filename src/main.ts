import './ui/styles.css';
import type { Db } from './sync/db';
import { LocalDb } from './sync/local-db';
import { firebaseConfig } from './firebase-config';
import { PythonRunner } from './python/runner';
import { Room } from './room/room';
import { loadMe, roomFromHash, roomPath, saveMe, saveRoom, savedRoom, forgetRoom } from './room/access';
import { loadIndex, loadLesson } from './lessons/types';
import { RoomView } from './ui/room-view';
import { homeView, joinForm, type EntryResult } from './ui/entry-view';
import { h } from './ui/dom';

const app = document.getElementById('app')!;
const params = new URLSearchParams(location.search);
const BASE = import.meta.env.BASE_URL;

async function makeDb(): Promise<Db> {
  if (params.get('db') === 'local' || !firebaseConfig) return new LocalDb();
  const { FirebaseDb } = await import('./sync/firebase-db');
  return new FirebaseDb(firebaseConfig);
}

// Python начинает грузиться сразу, пока человек вводит имя и PIN
const runner = new PythonRunner(new URL(BASE + 'pyodide/', location.href).href);
const dbP = makeDb();
let view: RoomView | null = null;
let room: Room | null = null;

async function enter(r: EntryResult): Promise<string | null> {
  const db = await dbP;
  const base = await roomPath(r.room, r.pin);
  if (r.create) {
    const lessons = await loadIndex(BASE);
    await Room.create(db, base, { id: '', name: r.name, color: '' }, lessons[0]?.id ?? '');
  } else if (!(await Room.exists(db, base))) {
    forgetRoom(r.room);
    return 'Комната не найдена. Проверь PIN или попроси новую ссылку.';
  }
  const me = saveMe(r.name, r.teacher);
  saveRoom({ room: r.room, pin: r.pin, teacher: r.teacher, at: Date.now(), title: savedRoom(r.room)?.title });
  if (r.create) { history.replaceState(null, '', '#r=' + r.room); }
  await openRoom(db, base, me, r.teacher, r.create ? r : null);
  return null;
}

async function openRoom(db: Db, base: string, me: ReturnType<typeof saveMe>, teacher: boolean, created: EntryResult | null) {
  view?.destroy(); room?.destroy();
  app.replaceChildren(h('<div class="loading">Открываю комнату…</div>'));
  room = new Room(db, base, me, teacher, runner);
  await room.start();
  // «Стереть всё» у кого угодно — у всех открывается чистая комната того же адреса
  room.onReset(() => location.reload());
  const lessons = await loadIndex(BASE);
  const inv = teacher ? { room: roomFromHash() ?? created?.room ?? '', pin: created?.pin ?? savedRoom(roomFromHash() ?? '')?.pin ?? '' } : null;
  view = new RoomView(room, lessons, (i) => loadLesson(i, BASE), inv && inv.room && inv.pin ? inv : null);
  app.replaceChildren(view.root);
  await view.start();
  if (created) view.openInvite();
  if (db.kind === 'local') console.info('Кодовая комната: локальный режим (без Firebase), синхронизация только между вкладками этого браузера');
}

async function route() {
  const r = roomFromHash();
  view?.destroy(); room?.destroy(); view = null; room = null;
  if (!r) { app.replaceChildren(homeView(enter, loadMe())); return; }
  const saved = savedRoom(r), me = loadMe();
  if (saved && me) {
    const err = await enter({ room: r, pin: saved.pin, name: me.name, teacher: saved.teacher, create: false }).catch(() => 'offline');
    if (!err) return;
  }
  app.replaceChildren(joinForm(r, enter));
}

addEventListener('hashchange', () => { void route(); });
void route();
