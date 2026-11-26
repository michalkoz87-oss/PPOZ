#!/usr/bin/env python3
"""Odtwarza robocze teksty norm w .work/corpus/normy/ (poza repozytorium).

Normy są plikami użytkownika w jego Dropboxie (licencja PKN: tylko do użytku wewnętrznego).
Tekstów norm NIE zapisujemy w repozytorium ani w aplikacji; służą wyłącznie do sprawdzania odpowiedzi.

Wykaz plików: tools/nightly/norms.json (identyfikator pliku w Dropboxie, nazwa pliku roboczego, wydanie, blok).

Użycie (uruchamiaj z opcją -I):
  python3 -I tools/nightly/norms_from_dropbox.py stan [blok]
      co jest, czego brakuje i jak to uzupełnić
  python3 -I tools/nightly/norms_from_dropbox.py tekst
      zamienia odpowiedzi narzędzia Dropbox „fetch” (zapisane w tej sesji) na pliki .txt
  python3 -I tools/nightly/norms_from_dropbox.py pdf <katalog z pobranymi PDF>
      pdftotext, a dla skanów OCR (tesseract -l pol); nazwa PDF = nazwa z wykazu z końcówką .pdf

Skąd „tekst” bierze dane: duże odpowiedzi „fetch” narzędzie zapisuje w katalogu tool-results sesji,
małe są w transkrypcie sesji (*.jsonl). Oba miejsca leżą w ~/.claude/projects/<projekt>/.
"""
import glob, json, os, re, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, '.work', 'corpus', 'normy')
MANIFEST = json.load(open(os.path.join(ROOT, 'tools', 'nightly', 'norms.json'), encoding='utf-8'))
SESSIONS = os.path.expanduser('~/.claude/projects')


def clean(text):
    # stopka licencyjna powtarza się na każdej stronie i nie niesie treści
    text = re.sub(r'Licencja Polskiego Komitetu Normalizacyjnego dla [^\n]*\n?', '', text)
    text = text.replace('\t', ' ')
    # część PDF-ów PKN ma znak „Ŝ” w miejscu „ż” (stara czcionka); poprawiamy tylko wtedy, gdy „ż” prawie nie występuje
    if text.count('Ŝ') > 10 * max(1, text.count('ż')):
        text = text.replace('Ŝ', 'ż')
    text = re.sub(r'[  ]+\n', '\n', text)
    return re.sub(r'\n{4,}', '\n\n\n', text).strip() + '\n'


def letters(text):
    return len(re.findall(r'[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]', text))


def write(entry, text, how):
    text = clean(text)
    if letters(text) < 1500:
        print('  pusty tekst (skan?): %s' % entry['file'])
        return False
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, entry['file']), 'w', encoding='utf-8') as f:
        f.write('NORMA: %s | STAN: %s | %s\n\n' % (entry['norm'], entry['stan'], entry.get('uwagi', '')))
        f.write(text)
    print('  zapisano %-48s %7d zn. (%s)' % (entry['file'], len(text), how))
    return True


def fetched():
    """Zbiera odpowiedzi „fetch” (id → najdłuższy tekst) z plików sesji."""
    found = {}

    def take(obj):
        if isinstance(obj, dict) and isinstance(obj.get('text'), str) and str(obj.get('id', '')).startswith('id:'):
            if len(obj['text']) > len(found.get(obj['id'], '')):
                found[obj['id']] = obj['text']

    def walk(x):
        if isinstance(x, str):
            s = x.lstrip()
            if s.startswith('{"id":"id:'):
                try:
                    take(json.loads(s))
                except ValueError:
                    pass
        elif isinstance(x, dict):
            for v in x.values():
                walk(v)
        elif isinstance(x, list):
            for v in x:
                walk(v)

    for fn in glob.glob(os.path.join(SESSIONS, '*', '*', 'tool-results', 'mcp-Dropbox-fetch-*.txt')):
        try:
            take(json.load(open(fn, encoding='utf-8')))
        except (ValueError, OSError):
            pass
    for fn in glob.glob(os.path.join(SESSIONS, '*', '*.jsonl')):
        with open(fn, encoding='utf-8', errors='replace') as f:
            for line in f:
                if '{\\"id\\":\\"id:' in line or '{"id":"id:' in line:
                    try:
                        walk(json.loads(line))
                    except ValueError:
                        pass
    return found


def cmd_tekst():
    found = fetched()
    for e in MANIFEST:
        if e['id'] in found:
            write(e, found[e['id']], 'fetch')


def ocr(pdf):
    out = []
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(['pdftoppm', '-r', '300', '-gray', '-png', pdf, os.path.join(tmp, 'p')], check=True)
        for png in sorted(glob.glob(os.path.join(tmp, 'p*.png'))):
            r = subprocess.run(['tesseract', png, '-', '-l', 'pol'], capture_output=True, text=True)
            out.append(r.stdout)
    return '\n\n'.join(out)


def cmd_pdf(folder):
    for e in MANIFEST:
        pdf = os.path.join(folder, e['file'][:-4] + '.pdf')
        if not os.path.exists(pdf):
            continue
        text = subprocess.run(['pdftotext', '-layout', pdf, '-'], capture_output=True, text=True).stdout
        how = 'pdftotext'
        if letters(text) < 1500:
            text, how = ocr(pdf), 'OCR — możliwe błędy w cyfrach, sprawdzaj z obrazem strony'
        write(e, text, how)


def cmd_stan(block=None):
    for e in MANIFEST:
        if block and block not in e['blocks']:
            continue
        p = os.path.join(OUT, e['file'])
        have = os.path.exists(p)
        print('%-5s %-4s %-46s %-13s %s%s' % ('JEST' if have else 'BRAK', ','.join(e['blocks']), e['file'], e['via'],
                                              e['stan'], '' if have else '  → ' + e['id']))


if __name__ == '__main__':
    a = sys.argv[1:]
    if a[:1] == ['tekst']:
        cmd_tekst()
    elif a[:1] == ['pdf'] and len(a) == 2:
        cmd_pdf(a[1])
    elif a[:1] == ['stan']:
        cmd_stan(a[1] if len(a) > 1 else None)
    else:
        print(__doc__)
