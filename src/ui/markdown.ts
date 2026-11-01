// Условие задачи: Markdown + формулы $…$ (KaTeX) + блоки кода.
import { Marked } from 'marked';
import katex from 'katex';

const md = new Marked({ gfm: true, breaks: true });

/** $…$ и $$…$$ → KaTeX до разбора Markdown, внутри `кода` формулы не трогаем. */
export function renderStatement(src: string): string {
  const keep: string[] = [];
  const stash = (h: string) => { keep.push(h); return `\u0000${keep.length - 1}\u0000`; };
  let s = src.replace(/```[\s\S]*?```|`[^`\n]+`/g, (m) => stash(m));
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_m, f) => stash(katex.renderToString(f, { displayMode: true, throwOnError: false })));
  s = s.replace(/\$([^$\n]+?)\$/g, (_m, f) => stash(katex.renderToString(f, { throwOnError: false })));
  // код возвращаем до разбора, KaTeX — после, чтобы Markdown его не испортил
  s = s.replace(/\u0000(\d+)\u0000/g, (m, i) => (keep[+i].startsWith('`') ? keep[+i] : m));
  let html = md.parse(s) as string;
  html = html.replace(/\u0000(\d+)\u0000/g, (_m, i) => keep[+i]);
  return html;
}
