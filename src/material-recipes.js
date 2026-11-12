// 자재 구성 추천: 품셈(공종)별로 함께 들어가는 자재와 작업 1단위당 수량.
// 단가는 넣지 않는다(같은 공사의 다른 행·자재단가 관리에 같은 품명·규격 단가가 있으면 그것을 쓴다).
// 근거: 3-1-2 전선관 부속품률(20%/40%/15%), 1-1-6 재료의 할증률(상한), 설계 실무의 일반 구성(사용자 설계내역서 예시).
(function(root){
  'use strict';
  const has=(t,re)=>re.test(t);
  const main=(name,spec)=>({name,spec});
  const x=(name,spec,unit,perUnit,extra={})=>({name,spec,unit,perUnit,...extra});
  // 1-1-6 할증률 상한 안내(자동 적용하지 않음)
  const LOSS_HINT={cableIn:'옥내 통신선·케이블 7.5% 이내',cableOut:'옥외 통신선·케이블 3% 이내',pipe:'옥내 합성수지전선관·금속관 10% 이내',tray:'케이블랙·덕트·레이스웨이 5% 이내'};

  // 각 항목: test(standard 텍스트) → 추천 목록 [{id,label,main?,extras[],lossHint?}]
  const RULES=[
    // ---- 3장 배관 ----
    {code:'3-1-1',make:s=>{
      const kind=(s.spec.match(/^(.*?전선관)/)||[])[1]||'전선관',size=(s.spec.match(/호칭\s*(\d+)/)||[])[1];
      const ratio=/나사 없는/.test(kind)?null:20;
      return [{id:'pipe',label:`${kind} + 부속품${ratio?` ${ratio}%`:''}`,main:main(kind,size?`${size}㎜`:''),lossHint:LOSS_HINT.pipe,
        extras:ratio?[x(`${kind} 부속품`,'커플링·부싱·커넥터·로크너트','식',null,{ratioPercent:ratio,source:'3-1-2 전선관 부속품률'})]:[],
        note:ratio?'':'나사 없는 전선관용 부속품은 실소요량으로 별도 계상(3-1-2 해설 ③)'},
        /합성수지/.test(kind)&&{id:'cd',label:'합성수지제 휨(가요) 전선관(CD·PF관) + 부속품 40%',main:main('CD관',size?`${size}㎜`:''),lossHint:LOSS_HINT.pipe,
        extras:[x('CD관 부속품','커플링·커넥터','식',null,{ratioPercent:40,source:'3-1-2 전선관 부속품률'})],note:'CD·PF관 노무는 합성수지 전선관 품의 80%(3-1-1 해설 ⑤)'}];}},
    {code:'3-2-1',make:s=>[{id:'box',label:'박스',main:main(/풀박스/.test(s.spec)?'풀박스':s.spec.replace(/\s*\(.*$/,''),/풀박스/.test(s.spec)?s.spec.replace(/^풀박스\s*/,''):'')}]},
    {code:'3-3-1',make:s=>[{id:'box',label:'단자함',main:main('단자함',s.spec.replace(/^단자함\s*/,''))}]},
    {code:'3-3-2',make:s=>[{id:'board',label:'배선반',main:main(s.spec.replace(/\s*\d+P.*$/,''),(s.spec.match(/\d+P.*$/)||[''])[0])}]},
    {code:/^3-4-[12]$/,make:s=>[{id:'tray',label:'케이블트레이',main:main(s.code==='3-4-2'?'조립식 케이블트레이':'케이블트레이',s.spec),lossHint:LOSS_HINT.tray,
      note:'지지금구·전산볼트는 설치 간격에 맞춰 부자재로 추가하세요.'}]},
    {code:/^3-5-[1-4]$/,make:s=>[{id:'duct',label:s.code==='3-5-3'?'몰딩':s.code==='3-5-4'?'레이스웨이':'덕트',main:main(s.code==='3-5-3'?(/PVC|알루미늄/.test(s.spec)?'바닥몰드':'금속몰딩'):s.code==='3-5-4'?'레이스웨이':s.name,s.spec),lossHint:LOSS_HINT.tray}]},
    // ---- 4장 케이블 ----
    {code:'4-3-1',make:s=>[{id:'cable',label:'꼬임케이블',main:main(/UTP|구내 4P/.test(s.spec+s.name)?'UTP 케이블':s.spec.split(' ')[0]+' 케이블',(s.spec.match(/\d+P/)||[''])[0]),lossHint:/옥외/.test(s.spec)?LOSS_HINT.cableOut:LOSS_HINT.cableIn}]},
    {code:'4-3-2',make:s=>{
      const t=`${s.name} ${s.spec}`;
      if(has(t,/RJ45|Plug/i))return [{id:'rj45',label:'RJ45 커넥터 + 보호캡',extras:[x('랜 커넥터','RJ45 8P8C','개',1),x('보호캡','RJ45용','개',1)]}];
      if(has(t,/Outlet|콘센트/i))return [{id:'outlet',label:'모듈러 잭(포트 수) + 플레이트',extras:[x('모듈러 잭','RJ45','개','ports'),x('아울렛 플레이트','','개',1)]}];
      if(has(t,/TELCO/i))return [{id:'telco',label:'TELCO 커넥터',extras:[x('TELCO 커넥터','50Pin','개',1)]}];
      return [];}},
    {code:'4-3-3',make:s=>{
      const t=`${s.name} ${s.spec}`;
      if(has(t,/Cord/i))return [
        {id:'cord-made',label:'패치코드 완제품',extras:[x('패치코드','UTP 3m','개',1)]},
        {id:'cord-diy',label:'패치코드 수제작 (케이블 3m + RJ45 2개 + 보호캡 2개)',extras:[x('UTP 케이블','4P','m',3),x('랜 커넥터','RJ45 8P8C','개',2),x('보호캡','RJ45용','개',2)],lossHint:LOSS_HINT.cableIn,
          note:'RJ45 접속 노무는 4-3-2 RJ45 플러그 접속 행을 따로 넣으세요(1개당 2개).'}];
      if(has(t,/성\s*단/))return [{id:'term',label:'성단 (부속 자재 없음)',extras:[],note:'성단 자재는 패치판넬·110블록에 포함. 잡재료는 1-1-12에 따라 일괄 계상.'}];
      if(has(t,/Patch\s*Panel|패치\s*패널/i))return [{id:'panel',label:'패치판넬',main:main('패치판넬',(t.match(/\d+\s*Port/i)||['24 Port'])[0])}];
      if(has(t,/Rack|랙/i))return [{id:'rack',label:'19″ 랙',main:main('통신용 RACK',(t.match(/높이[^ ]*\s*\S*/)||[''])[0]),note:'블랭크·엔트리 패널은 실장도 수량대로 자재단가 관리에 추가하세요.'}];
      if(has(t,/110\s*Block/i))return [{id:'block',label:'110 블록',main:main('110 블록',(t.match(/\d+P/)||[''])[0])}];
      if(has(t,/Outlet\s*Box|Box\s*설/i))return [{id:'obox',label:'아울렛 박스',main:main('아울렛 박스','')}];
      if(has(t,/MDF/))return [{id:'mdf',label:'MDF',main:main('MDF','23″ Standard')}];
      return [];}},
    {code:/^4-1-(1|3|4)$|^4-1-6$/,make:s=>/포설/.test(s.spec+s.name)&&!/내관이음|견인선/.test(s.spec)?[{id:'fiber',label:'광케이블',main:main(s.code==='4-1-4'?'광전복합케이블':'광케이블',(s.spec.match(/\d+코어|\d+㎟/)||[''])[0]),lossHint:/지중|가공/.test(s.spec)?LOSS_HINT.cableOut:LOSS_HINT.cableIn}]:[]},
    {code:'4-1-2-1',make:s=>/접속/.test(s.spec)?[{id:'splice',label:'광접속 슬리브',extras:[x('광접속 슬리브','','개',1)]}]:/광접속함체/.test(s.spec)?[{id:'closure',label:'광접속함체',main:main('광접속함체','')}]:[]},
    {code:'4-1-2-2',make:s=>/국내성단/.test(s.spec)?[{id:'term',label:'피그테일 + 어댑터',extras:[x('피그테일','','개',1),x('광 어댑터','','개',1)]}]:[{id:'box',label:s.spec.replace(/\s*설치$/,''),main:main(s.spec.replace(/\s*설치$/,''),'')}]},
    {code:/^4-(2-1|4-1|6-1|7-1|8-1|10)$/,make:s=>/커넥터/.test(s.spec)?[]:[{id:'cable',label:'케이블',main:main(s.code==='4-4-1'?'제어용 케이블':s.code==='4-6-1'?'전력케이블':s.code==='4-7-1'?'시내케이블':s.code==='4-10'?'PVC 케이블':s.code==='4-2-1'?'동축케이블':s.spec.replace(/\s*\S+\s*이하.*$/,''),s.spec),
      lossHint:/지중|가공|지하/.test(s.spec)?LOSS_HINT.cableOut:LOSS_HINT.cableIn}]},
    {code:'4-6-2',make:s=>[{id:'joint',label:'직선접속재',extras:[x('직선접속재',s.spec,'조',1)]}]},
    {code:'4-6-3',make:s=>[{id:'head',label:'단말처리재(케이블 헤드)',extras:[x('단말처리재',s.spec,'조',1)]}]}
  ];
  function forStandard(standard){
    if(!standard)return [];
    const rule=RULES.find(r=>r.code instanceof RegExp?r.code.test(standard.code):r.code===standard.code);
    return rule?rule.make(standard).filter(Boolean):[];
  }
  const keyOf=(name,spec)=>`${String(name||'').replace(/\s+/g,'').toLowerCase()}|${String(spec||'').replace(/\s+/g,'').toLowerCase()}`;
  // 같은 공사에서 이미 입력한 단가(주자재·부자재·자재단가 관리)를 품명+규격으로 모은다.
  function priceBook(state){
    const book=new Map();
    const put=(name,spec,price,source)=>{if(name&&price!=null&&price!==''&&!book.has(keyOf(name,spec)))book.set(keyOf(name,spec),{price:Number(price),source:source||''});};
    for(const q of state.quantities||[]){const s=(state.standards||[]).find(x=>x.id===q.standardId);put(q.materialName||s?.name,q.materialSpec||s?.spec,q.materialPrice,q.materialSource);for(const e of q.extraMaterials||[])if(e.ratioPercent==null)put(e.name,e.spec,e.price,e.source);}
    for(const m of state.materials||[])put(m.name,m.spec,m.price,m.source);
    return book;
  }
  // 추천을 행에 적용한다. 주자재 품명이 비어 있을 때만 채우고, 부자재는 같은 품명·규격이 없을 때만 더한다.
  function apply(row,recipe,{book=new Map(),ports=null}={}){
    const next=structuredClone(row);
    if(recipe.main){
      if(!next.materialName)next.materialName=recipe.main.name;
      if(!next.materialSpec&&recipe.main.spec)next.materialSpec=recipe.main.spec;
      const known=book.get(keyOf(next.materialName,next.materialSpec));
      if(next.materialPrice==null&&known){next.materialPrice=known.price;next.materialSource=next.materialSource||known.source;}
    }
    next.extraMaterials=[...(next.extraMaterials||[])];
    for(const e of recipe.extras||[]){
      if(next.extraMaterials.some(m=>keyOf(m.name,m.spec)===keyOf(e.name,e.spec)))continue;
      const known=e.ratioPercent==null?book.get(keyOf(e.name,e.spec)):null;
      const per=e.perUnit==='ports'?Number(ports||row.commentary?.ports||1):e.perUnit;
      next.extraMaterials.push({name:e.name,spec:e.spec||'',unit:e.unit||'개',...(e.ratioPercent!=null?{ratioPercent:e.ratioPercent}:{perUnit:per,lossPercent:0}),...(e.perUnit==='ports'?{perPorts:true}:{}),
        price:known?known.price:null,source:known?known.source:(e.source||'')});
    }
    return next;
  }
  root.MaterialRecipes={forStandard,priceBook,apply,keyOf,LOSS_HINT};
  if(typeof module!=='undefined')module.exports=root.MaterialRecipes;
})(globalThis);
