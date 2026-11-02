// Справочник Python для подсказок в редакторе (ED.4): параметры, коротко по-русски, пример.
// Только то, что встречается в атомах «Азы Python» и в ЕГЭ — подсказка учит, а не заваливает.

export interface Param { name: string; desc: string; opt?: boolean }
export interface PyDoc {
  /** как писать: «range(start, stop, step)» собирается из name + params */
  name: string;
  params: Param[];
  desc: string;
  ret?: string;
  ex?: string;
  /** метод — пишется после точки */
  method?: boolean;
  kind?: 'function' | 'method' | 'class' | 'module' | 'property' | 'keyword';
}

const P = (name: string, desc: string, opt = false): Param => ({ name, desc, opt });
const d = (name: string, params: Param[], desc: string, ret?: string, ex?: string, kind: PyDoc['kind'] = 'function'): PyDoc =>
  ({ name, params, desc, ret, ex, kind });
const m = (name: string, params: Param[], desc: string, ret?: string, ex?: string): PyDoc =>
  ({ name, params, desc, ret, ex, method: true, kind: 'method' });
const prop = (name: string, desc: string, ex?: string): PyDoc => ({ name, params: [], desc, ex, method: true, kind: 'property' });

/** Встроенные функции и типы */
export const BUILTINS: Record<string, PyDoc> = {
  print: d('print', [P('*объекты', 'что напечатать, через запятую'), P('sep', 'чем разделять, по умолчанию пробел', true), P('end', 'чем закончить строку, по умолчанию перевод строки', true)],
    'Печатает значения в окно вывода.', undefined, "print(17 // 5, 17 % 5)   # 3 2\nprint('a', 'b', sep='-')  # a-b"),
  input: d('input', [P('подсказка', 'текст перед вводом', true)], 'Читает одну строку из поля «Ввод». Всегда возвращает строку — для числа нужен int().', 'str', 'n = int(input())'),
  range: d('range', [P('start', 'с какого числа; если число одно — это stop: range(5) → 0…4'), P('stop', 'до какого числа — сам stop НЕ входит', true), P('step', 'шаг, по умолчанию 1', true)],
    'Последовательность целых чисел для цикла for. Один аргумент — это stop: range(5) даёт 0, 1, 2, 3, 4.', 'range', 'for i in range(1, 10, 2):  # 1 3 5 7 9'),
  len: d('len', [P('x', 'строка, список, множество, словарь')], 'Длина: сколько символов в строке или элементов в списке.', 'int', "len('КОТ')  # 3"),
  int: d('int', [P('x', 'строка или число'), P('base', 'основание системы счисления, по умолчанию 10', true)],
    'Превращает в целое число. Со вторым аргументом читает запись в другой системе.', 'int', "int('101', 2)  # 5\nint('ff', 16)  # 255", 'class'),
  str: d('str', [P('x', 'что превратить в строку')], 'Превращает в строку: число 5 → \'5\'.', 'str', "str(2027)[-1]  # '7'", 'class'),
  float: d('float', [P('x', 'строка или число')], 'Превращает в дробное число.', 'float', undefined, 'class'),
  bool: d('bool', [P('x', 'любое значение')], 'True или False: 0, пустая строка и пустой список — False.', 'bool', undefined, 'class'),
  list: d('list', [P('x', 'что превратить в список: строку, range, множество', true)], 'Список — ряд значений по порядку.', 'list', "list('КОТ')  # ['К', 'О', 'Т']", 'class'),
  set: d('set', [P('x', 'из чего собрать множество', true)], 'Множество: без повторов и без порядка. Удобно считать «сколько разных».', 'set', "len(set('КОЛОКОЛ'))  # 3", 'class'),
  dict: d('dict', [], 'Словарь: пары «ключ → значение».', 'dict', "d = {'a': 1}", 'class'),
  tuple: d('tuple', [P('x', 'из чего собрать кортеж', true)], 'Кортеж — неизменяемый список.', 'tuple', undefined, 'class'),
  bin: d('bin', [P('x', 'целое число')], "Двоичная запись числа строкой с меткой '0b'.", 'str', "bin(93)       # '0b1011101'\nbin(93)[2:]   # '1011101'"),
  oct: d('oct', [P('x', 'целое число')], "Восьмеричная запись строкой с меткой '0o'.", 'str', "oct(8)  # '0o10'"),
  hex: d('hex', [P('x', 'целое число')], "Шестнадцатеричная запись строкой с меткой '0x'.", 'str', "hex(255)  # '0xff'"),
  abs: d('abs', [P('x', 'число')], 'Модуль числа: без знака минус.', undefined, 'abs(-7)  # 7'),
  round: d('round', [P('x', 'число'), P('n', 'сколько знаков после запятой', true)], 'Округляет. Осторожно: round(2.5) даёт 2 — к чётному.', undefined, 'round(3.14159, 2)  # 3.14'),
  sum: d('sum', [P('числа', 'список, range или генератор чисел'), P('start', 'с чего начать сумму, по умолчанию 0', true)], 'Сумма чисел.', undefined, 'sum(range(1, 101))  # 5050'),
  max: d('max', [P('числа', 'список или несколько чисел через запятую'), P('key', 'по какому признаку сравнивать', true)], 'Наибольшее значение.', undefined, 'max([3, 9, 4])  # 9'),
  min: d('min', [P('числа', 'список или несколько чисел через запятую'), P('key', 'по какому признаку сравнивать', true)], 'Наименьшее значение.', undefined, 'min(5, 2, 8)  # 2'),
  sorted: d('sorted', [P('x', 'что отсортировать'), P('key', 'по какому признаку', true), P('reverse', 'True — по убыванию', true)], 'Новый отсортированный список, исходный не меняется.', 'list', "sorted('КОТ')  # ['К', 'О', 'Т']"),
  reversed: d('reversed', [P('x', 'строка или список')], 'Тот же ряд задом наперёд (для цикла).', undefined, "''.join(reversed('КОТ'))  # 'ТОК'"),
  enumerate: d('enumerate', [P('x', 'что перебирать'), P('start', 'с какого номера считать, по умолчанию 0', true)], 'Перебор с номером: даёт пары (номер, элемент).', undefined, "for i, ch in enumerate('КОТ', 1):"),
  zip: d('zip', [P('*ряды', 'несколько списков или строк')], 'Идёт по нескольким рядам сразу: первый с первым, второй со вторым.', undefined, 'for a, m in zip(ip, mask):'),
  map: d('map', [P('функция', 'что сделать с каждым элементом, например int'), P('ряд', 'список или строка')], 'Применяет функцию к каждому элементу.', undefined, "a = list(map(int, '1 2 3'.split()))"),
  filter: d('filter', [P('функция', 'условие для элемента'), P('ряд', 'что фильтровать')], 'Оставляет элементы, для которых условие истинно.'),
  any: d('any', [P('ряд', 'список условий или генератор')], 'True, если хотя бы одно истинно.', 'bool', 'any(x % 7 == 0 for x in a)'),
  all: d('all', [P('ряд', 'список условий или генератор')], 'True, если истинны все.', 'bool'),
  ord: d('ord', [P('c', 'один символ')], 'Код символа в таблице Unicode.', 'int', "ord('A')  # 65"),
  chr: d('chr', [P('code', 'код символа')], 'Символ по его коду.', 'str', "chr(65)  # 'A'"),
  divmod: d('divmod', [P('a', 'делимое'), P('b', 'делитель')], 'Сразу целая часть и остаток: то же, что (a // b, a % b).', 'tuple', 'divmod(17, 5)  # (3, 2)'),
  pow: d('pow', [P('a', 'основание'), P('b', 'степень'), P('mod', 'остаток от деления на mod', true)], 'Степень, то же что a ** b.', undefined, 'pow(2, 10)  # 1024'),
  open: d('open', [P('file', "имя файла, например '17.txt'"), P('mode', "'r' — читать (по умолчанию), 'w' — писать", true)],
    'Открывает файл. Файл задачи лежит рядом с программой.', undefined, "a = [int(x) for x in open('17.txt')]"),
  isinstance: d('isinstance', [P('x', 'значение'), P('тип', 'например int или str')], 'Проверяет тип значения.', 'bool'),
  type: d('type', [P('x', 'значение')], 'Тип значения: int, str, list…', undefined, undefined, 'class'),
  format: d('format', [P('x', 'число'), P('spec', "формат: 'b' — двоичная, '08b' — 8 знаков с нулями", true)], 'Запись числа по формату.', 'str', "format(5, '08b')  # '00000101'"),
};

