import sys
from pathlib import Path
import json,re,hashlib

pages=[json.loads(p.read_text(encoding='utf8')) for p in sorted(Path(sys.argv[2]).resolve().glob('*.json'))]
assert len(pages)==587
toc={}
for p in pages:
 for line in p['text'].splitlines():
  m=re.match(r'^\s*(\d{1,2}(?:-\d+){1,4})\s+(.+?)[·.…]{2,}\s*(\d+)\s*$',line)
  if m:
   code,title,printed=m.groups()
   toc.setdefault(code,{'code':code,'title':title.strip(),'page':int(printed),'pdfPage':int(printed)+30})
for p in pages:
 for h in p.get('headings',[]):
  if p['pdfPage']>=33 and h['code'] not in toc:
   toc[h['code']]={'code':h['code'],'title':h['title'],'page':p['pdfPage']-30,'pdfPage':p['pdfPage']}

ordered=sorted(toc.values(),key=lambda s:tuple(map(int,s['code'].split('-'))))
tables=[];active=None
for p in pages:
 if p['text'].splitlines() and re.sub(r'\s+','',p['text'].splitlines()[0])=='부록':active=None
 headings=sorted([h for h in p.get('headings',[]) if h['code'] in toc],key=lambda h:h['top'])
 for index,t in enumerate(p['tables']):
  previous=[h for h in headings if h['top']<t['bbox'][1]]
  code=previous[-1]['code'] if previous else active
  if p['pdfPage']<33:code=None
  tables.append({'id':f'p{p["pdfPage"]}-t{index+1}','pdfPage':p['pdfPage'],'code':code,'rows':t['rows'],'grid':t.get('grid',t['rows']),'bbox':t['bbox']})
 if headings:active=headings[-1]['code']

trades=['통신내선공','통신설비공','통신외선공','통신케이블공','무선안테나공','광케이블설치사','H/W시험사','S/W시험사','통신관련기사','통신관련산업기사','통신관련기능사','보통인부','특별인부','특수인부','내선전공','배전전공','송전전공','변전전공','계장공','플랜트전공','전기공사기사','전기공사산업기사','측량기술자','측량사','측부','기계설비공','용접공','철공','비계공','콘크리트공','보링공','굴착공','방수공','배관공','도장공','형틀목공','철근공','건설기계운전사']
normalize=lambda v:re.sub(r'\s+','',v or '')
canon={'H/W시험사':'H/W 시험사','S/W시험사':'S/W 시험사','통신관련산업기사':'통신관련 산업기사'}
drafts=[]
for t in tables:
 if not t['code'] or '삭제' in toc[t['code']]['title']:continue
 grid=t['grid'];header_end=-1;labor_cols={};unit_col=None
 for ri,row in enumerate(grid[:5]):
  for ci,value in enumerate(row):
   norm=normalize(value)
   if norm in trades:labor_cols[ci]=canon.get(norm,norm);header_end=max(header_end,ri)
   if norm=='단위':unit_col=ci;header_end=max(header_end,ri)
 if not labor_cols or len(set(labor_cols.values()))!=len(labor_cols):continue
 prior_unit=None
 for ri,row in enumerate(grid):
  if ri<=header_end:continue
  labor_lines={c:((row[c] or '').strip().splitlines() or ['']) for c in labor_cols}
  line_count=max([len(v) for v in labor_lines.values()]+[1])
  if any(len(v) not in [1,line_count] for v in labor_lines.values()):continue
  def at(value,j):
   lines=(value or '').splitlines()
   return lines[j] if len(lines)==line_count else (value or '').replace('\n',' ')
  for li in range(line_count):
   raw_unit=at(row[unit_col],li).strip() if unit_col is not None else ''
   if raw_unit in ['〃','”','“','"','동상']:raw_unit=prior_unit or ''
   else:prior_unit=raw_unit
   unit=re.fullmatch(r'([\d,.]+)?\s*([A-Za-z가-힣㎡㎥²³/()]+)',raw_unit)
   if not unit and unit_col is not None:continue
   base_quantity=float((unit[1] or '1').replace(',','')) if unit else None
   if base_quantity is not None and base_quantity<=0:continue
   labor=[];valid=True
   for ci,trade in labor_cols.items():
    value=at(row[ci],li).strip()
    if value in ['-','－','—','–','']:continue
    if not re.fullmatch(r'\d+(?:\.\d+)?',value):valid=False;break
    labor.append({'trade':trade,'base':float(value)})
   if not valid or not labor:continue
   labels=[]
   for ci,v in enumerate(row):
    if ci in labor_cols or ci==unit_col:continue
    label=at(v,li).strip()
    if label and label not in labels:labels.append(label)
   section=toc[t['code']]
   drafts.append({'id':f'{t["id"]}-r{ri+1}-l{li+1}','code':t['code'],'name':section['title'],'spec':' / '.join(labels),'unit':unit[2] if unit else '', 'unitUnresolved':not bool(unit),'baseQuantity':base_quantity,'labor':labor,'year':2026,'version':'2026.1-extracted','source':'2026년도 적용 정보통신공사 표준품셈','page':t['pdfPage']-30,'pdfPage':t['pdfPage'],'tableId':t['id'],'rowIndex':ri,'lineIndex':li,'verified':False,'reviewStatus':'source-review-required','conditions':'원문 표·단위·해설·공통 적용기준 확인 필요','included':'원문 해설 확인','excluded':'원문 해설 확인','separate':'원문 해설 확인','revised':'2026','adjustments':[{'id':'base','name':'기본 조건','factor':1,'basis':t['code']+' 본문 표'}]})

for i,s in enumerate(ordered):
 s['chapter']=int(s['code'].split('-')[0]);s['deleted']='삭제' in s['title']
 later=[x['pdfPage'] for x in ordered[i+1:] if x['pdfPage']>s['pdfPage']]
 s['endPdfPage']=min(later) if later else min(587,s['pdfPage']+2)
 s['tableIds']=[t['id'] for t in tables if t['code']==s['code']]
 s['draftIds']=[d['id'] for d in drafts if d['code']==s['code']]

source=Path(sys.argv[1]).resolve()
data={'year':2026,'source':'2026년도 적용 정보통신공사 표준품셈','sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'pageCount':587,'sections':ordered,'pages':[{'pdfPage':p['pdfPage'],'text':p['text']} for p in pages],'tables':tables,'drafts':drafts}
(Path(__file__).resolve().parents[1] / 'src/catalog-data.js').write_text('globalThis.standardCatalog = '+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf8')
summary={'pages':len(pages),'sections':len(ordered),'deleted':sum(s['deleted'] for s in ordered),'tables':len(tables),'drafts':len(drafts),'chapters':sorted(set(s['chapter'] for s in ordered)),'headingsEnriched':sum('headings' in p for p in pages)}
(Path(sys.argv[2]).resolve().parent / 'catalog-summary.json').write_text(json.dumps(summary,indent=2),encoding='utf8');print(json.dumps(summary),flush=True)
