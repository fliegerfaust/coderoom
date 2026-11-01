# Кодовая комната

Одна страница на занятие информатикой: слева задача карточкой (как на доске Holst), справа общий
редактор Python, под ним вывод. Код пишут двое сразу, у каждой строки полоска её автора, запуск
и вывод видят оба. Python работает в браузере (Pyodide), синхронизация — Firebase Realtime Database.

Продукт — [PRODUCT.md](PRODUCT.md), правила работы — [CLAUDE.md](CLAUDE.md), задачи — трекер (проект CR),
выкладка и сервисы — [DEPLOY.md](DEPLOY.md).

## Запуск

```bash
npm install
npm run dev          # http://localhost:5173, синхронизация через Firebase
                     # ?db=local — без Firebase, между вкладками одного браузера
npm run typecheck && npm test && npm run e2e
```

## Как устроено

| Папка | Что делает |
|---|---|
| `src/python/` | Pyodide в Web Worker: вывод потоком, `input()` из поля «Ввод», файлы задачи, «Стоп», разбор ошибок по-русски |
| `src/sync/` | интерфейс `Db` (Firebase или локальная база), Yjs поверх него: снимок + лог правок, присутствие |
| `src/room/` | комната: вход по ссылке и PIN (путь в базе — SHA-256), текущая задача, общий запуск |
| `src/editor/` | CodeMirror 6 + y-codemirror: курсоры с именами, полоска автора у строки |
| `src/ui/` | экраны: вход, комната (раскладка B «Карточка с доски») |
| `public/lessons/` | задачи занятий — **только экспортом** `tools/export_lesson.py`, без ответов |
| `preview/` | витрины экранов (выбор раскладки) |

## Задачи занятия

```bash
python3 tools/export_lesson.py --inf ~/Teaching/informatics --out public/lessons 01
```
