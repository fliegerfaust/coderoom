import { describe, expect, it } from 'vitest';
import { parsePythonError } from '../src/python/errors';
import fx from './fixtures/py-errors.json';

const p = (k: keyof typeof fx) => parsePythonError(fx[k].raw);

describe('разбор ошибок Python (PY.2)', () => {
  it('NameError: имя без кавычек, строка и подсказка про кавычки', () => {
    const e = p('name');
    expect(e.type).toBe('NameError');
    expect(e.line).toBe(1);
    expect(e.hint).toContain('Аршак');
    expect(e.hint).toContain('кавычки');
  });
  it('внутренние кадры Pyodide убраны', () => {
    for (const k of Object.keys(fx) as Array<keyof typeof fx>) {
      const e = p(k);
      expect(e.traceback).not.toContain('_pyodide');
      expect(e.traceback).not.toContain('python314.zip');
    }
  });
  it('SyntaxError без двоеточия', () => {
    const e = p('colon');
    expect(e.type).toBe('SyntaxError');
    expect(e.line).toBe(1);
    expect(e.hint).toContain('двоеточие');
  });
  it('IndentationError после if — строка 3', () => {
    const e = p('indent');
    expect(e.type).toBe('IndentationError');
    expect(e.line).toBe(3);
    expect(e.hint).toContain('отступ');
  });
  it('ошибка внутри функции указывает на самую глубокую строку программы', () => {
    const e = p('zero');
    expect(e.type).toBe('ZeroDivisionError');
    expect(e.line).toBe(2);
    expect(e.traceback).toContain('Строка 3');
    expect(e.traceback).toContain('Строка 2');
  });
  it('подсказки к частым ошибкам', () => {
    expect(p('concat').hint).toContain('str(x)');
    expect(p('index').hint).toContain('с 0');
    expect(p('intval').hint).toContain('int(s, 2)');
    expect(p('unclosed').hint).toMatch(/[Сс]кобка/);
    expect(p('file').hint).toContain('файл');
    expect(p('eq').type).toBe('SyntaxError');
  });
  it('каретка ^ остаётся под своим местом', () => {
    const lines = p('concat').traceback.split('\n');
    const i = lines.findIndex((l) => l.includes("print('a' + 1)"));
    expect(lines[i + 1].trim()).toMatch(/^[~^]+$/);
    expect(lines[i + 1].indexOf('~')).toBe(lines[i].indexOf("'a'"));
  });
  it('опечатка: подсказка Python «Did you mean» по-русски', () => {
    const e = p('typo');
    expect(e.type).toBe('NameError');
    expect(e.line).toBe(3);
    expect(e.hint).toContain('ipadress');
    expect(e.hint).toContain('ipaddress');
    expect(e.hint).not.toContain('кавычки');
    expect(p('attr').hint).toContain('sqrt');
    expect(p('module').hint).toContain('itertools');
  });
});
