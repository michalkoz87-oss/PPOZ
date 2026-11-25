#!/usr/bin/env python3
"""Buduje wersje do publikacji z katalogu app/:

  dist/egzamin-rzeczoznawcy-ppoz.html  – jeden plik (style, skrypty i dane w środku); działa po otwarciu z dysku
  dist/artifact.html + dist/data/      – strona dla artefaktu Claude (bez <html>/<head>/<body>; dane obok, w data/*.json)

Najpierw uruchom tools/build_data.py.
"""
import json, os, re, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(ROOT, 'app')
DIST = os.path.join(ROOT, 'dist')
DATA = ['meta', 'topics', 'plan', 'questions', 'flashcards', 'lessons', 'norms', 'legal', 'cases']


def read(*p):
    with open(os.path.join(APP, *p), encoding='utf-8') as f:
        return f.read()


def block(html, name):
    m = re.search(r'<!-- %s:START.*?-->(.*?)<!-- %s:END -->' % (name, name), html, re.S)
    return m.group(1)


def main():
    html = read('index.html')
    page = block(html, 'PAGE')
    css = '\n'.join(read(*href.split('/')) for href in re.findall(r'<link rel="stylesheet" href="(css/[^"]+)"', block(html, 'CSS')))
    js = '\n;\n'.join(read(*src.split('/')) for src in re.findall(r'<script src="(js/[^"]+)"></script>', block(html, 'JS')))
    assert '</script' not in js.lower(), 'skrypty nie mogą zawierać </script'
    head = re.search(r'(<title>.*?)<!-- CSS:START', page, re.S).group(1).strip()
    body = re.search(r'<body>(.*?)<!-- JS:START', page, re.S).group(1).strip()
    data = {n: json.load(open(os.path.join(APP, 'data', n + '.json'), encoding='utf-8')) for n in DATA}
    inline = json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')

    os.makedirs(os.path.join(DIST, 'data'), exist_ok=True)
    single = ('<!doctype html>\n<html lang="pl">\n<head>\n<meta charset="utf-8">\n'
              '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
              + head + '\n<style>\n' + css + '\n</style>\n</head>\n<body>\n' + body
              + '\n<script>window.__PPOZ_DATA__=' + inline + ';</script>\n<script>\n' + js + '\n</script>\n</body>\n</html>\n')
    with open(os.path.join(DIST, 'egzamin-rzeczoznawcy-ppoz.html'), 'w', encoding='utf-8') as f:
        f.write(single)
    artifact = head + '\n<style>\n' + css + '\n</style>\n' + body + '\n<script>\n' + js + '\n</script>\n'
    with open(os.path.join(DIST, 'artifact.html'), 'w', encoding='utf-8') as f:
        f.write(artifact)
    for n in DATA:
        shutil.copyfile(os.path.join(APP, 'data', n + '.json'), os.path.join(DIST, 'data', n + '.json'))
    print('jeden plik: %d KB | artefakt: %d KB + dane %d KB' % (
        len(single.encode()) // 1024, len(artifact.encode()) // 1024,
        sum(os.path.getsize(os.path.join(DIST, 'data', n + '.json')) for n in DATA) // 1024))


if __name__ == '__main__':
    main()
