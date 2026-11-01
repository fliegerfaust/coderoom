// Вход в комнату без аккаунтов (RM.1–RM.3, UI.3): преподаватель создаёт комнату,
// ученик входит по ссылке и PIN. Имя и PIN запоминаются в браузере.
import { h, esc, copyText, toast } from './dom';
import { ic } from './icons';
import { loadMe, newPin, newRoomId, roomLink, savedRooms, savedRoom, type Me } from '../room/access';

export interface EntryResult { room: string; pin: string; name: string; teacher: boolean; create: boolean }

const shell = (inner: string) => h(`<div class="entry"><form class="entry-card" novalidate>
  <div class="logo"><i>&gt;_</i><span>Кодовая комната</span></div>${inner}</form></div>`);

/** Ученик пришёл по ссылке #r=…: имя и PIN. */
export function joinForm(room: string, onSubmit: (r: EntryResult) => Promise<string | null>): HTMLElement {
  const me = loadMe();
  const saved = savedRoom(room);
  const el = shell(`
    <h1>Вход в <span class="mark">комнату</span></h1>
    <p>Код из этой комнаты видят двое: ты и преподаватель. PIN тебе скажут на занятии.</p>
    <div class="field"><label for="name">Как тебя зовут</label><input id="name" autocomplete="given-name" maxlength="24" value="${esc(me?.name ?? '')}" placeholder="Имя" required></div>
    <div class="field"><label for="pin">PIN комнаты</label><input id="pin" class="pin" inputmode="numeric" maxlength="4" autocomplete="off" value="${esc(saved?.pin ?? '')}" placeholder="····" required></div>
    <span class="msg-err" data-err hidden></span>
    <button class="btn run big" type="submit">${ic.right}<span>Войти</span></button>`);
  wire(el, async (f) => {
    const name = f.name.value.trim(), pin = f.pin.value.trim();
    if (!name) return 'Напиши своё имя: так собеседник увидит, чей это курсор.';
    if (!/^\d{4}$/.test(pin)) return 'PIN — четыре цифры.';
    return onSubmit({ room, pin, name, teacher: saved?.teacher ?? false, create: false });
  });
  return el;
}

/** Главная без ссылки: создать комнату или вернуться в свою. */
export function homeView(onSubmit: (r: EntryResult) => Promise<string | null>, me: Me | null): HTMLElement {
  const rooms = savedRooms();
  const el = shell(`
    <h1>Код вместе, <span class="mark">в одной комнате</span></h1>
    <p>Создай комнату для занятия: получишь ссылку и PIN для ученика. Код, ввод и вывод видят двое.</p>
    <div class="field"><label for="name">Твоё имя в комнате</label><input id="name" maxlength="24" value="${esc(me?.name ?? 'Денис')}" required></div>
    <button class="btn run big" type="submit">${ic.plus}<span>Создать комнату</span></button>
    ${rooms.length ? `<div class="rooms"><span class="label">Мои комнаты</span>${rooms.map((r) =>
      `<button type="button" data-room="${esc(r.room)}">${esc(r.title ?? 'Комната ' + r.room.slice(0, 4))}<small>PIN ${esc(r.pin)}${r.teacher ? ' · веду я' : ''}</small></button>`).join('')}</div>` : ''}`);
  el.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-room]');
    if (b) location.hash = 'r=' + b.dataset.room;
  });
  wire(el, async (f) => {
    const name = f.name.value.trim();
    if (!name) return 'Напиши имя.';
    return onSubmit({ room: newRoomId(), pin: newPin(), name, teacher: true, create: true });
  });
  return el;
}

/** Комната создана: ссылка и PIN для ученика. */
export function sharePanel(room: string, pin: string): HTMLElement {
  const link = roomLink(room);
  const el = h(`<div class="share" role="note">
    <span class="label">Отправь ученику ссылку, PIN скажи голосом</span>
    <div class="row"><code data-link>${esc(link)}</code><button class="btn" type="button" data-copy>${ic.copy}<span>Копировать</span></button></div>
    <div class="row"><span class="pinbig">${esc(pin)}</span><span class="sp"></span><span class="hint">PIN не храни в чате вместе со ссылкой</span></div>
  </div>`);
  el.querySelector('[data-copy]')!.addEventListener('click', async () => {
    toast((await copyText(link, el.querySelector('[data-link]') as HTMLElement)) ? 'Ссылка скопирована' : 'Ссылка выделена, скопируй её');
  });
  return el;
}

function wire(el: HTMLElement, submit: (f: HTMLFormElement & { name: HTMLInputElement; pin: HTMLInputElement }) => Promise<string | null>) {
  const form = el.querySelector('form')!;
  const err = el.querySelector<HTMLElement>('[data-err]') ?? form.appendChild(h('<span class="msg-err" data-err hidden></span>'));
  const btn = form.querySelector<HTMLButtonElement>('button[type=submit]')!;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    btn.disabled = true;
    try {
      const m = await submit(form as never);
      if (m) { err.textContent = m; err.hidden = false; }
    } catch (x) {
      console.error(x);
      err.textContent = 'Не получилось подключиться. Проверь интернет и попробуй ещё раз.';
      err.hidden = false;
    } finally { btn.disabled = false; }
  });
  const pin = form.querySelector<HTMLInputElement>('#pin');
  pin?.addEventListener('input', () => { pin.value = pin.value.replace(/\D/g, '').slice(0, 4); });
  queueMicrotask(() => (form.querySelector<HTMLInputElement>('input:placeholder-shown, input') as HTMLInputElement | null)?.focus());
}
