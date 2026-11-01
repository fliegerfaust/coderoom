// Синхронизация на живом сайте: два независимых браузера (как два компьютера) через Firebase.
import { test, expect, type Browser, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';

const DB = 'https://denval-coderoom-default-rtdb.europe-west1.firebasedatabase.app';
const lines = (p: Page) => p.evaluate(() => [...document.querySelectorAll('.cm-line')].map((l) => {
  const c = l.cloneNode(true) as HTMLElement;
  c.querySelectorAll('.cm-ySelectionInfo, .cm-ySelectionCaret, .cm-widgetBuffer').forEach((x) => x.remove());
  return (c.textContent ?? '').replace(/\u2060|\u00a0/g, '');
}).join('\n'));

async function person(browser: Browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  return { ctx, page };
}
async function toEnd(p: Page) { await p.locator('.cm-content').click(); await p.keyboard.press('ControlOrMeta+End'); }
async function same(a: Page, b: Page, label: string) {
  await expect.poll(async () => (await lines(a)) === (await lines(b)), { message: label, timeout: 30_000 }).toBe(true);
}

test('живой Firebase: два компьютера, одновременный набор, сжатие лога, офлайн, перезагрузка', async ({ browser }) => {
  const T = await person(browser), S = await person(browser);
  const t = T.page, s = S.page;
  const log: string[] = [];

  // преподаватель создаёт комнату
  await t.goto('./');
  await t.getByLabel('Твоё имя в комнате').fill('Денис-тест');
  await t.getByRole('button', { name: 'Создать комнату' }).click();
  const pin = (await t.locator('.pinbig').textContent())!.trim();
  const link = (await t.locator('[data-link]').textContent())!.trim();
  const room = link.split('#r=')[1];
  await t.getByRole('button', { name: 'Готово' }).click();

  // ученик в другом браузере
  await s.goto('./#r=' + room);
  await s.getByLabel('Как тебя зовут').fill('Аршак-тест');
  await s.getByLabel('PIN комнаты').fill(pin);
  await s.getByRole('button', { name: 'Войти' }).click();
  await expect(s.locator('.badge')).toHaveText('А1 · 1');
  await expect(t.locator('.peer', { hasText: 'Аршак-тест' })).toBeVisible();
  await expect(s.locator('.peer', { hasText: 'Денис-тест' })).toBeVisible();

  // 1. переход на задачу
  await t.getByRole('button', { name: 'Все стопки' }).click();
  await t.locator('.tasklist [data-task="c-e10-b4"]').click();
  await expect(s.locator('.badge')).toHaveText('№10 · Б4');

  // 2. задержка: строка учителя у ученика
  await toEnd(t);
  const t0 = Date.now();
  await t.keyboard.type('\nx = 1');
  await expect.poll(() => lines(s)).toContain('x = 1');
  log.push(`задержка доставки строки: ${Date.now() - t0} мс`);

  // 3. одновременный набор в разных строках
  await toEnd(s); await s.keyboard.type('\n');
  await toEnd(t); await t.keyboard.type('\n');
  await same(t, s, 'после переводов строк');
  await t.keyboard.press('ControlOrMeta+End');
  await Promise.all([
    t.keyboard.type('print("teacher teacher teacher")', { delay: 25 }),
    (async () => { await s.locator('.cm-content').click(); await s.keyboard.press('ControlOrMeta+Home'); await s.keyboard.type('# student student student\n', { delay: 25 }); })(),
  ]);
  await same(t, s, 'одновременный набор');
  const both = await lines(t);
  expect(both).toContain('print("teacher teacher teacher")');
  expect(both).toContain('# student student student');

  // 4. одновременный набор в ОДНОЙ строке — тексты сходятся, ни один символ не теряется
  await toEnd(t); await t.keyboard.type('\n');
  await same(t, s, 'новая строка');
  await toEnd(s);
  await Promise.all([t.keyboard.type('AAAAAAAAAA', { delay: 30 }), s.keyboard.type('bbbbbbbbbb', { delay: 30 })]);
  await same(t, s, 'одна строка вдвоём');
  const last = (await lines(t)).split('\n').pop()!;
  expect(last.replace(/[^A]/g, '').length).toBe(10);
  expect(last.replace(/[^b]/g, '').length).toBe(10);

  // 5. много правок — лог сжимается в снимок, новый вход видит всё
  await toEnd(t);
  await t.keyboard.type('\n' + 'z'.repeat(170), { delay: 55 });
  await same(t, s, 'после 170 правок');
  const base = 'rooms/' + createHash('sha256').update(`coderoom:${room}:${pin}`).digest('hex');
  const snap = await (await fetch(`${DB}/${base}/snap.json?shallow=true`)).json();
  const updCount = Object.keys((await (await fetch(`${DB}/${base}/upd.json?shallow=true`)).json()) ?? {}).length;
  log.push(`снимок: ${snap ? 'есть' : 'нет'}, правок в логе после сжатия: ${updCount}`);
  expect(snap).toBeTruthy();

  const S2 = await person(browser);
  await S2.page.goto('./#r=' + room);
  await S2.page.getByLabel('Как тебя зовут').fill('Третий');
  await S2.page.getByLabel('PIN комнаты').fill(pin);
  await S2.page.getByRole('button', { name: 'Войти' }).click();
  await expect(S2.page.locator('.badge')).toHaveText('№10 · Б4');
  await same(t, S2.page, 'новый вход после сжатия');
  await S2.ctx.close();

  // 6. ученик теряет сеть, оба пишут, сеть возвращается — всё сходится
  await S.ctx.setOffline(true);
  await expect(s.locator('[data-el="net"]')).toBeVisible({ timeout: 30_000 });
  await toEnd(s); await s.keyboard.type('\noffline_student = 1');
  // пока ученик без сети, у преподавателя лог сжимается: правка ученика придёт с ключом из прошлого
  await toEnd(t); await t.keyboard.type('\nonline_teacher = 2\n' + 'w'.repeat(160), { delay: 55 });
  await S.ctx.setOffline(false);
  await same(t, s, 'после возвращения сети');
  expect(await lines(t)).toContain('offline_student = 1');
  expect(await lines(s)).toContain('online_teacher = 2');

  // 7. перезагрузка ученика: код на месте, вход без формы
  const before = await lines(t);
  await s.reload();
  await expect(s.locator('.badge')).toHaveText('№10 · Б4');
  await expect.poll(() => lines(s)).toBe(before);

  // 8. запуск у ученика — вывод у преподавателя
  await s.locator('.cm-content').click();
  await s.keyboard.press('ControlOrMeta+a');
  await s.keyboard.type('print(172 + 16 + (200 & 224) + 0)');
  await same(t, s, 'перед запуском');
  await s.keyboard.press('ControlOrMeta+Enter');
  await expect(t.locator('.outbody')).toContainText('380', { timeout: 60_000 });
  await expect(t.locator('[data-el="runInfo"]')).toContainText('Аршак-тест');

  console.log(log.join('\n'));
  // уборка: тестовая комната удаляется из базы
  await fetch(`${DB}/${base}.json`, { method: 'DELETE' });
  await T.ctx.close(); await S.ctx.close();
});
