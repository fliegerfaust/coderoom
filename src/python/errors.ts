// Ошибка Python → короткое объяснение по-русски (PY.2).
// Трейсбек Pyodide содержит внутренние кадры; оставляем только строки программы ученика.

export const PROGRAM_FILE = 'program.py';

export interface FriendlyError {
  /** Тип ошибки: NameError, SyntaxError … */
  type: string;
  /** Сообщение Python как есть: «name 'x' is not defined» */
  message: string;
  /** Номер строки в коде ученика, если известен */
  line: number | null;
  /** Пояснение по-русски, на «ты» */
  hint: string;
  /** Очищенный трейсбек: только кадры program.py и последняя строка */
  traceback: string;
}

const HINTS: Array<[RegExp, (m: RegExpMatchArray, msg: string) => string]> = [
  [/^NameError$/, (_m, msg) => {
    const name = msg.match(/name '(.+?)' is not defined/)?.[1];
    return name
      ? `Python не знает, что такое «${name}». Проверь написание. Если это текст, возьми его в кавычки: '${name}'.`
      : 'Python не знает этого имени. Проверь написание или задай переменную раньше.';
  }],
  [/^IndentationError$/, (_m, msg) =>
    /expected an indented block/.test(msg)
      ? 'После строки с двоеточием (`for`, `if`, `while`, `def`) нужна строка с отступом: 4 пробела или Tab.'
      : /unindent does not match/.test(msg)
        ? 'Отступы в блоке разные. Строки одного блока начинаются с одинакового числа пробелов.'
        : 'Отступ не на месте: лишний или потерянный. Сравни с соседними строками.'],
  [/^TabError$/, () => 'В отступах смешаны пробелы и Tab. Сделай отступы одинаковыми.'],
  [/^SyntaxError$/, (_m, msg) => {
    if (/was never closed/.test(msg)) return 'Скобка или кавычка открыта и не закрыта.';
    if (/unmatched/.test(msg)) return 'Лишняя закрывающая скобка.';
    if (/expected ':'/.test(msg)) return 'В конце строки с `for`, `if`, `while`, `def` нужно двоеточие.';
    if (/invalid syntax\. Maybe you meant '==' or ':=' instead of '='\?|cannot assign/.test(msg))
      return 'В условии сравнение пишется двумя знаками: `==`. Один `=` — это «положить в переменную».';
    if (/unterminated string/.test(msg)) return 'Строка начата кавычкой и не закрыта.';
    if (/invalid decimal literal|invalid character/.test(msg)) return 'В строке есть символ, который Python не понимает. Проверь, нет ли русской буквы вместо латинской или лишнего знака.';
    return 'Python не может прочитать эту строку. Проверь скобки, кавычки и двоеточия.';
  }],
  [/^TypeError$/, (_m, msg) => {
    if (/can only concatenate str|unsupported operand type\(s\) for \+: 'int' and 'str'/.test(msg))
      return 'Складываешь число и строку. Число в строку: `str(x)`, строку в число: `int(s)`.';
    if (/not callable/.test(msg)) return 'Скобки после имени, которое не функция. Возможно, пропущен знак `*` или имя занято переменной.';
    if (/not iterable/.test(msg)) return 'Цикл `for` идёт только по строке, списку или `range(…)`, а здесь число. Для чисел: `range(n)`.';
    if (/missing \d+ required positional argument/.test(msg)) return 'Функции не хватает аргументов в скобках.';
    return 'Операция не подходит к таким данным. Посмотри, что лежит в переменных: число или строка.';
  }],
  [/^ZeroDivisionError$/, () => 'Деление на ноль. Проверь, что делитель не равен 0.'],
  [/^IndexError$/, () => 'Номер элемента вышел за край: счёт идёт с 0, последний элемент — `[-1]` или `[len(x) - 1]`.'],
  [/^KeyError$/, () => 'В словаре нет такого ключа.'],
  [/^ValueError$/, (_m, msg) =>
    /invalid literal for int\(\)/.test(msg)
      ? 'В `int(…)` попала строка, которая не число. Для двоичной записи нужен второй аргумент: `int(s, 2)`.'
      : 'Значение не подходит: например, `int(\'abc\')`.'],
  [/^AttributeError$/, (_m, msg) => {
    const a = msg.match(/has no attribute '(.+?)'/)?.[1];
    return a ? `У этого значения нет «${a}». Проверь написание после точки.` : 'Нет такого метода у этого значения.';
  }],
  [/^EOFError$/, () => 'Программа просит `input()`, а строки в поле «Ввод» закончились. Допиши их туда, по одной на строку.'],
  [/^FileNotFoundError$/, () => 'Такого файла нет. Имя файла пишется точно как в условии, вместе с `.txt`.'],
  [/^RecursionError$/, () => 'Функция вызывает себя без остановки. Проверь условие выхода из рекурсии.'],
  [/^ModuleNotFoundError$/, () => 'Такой библиотеки здесь нет. Для ЕГЭ хватает встроенных: `itertools`, `math`, `ipaddress`, `functools`.'],
  [/^KeyboardInterrupt$/, () => 'Программу остановили.'],
];

/** Разбирает текст исключения Pyodide (PythonError.message). */
export function parsePythonError(raw: string): FriendlyError {
  const lines = raw.replace(/\r/g, '').split('\n').filter((l) => l.length > 0);
  // последняя строка вида «Type: message» (или просто «Type»)
  let lastIdx = lines.length - 1;
  while (lastIdx > 0 && /^\s/.test(lines[lastIdx])) lastIdx--;
  const last = lines[lastIdx] ?? raw;
  const m = last.match(/^([A-Za-z_][\w.]*?(?:Error|Exception|Exit|Interrupt|Warning)|[A-Za-z_]\w*Error)(?::\s?(.*))?$/);
  const type = m ? m[1].split('.').pop()! : 'Error';
  const message = m ? (m[2] ?? '') : last;

  // кадры программы ученика: «  File "program.py", line 3, in <module>» + строка кода
  const kept: string[] = [];
  let line: number | null = null;
  for (let i = 0; i < lines.length; i++) {
    const fm = lines[i].match(/^\s*File "([^"]+)", line (\d+)/);
    if (!fm) continue;
    if (fm[1] !== PROGRAM_FILE) continue;
    line = Number(fm[2]);
    kept.push(`Строка ${fm[2]}`);
    const code = lines[i + 1];
    if (code && !/^\s*File "/.test(code) && /^\s{2,}/.test(code)) {
      const codeIndent = code.length - code.trimStart().length;
      kept.push('    ' + code.trim());
      // строка с ^^^^ под кодом — сдвигаем вместе с кодом
      const caret = lines[i + 2];
      if (caret && /^\s*[\^~]+\s*$/.test(caret)) {
        const caretIndent = caret.length - caret.trimStart().length;
        kept.push('    ' + ' '.repeat(Math.max(0, caretIndent - codeIndent)) + caret.trim());
      }
    }
  }
  // у SyntaxError строка указана без кадра «in <module>»
  if (line === null) {
    const sm = raw.match(/File "program\.py", line (\d+)/);
    if (sm) line = Number(sm[1]);
  }
  kept.push(last);

  let hint = 'Что-то пошло не так. Прочитай последнюю строку ошибки — там сказано, что именно.';
  for (const [re, fn] of HINTS) {
    const mm = type.match(re);
    if (mm) { hint = fn(mm, message); break; }
  }
  return { type, message, line, hint, traceback: kept.join('\n') };
}