/** Методы строк */
export const STR_METHODS: Record<string, PyDoc> = {
  split: m('split', [P('sep', 'по какому символу резать, по умолчанию по пробелам', true)], 'Режет строку на список кусков.', 'list', "'192.168.0.1'.split('.')  # ['192', '168', '0', '1']"),
  join: m('join', [P('ряд', 'список строк, которые склеить')], 'Склеивает строки, ставя между ними эту строку.', 'str', "'.'.join(['192', '168'])  # '192.168'"),
  count: m('count', [P('sub', 'что считать: символ или кусок строки')], 'Сколько раз встречается.', 'int', "'КОЛОКОЛ'.count('О')  # 3"),
  find: m('find', [P('sub', 'что искать'), P('start', 'с какого места искать', true)], 'Номер первого вхождения, −1 — если нет.', 'int', "'КОТ'.find('О')  # 1"),
  index: m('index', [P('sub', 'что искать')], 'Номер первого вхождения; если нет — ошибка.', 'int'),
  replace: m('replace', [P('old', 'что заменить'), P('new', 'на что заменить'), P('count', 'сколько раз, по умолчанию все', true)], 'Новая строка с заменой. Исходная не меняется.', 'str', "s = s.replace('12', '1', 1)  # №12"),
  upper: m('upper', [], 'Все буквы — заглавные.', 'str'),
  lower: m('lower', [], 'Все буквы — строчные.', 'str'),
  strip: m('strip', [P('chars', 'какие символы убрать, по умолчанию пробелы и переводы строк', true)], 'Убирает лишнее по краям.', 'str'),
  startswith: m('startswith', [P('prefix', 'с чего должна начинаться строка')], 'True, если строка начинается с этого.', 'bool'),
  endswith: m('endswith', [P('suffix', 'чем должна заканчиваться строка')], 'True, если строка заканчивается этим.', 'bool'),
  isdigit: m('isdigit', [], 'True, если в строке только цифры.', 'bool'),
  isalpha: m('isalpha', [], 'True, если в строке только буквы.', 'bool'),
  zfill: m('zfill', [P('width', 'нужная длина')], 'Дописывает нули слева до нужной длины.', 'str', "bin(5)[2:].zfill(8)  # '00000101'"),
  rjust: m('rjust', [P('width', 'нужная длина'), P('fill', 'чем дополнять, по умолчанию пробел', true)], 'Выравнивает вправо, дополняя слева.', 'str'),
  ljust: m('ljust', [P('width', 'нужная длина'), P('fill', 'чем дополнять', true)], 'Выравнивает влево, дополняя справа.', 'str'),
};

