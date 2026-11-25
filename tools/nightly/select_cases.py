#!/usr/bin/env python3
"""Wybiera kolejne kazusy części ustnej do nocnego przebiegu i wypisuje argumenty dla tools/nightly/cases.js.

Użycie: select_cases.py [ile, domyślnie 3]
Pomija kazusy, które istnieją i mają pole "review" (przeszły kontrolę). Kazus bez kontroli jest pisany od nowa.
"""
import datetime, json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
n = int(sys.argv[1]) if len(sys.argv) > 1 else 3
cfg = json.load(open(os.path.join(ROOT, 'tools', 'nightly', 'cases.json'), encoding='utf-8'))
todo = []
for c in cfg['cases']:
    p = os.path.join(ROOT, 'content', 'cases', c['id'] + '.json')
    if os.path.exists(p) and json.load(open(p, encoding='utf-8')).get('review'):
        continue
    todo.append(c)
os.makedirs(os.path.join(ROOT, '.work', 'cases'), exist_ok=True)
for c in todo[:n]:  # kazus napisany wcześniej: przygotuj wersję bez klucza i rysunki dla niezależnego zdającego
    p = os.path.join(ROOT, 'content', 'cases', c['id'] + '.json')
    if c.get('existing') and os.path.exists(p):
        c['recheck'] = True
        d = os.path.join(ROOT, '.work', 'cases', c['id'])
        os.makedirs(d, exist_ok=True)
        subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'nightly', 'case_strip.py'), p, os.path.join(d, 'task.json')], check=True, stdout=subprocess.DEVNULL)
        subprocess.run(['node', os.path.join(ROOT, 'tools', 'render_case.js'), p, d], check=True, stdout=subprocess.DEVNULL)
print(json.dumps(dict(root=ROOT, date=datetime.date.today().isoformat(), sources=cfg['sources'], cases=todo[:n]), ensure_ascii=False))
print('do zrobienia: %d | w tym przebiegu: %s' % (len(todo), ', '.join(c['id'] for c in todo[:n]) or 'nic'), file=sys.stderr)
