import json,urllib.request,urllib.parse,subprocess,os,sys,time
OUT=sys.argv[1]
def getj(u):
    for i in range(4):
        try:
            req=urllib.request.Request(u,headers={'Accept':'application/json','User-Agent':'curl/8'})
            return json.load(urllib.request.urlopen(req,timeout=90))
        except Exception as e:
            err=e; time.sleep(2*(i+1))
    raise err
def getb(u):
    for i in range(4):
        try:
            req=urllib.request.Request(u,headers={'User-Agent':'curl/8'})
            return urllib.request.urlopen(req,timeout=180).read()
        except Exception as e:
            err=e; time.sleep(2*(i+1))
    raise err
def key(e): 
    p=e.split('/'); return (int(p[1]),int(p[2]))
def pdf2txt(b):
    open('/tmp/_a.pdf','wb').write(b)
    subprocess.run(['pdftotext','-layout','/tmp/_a.pdf','/tmp/_a.txt'],check=True)
    return open('/tmp/_a.txt',encoding='utf-8',errors='replace').read()
ACTS=[
 ('ustawa_ppoz','DU/1991/351'),('ustawa_psp','DU/1991/400'),('prawo_budowlane','DU/1994/414'),('pos','DU/2001/627'),
 ('ustawa_odpady','DU/2013/21'),('ustawa_imprezy_masowe','DU/2009/504'),('ustawa_wyroby_budowlane','DU/2004/881'),
 ('rozp_ppoz_2010','DU/2010/719'),('wt_2002','DU/2002/690'),('woda_drogi_2009','DU/2009/1030'),
 ('uzgadnianie_2023','DU/2023/1563'),('uzgadnianie_2021_uchylone','DU/2021/1722'),('uzgadnianie_2015_uchylone','DU/2015/2117'),
 ('projekt_bud_2020','DU/2020/1609'),('bazy_paliw_2023','DU/2023/1707'),('bazy_paliw_2005_uchylone','DU/2005/2063'),
 ('wyroby_2007','DU/2007/1002'),('seveso_2016','DU/2016/138'),('metro_2023','DU/2023/1210'),('metro_2011_uchylone','DU/2011/859'),
 ('drogi_2022','DU/2022/1518'),('doi_2000_uchylone','DU/2000/735'),('autostrady_2002_uchylone','DU/2002/116'),
 ('odpady_ppoz_2020','DU/2020/296'),('atex_2016','DU/2016/817'),('atex_bhp_2010','DU/2010/931'),('sieci_gazowe_2013_uchylone','DU/2013/640'),
 ('lasy_2006','DU/2006/405'),('przedszkola_2017','DU/2017/1642'),('zlobki_2014','DU/2014/925'),
 ('budowle_rolnicze_2023','DU/2023/297'),('budowle_rolnicze_1997_uchylone','DU/1997/877'),
 ('egzamin_rzeczoznawcy_2015','DU/2015/2083'),('szkolenia_rzeczoznawcow_2015','DU/2015/1963'),('kontr_rozp_2005','DU/2005/1934'),
 ('wt_uzytkowania_bud_mieszk_1999_uchylone','DU/1999/836'),('bhp_ogolne_1997','DU/1997/844'),
]
index=[]
ONLY=set(sys.argv[2:])
for name,eli in ACTS:
    if ONLY and name not in ONLY: continue
    try:
        d=getj("https://api.sejm.gov.pl/eli/acts/"+eli)
    except Exception as e:
        print('ERR meta',name,eli,e); continue
    refs=d.get('references',{})
    types={t['type']:t['fileName'] for t in d.get('texts',[])}
    tj=sorted([x['id'] for x in refs.get('Inf. o tekście jednolitym',[])],key=key)
    zm=sorted([(x['id'],x.get('date')) for x in refs.get('Akty zmieniające',[])],key=lambda s:key(s[0]))
    uch=[(x['id'],x.get('date')) for x in refs.get('Akty uchylające',[])+refs.get('Uchylenia wynikające z',[])]
    parts=[]; comp=''
    try:
        if 'U' in types:
            b=getb(f"https://api.sejm.gov.pl/eli/acts/{eli}/text/U/{types['U']}")
            parts.append((f"TEKST UJEDNOLICONY (Kancelaria Sejmu) aktu {eli}",pdf2txt(b))); comp='tekst ujednolicony (U)'
        else:
            base=tj[-1] if tj else eli
            b=getb(f"https://api.sejm.gov.pl/eli/acts/{base}/text.pdf")
            parts.append((("TEKST JEDNOLITY " if tj else "TEKST OGŁOSZONY ")+base,pdf2txt(b)))
            later=[z for z in zm if key(z[0])>key(base)]
            for z,dt in later:
                try:
                    zb=getb(f"https://api.sejm.gov.pl/eli/acts/{z}/text.pdf")
                    parts.append((f"AKT ZMIENIAJĄCY {z} (wejście w życie zmiany: {dt}) — NIEUWZGLĘDNIONY w tekście powyżej",pdf2txt(zb)))
                except Exception as e: print('  ERR zm',z,e)
            comp=('t.j. '+base if tj else 'tekst pierwotny '+base)+(' + zmiany: '+', '.join(z for z,_ in later) if later else '')
    except Exception as e:
        print('ERR text',name,eli,e); continue
    hdr=f"AKT: {d['title']}\nELI: {eli}\nSTATUS (API Sejmu, stan na 2026-11-24): {d.get('status')} | inForce={d.get('inForce')} | data uchylenia: {d.get('repealDate')}\nUchylony/wygasły przez: {uch}\nSkład pliku: {comp}\n"
    body=hdr+''.join(f"\n\n{'#'*100}\n### {h}\n{'#'*100}\n\n{t}" for h,t in parts)
    open(os.path.join(OUT,name+'.txt'),'w',encoding='utf-8').write(body)
    index.append(dict(file=name+'.txt',eli=eli,title=d['title'],status=d.get('status'),inForce=d.get('inForce'),repealDate=d.get('repealDate'),repealedBy=uch,composition=comp,chars=len(body),tj=tj[-1] if tj else None,amend_all=zm))
    print(f"OK {name:42s} {len(body)//1000:>5}k  {d.get('status')}  {comp[:90]}")
ip=os.path.join(OUT,'_index.json')
old=json.load(open(ip)) if os.path.exists(ip) else []
names={i['file'] for i in index}
index=[o for o in old if o['file'] not in names]+index
json.dump(index,open(ip,'w'),ensure_ascii=False,indent=1)
