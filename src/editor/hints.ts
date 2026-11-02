// Подсказки в редакторе (ED.4–ED.6): параметры вызова при вводе, описание при наведении,
// автодополнение (только у учителя, ученику — по переключателю в комнате).
import { StateField, StateEffect, type EditorState, type Extension } from '@codemirror/state';
import { EditorView, showTooltip, hoverTooltip, keymap, type Tooltip } from '@codemirror/view';
import { autocompletion, type CompletionContext, type Completion, type CompletionResult } from '@codemirror/autocomplete';
import {
  BUILTINS, STR_METHODS, LIST_METHODS, MODULES, KEYWORDS,
  activeParam, callContext, importsOf, lookup, signature, type PyDoc,
} from './pydocs';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Карточка справки: сигнатура (текущий параметр выделен), что он значит, что делает функция, пример */
export function docCard(doc: PyDoc, active = -1): HTMLElement {
  const el = document.createElement('div');
  el.className = 'cm-pyhint';
  const isCall = doc.kind !== 'module' && doc.kind !== 'property';
  const params = doc.params.map((p, k) =>
    `<span class="${k === active ? 'on' : ''}">${esc(p.name)}${p.opt ? '<i>?</i>' : ''}</span>`).join(', ');
  const sig = isCall ? `<b>${esc(doc.name)}</b>(${params})` : `<b>${esc(doc.name)}</b>`;
  const ret = doc.ret ? ` <em>→ ${esc(doc.ret)}</em>` : '';
  const p = active >= 0 ? doc.params[active] : null;
  el.innerHTML = `<div class="sig">${sig}${ret}</div>`
    + (p ? `<div class="param"><code>${esc(p.name)}</code> — ${esc(p.desc)}${p.opt ? ' <small>можно не писать</small>' : ''}</div>` : '')
    + `<div class="desc">${esc(doc.desc)}</div>`
    + (doc.ex && active < 0 ? `<pre>${esc(doc.ex)}</pre>` : '');
  return el;
}

// ── подсказка параметров при вводе ──
interface SigState { from: number; tooltip: Tooltip | null; hidden: number }
const hideSig = StateEffect.define<null>();

function computeSig(state: EditorState, hidden: number): SigState {
  const sel = state.selection.main;
  if (!sel.empty) return { from: -1, tooltip: null, hidden };
  const text = state.doc.toString();
  const ctx = callContext(text, sel.head);
  if (!ctx) return { from: -1, tooltip: null, hidden: -1 };
  const doc = lookup(ctx.callee, importsOf(text));
  if (!doc || doc.kind === 'module' || doc.kind === 'property') return { from: ctx.from, tooltip: null, hidden };
  if (hidden === ctx.from) return { from: ctx.from, tooltip: null, hidden };
  const active = activeParam(doc, ctx);
  return {
    from: ctx.from, hidden: -1,
    tooltip: { pos: sel.head, above: true, strictSide: false, arrow: false, create: () => ({ dom: docCard(doc, active) }) },
  };
}

const sigField = StateField.define<SigState>({
  create: () => ({ from: -1, tooltip: null, hidden: -1 }),
  update(v, tr) {
    if (tr.effects.some((e) => e.is(hideSig))) return { from: v.from, tooltip: null, hidden: v.from };
    const mine = tr.isUserEvent('input') || tr.isUserEvent('delete') || tr.isUserEvent('select') || tr.isUserEvent('undo') || tr.isUserEvent('redo');
    // чужие правки только обновляют уже открытую подсказку, но не открывают новую
    if (mine || (v.tooltip && (tr.docChanged || tr.selection))) return computeSig(tr.state, v.hidden);
    return v;
  },
  provide: (f) => showTooltip.from(f, (v) => v.tooltip),
});

const sigKeys = keymap.of([{
  key: 'Escape',
  run: (view) => {
    if (!view.state.field(sigField).tooltip) return false;
    view.dispatch({ effects: hideSig.of(null) });
    return true;
  },
}]);

