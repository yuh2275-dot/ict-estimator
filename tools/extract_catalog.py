import sys
from pathlib import Path
import pdfplumber,json,re,hashlib,time

source=Path(sys.argv[1]).resolve()
out=Path(sys.argv[2]).resolve();out.mkdir(parents=True,exist_ok=True)
with pdfplumber.open(source) as pdf:
 for i,page in enumerate(pdf.pages):
  dest=out/f'{i+1:03d}.json'
  if dest.exists():continue
  tables=[]
  for t in page.find_tables():
   rows=t.extract()
   tables.append({'bbox':list(t.bbox),'rows':rows,'cells':[list(c) for c in t.cells]})
  data={'pdfPage':i+1,'width':float(page.width),'height':float(page.height),'text':page.extract_text(layout=False) or '', 'tables':tables}
  dest.write_text(json.dumps(data,ensure_ascii=False),encoding='utf8')
  page.close()
  if (i+1)%20==0:print('Extracted',i+1,'of',len(pdf.pages),flush=True)
print('DONE',flush=True)
