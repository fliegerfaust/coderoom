// Свой модуль turtle для №6 ЕГЭ (PY.7): в браузерном Python настоящего нет (нужен tkinter).
// Черепаха ничего не рисует сама — записывает отрезки и точки; после запуска воркер
// отдаёт запись странице, и та рисует её SVG в окне вывода у обоих.
export const TURTLE_PY = String.raw`
import sys, math, types

class _Rec:
    def __init__(self):
        self.segs = []; self.dots = []; self.fills = []; self.colors = ['#141414']; self.cut = False
    def ci(self, c):
        c = str(c)
        if c not in self.colors: self.colors.append(c)
        return self.colors.index(c)

_LIMIT = 40000
_rec = _Rec()
_state = {'last': None}   # черепаха, которая двигалась последней — её и рисуем треугольником

def _color(args):
    if not args: return None
    if len(args) == 1:
        c = args[0]
        if isinstance(c, (tuple, list)) and len(c) == 3:
            k = 255 if max(c) > 1 else 1
            return '#%02x%02x%02x' % tuple(int(v * 255 / k) for v in c)
        return str(c)
    if len(args) == 3: return _color((tuple(args),))
    return str(args[0])

class Turtle:
    def __init__(self, *a, **kw):
        self._x = 0.0; self._y = 0.0; self._h = 0.0; self._down = True
        self._w = 1; self._c = _rec.ci('#141414'); self._fill = None; self._visible = True
        _state['last'] = self
    # движение
    def _move(self, x, y):
        _state['last'] = self
        if self._down:
            if len(_rec.segs) < _LIMIT:
                _rec.segs.append([round(self._x, 3), round(self._y, 3), round(x, 3), round(y, 3), self._c, self._w])
            else: _rec.cut = True
        if self._fill is not None: self._fill.append([round(x, 3), round(y, 3)])
        self._x, self._y = float(x), float(y)
    def forward(self, d):
        r = math.radians(self._h); self._move(self._x + d * math.cos(r), self._y + d * math.sin(r))
    fd = forward
    def backward(self, d): self.forward(-d)
    bk = back = backward
    def right(self, a): self._h = (self._h - a) % 360
    rt = right
    def left(self, a): self._h = (self._h + a) % 360
    lt = left
    def goto(self, x, y=None):
        if y is None: x, y = x
        self._move(x, y)
    setpos = setposition = goto
    def setx(self, x): self._move(x, self._y)
    def sety(self, y): self._move(self._x, y)
    def setheading(self, a): self._h = a % 360
    seth = setheading
    def home(self): self._move(0, 0); self._h = 0.0
    def circle(self, radius, extent=360, steps=None):
        n = steps or max(12, int(abs(extent) / 6))
        step = extent / n; length = 2 * abs(radius) * math.sin(math.radians(abs(step)) / 2)
        sgn = 1 if radius >= 0 else -1
        for _ in range(n):
            self.left(sgn * step / 2); self.forward(length); self.left(sgn * step / 2)
    # перо
    def penup(self): self._down = False
    pu = up = penup
    def pendown(self): self._down = True
    pd = down = pendown
    def isdown(self): return self._down
    def pensize(self, w=None):
        if w is None: return self._w
        self._w = w
    width = pensize
    def pencolor(self, *a):
        c = _color(a)
        if c: self._c = _rec.ci(c)
    def color(self, *a):
        c = _color((a[0],)) if len(a) == 2 else _color(a)
        if c: self._c = _rec.ci(c)
    def fillcolor(self, *a): pass
    def dot(self, size=None, *color):
        if len(_rec.dots) < _LIMIT:
            c = _color(color)
            _rec.dots.append([round(self._x, 3), round(self._y, 3), size or max(self._w + 4, 2 * self._w), _rec.ci(c) if c else self._c])
        else: _rec.cut = True
    def begin_fill(self): self._fill = [[round(self._x, 3), round(self._y, 3)]]
    def end_fill(self):
        if self._fill and len(self._fill) > 2: _rec.fills.append([self._fill, self._c])
        self._fill = None
    # состояние
    def position(self): return (round(self._x, 6), round(self._y, 6))
    pos = position
    def xcor(self): return self._x
    def ycor(self): return self._y
    def heading(self): return self._h
    def distance(self, x, y=None):
        if y is None: x, y = x
        return math.hypot(self._x - x, self._y - y)
    def towards(self, x, y=None):
        if y is None: x, y = x
        return math.degrees(math.atan2(y - self._y, x - self._x)) % 360
    def speed(self, *a): return 0
    def hideturtle(self): self._visible = False
    ht = hideturtle
    def showturtle(self): self._visible = True
    st = showturtle
    def isvisible(self): return self._visible
    def shape(self, *a): pass
    def write(self, *a, **k): pass
    def stamp(self): pass
    def clear(self): pass
    def reset(self): _reset()

class _Screen:
    def tracer(self, *a, **k): pass
    def update(self): pass
    def screensize(self, *a, **k): pass
    def setup(self, *a, **k): pass
    def bgcolor(self, *a): pass
    def title(self, *a): pass
    def delay(self, *a): pass
    def mainloop(self): pass
    done = exitonclick = bye = mainloop
    def setworldcoordinates(self, *a): pass

_screen = _Screen()
_pen = Turtle()

def _reset():
    global _rec, _pen
    _rec = _Rec(); _pen = Turtle(); _state['last'] = None

def _export():
    import json
    t = _state['last'] or _pen
    return json.dumps({'segs': _rec.segs, 'dots': _rec.dots, 'fills': _rec.fills, 'colors': _rec.colors, 'cut': _rec.cut,
                       'turtle': [round(t._x, 3), round(t._y, 3), t._h, t._visible]})

def _used():
    return bool(_rec.segs or _rec.dots or _rec.fills)

m = types.ModuleType('turtle')
m.Turtle = m.RawTurtle = m.Pen = Turtle
m.Screen = lambda: _screen
m._reset = _reset; m._export = _export; m._used = _used
for name in ['tracer', 'update', 'screensize', 'setup', 'bgcolor', 'title', 'delay', 'mainloop', 'done', 'exitonclick', 'bye', 'setworldcoordinates']:
    setattr(m, name, getattr(_screen, name))
for name in [n for n in dir(Turtle) if not n.startswith('_')]:
    def _f(*a, _n=name, **k): return getattr(_pen, _n)(*a, **k)
    setattr(m, name, _f)
m.__all__ = [n for n in dir(m) if not n.startswith('_')]
sys.modules['turtle'] = m
`;
