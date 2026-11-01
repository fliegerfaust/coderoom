# Задачи

Задачи «Кодовой комнаты» ведутся в трекере (Kanban, проект **CR**), не в этом файле:

```bash
node /Users/Denis/Work/task-tracker/bin/tt.js board -p CR    # доска
node /Users/Denis/Work/task-tracker/bin/tt.js epics -p CR    # эпики
```

Агенты: CLI с `--as claude` или MCP `task-tracker`, правила в [CLAUDE.md](CLAUDE.md). Коды задач
(`PY.2`, `CR-5`) пишутся в коммиты; сделанное ищите в `git log`.
