// Подпись движения комнаты: у каждой строки полоска цвета того, кто её написал (SY.3).
// Автор строки считается из самого документа Yjs: у каждого символа есть clientID вставившего.
import { gutter, GutterMarker, ViewPlugin, type ViewUpdate, type EditorView } from '@codemirror/view';
import { RangeSet, RangeSetBuilder } from '@codemirror/state';
import * as Y from 'yjs';

export interface Author { name: string; color: string }

class Bar extends GutterMarker {
  constructor(readonly a: Author) { super(); }
  eq(o: Bar) { return o.a.color === this.a.color && o.a.name === this.a.name; }
  toDOM() {
    const d = document.createElement('div');
    d.className = 'cm-author';
    d.style.background = this.a.color;
    d.title = this.a.name;
    return d;
  }
}

/** Участки текста по авторам: [начало, длина, clientID] в порядке документа. */
export function authorRuns(text: Y.Text): Array<[number, number, number]> {
  const runs: Array<[number, number, number]> = [];
  let pos = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let item: any = (text as any)._start;
  while (item) {
    if (!item.deleted && item.countable) {
      const len = item.length as number;
      const c = item.id.client as number;
      const last = runs[runs.length - 1];
      if (last && last[2] === c && last[0] + last[1] === pos) last[1] += len;
      else runs.push([pos, len, c]);
      pos += len;
    }
    item = item.right;
  }
  return runs;
}

export function authorship(text: Y.Text, clients: Y.Map<Author>) {
  const compute = (view: EditorView): RangeSet<GutterMarker> => {
    const runs = authorRuns(text);
    const b = new RangeSetBuilder<GutterMarker>();
    const doc = view.state.doc;
    if (doc.length !== text.length) return b.finish(); // ещё не догнали Yjs
    let ri = 0;
    for (let n = 1; n <= doc.lines; n++) {
      const line = doc.line(n);
      if (line.length === 0) continue;
      const count = new Map<number, number>();
      while (ri < runs.length && runs[ri][0] + runs[ri][1] <= line.from) ri++;
      for (let j = ri; j < runs.length && runs[j][0] < line.to; j++) {
        const [s, l, c] = runs[j];
        const ov = Math.min(s + l, line.to) - Math.max(s, line.from);
        if (ov > 0 && line.text.trim()) count.set(c, (count.get(c) ?? 0) + ov);
      }
      let best = -1, bestN = 0;
      count.forEach((v, c) => { if (v > bestN) { bestN = v; best = c; } });
      const a = best >= 0 ? clients.get(String(best)) : undefined;
      if (a) b.add(line.from, line.from, new Bar(a));
    }
    return b.finish();
  };

  const plugin = ViewPlugin.fromClass(class {
    markers: RangeSet<GutterMarker>;
    constructor(view: EditorView) { this.markers = compute(view); }
    update(u: ViewUpdate) { if (u.docChanged || u.transactions.length) this.markers = compute(u.view); }
  });

  return [
    plugin,
    gutter({
      class: 'cm-author-gutter',
      markers: (v) => v.plugin(plugin)?.markers ?? RangeSet.empty,
      initialSpacer: () => new Bar({ name: '', color: 'transparent' }),
    }),
  ];
}
