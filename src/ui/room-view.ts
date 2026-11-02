// Экран комнаты: шапка с присутствием, задача, общий редактор, вывод (UI.2).
// Раскладка B «Карточка с доски» (выбор Дениса по витрине UI.1).
import { Room, type RunState, type Peer } from '../room/room';
import { CodeEditor } from '../editor/editor';
import { FREE_TASK, findTask, type Lesson, type LessonIndexItem, type LessonTask } from '../lessons/types';
import { renderStatement } from './markdown';
import { ic } from './icons';
import { h, esc, toast } from './dom';
import { sharePanel } from './entry-view';
import { turtleFigure, openTurtleFull } from './turtle-view';

const FONT_KEY = 'coderoom-font';
const readFont = () => { try { return Number(localStorage.getItem(FONT_KEY)) || 20; } catch { return 20; } };

export class RoomView {
  root: HTMLElement;
  private editor: CodeEditor;
  private lesson: Lesson | null = null;
  private flat: LessonTask[] = [];
  private task: LessonTask = FREE_TASK;
  private els: Record<string, HTMLElement> = {};
  private listOpen = false;
  /** Меню занятия в шапке (только у преподавателя): 'menu' | 'confirm' */
  private lessonMenu: '' | 'menu' | 'confirm' = '';
  private boundStdin: (() => void) | null = null;
  private font = readFont();
  private tick = 0;

  private inviteEl: HTMLElement | null = null;

