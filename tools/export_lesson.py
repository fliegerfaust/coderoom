# -*- coding: utf-8 -*-
"""Экспорт задач занятия из Teaching/informatics в «Кодовую комнату» (LS.2).

Один источник правды — исходники занятий: атомы «Азы Python» (atoms.py) и задачи ЕГЭ (tasks_*.py).
Сюда уходят только условие, картинка, файлы и заготовка. **Ответов и разборов нет**: сайт публичный.

    python3 tools/export_lesson.py --inf ~/Teaching/informatics --out public/lessons 01

Правка JSON руками затирается следующим экспортом.
"""
import argparse
import json
import os
import shutil
import sys
import types

KIND = {"predict": "Предскажи вывод", "bug": "Найди ошибку", "make": "Напиши сам"}
Q_DEFAULT = {
    "predict": "Что напечатает программа? Сначала запиши ответ, потом запусти.",
    "bug": "Программа работает не так, как задумано. Найди ошибку и исправь.",
    "make": "Допиши программу.",
}
REF = {"b": "Б", "n": "Н", "v": "В", "k": "Д", "r": "Р", "p": "П", "x": "Х"}
EGE_STARTER = "# №{ege}: пиши решение здесь\n"


def stub_playwright():
    """board_cards тянет playwright; для экспорта он не нужен."""
    sys.modules.setdefault("playwright", types.ModuleType("playwright"))
    m = types.ModuleType("playwright.sync_api")
    m.sync_playwright = None
    sys.modules["playwright.sync_api"] = m


def atom_task(a_id, i, t, prefix):
    q = t.get("q") or Q_DEFAULT[t["kind"]]
    st = q
    if t["kind"] in ("predict", "bug"):
        st += "\n\n```python\n" + t["code"] + "\n```"
    starter = t.get("blank") if t["kind"] == "make" else t["code"]
    return {"id": "%s-%s-%d" % (prefix, a_id.lower().replace("а", "a"), i), "label": "%s · %d" % (a_id, i),
            "kind": t["kind"], "topic": KIND[t["kind"]], "level": 1, "statement": st,
            "starter": (starter or "").rstrip("\n") + "\n"}


def ref_label(ref):
    head, num = ref[0], ref[1:].lstrip("0") or "0"
    return REF.get(head, head.upper()) + num


def ege_task(t, prefix, head, img_src, img_dst, files_src):
    st = t["st"]
    intro = None
    if head and st.startswith(head):
        intro, st = head.strip(), st[len(head):].strip()
    task = {"id": "%s-e%s-%s" % (prefix, t["ege"], t["ref"]), "label": "№%s · %s" % (t["ege"], ref_label(t["ref"])),
            "kind": "ege", "ege": str(t["ege"]), "topic": t["topic"], "level": t["lvl"], "statement": st,
            "starter": EGE_STARTER.format(ege=t["ege"])}
    if intro:
        task["intro"] = intro
    if t.get("img_name"):
        src = os.path.join(img_src, t["img_name"])
        if os.path.exists(src):
            os.makedirs(img_dst, exist_ok=True)
            shutil.copy(src, os.path.join(img_dst, t["img_name"]))
            task["image"] = "img/" + t["img_name"]
    for f in t.get("files") or []:
        os.makedirs(os.path.join(img_dst, "..", "files"), exist_ok=True)
        shutil.copy(os.path.join(files_src, f), os.path.join(img_dst, "..", "files", f))
        task.setdefault("files", []).append({"name": f, "url": "lessons/files/" + f})
    return task


def lesson_01(inf, out):
    stub_playwright()
    sys.path.insert(0, os.path.join(inf, "Азы Python", "Исходники"))
    l00 = os.path.join(inf, "Занятие 00 · Три ключа (А0)", "Исходники")
    sys.path.insert(0, l00)
    import atoms
    import tasks_proba as TP
    atoms.check()
    a1 = [a for a in atoms.ATOMS if a["id"] == "А1"][0]
    head = getattr(TP, "T10_HEAD", "")
    img_src, img_dst = os.path.join(l00, "картинки"), os.path.join(out, "img")
    cls = [TP.BAZA[3], TP.BAZA[4], TP.BAZA[5], TP.NORMA[2], TP.NORMA[3], TP.VYZOV[2], TP.VYZOV[3]]
    groups = [
        {"id": "class-py", "title": "На занятии · Python А1",
         "tasks": [atom_task("А1", i + 1, t, "c") for i, t in enumerate(a1["tasks"])]},
        {"id": "class-ege", "title": "На занятии · ЕГЭ №10",
         "tasks": [ege_task(t, "c", head, img_src, img_dst, l00) for t in cls]},
        {"id": "home-py", "title": "Дома · Python А1",
         "tasks": [atom_task("А1", i + 1, t, "h") for i, t in enumerate(atoms.HW["А1"])]},
        {"id": "home-ege", "title": "Дома · ЕГЭ №10",
         "tasks": [ege_task(t, "h", head, img_src, img_dst, l00) for t in TP.HW_L01]},
    ]
    return {"id": "01", "short": "Занятие 01", "title": "Занятие 01 · А1 Переменные и арифметика + №10 «Твой роутер»",
            "groups": groups}


LESSONS = {"01": lesson_01}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--inf", required=True, help="папка Teaching/informatics")
    ap.add_argument("--out", default="public/lessons")
    ap.add_argument("ids", nargs="+")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    idx_path = os.path.join(a.out, "index.json")
    index = json.load(open(idx_path, encoding="utf-8")) if os.path.exists(idx_path) else []
    for lid in a.ids:
        lesson = LESSONS[lid](os.path.abspath(a.inf), os.path.abspath(a.out))
        blob = json.dumps(lesson, ensure_ascii=False)
        for bad in ('"ans"', '"steps"', '"answer', '"fix"', '"out"'):
            assert bad not in blob, "в экспорт попал ответ: " + bad
        with open(os.path.join(a.out, lid + ".json"), "w", encoding="utf-8") as f:
            json.dump(lesson, f, ensure_ascii=False, indent=1)
        index = [x for x in index if x["id"] != lid] + [{"id": lid, "title": lesson["title"], "short": lesson["short"], "file": lid + ".json"}]
        n = sum(len(g["tasks"]) for g in lesson["groups"])
        print("занятие %s: %d задач → %s" % (lid, n, a.out))
    index.sort(key=lambda x: x["id"])
    with open(idx_path, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
