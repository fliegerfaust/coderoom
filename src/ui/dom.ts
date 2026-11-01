export function h(html: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

let toastTimer = 0;
export function toast(msg: string) {
  document.querySelector('.toast')?.remove();
  const el = h(`<div class="toast" role="status">${esc(msg)}</div>`);
  document.body.append(el);
  clearTimeout(toastTimer);
  toastTimer = self.setTimeout(() => el.remove(), 2600);
}

export async function copyText(text: string, fallbackEl?: HTMLElement): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    if (fallbackEl) { const r = document.createRange(); r.selectNodeContents(fallbackEl); const s = getSelection(); s?.removeAllRanges(); s?.addRange(r); }
    return false;
  }
}