  constructor(private room: Room, private lessons: LessonIndexItem[], private loadLesson: (i: LessonIndexItem) => Promise<Lesson>,
    /** ссылка и PIN — только у преподавателя (ST.1) */ private invite: { room: string; pin: string } | null = null) {
    this.root = h(`<div class="room">
      <header class="bar area-bar">
        <div class="logo"><i>&gt;_</i><span>Кодовая комната</span></div>
        <div class="lessonnav" data-el="lessonNav"></div>
        <span class="sp"></span>
        <span class="net" data-el="net" hidden>Нет связи, правки сохранятся и уйдут позже</span>
        ${invite ? `<button class="btn ghost invitebtn" data-act="invite" aria-haspopup="dialog" title="Ссылка и PIN для ученика">${ic.invite}<span>Пригласить</span></button>` : ''}
        <div class="peers" data-el="peers"></div>
      </header>
      <section class="task area-task" data-el="task"></section>
      <section class="edpane area-ed">
        <div class="edhead">
          <div class="legend" data-el="legend"></div><span class="sp"></span>
          <button class="btn ghost icon" data-act="font-" title="Мельче">${ic.minus}</button>
          <button class="btn ghost icon" data-act="font+" title="Крупнее">${ic.plus}</button>
          <button class="btn ghost" data-act="reset" title="Сбросить задачу: заготовка в редакторе, пустой ввод, без вывода и отметки">${ic.undo}<span>Сбросить</span></button>
          <button class="btn stop" data-act="stop" data-el="stopBtn" disabled>${ic.stop}<span>Стоп</span></button>
          <button class="btn run" data-act="run" data-el="runBtn">${ic.play}<span>Запустить</span><kbd>${navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'} ↵</kbd></button>
        </div>
        <div class="editor-host" data-el="editor"></div>
      </section>
      <section class="out area-out" aria-live="polite">
        <div class="outhead"><span data-el="status"></span><small data-el="runInfo"></small><span class="sp"></span></div>
        <div class="outbody" data-el="out"></div>
        <div class="stdin"><label for="stdin" title="Строки по одной на каждый вызов input()">${ic.input}Ввод для input()</label><textarea id="stdin" data-el="stdin" rows="1" spellcheck="false" placeholder="строки по одной на каждый input(), например: 5"></textarea></div>
      </section>
    </div>`);
    this.root.querySelectorAll<HTMLElement>('[data-el]').forEach((e) => { this.els[e.dataset.el!] = e; });
    this.editor = new CodeEditor({ parent: this.els.editor, onRun: () => this.run(), fontSize: this.font });
    this.root.addEventListener('click', (e) => this.onClick(e));
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (this.listOpen) { this.listOpen = false; this.renderTask(); }
      if (this.lessonMenu) { this.lessonMenu = ''; this.renderLessonNav(); }
      if (this.inviteEl) this.closeInvite();
    });
    document.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (this.listOpen && !t.closest('.tasknav')) { this.listOpen = false; this.renderTask(); }
      if (this.lessonMenu && !t.closest('.lessonnav')) { this.lessonMenu = ''; this.renderLessonNav(); }
      if (this.inviteEl && !t.closest('.share-pop, .invitebtn')) this.closeInvite();
    });
  }

  async start() {
    const r = this.room;
    r.db.onConnected((on) => { this.els.net.hidden = on; });
    r.onPeers((p) => this.renderPeers(p));
    r.onRun((run) => this.renderRun(run));
    r.runner.onState(() => this.renderButtons());
    r.onMeta(() => { void this.syncFromMeta(); });
    r.doc.getMap('ran').observe(() => this.renderTask());
    r.opened.observe(() => { if (!r.teacher) this.renderTask(); });
    await this.syncFromMeta(true);
    // тик для «идёт 3 с»
    this.tick = self.setInterval(() => { if (r.run?.status === 'running') this.renderRun(r.run); }, 500);
  }

  private async ensureLesson(id: string | null) {
    const item = this.lessons.find((l) => l.id === id) ?? this.lessons[0];
    if (!item) { this.lesson = null; this.flat = []; return; }
    if (this.lesson?.id !== item.id) {
      this.lesson = await this.loadLesson(item);
      this.flat = this.lesson.groups.flatMap((g) => g.tasks);
    }
  }

  /** Открытая задача — общая: берём её из документа комнаты. Пусто — открываем первую. */
  private async syncFromMeta(first = false) {
    const r = this.room;
    await this.ensureLesson(r.lessonId ?? r.created.lesson ?? null);
    this.renderLessonNav();
    const id = r.taskId;
    const t = id ? findTask(this.lesson, id) : null;
    if (!t) { this.open(this.flat[0] ?? FREE_TASK); return; }
    if (first || t.id !== this.task.id) this.show(t);
  }

  open(t: LessonTask) {
    this.listOpen = false;
    this.room.openTask(t, this.lesson?.id ?? null);
    this.show(t);
  }

  private show(t: LessonTask) {
    this.task = t;
    this.renderTask();
    this.editor.bind(this.room.code(this.key(t)), this.room.awareness, this.room.clients);
    this.bindStdin();
    this.renderRun(this.room.run);
    this.renderLegend();
  }

  private bindStdin() {
    this.boundStdin?.();
    const ta = this.els.stdin as HTMLTextAreaElement;
    const yt = this.room.stdin(this.key(this.task));
    ta.value = yt.toString();
    const fromDoc = () => { if (document.activeElement !== ta) ta.value = yt.toString(); };
    const fromUser = () => { this.room.doc.transact(() => { yt.delete(0, yt.length); yt.insert(0, ta.value); }); };
    yt.observe(fromDoc);
    ta.addEventListener('input', fromUser);
    this.boundStdin = () => { yt.unobserve(fromDoc); ta.removeEventListener('input', fromUser); };
  }

  private key(t: LessonTask) { return Room.key(this.lesson?.id ?? null, t.id); }

  /** Ученик видит только открытые задачи и текущую; преподаватель — все (ST.2) */
  private visible(t: LessonTask) {
    return this.room.teacher || t.id === this.task.id || !!this.room.opened.get(this.key(t));
  }
  private visibleFlat() { return this.flat.filter((t) => this.visible(t)); }

  // ── «Пригласить»: ссылка и PIN в любой момент (ST.1) ──
  openInvite() {
    if (!this.invite || this.inviteEl) return;
    const panel = sharePanel(this.invite.room, this.invite.pin);
    const wrap = h('<div class="share-pop" role="dialog" aria-label="Ссылка и PIN для ученика"><button class="btn ghost" type="button" data-close>Готово</button></div>');
    wrap.prepend(panel);
    wrap.querySelector('[data-close]')!.addEventListener('click', () => this.closeInvite());
    this.root.append(wrap);
    this.inviteEl = wrap;
    this.root.querySelector('.invitebtn')?.setAttribute('aria-expanded', 'true');
  }
  private closeInvite() {
    this.inviteEl?.remove(); this.inviteEl = null;
    this.root.querySelector('.invitebtn')?.setAttribute('aria-expanded', 'false');
  }

  // ── занятие: переключатель и «Стереть всё» (LS.4, RM.4) ──
  private renderLessonNav() {
    const nav = this.els.lessonNav;
    const title = this.lesson?.title ?? 'Свободная комната';
    if (!this.room.teacher) { nav.innerHTML = `<span class="lesson-name">${esc(title)}</span>`; return; }
    let panel = '';
    if (this.lessonMenu === 'menu') {
      panel = `<div class="lessonmenu" role="dialog" aria-label="Занятие">
        <h4>Занятие</h4>
        <div class="lessonlist">${this.lessons.map((l) => `<button class="lessonrow ${l.id === this.lesson?.id ? 'on' : ''}" data-lesson="${esc(l.id)}">
          <b>${esc(l.short)}</b><span>${esc(l.title.replace(/^Занятие \d+\s*·\s*/, ''))}</span></button>`).join('')}</div>
        <div class="danger-zone"><div><b>Начать заново</b><span>Стереть код, ввод, вывод и отметки всех задач. Ссылка и PIN останутся.</span></div>
          <button class="btn danger" data-act="erase-ask">${ic.undo}<span>Стереть всё…</span></button></div>
      </div>`;
    } else if (this.lessonMenu === 'confirm') {
      panel = `<div class="lessonmenu" role="alertdialog" aria-label="Стереть всё в комнате">
        <h4>Стереть всё в комнате?</h4>
        <p class="confirm-t">Код, ввод, вывод и отметки всех задач исчезнут у обоих. Вернуть их будет нельзя. Ссылка и PIN останутся прежними.</p>
        <div class="confirm-row"><button class="btn" data-act="erase-cancel">Отмена</button><button class="btn danger" data-act="erase-do">Стереть всё</button></div>
      </div>`;
    }
    nav.innerHTML = `<button class="btn ghost lessonbtn" data-act="lessons" aria-expanded="${!!this.lessonMenu}" aria-haspopup="dialog" title="Сменить занятие или начать заново">
      <span class="lesson-name">${esc(title)}</span>${ic.down}</button>${panel}`;
  }

  private async openLesson(id: string) {
    this.lessonMenu = '';
    const item = this.lessons.find((l) => l.id === id);
    if (!item) return;
    this.lesson = await this.loadLesson(item);
    this.flat = this.lesson.groups.flatMap((g) => g.tasks);
    this.open(this.flat[0] ?? FREE_TASK);
    this.renderLessonNav();
  }

  // ── задача ──
  private groupOf(t: LessonTask) { return this.lesson?.groups.find((g) => g.tasks.some((x) => x.id === t.id)); }

  private renderTask() {
    const t = this.task, g = this.groupOf(t);
    const vis = this.visibleFlat(), i = vis.findIndex((x) => x.id === t.id);
    const prev = i > 0 ? vis[i - 1] : null, next = i >= 0 && i < vis.length - 1 ? vis[i + 1] : null;
    const ran = this.room.doc.getMap<{ status: string }>('ran');
    const key = (x: LessonTask) => this.key(x);
    const chips = (ts: LessonTask[]) => ts.filter((x) => this.visible(x)).map((x) =>
      `<button class="chip ${x.id === t.id ? 'on' : ''} ${ran.get(key(x)) ? 'ran' : ''}" data-task="${x.id}" title="${esc(x.label)}">${esc(short(x))}</button>`).join('');
    const list = this.listOpen ? `<div class="tasklist" role="dialog" aria-label="Все задачи занятия">
        ${(this.lesson?.groups ?? []).filter((gr) => gr.tasks.some((x) => this.visible(x))).map((gr) => `<h4>${esc(gr.title)}</h4><div class="grid">${chips(gr.tasks)}</div>`).join('')}
        <h4>Без условия</h4><div class="grid"><button class="chip ${t.id === 'free' ? 'on' : ''}" data-task="free">Чистый лист</button></div>
      </div>` : '';
    const lvl = t.level ? ['', 'База', 'Норма', 'Вызов', 'Повышенный'][t.level] ?? '' : '';
    const meta = t.kind === 'ege' ? [lvl, t.topic.toLowerCase()].filter(Boolean).join(' · ') : t.topic;
    this.els.task.innerHTML = `
      <div class="stacktitle tasknav">
        <span class="label">${esc(g?.title ?? 'Свободный лист')}</span>
        <button class="btn ghost" data-act="list" aria-expanded="${this.listOpen}" aria-haspopup="dialog">${ic.list}<span>${this.room.teacher ? 'Все стопки' : 'Открытые задачи'}</span></button>
        ${list}
      </div>
      ${g ? `<div class="stack" role="toolbar" aria-label="Задачи стопки">${chips(g.tasks)}</div>` : ''}
      <article class="card">
        <div class="cardtop"><span class="badge">${esc(t.label)}</span><span class="lvl">${esc(meta)}</span></div>
        <div class="cardbody">
          <div class="st">${renderStatement(t.statement)}</div>
          ${t.image ? `<img class="timg" src="${esc(t.image.startsWith('lessons/') ? t.image : 'lessons/' + t.image)}" alt="Рисунок к задаче">` : ''}
          ${t.files?.length ? `<div class="files">${t.files.map((f) => `<a href="${esc(f.url)}" target="_blank" rel="noopener">${ic.file} ${esc(f.name)}</a>`).join('')}</div>` : ''}
          ${t.intro ? `<div><button class="disclose" data-act="intro" aria-expanded="false">${ic.down}Что такое маска и адрес сети</button><p class="intro-t" hidden>${esc(t.intro)}</p></div>` : ''}
        </div>
        <div class="cardfoot">
          <button class="btn" data-task="${prev?.id ?? ''}" ${prev ? '' : 'disabled'}>${ic.left}<span>${prev ? esc(prev.label) : this.room.teacher ? 'Начало' : 'Назад'}</span></button>
          <button class="btn" data-task="${next?.id ?? ''}" ${next ? '' : 'disabled'}><span>${next ? esc(next.label) : this.room.teacher ? 'Конец' : 'Пока всё'}</span>${ic.right}</button>
        </div>
      </article>`;
  }

  private renderLegend() {
    const peers = this.room.peers();
    this.els.legend.innerHTML = peers.map((p) => `<span><i style="background:${p.color}"></i>${esc(p.name)}</span>`).join('');
  }

  private renderPeers(peers: Peer[]) {
    this.els.peers.innerHTML = peers.map((p) =>
      `<span class="peer" title="${p.teacher ? 'Преподаватель' : 'Ученик'}"><b style="background:${p.color}">${esc(p.name.slice(0, 1).toUpperCase())}</b>${esc(p.name)}${p.teacher ? ' <small>ведёт</small>' : ''}</span>`).join('');
    this.renderLegend();
  }

  // ── запуск ──
  private renderButtons() {
    const r = this.room;
    const running = r.run?.status === 'running';
    (this.els.stopBtn as HTMLButtonElement).disabled = !running;
    this.els.stopBtn.classList.toggle('live', running);
    const loading = r.runner.state === 'loading';
    this.els.runBtn.querySelector('span')!.textContent = loading && !running ? 'Python грузится…' : 'Запустить';
  }

  private renderRun(run: RunState | null) {
    this.renderButtons();
    const mine = run && run.task === this.key(this.task) ? run : null;
    const st = this.els.status, info = this.els.runInfo, out = this.els.out;
    if (!mine) {
      st.className = 'status idle'; st.innerHTML = '<i></i>Вывод';
      info.textContent = '';
      out.innerHTML = `<span class="empty">Здесь появится то, что напечатает программа. Запуск: кнопка «Запустить» или ${navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'} + Enter.</span>`;
      return;
    }
    const secs = (ms: number) => (ms < 1000 ? `${(ms / 1000).toFixed(2).replace('.', ',')} с` : `${(ms / 1000).toFixed(1).replace('.', ',')} с`);
    const label = { running: 'Идёт', done: 'Готово', error: 'Ошибка', stopped: 'Остановлено' }[mine.status];
    st.className = `status ${mine.status}`; st.innerHTML = `<i></i>${label}`;
    const dur = mine.status === 'running' ? secs(Date.now() - mine.at) : mine.ms != null ? secs(mine.ms) : '';
    info.textContent = `Запустил ${mine.name}${dur ? ' · ' + dur : ''}`;
    let html = mine.draw ? turtleFigure(mine.draw) : '';
    html += mine.cut ? '<span class="cut">Начало вывода обрезано: показываю последние строки.</span>' : '';
    html += esc(mine.out || '');
    if (!mine.out && !mine.draw && mine.status === 'done') html += '<span class="empty">Программа ничего не напечатала. Чтобы увидеть результат, нужен print(…).</span>';
    if (mine.status === 'running' && !mine.out && this.room.runner.state === 'loading') html += '<span class="empty">Python загружается, первый раз это занимает несколько секунд…</span>';
    if (mine.error) {
      const e = mine.error;
      html += `<div class="err"><span class="t">${esc(e.type)}${e.line ? ` · строка ${e.line}` : ''}</span><span class="h">${inlineCode(esc(e.hint))}</span><pre>${esc(e.traceback)}</pre></div>`;
    }
    if (mine.status === 'stopped') html += `<div class="err"><span class="t">Программу остановили</span><span class="h">Если она шла слишком долго, проверь условие цикла: может, он не заканчивается.</span></div>`;
    const atBottom = out.scrollHeight - out.scrollTop - out.clientHeight < 40;
    out.innerHTML = html;
    if (atBottom) out.scrollTop = out.scrollHeight;
  }

  private run() {
    if (this.room.run?.status === 'running' && this.room.run.by !== this.room.me.id) { toast('Сейчас идёт запуск у собеседника. Подожди или нажми «Стоп».'); return; }
    void this.room.runTask(this.task, this.lesson?.id ?? null);
  }

  private onClick(e: MouseEvent) {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act],[data-task],[data-lesson]');
    if (!el || (el as HTMLButtonElement).disabled) return;
    if (el.dataset.lesson !== undefined) { void this.openLesson(el.dataset.lesson); return; }
    if (el.dataset.task !== undefined) {
      const t = el.dataset.task === 'free' ? FREE_TASK : this.flat.find((x) => x.id === el.dataset.task && this.visible(x));
      if (t) this.open(t);
      return;
    }
    switch (el.dataset.act) {
      case 'run': this.run(); break;
      case 'stop': this.room.stop(); break;
      case 'reset': this.room.resetTask(this.task, this.lesson?.id ?? null); this.editor.focus(); break;
      case 'turtle-full': if (this.room.run?.draw) openTurtleFull(this.room.run.draw); break;
      case 'invite': if (this.inviteEl) this.closeInvite(); else this.openInvite(); e.stopPropagation(); break;
      case 'lessons': this.lessonMenu = this.lessonMenu ? '' : 'menu'; this.renderLessonNav(); e.stopPropagation(); break;
      case 'erase-ask': this.lessonMenu = 'confirm'; this.renderLessonNav(); e.stopPropagation(); break;
      case 'erase-cancel': this.lessonMenu = 'menu'; this.renderLessonNav(); e.stopPropagation(); break;
      case 'erase-do': {
        const b = el as HTMLButtonElement; b.disabled = true; b.textContent = 'Стираю…';
        void this.room.eraseAll(this.lesson?.id ?? null).catch(() => { toast('Не получилось стереть: нет связи. Попробуй ещё раз.'); this.lessonMenu = ''; this.renderLessonNav(); });
        break;
      }
      case 'list': this.listOpen = !this.listOpen; this.renderTask(); e.stopPropagation(); break;
      case 'intro': { const p = el.nextElementSibling as HTMLElement; p.hidden = !p.hidden; el.setAttribute('aria-expanded', String(!p.hidden)); break; }
      case 'font-': case 'font+': {
        this.font = Math.max(14, Math.min(32, this.font + (el.dataset.act === 'font+' ? 2 : -2)));
        try { localStorage.setItem(FONT_KEY, String(this.font)); } catch { /* */ }
        this.editor.setFontSize(this.font);
        break;
      }
    }
  }

  destroy() { clearInterval(this.tick); this.editor.destroy(); this.boundStdin?.(); }
}

function short(t: LessonTask) { return t.label.replace(/^.*·\s*/, ''); }
function inlineCode(s: string) { return s.replace(/`([^`]+)`/g, '<code>$1</code>'); }
