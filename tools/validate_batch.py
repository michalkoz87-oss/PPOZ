#!/usr/bin/env python3
"""Walidacja pliku wynikowego paczki pytań. Użycie: validate_batch.py <plik_wyniku.json> <plik_paczki.json> [--adj id,id,...]"""
import json,sys
TOPICS={'P1','P2','P3','W1','W2','W3','W4','W5','W6','R1','R2','H1','H2','U1','U2','U3','U4','U5','U6','U7','X1','S1','S2','S3','S4','S5','S6','S7','S8','O1','Z9'}
def main():
    res=sys.argv[1]; batch=sys.argv[2]
    try: data=json.load(open(res,encoding='utf-8'))
    except Exception as e: print('BŁĄD: plik nie jest poprawnym JSON:',e); return 1
    if '--adj' in sys.argv: want=[int(x) for x in sys.argv[sys.argv.index('--adj')+1].split(',')]
    else: want=[q['id'] for q in json.load(open(batch,encoding='utf-8'))]
    errs=[]
    if not isinstance(data,list): print('BŁĄD: oczekiwano listy obiektów'); return 1
    got={}
    for o in data:
        if not isinstance(o,dict) or 'id' not in o: errs.append('element bez id'); continue
        got[o['id']]=o
        p=f"id {o['id']}: "
        if o.get('ans') not in ('a','b','c'): errs.append(p+'ans musi być a/b/c')
        if o.get('conf') not in ('wysoka','średnia','niska'): errs.append(p+'conf musi być wysoka/średnia/niska')
        if o.get('ansNow') not in ('=','a','b','c','brak'): errs.append(p+'ansNow musi być "=", a, b, c lub "brak"')
        if o.get('stan') not in ('aktualne','zmienione','uchylone','nieustalone'): errs.append(p+'stan musi być aktualne/zmienione/uchylone/nieustalone')
        if not isinstance(o.get('norms',[]),list): errs.append(p+'norms musi być listą')
        if o.get('stan')!='aktualne' and not (o.get('stanNote') or '').strip(): errs.append(p+'stanNote wymagane gdy stan != aktualne')
        if o.get('topic') not in TOPICS: errs.append(p+'topic spoza listy')
        for f,mn in (('basis',3),('expl',30)):
            if not isinstance(o.get(f),str) or len(o[f].strip())<mn: errs.append(p+f'pole {f} puste lub za krótkie')
        for f in ('src','quote'):
            if not isinstance(o.get(f),str): errs.append(p+f'pole {f} musi być tekstem (może być puste)')
        if o.get('conf')=='wysoka' and len((o.get('quote') or '').strip())<15: errs.append(p+'conf=wysoka wymaga dosłownego cytatu (quote) ze źródła')
    miss=[i for i in want if i not in got]; extra=[i for i in got if i not in want]
    if miss: errs.append(f'brak pytań: {miss}')
    if extra: errs.append(f'nadmiarowe id: {extra}')
    if errs:
        print('BŁĘDY (%d):'%len(errs)); [print(' -',e) for e in errs[:40]]; return 1
    print('OK',len(got),'pytań'); return 0
sys.exit(main())