/** Методы списков, множеств, словарей */
export const LIST_METHODS: Record<string, PyDoc> = {
  append: m('append', [P('x', 'что добавить в конец')], 'Добавляет элемент в конец списка.', undefined, 'a.append(x)'),
  extend: m('extend', [P('ряд', 'чьи элементы добавить')], 'Добавляет все элементы другого ряда.'),
  insert: m('insert', [P('i', 'на какое место'), P('x', 'что вставить')], 'Вставляет элемент на место i.'),
  pop: m('pop', [P('i', 'номер, по умолчанию последний', true)], 'Удаляет элемент и возвращает его.'),
  remove: m('remove', [P('x', 'что удалить')], 'Удаляет первое такое значение.'),
  sort: m('sort', [P('key', 'по какому признаку', true), P('reverse', 'True — по убыванию', true)], 'Сортирует сам список (ничего не возвращает).'),
  reverse: m('reverse', [], 'Переворачивает сам список.'),
  add: m('add', [P('x', 'что добавить')], 'Добавляет элемент в множество.'),
  get: m('get', [P('key', 'ключ'), P('default', 'что вернуть, если ключа нет', true)], 'Значение по ключу словаря без ошибки.'),
  items: m('items', [], 'Пары (ключ, значение) словаря — для цикла.'),
  keys: m('keys', [], 'Ключи словаря.'),
  values: m('values', [], 'Значения словаря.'),
};

