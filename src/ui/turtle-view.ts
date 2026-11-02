// Рисунок Черепахи (№6) в окне вывода и во весь экран (PY.7).
// Ось y в Черепахе смотрит вверх, в SVG — вниз: рисуем в координатах (x, -y).
import type { TurtleDraw } from '../python/protocol';
import { h, esc } from './dom';

interface Box { x: number; y: number; w: number; h: number }

function bounds(d: TurtleDraw): Box {
  let x0 = 0, y0 = 0, x1 = 0, y1 = 0;
  const add = (x: number, y: number) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, -y); y1 = Math.max(y1, -y); };
  for (const s of d.segs ?? []) { add(s[0], s[1]); add(s[2], s[3]); }
  for (const p of d.dots ?? []) add(p[0], p[1]);
  for (const f of d.fills ?? []) for (const p of f[0] ?? []) add(p[0], p[1]);
  const w = Math.max(x1 - x0, 1), hh = Math.max(y1 - y0, 1), pad = Math.max(w, hh) * 0.06 + 4;
  return { x: x0 - pad, y: y0 - pad, w: w + 2 * pad, h: hh + 2 * pad };
}

/** SVG рисунка; px — ширина, под которую считаются размеры точек */
export function turtleSvg(d: TurtleDraw, px = 560, view?: Box): string {
  const b = view ?? bounds(d);
  const u = b.w / px; // единиц мира на пиксель
  const col = (i: number) => esc(d.colors?.[i] ?? '#141414');
  const fills = (d.fills ?? []).map(([pts, c]) =>
    `<polygon points="${(pts ?? []).map((p) => `${p[0]},${-p[1]}`).join(' ')}" fill="${col(c)}" fill-opacity=".18" stroke="none"/>`).join('');
  // отрезки одного цвета и толщины — одним path
  const groups = new Map<string, string[]>();
  for (const s of d.segs ?? []) {
    const k = `${s[4]}|${s[5]}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(`M${s[0]} ${-s[1]}L${s[2]} ${-s[3]}`);
  }
  const lines = [...groups].map(([k, ds]) => {
    const [c, w] = k.split('|').map(Number);
    return `<path d="${ds.join('')}" stroke="${col(c)}" stroke-width="${Math.max(1, w) * 1.5}" fill="none" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/>`;
  }).join('');
  const dots = (d.dots ?? []).map((p) => `<circle cx="${p[0]}" cy="${-p[1]}" r="${Math.max(1.6, (p[2] || 4) / 2) * u}" fill="${col(p[3])}"/>`).join('');
  const [tx, ty, th, vis] = d.turtle ?? [0, 0, 0, false];
  const s = 9 * u, a = (-th * Math.PI) / 180;
  const tri = (dx: number, dy: number) => `${tx + dx * Math.cos(a) - dy * Math.sin(a)},${-ty + dx * Math.sin(a) + dy * Math.cos(a)}`;
  const turtle = vis ? `<polygon class="tt-head" points="${tri(s, 0)} ${tri(-s * 0.7, s * 0.6)} ${tri(-s * 0.7, -s * 0.6)}"/>` : '';
  const axes = `<path class="tt-axis" d="M${b.x} 0H${b.x + b.w}M0 ${b.y}V${b.y + b.h}" vector-effect="non-scaling-stroke"/>`;
  return `<svg class="tt-svg" viewBox="${b.x} ${b.y} ${b.w} ${b.h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Рисунок Черепахи">${axes}${fills}${lines}${dots}${turtle}</svg>`;
}

export function turtleFigure(d: TurtleDraw): string {
  const n = (d.segs?.length ?? 0), m = (d.dots?.length ?? 0);
  return `<figure class="turtle"><div class="tt-box">${turtleSvg(d)}</div>
    <figcaption><span>Черепаха: ${n} ${plural(n, 'отрезок', 'отрезка', 'отрезков')}${m ? `, ${m} ${plural(m, 'точка', 'точки', 'точек')}` : ''}${d.cut ? ' · показаны первые 40 000' : ''}</span>
    <button class="btn ghost" type="button" data-act="turtle-full">Во весь экран</button></figcaption></figure>`;
}

/** Во весь экран: колесо — масштаб к курсору, перетаскивание — сдвиг, Esc — закрыть */
export function openTurtleFull(d: TurtleDraw) {
  const base = bounds(d);
  let v: Box = { ...base };
  const el = h(`<div class="tt-full" role="dialog" aria-label="Рисунок Черепахи во весь экран">
    <div class="tt-full-bar"><b>Рисунок Черепахи</b><span>Колесо — масштаб, перетаскивание — сдвиг</span><span class="sp"></span>
      <button class="btn" type="button" data-z="in">Крупнее</button><button class="btn" type="button" data-z="out">Мельче</button>
      <button class="btn" type="button" data-z="fit">Целиком</button><button class="btn" type="button" data-z="close">Закрыть</button></div>
    <div class="tt-full-box"></div></div>`);
  const box = el.querySelector<HTMLElement>('.tt-full-box')!;
  const draw = () => { box.innerHTML = turtleSvg(d, box.clientWidth || 1200, v); };
  const zoom = (k: number, cx = 0.5, cy = 0.5) => {
    const nw = v.w * k, nh = v.h * k;
    v = { x: v.x + (v.w - nw) * cx, y: v.y + (v.h - nh) * cy, w: nw, h: nh };
    draw();
  };
  box.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = box.getBoundingClientRect();
    zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  }, { passive: false });
  let drag: { x: number; y: number; v: Box } | null = null;
  box.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, v: { ...v } }; box.setPointerCapture(e.pointerId); });
  box.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const r = box.getBoundingClientRect(), k = Math.max(drag.v.w / r.width, drag.v.h / r.height);
    v = { ...drag.v, x: drag.v.x - (e.clientX - drag.x) * k, y: drag.v.y - (e.clientY - drag.y) * k };
    draw();
  });
  box.addEventListener('pointerup', () => { drag = null; });
  const close = () => { el.remove(); removeEventListener('keydown', onKey); };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
  addEventListener('keydown', onKey);
  el.addEventListener('click', (e) => {
    const z = (e.target as HTMLElement).closest<HTMLElement>('[data-z]')?.dataset.z;
    if (z === 'in') zoom(1 / 1.5); else if (z === 'out') zoom(1.5); else if (z === 'fit') { v = { ...base }; draw(); } else if (z === 'close') close();
  });
  document.body.append(el);
  draw();
}

function plural(n: number, one: string, few: string, many: string) {
  const a = n % 10, b = n % 100;
  return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many;
}
