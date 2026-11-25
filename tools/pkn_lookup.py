import re,html,urllib.request,urllib.parse,http.cookiejar,json,sys,time,os
P='_searchstandards_WAR_p4scustomerpknzwnelsearchstandardsportlet_'
class PKN:
    def __init__(s):
        s.cj=http.cookiejar.CookieJar()
        s.op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(s.cj)); s.op.addheaders=[('User-Agent','Mozilla/5.0')]
        s.refresh()
    def refresh(s):
        t=s.op.open('https://wiedza.pkn.pl/web/guest/wyszukiwarka-norm',timeout=60).read().decode('utf-8','replace')
        s.act=html.unescape(re.search(r'<form action="([^"]+)"[^>]*id="%sfm"'%P,t).group(1))
        s.fd=re.search(r'name="%sformDate"[^>]*value="([^"]*)"'%P,t).group(1)
    def search(s,number,actual='all'):
        d={P+'formDate':s.fd,P+'standardNumber':number,P+'standardRowsOnPage':'75',P+'standardActual':actual,'hiddenInputStandardNumber':''}
        for k in ('standardIcs','standardTitle','standardTitleEnglish','standardContent','startDate','endDate','withdrawalStartDate','withdrawalEndDate','standardDirectiveNumber','standardKt','standardSector'): d[P+k]=''
        r=s.op.open(s.act,urllib.parse.urlencode(d).encode(),timeout=90).read().decode('utf-8','replace')
        return parse(r),r
    def detail(s,url):
        return s.op.open(url,timeout=90).read().decode('utf-8','replace')
def clean(x): return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',x))).strip()
def parse(r):
    rows=[]
    for tr in re.findall(r'<tr class="portlet-section-(?:body|alternate)[^"]*results-row[^"]*"\s*>(.*?)</tr>',r,re.S):
        rec={}
        parts=re.split(r'<span class="p4s-search-results-label">',tr)[1:]
        for p in parts:
            m=re.match(r'(.*?)</span>(.*)',p,re.S)
            if not m: continue
            label=clean(m.group(1)); rest=m.group(2)
            try:
                if label.startswith('Numer'):
                    a=re.search(r'<a [^>]*href="([^"]+)"[^>]*>(.*?)</a>',rest,re.S)
                    txt=clean(a.group(2)) if a else clean(rest); ver=re.search(r'wersja \w+',txt)
                    rec['kind']=label; rec['ver']=ver.group(0) if ver else ''
                    n=re.sub(r'\s*wersja \w+','',txt)
                    n=re.sub(r'\s*-\s*','-',n); n=re.sub(r'\s*:\s*',':',n); n=re.sub(r'\s*/\s*','/',n); n=re.sub(r'\s*\+\s*','+',n)
                    rec['num']=re.sub(r'\s+',' ',n).strip()
                    if a: rec['url']=html.unescape(a.group(1))
                elif label.startswith('Tytuł w'): rec['titleEn']=clean(rest)
                elif label.startswith('Tytuł'): rec['title']=clean(rest)
                elif label=='Status': rec['status']=clean(rest)
                else:
                    items=[clean(x) for x in re.findall(r'<li[^>]*>(.*?)</li>',rest,re.S)]
                    key={'Wprowadza':'introduces','Zastępuje':'replaces','Zastąpiona przez':'replacedBy'}.get(label,label)
                    rec[key]=[re.sub(r'\s*wersja \w+','',re.sub(r'\s*-\s*','-',re.sub(r'\s*:\s*',':',i))).strip()+(' ['+re.search(r'wersja (\w+)',i).group(1)[:3]+']' if re.search(r'wersja (\w+)',i) else '') for i in items] or clean(rest)
            except Exception as e:
                rec.setdefault('_err',[]).append(label+': '+str(e)[:60])
        if rec.get('num'): rows.append(rec)
    return rows
if __name__=='__main__':
    out=sys.argv[1]; qs=json.load(open(sys.argv[2]))
    os.makedirs(out,exist_ok=True)
    pk=PKN(); allrows={}
    for i,q in enumerate(qs):
        fn=os.path.join(out,re.sub(r'[^A-Za-z0-9]+','_',q)+'.json')
        if os.path.exists(fn): allrows[q]=json.load(open(fn)); continue
        for attempt in range(3):
            try:
                rows,_=pk.search(q); break
            except Exception as e:
                rows=None; time.sleep(4)
                try: pk=PKN()
                except Exception: time.sleep(8)
        if rows is None: print('FAIL',q); continue
        json.dump(rows,open(fn,'w'),ensure_ascii=False,indent=1); allrows[q]=rows
        cur=sorted({r['num'] for r in rows if r.get('status')=='aktualna'})
        print(f"{q:22s} rows={len(rows):3d} aktualne: {'; '.join(cur)[:150]}")
        time.sleep(0.8)