/** Модули и их функции: ключ «модуль.имя» */
export const MODULES: Record<string, PyDoc> = {
  itertools: d('itertools', [], 'Перебор вариантов: product, permutations, combinations.', undefined, 'from itertools import product', 'module'),
  'itertools.product': d('product', [P('*ряды', 'из каких букв или чисел собирать'), P('repeat', 'сколько позиций в слове', true)],
    'Все наборы с повторениями по порядку — как вложенные циклы. №8: все слова из букв.', undefined, "for w in product('АБВ', repeat=4):\n    s = ''.join(w)"),
  'itertools.permutations': d('permutations', [P('ряд', 'что переставлять'), P('r', 'длина перестановки, по умолчанию вся', true)],
    'Все перестановки без повторов: каждый элемент один раз. №1: соответствие вершин.', undefined, "for p in permutations('АБВГ'):"),
  'itertools.combinations': d('combinations', [P('ряд', 'из чего выбирать'), P('r', 'сколько выбрать')], 'Все выборки без учёта порядка.', undefined, 'for a, b in combinations(nums, 2):'),
  math: d('math', [], 'Математика: sqrt, ceil, floor, gcd, log2, prod.', undefined, 'import math', 'module'),
  'math.sqrt': d('sqrt', [P('x', 'число')], 'Квадратный корень (дробный).', 'float', 'math.sqrt(16)  # 4.0'),
  'math.isqrt': d('isqrt', [P('n', 'целое число')], 'Целая часть квадратного корня.', 'int', 'math.isqrt(17)  # 4'),
  'math.ceil': d('ceil', [P('x', 'число')], 'Округление вверх. №7, №11: сколько бит нужно.', 'int', 'math.ceil(math.log2(26))  # 5'),
  'math.floor': d('floor', [P('x', 'число')], 'Округление вниз.', 'int'),
  'math.log2': d('log2', [P('x', 'число')], 'Логарифм по основанию 2: в какую степень возвести 2.', 'float', 'math.log2(1024)  # 10.0'),
  'math.log': d('log', [P('x', 'число'), P('base', 'основание, по умолчанию e', true)], 'Логарифм.', 'float'),
  'math.gcd': d('gcd', [P('*числа', 'целые числа')], 'Наибольший общий делитель.', 'int', 'math.gcd(12, 18)  # 6'),
  'math.prod': d('prod', [P('ряд', 'числа')], 'Произведение чисел.', undefined, 'math.prod([2, 3, 4])  # 24'),
  'math.factorial': d('factorial', [P('n', 'целое число')], 'Факториал n!.', 'int'),
  ipaddress: d('ipaddress', [], 'IP-адреса и сети для №10 (маска, адрес сети).', undefined, 'import ipaddress', 'module'),
  'ipaddress.ip_network': d('ip_network', [P('адрес', "строка 'IP/маска' или 'IP/число единиц'"), P('strict', 'False — разрешить адрес узла, а не только сети', true)],
    'Сеть по адресу и маске. Для №10 почти всегда strict=False.', undefined, "net = ipaddress.ip_network('98.162.71.94/255.255.240.0', strict=False)\nprint(net.network_address)"),
  'ipaddress.ip_address': d('ip_address', [P('адрес', "строка '192.168.0.1'")], 'Один IP-адрес.', undefined, "ip = ipaddress.ip_address('192.168.0.1')"),
  'ipaddress.network_address': prop('network_address', 'Адрес сети — первый адрес.', "print(net.network_address)"),
  'ipaddress.broadcast_address': prop('broadcast_address', 'Широковещательный адрес — последний в сети.'),
  'ipaddress.netmask': prop('netmask', 'Маска сети.', 'print(net.netmask)'),
  'ipaddress.prefixlen': prop('prefixlen', 'Сколько единиц в маске.'),
  'ipaddress.num_addresses': prop('num_addresses', 'Сколько всего адресов в сети.'),
  'ipaddress.hosts': m('hosts', [], 'Адреса узлов сети (без адреса сети и широковещательного).'),
  functools: d('functools', [], 'lru_cache и cache — запоминание результатов функции (№16, №23).', undefined, 'from functools import lru_cache', 'module'),
  'functools.lru_cache': d('lru_cache', [P('maxsize', 'сколько ответов помнить; None — без ограничения', true)],
    'Запоминает ответы функции: рекурсия считает каждое значение один раз.', undefined, '@lru_cache(None)\ndef f(n):'),
  'functools.cache': d('cache', [], 'То же, что lru_cache(None): помнит все ответы.', undefined, '@cache\ndef f(n):'),
  re: d('re', [], 'Шаблоны в тексте (регулярные выражения): №24.', undefined, 'import re', 'module'),
  're.findall': d('findall', [P('шаблон', "например r'[A-Z]+'"), P('строка', 'где искать')], 'Все куски строки, подходящие под шаблон.', 'list'),
  're.fullmatch': d('fullmatch', [P('шаблон', 'шаблон'), P('строка', 'вся строка целиком')], 'Подходит ли вся строка под шаблон.'),
  're.search': d('search', [P('шаблон', 'шаблон'), P('строка', 'где искать')], 'Первое место, подходящее под шаблон.'),
  're.sub': d('sub', [P('шаблон', 'что заменить'), P('замена', 'на что'), P('строка', 'где')], 'Замена по шаблону.', 'str'),
  fnmatch: d('fnmatch', [], 'Маски вида 12?45*7 для №25.', undefined, 'from fnmatch import fnmatch', 'module'),
  'fnmatch.fnmatch': d('fnmatch', [P('строка', "число строкой: str(x)"), P('маска', "'?' — одна цифра, '*' — сколько угодно")],
    'Подходит ли строка под маску. №25.', 'bool', "fnmatch(str(x), '12??36*1')"),
  sys: d('sys', [], 'Настройки Python, например предел рекурсии.', undefined, 'import sys', 'module'),
  'sys.setrecursionlimit': d('setrecursionlimit', [P('n', 'новый предел, например 10000')], 'Разрешает более глубокую рекурсию (№16).', undefined, 'sys.setrecursionlimit(10000)'),
  turtle: d('turtle', [], 'Черепаха для №6: рисунок появится в окне вывода.', undefined, 'from turtle import *', 'module'),
  'turtle.forward': d('forward', [P('d', 'на сколько шагов вперёд')], 'Вперёд по направлению взгляда. Коротко: fd.', undefined, 'fd(10 * k)'),
  'turtle.fd': d('fd', [P('d', 'на сколько шагов вперёд')], 'Вперёд по направлению взгляда.', undefined, 'fd(10 * k)'),
  'turtle.backward': d('backward', [P('d', 'на сколько шагов назад')], 'Назад, не поворачиваясь. Коротко: bk.'),
  'turtle.bk': d('bk', [P('d', 'на сколько шагов назад')], 'Назад, не поворачиваясь.'),
  'turtle.right': d('right', [P('a', 'угол в градусах')], 'Поворот направо (по часовой). Коротко: rt.', undefined, 'rt(90)'),
  'turtle.rt': d('rt', [P('a', 'угол в градусах')], 'Поворот направо (по часовой).', undefined, 'rt(120)'),
  'turtle.left': d('left', [P('a', 'угол в градусах')], 'Поворот налево (против часовой). Коротко: lt.', undefined, 'lt(90)'),
  'turtle.lt': d('lt', [P('a', 'угол в градусах')], 'Поворот налево (против часовой).', undefined, 'lt(90)'),
  'turtle.up': d('up', [], 'Поднять хвост: дальше Черепаха ходит без следа.'),
  'turtle.penup': d('penup', [], 'Поднять хвост: дальше Черепаха ходит без следа.'),
  'turtle.down': d('down', [], 'Опустить хвост: снова рисует след.'),
  'turtle.pendown': d('pendown', [], 'Опустить хвост: снова рисует след.'),
  'turtle.goto': d('goto', [P('x', 'координата x'), P('y', 'координата y')], 'Переместиться в точку (x, y).', undefined, 'goto(x * k, y * k)'),
  'turtle.dot': d('dot', [P('size', 'размер точки', true), P('color', 'цвет', true)], 'Поставить точку там, где стоит Черепаха. №6: сетка точек.', undefined, 'dot(3)'),
  'turtle.tracer': d('tracer', [P('n', '0 — рисовать сразу, без анимации')], 'Скорость рисования. В комнате рисунок всегда готов сразу.', undefined, 'tracer(0)'),
  'turtle.circle': d('circle', [P('radius', 'радиус'), P('extent', 'дуга в градусах, по умолчанию полный круг', true)], 'Круг или дуга.'),
  'turtle.setheading': d('setheading', [P('a', 'угол: 0 — вправо, 90 — вверх')], 'Повернуть в заданную сторону. Коротко: seth.'),
  'turtle.screensize': d('screensize', [P('w', 'ширина'), P('h', 'высота')], 'Размер холста. В комнате не нужен: рисунок подстраивается сам.'),
  'turtle.done': d('done', [], 'Конец рисования.'),
  collections: d('collections', [], 'Counter, deque, defaultdict.', undefined, 'from collections import Counter', 'module'),
  'collections.Counter': d('Counter', [P('ряд', 'что посчитать')], 'Считает, сколько раз встречается каждый элемент.', undefined, "Counter('КОЛОКОЛ')  # {'О': 3, 'К': 2, 'Л': 2}", 'class'),
  'collections.deque': d('deque', [P('ряд', 'начальные элементы', true)], 'Очередь: быстро добавлять и забирать с обоих концов (обход графа).', undefined, undefined, 'class'),
  'collections.defaultdict': d('defaultdict', [P('тип', 'что по умолчанию: int, list…')], 'Словарь, который сам создаёт значение для нового ключа.', undefined, 'g = defaultdict(list)', 'class'),
};

