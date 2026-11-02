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
  await s.addInitScript(() => { try { if (!sessionStorage.getItem('e2e')) { sessionStorage.setItem('e2e', '1'); localStorage.removeItem('coderoom-me'); localStorage.removeItem('coderoom-rooms'); } } catch { /* */ } });
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

test('преподаватель меняет занятие и стирает всё в комнате, у ученика тоже чисто', async ({ context }) => {
  const t = await context.newPage();
  await t.goto('./?db=local');
  await t.getByLabel('Твоё имя в комнате').fill('Денис');
  await t.getByRole('button', { name: 'Создать комнату' }).click();
  const pin = (await t.locator('.pinbig').textContent())!.trim();
  const link = (await t.locator('[data-link]').textContent())!.trim();
  await t.getByRole('button', { name: 'Готово' }).click();
  const s = await context.newPage();
  await s.addInitScript(() => { try { if (!sessionStorage.getItem('e2e')) { sessionStorage.setItem('e2e', '1'); localStorage.removeItem('coderoom-me'); localStorage.removeItem('coderoom-rooms'); } } catch { /* */ } });
  await s.goto('./?db=local#' + link.split('#')[1]);
  await s.getByLabel('Как тебя зовут').fill('Аршак');
  await s.getByLabel('PIN комнаты').fill(pin);
  await s.getByRole('button', { name: 'Войти' }).click();
  await expect(s.locator('.badge')).toHaveText('А1 · 1');
  // у ученика нет меню занятия
  await expect(s.locator('.lessonbtn')).toHaveCount(0);

  // запуск — отметка; «Сбросить» снимает её и возвращает заготовку
  await s.locator('.cm-content').click();
  await s.keyboard.press('ControlOrMeta+End');
  await s.keyboard.type('\nprint("тест")');
  await s.keyboard.press('ControlOrMeta+Enter');
  await expect(t.locator('.outbody')).toContainText('тест', { timeout: 60_000 });
  await expect(t.locator('.stack .chip.ran')).toHaveCount(1);
  await t.getByRole('button', { name: 'Сбросить', exact: true }).click();
  await expect(s.locator('.stack .chip.ran')).toHaveCount(0);
  await expect(s.locator('.cm-content')).not.toContainText('тест');
  await expect(s.locator('.outbody .empty')).toBeVisible();

  // смена занятия: у ученика открывается занятие 02
  await t.locator('.lessonbtn').click();
  await t.locator('[data-lesson="02"]').click();
  await expect(s.locator('.badge')).toHaveText('А2 · 1');
  await expect(s.locator('.lesson-name')).toContainText('Занятие 02');

  // набираем код и запускаем, потом «Стереть всё»
  await s.locator('.cm-content').click();
  await s.keyboard.press('ControlOrMeta+End');
  await s.keyboard.type('\nprint("след")');
  await s.keyboard.press('ControlOrMeta+Enter');
  await expect(t.locator('.outbody')).toContainText('след', { timeout: 60_000 });
  await t.locator('.lessonbtn').click();
  await t.getByRole('button', { name: 'Стереть всё…' }).click();
  await expect(t.getByText('Стереть всё в комнате?')).toBeVisible();
  await t.getByRole('button', { name: 'Стереть всё', exact: true }).click();

  // у обоих чистая комната того же занятия, вход без формы
  for (const p of [t, s]) {
    await expect(p.locator('.badge')).toHaveText('А2 · 1');
    await expect(p.locator('.cm-content')).not.toContainText('след');
    await expect(p.locator('.chip.ran')).toHaveCount(0);
    await expect(p.locator('.outbody .empty')).toBeVisible();
  }
  // комната живая после стирания: правка доходит
  await s.locator('.cm-content').click();
  await s.keyboard.press('ControlOrMeta+End');
  await s.keyboard.type('\nx = 42');
  await expect(t.locator('.cm-content')).toContainText('x = 42');
});

test('ученик видит только открытые задачи; «Пригласить» у преподавателя показывает ссылку и PIN', async ({ context }) => {
  const t = await context.newPage();
  await t.goto('./?db=local');
  await t.getByLabel('Твоё имя в комнате').fill('Денис');
  await t.getByRole('button', { name: 'Создать комнату' }).click();
  const pin = (await t.locator('.pinbig').textContent())!.trim();
  const link = (await t.locator('[data-link]').textContent())!.trim();
  await t.getByRole('button', { name: 'Готово' }).click();
  await expect(t.locator('.share-pop')).toHaveCount(0);

  // «Пригласить» в любой момент: та же ссылка и тот же PIN
  await t.getByRole('button', { name: 'Пригласить' }).click();
  await expect(t.locator('.share-pop .pinbig')).toHaveText(pin);
  await expect(t.locator('.share-pop [data-link]')).toHaveText(link);
  await t.keyboard.press('Escape');
  await expect(t.locator('.share-pop')).toHaveCount(0);

  const s = await context.newPage();
  await s.addInitScript(() => { try { if (!sessionStorage.getItem('e2e')) { sessionStorage.setItem('e2e', '1'); localStorage.removeItem('coderoom-me'); localStorage.removeItem('coderoom-rooms'); } } catch { /* */ } });
  await s.goto('./?db=local#' + link.split('#')[1]);
  await s.getByLabel('Как тебя зовут').fill('Аршак');
  await s.getByLabel('PIN комнаты').fill(pin);
  await s.getByRole('button', { name: 'Войти' }).click();
  await expect(s.locator('.badge')).toHaveText('А1 · 1');

  // у ученика: ни меню занятий, ни «Пригласить»; видна только открытая задача
  await expect(s.locator('.lessonbtn')).toHaveCount(0);
  await expect(s.getByRole('button', { name: 'Пригласить' })).toHaveCount(0);
  await expect(s.locator('.stack .chip')).toHaveCount(1);
  await expect(s.locator('.cardfoot button').last()).toBeDisabled();
  // у преподавателя — все 8 задач стопки
  await expect(t.locator('.stack .chip')).toHaveCount(8);

  // преподаватель открывает А1 · 3 — у ученика две задачи, вперёд по-прежнему нельзя
  await t.locator('.stack [data-task="c-a1-3"]').click();
  await expect(s.locator('.badge')).toHaveText('А1 · 3');
  await expect(s.locator('.stack .chip')).toHaveCount(2);
  await s.getByRole('button', { name: 'Мои задачи' }).click();
  await expect(s.locator('.tasklist .chip')).toHaveCount(3); // А1·1, А1·3 и «Чистый лист»
  await expect(s.locator('.tasklist')).not.toContainText('№10');
  await s.keyboard.press('Escape');

  // ученик может вернуться к уже открытой задаче
  await s.locator('.stack [data-task="c-a1-1"]').click();
  await expect(t.locator('.badge')).toHaveText('А1 · 1');
});

