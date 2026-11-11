import sys
from pathlib import Path
import pdfplumber,json,re
source=Path(sys.argv[1]).resolve()
out=Path(sys.argv[2]).resolve()
with pdfplumber.open(source) as pdf:
 for i,page in enumerate(pdf.pages):
  dest=out/f'{i+1:03d}.json'
  if not dest.exists():continue
  data=json.loads(dest.read_text(encoding='utf8'))
  if 'headings' in data:continue
  found=page.search(r'(?m)^(\d{1,2}(?:-\d+){1,4})\s+([^\n]+)',regex=True)
  data['headings']=[{'code':m['groups'][0],'title':m['groups'][1],'top':m['top']} for m in found if not re.search(r'[·.…]{2}',m['text'])]
  # Geometry identifies the origin of merged cells without guessing a previous row.
  for table in data['tables']:
   cells=table['cells'];xs=sorted(set(c[0] for c in cells));ys=sorted(set(c[1] for c in cells))
   origin={(round(c[0],3),round(c[1],3)):v for row,y in zip(table['rows'],ys) for x,v in zip(xs,row) if v is not None for c in cells if abs(c[0]-x)<.01 and abs(c[1]-y)<.01}
   grid=[]
   for y in ys:
    row=[]
    for x in xs:
     containing=[c for c in cells if c[0]-.01<=x<c[2]-.01 and c[1]-.01<=y<c[3]-.01]
     c=containing[0] if containing else None
     row.append(origin.get((round(c[0],3),round(c[1],3))) if c else None)
    grid.append(row)
   table['grid']=grid
  dest.write_text(json.dumps(data,ensure_ascii=False),encoding='utf8');page.close()
  if(i+1)%50==0:print('Enriched',i+1,flush=True)
