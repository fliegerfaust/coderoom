/// <reference lib="webworker" />
// Python (Pyodide) в отдельном потоке: страница не замирает, «Стоп» — terminate() (PY.1, PY.3).
import type { FromWorker, ToWorker } from './protocol';
import { PROGRAM_FILE } from './errors';

declare const self: DedicatedWorkerGlobalScope;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Py = any;

let py: Py = null;
let ready: Promise<void> | null = null;
let current = '';
let stdinLines: string[] = [];

const post = (m: FromWorker) => self.postMessage(m);

function hookIO() {
  const dec = new TextDecoder();
  py.setStdout({ write: (b: Uint8Array) => { post({ t: 'out', id: current, s: dec.decode(b, { stream: true }) }); return b.length; } });
  const decErr = new TextDecoder();
  py.setStderr({ write: (b: Uint8Array) => { post({ t: 'err', id: current, s: decErr.decode(b, { stream: true }) }); return b.length; } });
  py.setStdin({ stdin: () => (stdinLines.length ? stdinLines.shift()! + '\n' : null), autoEOF: true });
}

async function init(indexURL: string) {
  const t0 = performance.now();
  const mod = await import(/* @vite-ignore */ indexURL + 'pyodide.mjs');
  py = await mod.loadPyodide({ indexURL });
  hookIO();
  // input() печатает подсказку и перевод строки, как в IDLE с вводом из файла
  py.runPython(`
import builtins, sys
_input = builtins.input
def input(prompt=''):
    if prompt:
        sys.stdout.write(str(prompt)); sys.stdout.flush()
    s = sys.stdin.readline()
    if s == '':
        raise EOFError('EOF when reading a line')
    s = s.rstrip('\\n')
    sys.stdout.write(s + '\\n')
    return s
builtins.input = input
`);
  post({ t: 'ready', ms: Math.round(performance.now() - t0) });
}

async function run(m: Extract<ToWorker, { t: 'run' }>) {
  await ready;
  current = m.id;
  stdinLines = m.stdin.length ? m.stdin.replace(/\r/g, '').split('\n') : [];
  const t0 = performance.now();
  try {
    for (const f of m.files) {
      const buf = new Uint8Array(await (await fetch(f.url)).arrayBuffer());
      py.FS.writeFile(f.name, buf);
    }
    py.FS.writeFile(PROGRAM_FILE, new TextEncoder().encode(m.code));
    const globals = py.globals.get('dict')();
    globals.set('__name__', '__main__');
    try {
      await py.runPythonAsync(m.code, { globals, filename: PROGRAM_FILE, dedent: false });
    } finally {
      py.runPython('import sys; sys.stdout.flush(); sys.stderr.flush()');
      globals.destroy();
    }
    post({ t: 'done', id: m.id, ms: Math.round(performance.now() - t0) });
  } catch (e) {
    try { py.runPython('import sys; sys.stdout.flush()'); } catch { /* */ }
    post({ t: 'exc', id: m.id, raw: String((e as Error)?.message ?? e), ms: Math.round(performance.now() - t0) });
  }
}

self.onmessage = (ev: MessageEvent<ToWorker>) => {
  const m = ev.data;
  if (m.t === 'init') ready = init(m.indexURL).catch((e) => post({ t: 'fatal', s: String(e?.message ?? e) }));
  else if (m.t === 'run') void run(m);
};