// ── описание при наведении ──
const hover = hoverTooltip((view, pos) => {
  const line = view.state.doc.lineAt(pos);
  const t = line.text, at = pos - line.from;
  let a = at, b = at;
  while (a > 0 && /[\w.]/.test(t[a - 1])) a--;
  while (b < t.length && /\w/.test(t[b])) b++;
  const raw = t.slice(a, b);
  const chain = raw.replace(/^\.+/, '');
  if (!chain || /^\d/.test(chain)) return null;
  // '.'.join — метод того, что не имя
  const word = raw.startsWith('.') ? '?.' + chain : chain;
  const doc = lookup(word, importsOf(view.state.doc.toString()));
  const kw = !doc && KEYWORDS[word];
  if (!doc && !kw) return null;
  return {
    pos: line.from + a, end: line.from + b, above: true,
    create: () => {
      if (doc) return { dom: docCard(doc) };
      const el = document.createElement('div');
      el.className = 'cm-pyhint';
      el.innerHTML = `<div class="sig"><b>${esc(chain)}</b></div><div class="desc">${esc(kw as string)}</div>`;
      return { dom: el };
    },
  };
}, { hoverTime: 350 });

// ── автодополнение ──
const opt = (doc: PyDoc, boost = 0): Completion => ({
  label: doc.name,
  type: doc.kind === 'method' ? 'method' : doc.kind === 'property' ? 'property' : doc.kind ?? 'function',
  detail: signature(doc) === doc.name ? undefined : signature(doc).slice(doc.name.length),
  info: () => docCard(doc),
  boost,
});

const GLOBAL: Completion[] = [
  ...Object.values(BUILTINS).map((d) => opt(d, 2)),
  ...Object.keys(MODULES).filter((k) => !k.includes('.')).map((k) => opt(MODULES[k], 1)),
  ...Object.entries(KEYWORDS).map(([k, v]) => ({ label: k, type: 'keyword', info: v })),
];
const METHODS: Completion[] = [...Object.values(STR_METHODS), ...Object.values(LIST_METHODS)].map((d) => opt(d));

function source(ctx: CompletionContext): CompletionResult | null {
  const before = ctx.matchBefore(/[\w.]*$/);
  if (!before) return null;
  const line = ctx.state.doc.lineAt(ctx.pos);
  const lineBefore = line.text.slice(0, ctx.pos - line.from);
  // в строке или комментарии не подсказываем
  if (/#/.test(lineBefore.replace(/'[^']*'|"[^"]*"/g, '')) || (lineBefore.match(/['"]/g)?.length ?? 0) % 2) return null;
  const dot = before.text.lastIndexOf('.');
  if (dot >= 0) {
    const obj = before.text.slice(0, dot);
    const from = before.from + dot + 1;
    const mod = Object.keys(MODULES).filter((k) => k.startsWith(obj + '.')).map((k) => opt(MODULES[k], 1));
    if (mod.length) return { from, options: mod, validFor: /^\w*$/ };
    if (/^\d+$/.test(obj)) return null; // 3.14
    return { from, options: METHODS, validFor: /^\w*$/ };
  }
  if (!ctx.explicit && before.text.length < 2) return null;
  // свои имена из кода: переменные и функции
  const text = ctx.state.doc.toString();
  const imp = importsOf(text);
  const known = new Set(GLOBAL.map((c) => c.label));
  const own: Completion[] = [];
  for (const name of new Set(text.match(/\b[A-Za-z_]\w{1,}\b/g) ?? [])) {
    if (known.has(name) || name === before.text) continue;
    const d = imp[name] ? MODULES[`${imp[name]}.${name}`] : undefined;
    own.push(d ? opt(d, 3) : { label: name, type: 'variable', boost: -1 });
  }
  return { from: before.from, options: [...GLOBAL, ...own], validFor: /^\w*$/ };
}

/** Подсказки, которые есть у всех: параметры при вводе и описание при наведении */
export function pyHints(): Extension {
  // ушёл фокус из редактора — подсказка параметров прячется
  const blur = EditorView.focusChangeEffect.of((_s, focusing) => (focusing ? null : hideSig.of(null)));
  return [sigField, sigKeys, hover, blur];
}

/** Автодополнение — отдельно, чтобы включать и выключать на лету */
export function pyCompletion(on: boolean): Extension {
  return on ? autocompletion({ override: [source], icons: false, maxRenderedOptions: 40, addToOptions: [] }) : [];
}
