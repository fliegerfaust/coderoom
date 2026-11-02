import { describe, it, expect } from 'vitest';
import { callContext, lookup, importsOf, activeParam, signature } from '../src/editor/pydocs';

const at = (s: string) => callContext(s.replace('|', ''), s.indexOf('|'));

describe('разбор вызова под курсором', () => {
  it('имя и номер аргумента', () => {
    expect(at('print(1, |')).toMatchObject({ callee: 'print', arg: 1 });
    expect(at('x = range(|')).toMatchObject({ callee: 'range', arg: 0 });
    expect(at('print(len(s), |')).toMatchObject({ callee: 'print', arg: 1 });
    expect(at('print(len(s|')).toMatchObject({ callee: 'len', arg: 0 });
  });
  it('скобки и запятые в строках не мешают', () => {
    expect(at("print('a, (b', |")).toMatchObject({ callee: 'print', arg: 1 });
    expect(at("s.split(',|")).toMatchObject({ callee: 's.split', arg: 0 });
  });
  it('именованный аргумент', () => {
    expect(at("print(a, sep=|")).toMatchObject({ named: 'sep' });
    expect(at("product('АБ', repeat=4|")).toMatchObject({ callee: 'product', named: 'repeat', arg: 1 });
  });
  it('метод и модуль', () => {
    expect(at('math.sqrt(|')!.callee).toBe('math.sqrt');
    expect(at('bin(x)[2:].zfill(|')!.callee).toBe('?.zfill');
    expect(at("'.'.join(|")!.callee).toBe('___.join');
  });
  it('нет вызова', () => {
    expect(at('x = 5|')).toBeNull();
    expect(at('print(1)|')).toBeNull();
    expect(at('a = [1, |')).toBeNull();
    expect(at('if (x > |')).toBeNull();
    expect(at('def f(n|')).toBeNull();
  });
  it('многострочный вызов', () => {
    expect(at('print(1,\n      2, |')).toMatchObject({ callee: 'print', arg: 2 });
  });
});

describe('справочник', () => {
  it('находит встроенные, модульные и методы', () => {
    expect(lookup('print')!.name).toBe('print');
    expect(lookup('math.ceil')!.name).toBe('ceil');
    expect(lookup('s.split')!.name).toBe('split');
    expect(lookup('?.zfill')!.name).toBe('zfill');
    expect(lookup('net.network_address')!.kind).toBe('property');
    expect(lookup('nothing_here')).toBeNull();
  });
  it('from … import', () => {
    const imp = importsOf('from itertools import product, permutations\nfrom turtle import *\n');
    expect(lookup('product', imp)!.name).toBe('product');
    expect(lookup('fd', imp)!.name).toBe('fd');
    expect(lookup('product')).toBeNull();
  });
  it('какой параметр подсветить', () => {
    const p = lookup('print')!;
    expect(activeParam(p, { callee: 'print', arg: 3, named: null, from: 0 })).toBe(0);
    expect(activeParam(p, { callee: 'print', arg: 1, named: 'end', from: 0 })).toBe(2);
    const r = lookup('range')!;
    expect(activeParam(r, { callee: 'range', arg: 1, named: null, from: 0 })).toBe(1);
    expect(signature(r)).toBe('range(start, stop?, step?)');
  });
});
