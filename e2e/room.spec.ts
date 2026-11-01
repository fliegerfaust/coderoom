import { test, expect, type Page } from '@playwright/test';

const typeCode = async (p: Page, text: string) => {
  await p.locator('.cm-content').click();
  await p.keyboard.press('ControlOrMeta+End');
  await p.keyboard.type(text);
};

test('преподаватель создаёт комнату, ученик входит по PIN, пишут и запускают вместе', async ({ context }) => {
  const t = await context.newPage();
  await t.goto('./?db=local');
  await t.getByLabel('Твоё имя в комнате').fill('Денис');
  await t.getByRole('button', { name: 'Создать комнату' }).click();
  const pin = (await t.locator('.pinbig').textContent())!.trim();
  const link = (await t.locator('[data-link]').textContent())!.trim();
  expect(pin).toMatch(/^\d{4}$/);
  await t.getByRole('button', { name: 'Готово' }).click();
  await expect(t.locator('.badge')).toHaveText('А1 · 1');

  // ученик: неверный PIN, потом верный
  const s = await context.newPage();
  await s.addInitScript(() => { try { localStorage.removeItem('coderoom-me'); localStorage.removeItem('coderoom-rooms'); } catch { /* */ } });
  await s.goto(link.replace(/^.*?\?/, './?').replace('#', '&x=1#').replace('&x=1', ''));
  await s.getByLabel('Как тебя зовут').fill('Аршак');
  await s.getByLabel('PIN комнаты').fill(pin === '0000' ? '1111' : '0000');
  await s.getByRole('button', { name: 'Войти' }).click();
  await expect(s.getByText('Комната не найдена')).toBeVisible();
  await s.getByLabel('PIN комнаты').fill(pin);
  await s.getByRole('button', { name: 'Войти' }).click();
  await expect(s.locator('.badge')).toHaveText('А1 · 1');

  // оба видят друг друга
  await expect(t.locator('.peer', { hasText: 'Аршак' })).toBeVisible();
  await expect(s.locator('.peer', { hasText: 'Денис' })).toBeVisible();

  // учитель переходит к №10 · Б4 — у ученика открывается та же задача
  await t.getByRole('button', { name: 'Все стопки' }).click();
  await t.locator('.tasklist [data-task="c-e10-b4"]').click();
  await expect(s.locator('.badge')).toHaveText('№10 · Б4');

  // пишут оба
  await typeCode(s, '\nprint(200 & 224)');
  await expect(t.locator('.cm-content')).toContainText('print(200 & 224)');
  await typeCode(t, '\nprint(172 + 16 + (200 & 224) + 0)');
  await expect(s.locator('.cm-content')).toContainText('print(172 + 16');
  // полоски авторства двух цветов
  const bars = t.locator('.cm-author:not([title=""])');
  await expect(bars).toHaveCount(3);
  await expect(bars.nth(1)).toHaveAttribute('title', 'Аршак');
  await expect(bars.nth(2)).toHaveAttribute('title', 'Денис');

  // ученик запускает — вывод у обоих
  await s.getByRole('button', { name: /Запустить/ }).click();
  await expect(s.locator('.outbody')).toContainText('380', { timeout: 60_000 });
  await expect(t.locator('.outbody')).toContainText('380');
  await expect(t.locator('[data-el="runInfo"]')).toContainText('Запустил Аршак');

  // ошибка с пояснением
  await typeCode(t, '\nprint(Аршак)');
  await t.keyboard.press('ControlOrMeta+Enter');
  await expect(s.locator('.err .t')).toContainText('NameError · строка 5');
  await expect(s.locator('.err .h')).toContainText('кавычки');

  // бесконечный цикл: стоп с другой стороны
  await t.locator('.cm-content').click();
  await t.keyboard.press('ControlOrMeta+a');
  await t.keyboard.type('while True:\n    pass');
  await t.keyboard.press('ControlOrMeta+Enter');
  await expect(s.locator('.status')).toContainText('Идёт');
  await s.getByRole('button', { name: 'Стоп', exact: true }).click();
  await expect(t.locator('.status')).toContainText('Остановлено');

  // после стопа Python снова работает
  await t.keyboard.press('ControlOrMeta+a');
  await t.keyboard.type('print(input() * 2)');
  await t.locator('#stdin').fill('ab');
  await t.keyboard.press('Escape');
  await t.locator('.cm-content').click();
  await t.keyboard.press('ControlOrMeta+Enter');
  await expect(s.locator('.outbody')).toContainText('abab', { timeout: 60_000 });
});