export const KEYWORDS: Record<string, string> = {
  for: 'Цикл: для каждого элемента ряда. for x in range(10):',
  while: 'Цикл, пока условие истинно. while n > 0:',
  if: 'Условие: если… if x % 2 == 0:',
  elif: 'Иначе если…',
  else: 'Иначе…',
  def: 'Своя функция: def f(n):',
  return: 'Что функция отдаёт.',
  break: 'Выйти из цикла сразу.',
  continue: 'Перейти к следующему шагу цикла.',
  import: 'Подключить модуль: import math',
  from: 'Подключить часть модуля: from itertools import product',
  in: 'Проверка «есть ли»: x in a, или перебор в for.',
  not: 'Отрицание: not x',
  and: 'И: оба условия.',
  or: 'Или: хотя бы одно условие.',
  True: 'Истина.', False: 'Ложь.', None: 'Ничего.',
  lambda: 'Короткая функция в одну строку: lambda x: x * 2',
};

/** Сигнатура строкой: «range(start?, stop, step?)» */
export function signature(doc: PyDoc): string {
  if (doc.kind === 'module' || doc.kind === 'property') return doc.name;
  return `${doc.name}(${doc.params.map((p) => p.name + (p.opt ? '?' : '')).join(', ')})`;
}

/**
 * Найти справку по имени вызова: «print», «math.sqrt», «s.split», «net.network_address», «product».
 * imports — имена, подключённые через from X import ..., чтобы «product» нашёлся как itertools.product.
 */
