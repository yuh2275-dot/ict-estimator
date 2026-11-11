// 2026 표준품셈 전체 본문(src/catalog-data.js)에서 각 절의 [해 설] 항목을 추출해
// 공종 해설 조건 데이터(src/commentary-data.js)를 만든다.
// 원문 문장은 그대로 보존하고, 해석 가능한 비율 문구만 선택지로 바꾼다. 결과는 자동 추출이므로
// 화면에서 원문 대조 후 선택하도록 표시한다.
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
require(path.join(root,'src/catalog-data.js'));
const catalog=globalThis.standardCatalog;

const CIRCLED='①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳㉑㉒㉓㉔㉕㉖㉗㉘㉙㉚㉛㉜㉝㉞㉟';
const squash=s=>s.replace(/\s+/g,'');
const sections=new Map(catalog.sections.filter(s=>!s.deleted).map(s=>[s.code,s]));

function headerCode(line){
  const m=line.match(/^(\d+(?:-\d+){1,4})\s+(.+)$/);
  if(!m||!sections.has(m[1]))return null;
  const title=squash(sections.get(m[1]).title),rest=squash(m[2]);
  return title&&rest.startsWith(title.slice(0,Math.min(2,title.length)))?m[1]:null;
}

// 1. 페이지를 이어 붙여 절별 해설 항목을 모은다.
const blocks=new Map(); // code -> [{page, items:[{no,text,page}]}]
let current=null,mode=null,block=null,item=null;
for(const page of catalog.pages){
  const lines=page.text.split('\n').map(l=>l.trim()).filter(Boolean);
  lines.forEach((line,index)=>{
    if(index===0&&/^제\s*\d+\s*장/.test(line))return;      // 장 머리글
    if(/^-\s*\d+\s*-$/.test(line))return;                    // 쪽 번호
    const code=headerCode(line);
    if(code){current=code;mode=null;item=null;return;}
    if(/^\[\s*해\s*설\s*\]$/.test(line)){
      if(!current)return;
      mode='commentary';block={page:page.pdfPage,items:[]};item=null;
      if(!blocks.has(current))blocks.set(current,[]);
      blocks.get(current).push(block);return;
    }
    if(mode!=='commentary')return;
    if(/^\(단위\s*[:：]/.test(line)){mode=null;item=null;return;}
    const no=CIRCLED.indexOf(line[0]);
    if(no>=0){item={no:no+1,text:line.slice(1).trim(),page:page.pdfPage};block.items.push(item);return;}
    if(item)item.text+=' '+line;
  });
}

// 2. 문장에서 비율 문구를 해석한다.
const pct=String.raw`(\d+(?:\.\d+)?)\s*%`;
function clauseBefore(text,at){
  // 괄호 밖의 쉼표·마침표·연결어미에서 절을 나눈다.
  let start=0,depth=0;
  for(let i=0;i<at;i++){
    const ch=text[i];
    if('(（[“"'.includes(ch)&&!(ch==='"'&&depth))depth++;
    else if(')）]”'.includes(ch))depth=Math.max(0,depth-1);
    else if(!depth&&',，.;'.includes(ch)&&!(/\d/.test(text[i-1]||'')&&/\d/.test(text[i+1]||'')))start=i+1;
    else if(!depth&&ch===' '){const w=text.slice(Math.max(0,i-3),i);if(/(하며|하고|이며|이고)$/.test(w)||/[가-힣](며|고)$/.test(w)&&/(하|이|되|있|없|함|용)(며|고)$/.test(w))start=i+1;}
  }
  let label=text.slice(start,at).trim()
    .replace(/(본\s*품셈|본\s*품|이\s*품|본\s*공량|해당\s*품셈)\s*의?\s*$/,'').trim()
    .replace(/\s*(은|는|을|를|이|가|에|에는|의|시|시는|때|때에는|경우|경우에는|경우는)$/,'')
    .replace(/[\s(“"']+$/,'').trim();
  if(label.length>48)label='…'+label.slice(-47);
  return label;
}
function parseItem(text){
  const plain=text.replace(/\s+/g,' ').trim();
  if(/1-2-\d/.test(plain)&&/할증/.test(plain))return {kind:'common'};      // 공통 할증 참조: 공통 할증 화면에서 선택
  // 철거
  const removal=plain.match(/철\s*거[^%]{0,20}?불용\s*(\d+)\s*%[^%]{0,10}?재사용\s*(\d+)\s*%/);
  if(removal)return {kind:'choice',demolition:true,choices:[{name:`철거 (불용) ${removal[1]}%`,factor:+removal[1]/100},{name:`철거 (재사용) ${removal[2]}%`,factor:+removal[2]/100}]};
  const removalOne=plain.match(/^철\s*거\s*\.?\s*\(?\s*(\d+)\s*%/)||plain.match(/철거(?:시|는|의 경우)?\s*(?:본\s*품셈의\s*)?(\d+)\s*%\s*적용/);
  if(removalOne&&!/설치|신설/.test(plain.slice(0,removalOne.index)))return {kind:'choice',demolition:true,choices:[{name:`철거 ${removalOne[1]}%`,factor:+removalOne[1]/100}]};
  // 2열 180%, 3열 260%, 4열 340%, 초과 1열당 80% 가산
  if(/180\s*%/.test(plain)&&/260\s*%/.test(plain)&&/340\s*%/.test(plain)&&/80\s*%\s*(씩\s*)?가산/.test(plain)){
    if(/100P\s*의\s*180/.test(plain))return {kind:'count',unit:'×100P',perUnit:false};
    const unit=(plain.match(/2\s*(열|세트|회선|조|단|면|본|개소|개|대|공|구)/)||[])[1]||'열';
    return {kind:'count',unit,perUnit:true};
  }
  const choices=[],re=new RegExp(pct+String.raw`\s*(씩\s*)?(까지\s*)?(를\s*|을\s*)?(적용|가산|감산|감|할증|증)`,'g');
  let m,ambiguous=false;
  while((m=re.exec(plain))){
    const value=+m[1],verb=m[5],before=plain.slice(Math.max(0,m.index-12),m.index);
    if(/[~～∼-]\s*$/.test(before)){ambiguous=true;continue;}                 // 70~80%
    // "100P의 180%", "6구 품셈의 250%"처럼 다른 규격을 기준으로 한 비율은 자동 계수로 쓰지 않는다.
    const owner=plain.slice(Math.max(0,m.index-30),m.index).match(/(\S+)(\s+(?:품셈|품))?\s*의\s*$/);
    if(owner&&/\d/.test(owner[1])){ambiguous=true;continue;}
    if(m[2]){ambiguous=true;continue;}
    if(/(당|마다)\s*(본\s*품셈의?|본\s*품의|이\s*품의|해당\s*품셈의?)?\s*$/.test(before.length<12?before:plain.slice(Math.max(0,m.index-20),m.index))){ambiguous=true;continue;} // "1대당 80% 가산" 같은 증분은 수량에 따라 달라짐
    const label=clauseBefore(plain,m.index)||'해당 조건';
    if(m[3]){ambiguous=true;continue;}                                         // "N%까지" 상한 문구는 대상(품·재료비)이 다양해 직접입력
    if((verb==='할증'||verb==='증')&&value>=100){ambiguous=true;continue;}     // "150% 할증"은 배율인지 가산인지 문맥에 따라 다름
    let factor;
    if(verb==='적용')factor=value/100;
    else if(verb==='감산'||verb==='감')factor=1-value/100;
    else factor=1+value/100;
    if(!(factor>0)||factor>20){ambiguous=true;continue;}
    choices.push({name:`${label} ${verb==='적용'?value+'% 적용':verb==='감'||verb==='감산'?value+'% 감':value+'% '+verb}`,factor});
  }
  // "1P 50%, 2P 70%, 쌍투는 120%, 4P는 130% 적용"처럼 마지막 동사를 공유하는 나열
  for(const sentence of plain.split(/\.\s+|\.$/)){
    const parts=sentence.split(/[,，]\s*/),last=parts[parts.length-1].match(new RegExp(pct+String.raw`\s*(를\s*|을\s*)?(적용|가산)\s*$`));
    if(!last||parts.length<2||last[3]!=='적용'||/(당|마다)/.test(parts[parts.length-1]))continue;
    for(const part of parts.slice(0,-1)){
      const bare=part.match(new RegExp(String.raw`^(.{1,30}?)\s*(?:은|는)?\s*`+pct+String.raw`$`));
      if(!bare||/\d\s*$/.test(bare[1])&&!/[A-Za-z가-힣]/.test(bare[1]))continue;
      const label=bare[1].replace(/\s*(은|는)$/,'').trim(),value=+bare[2];
      if(!label||/(당|마다|이하|이상|미만|초과|[~～∼-])$/.test(label)||/품셈|품의/.test(label))continue;
      const factor=value/100;
      if(factor>0&&factor<=20)choices.push({name:`${label} ${value}% 적용`,factor});
    }
  }
  if(choices.length)return {kind:'choice',choices,partial:ambiguous};
  if(/\d\s*%/.test(plain)&&/(적용|가산|감|할증)/.test(plain))return {kind:'manual'};
  return {kind:'note'};
}

// 3. 데이터 생성
const out={};
let stats={sections:0,items:0,choice:0,count:0,manual:0,common:0,note:0};
for(const [code,list] of blocks){
  const groups=[],notes=[];
  list.forEach((b,bi)=>b.items.forEach(it=>{
    const text=it.text.replace(/\s+/g,' ').trim(),parsed=parseItem(text);
    const ref=`${list.length>1?`[해설 ${bi+1}] `:''}${CIRCLED[it.no-1]}`;
    const id=`b${bi+1}n${it.no}`;
    stats.items++;stats[parsed.kind]++;
    const base={id,ref,text,page:it.page-30};
    if(parsed.kind==='choice')groups.push({...base,type:'choice',demolition:!!parsed.demolition,partial:!!parsed.partial,choices:parsed.choices.map((c,i)=>({id:'c'+(i+1),...c}))});
    else if(parsed.kind==='count')groups.push({...base,type:'count',unit:parsed.unit,perUnit:parsed.perUnit});
    else notes.push({...base,kind:parsed.kind});
  }));
  if(!groups.length&&!notes.length)continue;
  stats.sections++;
  out[code]={title:sections.get(code).title,groups,notes};
}
const header='// 자동 생성: node tools/extract_commentary.cjs — 직접 수정하지 마세요.\n// 2026 정보통신공사 표준품셈 각 절의 [해 설] 항목. 원문 대조가 필요한 자동 추출 데이터입니다.\n';
fs.writeFileSync(path.join(root,'src/commentary-data.js'),header+'globalThis.commentaryCatalog = '+JSON.stringify({year:2026,source:catalog.source,sha256:catalog.sha256,sections:out})+';\nif (typeof module !== \'undefined\') module.exports = globalThis.commentaryCatalog;\n');
console.log(stats);