test('домашка выдаётся ученику; Черепаха рисует у обоих; опечатка объясняется', async ({ context }) => {
  const t = await context.newPage();
  await t.goto('./?db=local');
  await t.getByLabel('Твоё имя в комнате').fill('Денис');
  await t.getByRole('button', { name: 'Создать комнату' }).click();
  const pin = (await t.locator('.pinbig').textContent())!.trim();
  const link = (await t.locator('[data-link]').textContent())!.trim();
  await t.getByRole('button', { name: 'Готово' }).click();
  const s = await context.newPage();
  await s.addInitScript(() => { try { if (!sessionStorage.getItem('e2e')) { sessionStorage.setItem('e2e', '1'); localStorage.removeItem('coderoom-me'); localStorage.removeItem('coderoom-rooms'); } } catch { /* */ } });
  await s.goto('./?db=local#' + link.split('#')[1]);
  await s.getByLabel('Как тебя зовут').fill('Аршак');
  await s.getByLabel('PIN комнаты').fill(pin);
  await s.getByRole('button', { name: 'Войти' }).click();
  await expect(s.locator('.badge')).toHaveText('А1 · 1');
  await expect(s.locator('.homebtn')).toHaveCount(0);

  // выдаём «Дома · Python А1» (4 задачи)
  await t.getByRole('button', { name: 'Все стопки' }).click();
  await t.locator('[data-issue="home-py"]').click();
  await expect(t.locator('[data-issue="home-py"]')).toHaveText('Выдана ученику');
  await t.keyboard.press('Escape');
  await expect(s.locator('.homebtn')).toContainText('Домашка');
  await expect(s.locator('.homebtn')).toContainText('4 задачи');
  await s.getByRole('button', { name: 'Мои задачи' }).click();
  await expect(s.locator('.tasklist')).toContainText('Дома · Python А1');
  await expect(s.locator('.tasklist')).not.toContainText('Дома · ЕГЭ');
  await s.keyboard.press('Escape');
  await s.locator('.homebtn').click();
  await expect(t.locator('.badge')).toHaveText('А1 · 1');
  await expect(s.locator('.lvl')).toBeVisible();
  await expect(s.locator('.stacktitle .label')).toHaveText('Дома · Python А1');
  await expect(s.locator('.stack .chip')).toHaveCount(4);

  // снять выдачу — домашка уходит (кроме открытой сейчас)
  await t.getByRole('button', { name: 'Все стопки' }).click();
  await t.locator('[data-issue="home-py"]').click();
  await t.keyboard.press('Escape');
  await expect(s.locator('.stack .chip')).toHaveCount(1);

  // Черепаха: рисунок у обоих, во весь экран
  await t.locator('.cm-content').click();
  await t.keyboard.press('ControlOrMeta+a');
  await t.keyboard.type('from turtle import *\ntracer(0)\nlt(90)\nfor i in range(4):\nfd(100)\nrt(90)\n');
  await t.keyboard.press('ControlOrMeta+Enter');
  await expect(s.locator('.turtle figcaption')).toContainText('4 отрезка', { timeout: 60_000 });
  await expect(s.locator('.tt-svg path').nth(1)).toBeVisible();
  await s.getByRole('button', { name: 'Во весь экран' }).click();
  await expect(s.locator('.tt-full .tt-svg')).toBeVisible();
  await s.keyboard.press('Escape');
  await expect(s.locator('.tt-full')).toHaveCount(0);

  // опечатка в имени модуля
  await t.locator('.cm-content').click();
  await t.keyboard.press('ControlOrMeta+a');
  await t.keyboard.type('import ipaddress\nnet = ipadress.ip_network("1.2.3.4/24")');
  await t.keyboard.press('ControlOrMeta+Enter');
  await expect(s.locator('.err .h')).toContainText('ipaddress', { timeout: 60_000 });
  await expect(s.locator('.err .h')).toContainText('опечатк');
});
