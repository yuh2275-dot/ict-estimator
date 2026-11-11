(function(root){
  'use strict';
  // 2026 정보통신공사 표준품셈, 인쇄면 19~26 (PDF 49~56).
  const groups=[], items=[];
  function group(id,name,code,page){groups.push({id,name,code,page});}
  function add(groupId,id,name,rate,extra={}){
    const g=groups.find(g=>g.id===groupId);
    items.push({group:groupId,id,name,rate,target:'labor',exclusive:groupId,code:g.code,page:g.page,...extra});
  }
  function variants(g,prefix,labels,rates,extra={}){labels.forEach((label,i)=>add(g,prefix+i,label,rates[i],extra));}
  group('terrain','지세별','1-2-2-1',49);
  variants('terrain','terrain_', ['보통','불량','매우 불량','물이 있는 논','농작물이 있는 논밭','소택지·깊은 논','번화가 1 (주간)','번화가 1 지중케이블 (주간)','번화가 2 (주간)','번화가 2 지중케이블 (주간)','주택가','고속도로·도로경사면','공항 이착륙 20회 이상/일','공항 10회 이상~20회 미만/일','공항 6회 이상~10회 미만/일','공항 5회 이하/일'],[0,25,50,20,10,50,20,30,10,15,10,20,50,25,15,10],{note:'지세·번화가 구분은 원문 표의 조건을 확인하세요.'});
  add('terrain','island','도서지구 (본토 파견인력)',null,{input:'percent',max:50,note:'본토에서 파견된 인력에만 적용. 혼합 인력은 산출 행을 나누세요.'});
  add('terrain','busy_night','번화가 1·2 야간 지세',50,{page:50,note:'주간 지세율을 대체하는 50%입니다. 야간 품·노임은 별도 선택합니다.'});
  group('landform','지형별','1-2-2-2',51);
  variants('landform','landform_', ['강 건너기 (강폭 150m 이상)','계곡 건너기 (선로 150m 이상)'],[50,30]);
  group('small','소단위 작업','1-2-2-3',51);
  variants('small','small_', ['1~3기(개)','4~5기(개)','6~8기(개)','9~10기(개)'],[50,30,15,10]);
  group('remote','원거리·이동·분산작업','1-2-2-4',51);
  add('remote','remote','왕복 이동시간으로 산정',null,{input:'hours',note:'왕복시간에서 1시간을 뺀 t로 t/(8−t)×100, 최대 50%. 1시간 이하는 0%.'});
  group('risk','위험 작업','1-2-2-5',52);
  variants('risk','bridge_', ['교량 인도교','교량 철교','교량 공중작업'],[15,30,70],{exclusive:'bridge'});
  for(const [id,name] of [['height_no','고소작업 · 비계틀 없음'],['height_scaffold','고소작업 · 비계틀 있음'],['height_vehicle','고소작업차 사용']])add('risk',id,name,null,{input:'height',exclusive:'height',note:'지상 높이(m)를 입력하면 원문 높이 구간으로 계산합니다.'});
  add('risk','underground','지하작업 (원문: 지하 4m 이하)',10,{exclusive:'underground'});
  variants('risk','live_', ['활선 AC 154kV 이상 · 4m 이내','활선 AC 66kV급 · 3m 이내','활선 AC 6.6kV급 · 2m 이내','활선 AC 600V 이상 · 1m 이내','활선 AC 60V 이상~600V 미만 · 30cm 이내','활선 DC 1,500V 이상 · 1m 이내','활선 DC 60V 이상~1,500V 미만 · 30cm 이내'],[30,30,30,30,30,30,30],{exclusive:'live'});
  add('risk','power_line','전력선 첨가·외선 증설',20,{exclusive:'power_line',page:53});
  variants('risk','tunnel_', ['터널 인도','철도터널 · 인도·궤도 부설 전','철도터널 · 궤도 부설 후 열차 통행 전','철도터널 · 궤도 부설 후 열차 통행 중','도로터널'],[15,15,20,30,30],{exclusive:'tunnel',page:53,note:'터널 입구에서 25m 이상 들어간 작업에 적용.'});
  add('risk','tunnel_ladder','터널 내 사다리 추가',10,{exclusive:'ladder',page:53,note:'터널 할증과 함께 적용. 고소작업 할증과 중복할 수 없습니다.'});
  add('risk','military','군 작전지구',null,{input:'percent',max:20,exclusive:'military',page:53});
  group('night','야간작업','1-2-2-6',53);
  add('night','night','야간작업 · 품 25% + 노임 50%',25,{wageRate:50,note:'공사성질상 부득이한 야간작업. 이 선택에 노임 50%가 포함됩니다.'});
  group('floor','건물층수별','1-2-2-7',53);
  add('floor','floor_above','지상층',null,{input:'floor',note:'1층 0%, 2~5층 1%, 6~10층 3%, 이후 구간별 적용. 층 구분 불가 시 층고 3.6m로 환산.'});
  add('floor','floor_below','지하층',null,{input:'floor',note:'지하 1층 1%, 2~5층 2%, 6층부터 1개 층당 0.2% 추가.'});
  group('train','운전빈도별','1-2-2-8',54);
  variants('train','train_', ['본선 13회 이하','본선 14~18회','본선 19회 이상','인접선 13회 이하','인접선 14~18회','인접선 19회 이상'],[14,25,37,3,5,7],{note:'열차통과로 작업이 중단되는 경우. 인접선은 이격거리 10m 이내.'});
  group('catenary','전차선 가설 차단공사','1-2-2-9',54);
  [25,38,50,63,75,88,100,113,125,138,150].forEach((count,i)=>{
    ['1시간 미만','1시간 이상~2시간 미만','2시간 이상~3시간 미만','3시간 이상~6시간 미만'].forEach((time,j)=>add('catenary',`catenary_${i}_${j}`,`열차 ${count}회 · 차단 ${time}`,45+10*i-5*j,{note:'단선구간의 전차선·조가선·보조조가선 가설. 빈도·입환·열차접근·감시·사다리 할증 별도 가산 불가. 표에 없는 횟수는 임의 보간하지 마세요.'}));
  });
  group('shunting','구내 입환·천정·벽 속','1-2-2-10',55);
  variants('shunting','shunt_', ['특히 빈번한 입환 (구내배선 6선 이상)','기타 역 구내 (구내배선 5선 이상)'],[20,10],{exclusive:'shunting'});
  variants('shunting','enclosed_', ['천정 속 작업 (기존건물 개보수)','벽 속 작업 (기존건물 개보수)'],[40,20],{exclusive:'enclosed'});
  group('harmful','유해별','1-2-2-11',55);
  variants('harmful','harmful_', ['고온·고압기기 접근','고열·미탄실·위험물·독극물·석면 등','맨홀·정화조·축전지실·제빙실·밀폐공간 등 유해가스'],[30,20,10]);
  group('special','특수작업','1-2-2-12',55);
  add('special','special','특별 기술·안전관리 기술원·감독원 투입',null,{input:'percent',min:5,max:10,note:'중요기기·공작물, 특별 사양·공법 등. 특별 작업조의 기술원·감독원 1인 계상은 별도 수량으로 입력합니다.'});
  group('outage','휴전 시간별','1-2-2-13',55);
  variants('outage','outage_', ['2시간','3시간','4시간','5시간','6시간','7시간'],[35,30,25,20,10,0],{note:'휴전공사 또는 운행선의 선로 일시 사용 중지가 필요한 궤도공사.'});
  group('other','기타 작업환경','1-2-2-14',56);
  add('other','environment','동시장비·협소·소음진동·위험 등 능력저하',null,{input:'percent',max:50,exclusive:'environment',note:'4개 조건은 서로 중복 가산하지 않고 종합하여 한 번 적용합니다.'});
  add('other','manhole','협소·복잡한 인수공',null,{input:'percent',max:20,exclusive:'manhole',note:'케이블 수용기준을 초과해 작업간격이 확보되지 않는 인수공.'});
  add('other','security','보안지역·입회하 작업',null,{input:'percent',max:15,exclusive:'security',note:'작업시간과 통행로 제한이 있는 경우.'});
  variants('other','sea_', ['선상·해상 보통 (항내)','선상·해상 약간 나쁨 (항외)','선상·해상 나쁨 (파고 0.5m 이상)'],[25,33,42],{exclusive:'sea'});
  add('other','urgent','긴급공사',null,{input:'percent',max:30,exclusive:'urgent',note:'재해·돌발사고·일기불순·원인자 부담·현장방문 계획수립 등에 따른 긴급 시행.'});
  group('wage','노임 할증 직접 입력','1-2-1',49);
  for(const [id,name] of [['overtime','연장근로'],['night_wage','야간근로 (노임만)'],['holiday','휴일근로'],['danger_wage','유해·위험 작업 노임'],['island_wage','도서지역 노임'],['qualification','기능자격자 특별 사용']])add('wage',id,name,null,{input:'percent',target:'wage',exclusive:id,note:'적용 법령·근로조건을 확인해 해당 작업분의 요율과 근거를 직접 입력하세요. 작업시간이 다르면 행을 나누세요.'});
  group('material','재료 할증','1-1-6',35);
  const materialNames=['옥내 통신선·케이블(광 포함)','옥내 합성수지전선관·금속관','옥내 트레이·덕트·레이스웨이','옥외 통신선·케이블(광 포함)','옥외 지하관로·직매케이블(광 포함)','옥외 합성수지전선관(파형관 포함)','옥외 합성수지관 소켓','옥외 점퍼선','옥외 열수축관','옥외 25회선 접속자(커넥터 포함)','옥외 조가선·지지선','옥외 가공선로 철물류 100개 미만','옥외 가공선로 철물류 100~199개','옥외 가공선로 철물류 200~499개','옥외 가공선로 철물류 500~999개','옥외 가공선로 철물류 1,000개 이상'];
  [7.5,10,5,3,3,3,10,5,5,2,4,3,2.5,2,1.5,1].forEach((max,i)=>add('material','material_'+i,`${materialNames[i]} (최대 ${max}%)`,null,{input:'percent',max,target:'material',note:'재료 수량에만 적용합니다. 시공수량·노무비는 늘리지 않습니다. 철거손실률과 구분하세요.'}));
  const finite=v=>{if(v===''||v==null||!Number.isFinite(Number(v))||Number(v)<0||Number(v)>1e12)throw Error('할증 입력값을 확인하세요.');return Number(v);};
  function supportsParallel(standard){return standard?.code==='4-3-1'&&Number(standard.year)===2026&&standard.unit==='m';}
  function parallel(standard,row){
    const runs=row.parallelRuns===undefined?1:finite(row.parallelRuns);
    const mode=row.parallelQuantityMode??'total';
    if(!Number.isInteger(runs)||runs<1||runs>1e6)throw Error('동시포설 열 수는 1 이상의 정수로 입력하세요.');
    if(!['total','route'].includes(mode))throw Error('동시포설 수량 기준을 확인하세요.');
    if((runs!==1||mode!=='total')&&!supportsParallel(standard))throw Error('이 동시포설 조건은 2026년 4-3-1 꼬임케이블 포설(m)에만 적용합니다.');
    const bundleFactor=(10+8*(runs-1))/10;
    return {runs,mode,bundleFactor,perCableFactor:bundleFactor/runs,quantityMultiplier:mode==='route'?runs:1};
  }
  function resolve(selection){
    const item=items.find(i=>i.id===selection.id);
    if(!item)throw Error('등록되지 않은 공통 할증');
    let rate=item.rate;
    if(item.input){
      const v=finite(selection.value);
      if(item.input==='percent'){
        if(v<(item.min??0)||v>(item.max??1000))throw Error(`${item.name}: ${item.min??0}~${item.max??1000}% 범위를 확인하세요.`);
        rate=v;
        if(!String(selection.note||'').trim())throw Error(`${item.name}: 적용 근거를 입력하세요.`);
      }
      if(item.input==='hours'){const t=Math.max(0,v-1);rate=t>=8?50:Math.min(50,t/(8-t)*100);}
      if(item.input==='height'){
        if(item.id==='height_no')rate=v<1.2?0:v<5?10:v<10?20:v<15?30:v<20?40:v<30?50:v<40?60:v<50?70:v<60?80:90+Math.floor((v-60)/10)*10;
        else rate=v<10?(item.id==='height_vehicle'?7:0):v<20?10:v<30?20:v<50?30:v<60?40:50+Math.floor((v-60)/10)*10;
      }
      if(item.input==='floor'){
        if(!Number.isInteger(v)||v<1)throw Error('층수는 1 이상의 정수로 입력하세요.');
        rate=item.id==='floor_below'?(v===1?1:2+Math.max(0,v-5)*.2):(v===1?0:v<=5?1:v<=10?3:v<=15?4:v<=20?5:v<=25?6:7+Math.max(0,Math.ceil((v-30)/5)));
      }
    }
    return {...item,rate,value:selection.value,basis:[`${item.code} (인쇄 ${item.page-30}쪽)`,selection.note].filter(Boolean).join(' · ')};
  }
  function combined(standard,row){
    const parallelWork=parallel(standard,row);
    let special=standard.adjustments.find(a=>a.id===row.adjustment);
    if(row.adjustment==='custom'){
      const factor=finite(row.standardFactor);
      if(!String(row.standardFactorBasis||'').trim())throw Error('공종 해설 계수의 적용 근거를 입력하세요.');
      special={id:'custom',name:'공종 해설 직접입력',factor,basis:row.standardFactorBasis};
    }
    if(!special)throw Error('허용되지 않은 할증');
    if(row.surcharges!=null&&!Array.isArray(row.surcharges))throw Error('공통 할증 목록 형식 오류');
    const selected=(row.surcharges||[]).map(resolve), seen=new Set();
    for(const item of selected){if(seen.has(item.exclusive))throw Error(`${item.name}: 같은 조건의 할증은 한 번만 선택하세요.`);seen.add(item.exclusive);}
    if(seen.has('ladder')&&seen.has('height'))throw Error('터널 사다리와 고소작업 할증은 중복할 수 없습니다.');
    if(seen.has('ladder')&&!seen.has('tunnel'))throw Error('터널 사다리는 터널 작업 할증과 함께 선택하세요.');
    if(seen.has('catenary')&&['train','shunting','ladder'].some(g=>seen.has(g)))throw Error('전차선 차단공사와 운전빈도·구내입환·사다리 할증은 중복할 수 없습니다.');
    if(seen.has('night')&&seen.has('night_wage'))throw Error('야간작업에 노임 50%가 이미 포함되어 있습니다.');
    const laborPercent=selected.filter(i=>i.target==='labor').reduce((n,i)=>n+i.rate,0);
    const materialPercent=selected.filter(i=>i.target==='material').reduce((n,i)=>n+i.rate,0);
    const wagePercent=selected.reduce((n,i)=>n+(i.target==='wage'?i.rate:0)+(i.wageRate||0),0);
    const laborFactor=finite(special.factor)*parallelWork.perCableFactor*(1+laborPercent/100),wageFactor=1+wagePercent/100;
    const parallelBasis=parallelWork.runs>1?`4-3-1 해설 ⑧ (인쇄 90쪽): ${parallelWork.runs}열 동시포설, 경로길이 기준 ×${parallelWork.bundleFactor} / 케이블 총길이 기준 ×(${parallelWork.bundleFactor}÷${parallelWork.runs}); 입력 기준: ${parallelWork.mode==='route'?'1열 경로길이':'케이블 총길이'}`:'';
    return {id:special.id,name:[special.name,parallelWork.runs>1?`${parallelWork.runs}열 동시포설`:'',...selected.map(i=>i.name)].filter(Boolean).join(' / '),factor:laborFactor*wageFactor,laborFactor,wageFactor,laborPercent,wagePercent,materialPercent,materialFactor:1+materialPercent/100,specialFactor:Number(special.factor),selected,parallel:parallelWork,
      basis:[special.basis,parallelBasis,...selected.map(i=>`${i.name} ${i.rate}%${i.wageRate?` + 노임 ${i.wageRate}%`:''} · ${i.basis}`),`공종계수 ${special.factor}${parallelWork.runs>1?` × 동시포설(${parallelWork.bundleFactor}÷${parallelWork.runs})`:''} × 품(1 + ${laborPercent}%) × 노임(1 + ${wagePercent}%)`].filter(Boolean).join(' / ')};
  }
  root.Surcharges={groups,items,resolve,combined,parallel,supportsParallel};
  if(typeof module!=='undefined')module.exports=root.Surcharges;
})(globalThis);
