// Настоящие трейсбеки Pyodide для тестов разбора ошибок (PY.2).
import { loadPyodide } from '../node_modules/pyodide/pyodide.mjs';
import { writeFileSync } from 'node:fs';
const py = await loadPyodide();
const cases = {
  name: "print(Аршак)",
  colon: "for i in range(3)\n    print(i)",
  indent: "x = 5\nif x > 2:\nprint(x)",
  concat: "print('a' + 1)",
  zero: "def f(n):\n    return 1/n\nprint(f(0))",
  index: "w = 'КОТ'\nprint(w[3])",
  intval: "print(int('0b101'))",
  eq: "x = 3\nif x = 3:\n    print(x)",
  unclosed: "print((1 + 2)",
  file: "f = open('17.txt')",
};
const out = {};
for (const [k, code] of Object.entries(cases)) {
  try { await py.runPythonAsync(code, { filename: 'program.py', dedent: false, globals: py.globals.get('dict')() }); }
  catch (e) { out[k] = { code, raw: e.message }; }
}
writeFileSync('tests/fixtures/py-errors.json', JSON.stringify(out, null, 1));
console.log(Object.keys(out).join(' '));
