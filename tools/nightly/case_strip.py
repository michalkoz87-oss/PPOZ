#!/usr/bin/env python3
"""Zapisuje wersję kazusu bez klucza: tak widzi go zdający (i niezależny agent „zdający” w nocnym przebiegu).

Użycie: case_strip.py <content/cases/K02.json> <plik wyjściowy>
Usuwa: findings, summary, punkty odpowiedzi w pytaniach; zostawia zadanie, opis, rysunki i treść pytań.
"""
import json, sys

c = json.load(open(sys.argv[1], encoding='utf-8'))
out = {k: c[k] for k in ('id', 'title', 'tags', 'problem', 'legal', 'doc', 'drawings') if k in c}
out['questions'] = [dict(id=q['id'], q=q['q']) for q in c.get('questions', [])]
json.dump(out, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('zapisano', sys.argv[2])
