// Экран комнаты: шапка с присутствием, задача, общий редактор, вывод (UI.2).
// Раскладка задаётся классом .lay-a / .lay-b / .lay-c (витрина UI.1), детали общие.
import type { Room, RunState, Peer } from '../room/room';
import { CodeEditor } from '../editor/editor';
import { FREE_TASK, findTask, type Lesson, type LessonIndexItem, type LessonTask } from '../lessons/types';
import { renderStatement } from './markdown';
import { ic } from './icons';
import { h, esc, toast } from './dom';

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
  private boundStdin: (() => void) | null = null;
  private font = readFont();
  private tick = 0;

  constructor(private room: Room, private lessons: LessonIndexItem[], private loadLesson: (i: LessonIndexItem) => Promise<Lesson>) {
    this.root = h(`<div class="room">
      <header class="bar area-bar">
        <div class="logo"><i>&gt;_</i><span>Кодовая комната</span></div>
        <span class="lesson-name" data-el="lessonName"></span>
        <span class="sp"></span>
        <span class="net" data-el="net" hidden>Нет связи, правки сохранятся и уйдут позже</span>
        <div class="peers" data-el="peers"></div>
      </header>
      <section class="task area-task" data-el="task"></section>
      <section class="edpane area-ed">
        <div class="edhead">
          <div class="legend" data-el="legend"></div><span class="sp"></span>
          <button class="btn ghost icon" data-act="font-" title="Мельче">${ic.minus}</button>
          <button class="btn ghost icon" data-act="font+" title="Крупнее">${ic.plus}</button>
          <button class="btn ghost" data-act="reset" title="Вернуть заготовку задачи">${ic.undo}<span>Заготовка</span></button>
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
      if (e.key === 'Escape' && this.listOpen) { this.listOpen = false; this.renderTask(); }
    });
    document.addEventListener('click', (e) => {
      if (this.listOpen && !(e.target as HTMLElement).closest('.tasknav')) { this.listOpen = false; this.renderTask(); }
    });
  }

  async start() {
    const r = this.room;
    r.db.onConnected((on) => { this.els.net.hidden = on; });
    r.onPeers((p) => this.renderPeers(p));
    r.onRun((run) => this.renderRun(run));
    r.runner.onState(() => this.renderButtons());
    r.onMeta(() => { void this.syncFromMeta(); });
    r.doc.getMap('ran').observe(() => { if (this.listOpen) this.renderTask(); });
    await this.syncFromMeta(true);
    // тик для «идёт 3 с»
    this.tick = self.setInterval(() => { if (r.run?.status === 'running') this.renderRun(r.run); }, 500);
  }

  private async ensureLesson(id: string | null) {
    const item = this.lessons.find((l) => l.id === id) ?? this.lessons[this.lessons.length - 1];
    if (!item) { this.lesson = null; this.flat = []; return; }
    if (this.lesson?.id !== item.id) {
      this.lesson = await this.loadLesson(item);
      this.flat = this.lesson.groups.flatMap((g) => g.tasks);
    }
  }

  /** Открытая задача — общая: берём её из документа комнаты. Пусто — открываем первую. */
  private async syncFromMeta(first = false) {
    const r = this.room;
    await this.ensureLesson(r.lessonId);
    this.els.lessonName.textContent = this.lesson?.title ?? 'Свободная комната';
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
    this.editor.bind(this.room.code(t.id), this.room.awareness, this.room.clients);
    this.bindStdin();
    this.renderRun(this.room.run);
    this.renderLegend();
  }

  private bindStdin() {
    this.boundStdin?.();
    const ta = this.els.stdin as HTMLTextAreaElement;
    const yt = this.room.stdin(this.task.id);
    ta.value = yt.toString();
    const fromDoc = () => { if (document.activeElement !== ta) ta.value = yt.toString(); };
    const fromUser = () => { this.room.doc.transact(() => { yt.delete(0, yt.length); yt.insert(0, ta.value); }); };
    yt.observe(fromDoc);
    ta.addEventListener('input', fromUser);
    this.boundStdin = () => { yt.unobserve(fromDoc); ta.removeEventListener('input', fromUser); };
  }

  // ── задача ──
  private idx() { return this.flat.findIndex((x) => x.id === this.task.id); }
  private groupOf(t: LessonTask) { return this.lesson?.groups.find((g) => g.tasks.some((x) => x.id === t.id)); }

  private renderTask() {
    const t = this.task, i = this.idx(), g = this.groupOf(t);
    const prev = i > 0 ? this.flat[i - 1] : null, next = i >= 0 && i < this.flat.length - 1 ? this.flat[i + 1] : null;
    const ran = this.room.doc.getMap<{ status: string }>('ran');
    const key = (x: LessonTask) => `${this.lesson?.id ?? '-'}:${x.id}`;
    const chips = (ts: LessonTask[]) => ts.map((x) =>
      `<button class="chip ${x.id === t.id ? 'on' : ''} ${ran.get(key(x)) ? 'ran' : ''}" data-task="${x.id}" title="${esc(x.label)}">${esc(short(x))}</button>`).join('');
    const list = this.listOpen ? `<div class="tasklist" role="dialog" aria-label="Все задачи занятия">
        ${(this.lesson?.groups ?? []).map((gr) => `<h4>${esc(gr.title)}</h4><div class="grid">${chips(gr.tasks)}</div>`).join('')}
        <h4>Без условия</h4><div class="grid"><button class="chip ${t.id === 'free' ? 'on' : ''}" data-task="free">Чистый лист</button></div>
      </div>` : '';
    const lvl = t.level ? ['', 'База', 'Норма', 'Вызов', 'Повышенный'][t.level] ?? '' : '';
    const meta = t.kind === 'ege' ? [lvl, t.topic.toLowerCase()].filter(Boolean).join(' · ') : t.topic;
    this.els.task.innerHTML = `
      <div class="stacktitle tasknav">
        <span class="label">${esc(g?.title ?? 'Свободный лист')}</span>
        <button class="btn ghost" data-act="list" aria-expanded="${this.listOpen}" aria-haspopup="dialog">${ic.list}<span>Все стопки</span></button>
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
          <button class="btn" data-task="${prev?.id ?? ''}" ${prev ? '' : 'disabled'}>${ic.left}<span>${prev ? esc(prev.label) : 'Начало'}</span></button>
          <button class="btn" data-task="${next?.id ?? ''}" ${next ? '' : 'disabled'}><span>${next ? esc(next.label) : 'Конец'}</span>${ic.right}</button>
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
    const mine = run && run.task === this.task.id ? run : null;
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
    let html = mine.cut ? '<span class="cut">Начало вывода обрезано: показываю последние строки.</span>' : '';
    html += esc(mine.out || '');
    if (!mine.out && mine.status === 'done') html += '<span class="empty">Программа ничего не напечатала. Чтобы увидеть результат, нужен print(…).</span>';
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
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act],[data-task]');
    if (!el || (el as HTMLButtonElement).disabled) return;
    if (el.dataset.task !== undefined) {
      const t = el.dataset.task === 'free' ? FREE_TASK : this.flat.find((x) => x.id === el.dataset.task);
      if (t) this.open(t);
      return;
    }
    switch (el.dataset.act) {
      case 'run': this.run(); break;
      case 'stop': this.room.stop(); break;
      case 'reset': this.room.resetToStarter(this.task); this.editor.focus(); break;
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
