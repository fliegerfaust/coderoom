# Выкладка и сервисы

## Сайт — GitHub Pages
- Репозиторий `fliegerfaust/coderoom` (публичный), Pages → Source: GitHub Actions.
- Выкладка только тегом: релиз мёржится в `main` `--no-ff`, на мёрдж ставится тег `vX.Y.Z`, пуш тега
  запускает `.github/workflows/pages.yml`. Откат — ручной запуск workflow с прошлым тегом.
- Адрес: https://fliegerfaust.github.io/coderoom/

## Синхронизация — Firebase Realtime Database
- Проект `denval-coderoom` (аккаунт denis.bezik@gmail.com), база `denval-coderoom-default-rtdb`,
  регион europe-west1 (Бельгия), бесплатный тариф Spark.
- Правила — `database.rules.json` (копия опубликованных в консоли): корень закрыт, открыт только
  `rooms/<64 hex>`. Путь комнаты = SHA-256 от комнаты и PIN, поэтому без PIN комнату не найти.
  Правишь файл — публикуешь его в консоли (Realtime Database → Rules).
- Конфиг — `src/firebase-config.ts`: для базы без входа нужен только `databaseURL`.
- Проверка правил: запись в `rooms/<64 hex>` — 200, чтение корня и `rooms` — 401.

## Если Firebase недоступен
Комната открывается с `?db=local`: синхронизация только между вкладками одного браузера
(для подготовки и показа). Замена транспорта — задача в бэклоге трекера.
