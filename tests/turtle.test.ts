import { describe, expect, it, beforeAll } from 'vitest';
import { loadPyodide } from 'pyodide';
import { TURTLE_PY } from '../src/python/turtle_py';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let py: any;
beforeAll(async () => {
  py = await loadPyodide({ indexURL: new URL('../node_modules/pyodide/', import.meta.url).pathname });
  py.runPython(TURTLE_PY, { globals: py.globals.get('dict')() });
}, 60_000);

const run = (code: string) => {
  py.runPython("import sys; sys.modules['turtle']._reset()");
  py.runPython(code, { globals: py.globals.get('dict')() });
  return JSON.parse(py.runPython("import sys; sys.modules['turtle']._export()"));
};

describe('Черепаха для №6 (PY.7)', () => {
  it('решение №6 в стиле ЕГЭ: from turtle import *, tracer, lt/fd/rt, up, goto, dot, done', () => {
    const d = run(`
from turtle import *
tracer(0); screensize(3000, 3000)
k = 10
lt(90)
for i in range(4):
    fd(10 * k); rt(90)
up()
for x in range(0, 11):
    for y in range(0, 11):
        goto(x * k, y * k); dot(3)
done()`);
    expect(d.segs).toHaveLength(4);
    const close = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]) < 1e-6);
    expect(close(d.segs[0].slice(0, 4), [0, 0, 0, 100])).toBe(true);
    expect(close(d.segs[1].slice(0, 4), [0, 100, 100, 100])).toBe(true);
    expect(d.dots).toHaveLength(121);
  });
  it('объект Turtle, цвета, circle, pos, heading; перо поднято — без отрезков', () => {
    const d = run(`
import turtle
t = turtle.Turtle()
t.color('red'); t.pensize(3)
t.circle(50)
t.penup(); t.goto(100, 100)
print(t.pos(), t.heading())`);
    expect(d.segs.length).toBeGreaterThan(20);
    expect(d.colors).toContain('red');
    expect(d.segs.every((s: number[]) => s[5] === 3)).toBe(true);
    expect(d.turtle.slice(0, 2)).toEqual([100, 100]);
  });
  it('каждый запуск начинается с чистого листа', () => {
    run('import turtle\nturtle.fd(50)');
    const d = run('x = 1');
    expect(d.segs).toHaveLength(0);
  });
});
