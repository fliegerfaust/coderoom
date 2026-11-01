// Pyodide лежит на нашем сайте: не зависим от CDN (PY.1).
import { cpSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const src = 'node_modules/pyodide';
const dst = 'public/pyodide';
const ver = JSON.parse(readFileSync(join(src, 'package.json'), 'utf8')).version;
const stamp = join(dst, `.v${ver}`);
if (existsSync(stamp)) process.exit(0);
mkdirSync(dst, { recursive: true });
for (const f of ['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json'])
  cpSync(join(src, f), join(dst, f));
cpSync(join(src, 'package.json'), stamp);
console.log(`pyodide ${ver} → ${dst}`);