export function lookup(callee: string, imports: Record<string, string> = {}): PyDoc | null {
  const parts = callee.split('.');
  const last = parts[parts.length - 1];
  if (parts.length === 1) {
    if (BUILTINS[last]) return BUILTINS[last];
    if (MODULES[last]) return MODULES[last];
    const from = imports[last];
    if (from && MODULES[`${from}.${last}`]) return MODULES[`${from}.${last}`];
    return null;
  }
  const mod = parts.slice(0, -1).join('.');
  if (MODULES[`${mod}.${last}`]) return MODULES[`${mod}.${last}`];
  // метод неизвестного объекта: строка, список, сеть ipaddress
  return STR_METHODS[last] ?? LIST_METHODS[last] ?? MODULES[`ipaddress.${last}`] ?? null;
}

/** from itertools import product, permutations / from turtle import * → имя → модуль */
export function importsOf(code: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const mm of code.matchAll(/^\s*from\s+(\w+)\s+import\s+([^\n#]+)/gm)) {
    const mod = mm[1];
    if (mm[2].trim() === '*') {
      for (const k of Object.keys(MODULES)) if (k.startsWith(mod + '.')) out[k.slice(mod.length + 1)] = mod;
    } else for (const n of mm[2].split(',')) out[n.trim().split(/\s+as\s+/)[0]] = mod;
  }
  return out;
}

export interface CallContext { callee: string; arg: number; named: string | null; from: number }

/** Маскирует строки и комментарии того же размера, чтобы скобки и запятые в них не мешали разбору */
export function maskCode(s: string): string {
  return s.replace(/'(?:[^'\\\n]|\\.)*'?|"(?:[^"\\\n]|\\.)*"?|#[^\n]*/g, (q) => q.replace(/[^\n]/g, '_'));
}

const NOT_CALL = new Set(['if', 'elif', 'while', 'for', 'in', 'and', 'or', 'not', 'return', 'yield', 'del', 'assert', 'with', 'is']);

/**
 * Где курсор: внутри вызова какой функции и на каком аргументе.
 * Идём влево от курсора, считая скобки; первая незакрытая «(» — наш вызов.
 */
export function callContext(text: string, pos: number): CallContext | null {
  const start = Math.max(0, pos - 2000);
  const s = maskCode(text.slice(start, pos));
  let depth = 0, commas = 0, lastComma = -1, i = s.length - 1;
  for (; i >= 0; i--) {
    const c = s[i];
    if (c === ')' || c === ']' || c === '}') depth++;
    else if (c === '[' || c === '{') { if (depth === 0) return null; depth--; }
    else if (c === '(') { if (depth === 0) break; depth--; }
    else if (c === ',' && depth === 0) { commas++; if (lastComma < 0) lastComma = i; }
  }
  if (i < 0) return null;
  const head = s.slice(0, i).match(/([A-Za-z_]\w*(?:\s*\.\s*[A-Za-z_]\w*)*)\s*$/);
  if (!head) return null;
  let callee = head[1].replace(/\s+/g, '');
  if (NOT_CALL.has(callee)) return null;
  // bin(x)[2:].zfill( — метод чего-то, что не имя: помечаем «?.»
  if (s[i - head[0].length - 1] === '.') callee = '?.' + callee;
  // def f(… — объявление, а не вызов
  if (/\bdef\s+$/.test(s.slice(0, i - head[0].length))) return null;
  const argText = s.slice(lastComma >= 0 ? lastComma + 1 : i + 1);
  const named = argText.match(/^\s*([A-Za-z_]\w*)\s*=(?!=)/)?.[1] ?? null;
  return { callee, arg: commas, named, from: start + i - head[0].length };
}

/** Какой параметр подсветить: по имени (end=…) или по номеру; *объекты забирают все позиции */
export function activeParam(doc: PyDoc, ctx: CallContext): number {
  if (ctx.named) {
    const k = doc.params.findIndex((p) => p.name === ctx.named);
    if (k >= 0) return k;
  }
  const star = doc.params.findIndex((p) => p.name.startsWith('*'));
  if (star >= 0 && ctx.arg >= star) return star;
  return Math.min(ctx.arg, doc.params.length - 1);
}
