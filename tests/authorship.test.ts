import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { authorRuns } from '../src/editor/authorship';

describe('авторство строк из Yjs (SY.3)', () => {
  it('символы двух клиентов разделяются по участкам', () => {
    const a = new Y.Doc(), b = new Y.Doc();
    a.getText('t').insert(0, 'print(1)\n');
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    b.getText('t').insert(9, 'print(2)\n');
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    const runs = authorRuns(a.getText('t'));
    expect(runs).toEqual([[0, 9, a.clientID], [9, 9, b.clientID]]);
  });
  it('удалённые символы не считаются', () => {
    const a = new Y.Doc();
    const t = a.getText('t');
    t.insert(0, 'abcdef');
    t.delete(1, 3);
    expect(authorRuns(t)).toEqual([[0, 3, a.clientID]]);
  });
});
