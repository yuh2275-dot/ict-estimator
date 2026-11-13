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
  // 공종별 해설 조건: 2026 표준품셈 4-3-1~4-3-3 해설 (인쇄 90~92쪽). 그룹마다 하나를 선택하고, 서로 다른 해설 조건은 곱하여 기본 품을 만든다(1-2-2-15의 "해설란의 할증·감 요소가 감안된 품").
  const choice=(id,name,factor)=>({id,name,factor});
  const none=name=>choice('none',name,1);
  const work=(basis,unused,reuse)=>({id:'work',name:'작업 구분',basis,demolition:true,choices:[none('신설'),choice('remove_unused',`철거 (불용) ${unused*100}%`,unused),choice('remove_reuse',`철거 (재사용) ${reuse*100}%`,reuse)]});
  const countGroup=(id,name,basis,options)=>({id,name,basis,type:'count',...options});
  const sequence=n=>(10+8*(n-1))/10;
  const commentaryRules={
    // 4-4-1은 인쇄 93쪽 이미지 대조. 이전 자동 추출 id를 유지해 저장된 작업도 그대로 계산한다.
    '4-4-1':{page:93,notes:[
      '① 동일 Level 100m 이내 드럼 소운반·드럼대 설치·해체, 케이블 부설, 정돈·청소, 단자처리·결선·표찰 포함',
      '② PVC 및 비닐절연외장 제어케이블에 적용',
      '③ 전선관·랙·덕트·트레이·Pit·공동구·새들을 이용한 포설 기준',
      '④ 직매부설의 굴착은 별도 계상',
      '⑥ 1.5㎟ 미만은 1.5㎟ 기준, 10㎟ 초과는 4-6-1 통신용 구내 전력케이블 적용',
      '⑦ 가요성 금속피 케이블의 앵커볼트 설치는 별도 계상'
    ],groups:()=>[
      {id:'b1n4',name:'포설 방식',basis:'해설 ④',choices:[none('전선관·랙·덕트·트레이 등'),choice('c1','직매부설 80% (굴착 별도)',.8)]},
      {id:'b1n5',name:'실드 여부',basis:'해설 ⑤',choices:[none('일반 케이블'),choice('c1','실드케이블 120%',1.2)]},
      {id:'b1n7',name:'금속피 여부',basis:'해설 ⑦',choices:[none('일반 외피'),choice('c1','가요성 금속피 (알루미늄·스틸) 150%',1.5)]},
      countGroup('b1n8','동시포설 열 수','해설 ⑧',{min:1,step:1,unit:'열',perUnit:true,factor:sequence,hint:'수량은 케이블 총길이(m)입니다. 2열 180% · 3열 260% · 4열 340%, 이후 1열당 80% 가산. 예: 경로 100m × 4열 → 수량 400m, 총길이 기준 계수 3.4÷4 = 0.85.'}),
      {id:'b1n9',name:'작업 구분',basis:'해설 ⑨',demolition:true,choices:[none('신설'),choice('c1','철거 (불용) 50%',.5),choice('c2','철거 (재사용) 90%',.9)]}
    ]},
    // 4-6-1~4-6-3은 인쇄 95~97쪽(PDF 125~127) 이미지 대조. 자동 추출 id(b1nN·cN)를 유지하고, 빠진 선택지(② 직매, ⑥ 증설·이설, ⑮ 재활용 90%, 4-6-2 재배치 등)를 보완한다.
    // excludes: 한 행에서 함께 선택하면 같은 작업을 두 번 반영하게 되는 조건. {그룹 id: true(어느 선택이든) | [선택 id…]}
    '4-6-1':{page:95,notes:[
      '② 전선관·랙·덕트·케이블트레이·Pit·공동구·새들 이용 포설 기준. 작업높이에 따른 할증은 공통 할증 "1-2-2-5 위험 할증률"에서 선택',
      '③ 성단 품셈 별도 계상',
      '⑨ 야간작업은 공통 할증 "1-2-2-6 야간작업"에서 선택',
      '⑩ 10㎟ 이하 통신용 구내 전력케이블은 4-4-1 제어용 케이블 적용',
      '⑫ 가요성 금속피 케이블의 앵커볼트 설치는 별도 계상',
      '⑭ 신호수 등 안전 인력·안전시설은 1-1-27-1 안전시설 적용'
    ],groups:()=>[
      {id:'b1n1',name:'포박',basis:'해설 ①',choices:[none('포박 없음'),choice('c1','포박실 포박 148%',1.48),choice('c2','케이블타이 포박 110%',1.1)]},
      {id:'b1n2',name:'포설 방식',basis:'해설 ②',choices:[none('전선관·랙·덕트·트레이·Pit·공동구·새들'),choice('c1','직매 80%',.8)]},
      {id:'b1n4',name:'심수',basis:'해설 ④',choices:[none('단심 (기본)'),choice('c2','2심 140%',1.4),choice('c3','3심 200%',2),choice('c4','4심 260%',2.6),choice('c5','5심 320%',3.2),choice('c6','6심 380%',3.8),choice('c1','7심 440%',4.4)]},
      {id:'b1n5',name:'8자 케이블',basis:'해설 ⑤',choices:[none('일반 케이블'),choice('c1','8자 케이블 포설 115%',1.15)]},
      {id:'b1n6',name:'증설·이설',basis:'해설 ⑥',excludes:{b1n13:true,b1n15:true},choices:[none('신설'),choice('c1','증설 및 이설 150%',1.5)]},
      {id:'b1n7',name:'케이블 외장',basis:'해설 ⑦',choices:[none('일반 외장'),choice('c1','동심중성선형 (CNCV) 110%',1.1),choice('c2','강대내장 케이블 150%',1.5)]},
      {id:'b1n8',name:'전압',basis:'해설 ⑧',choices:[none('3.3㎸ 미만'),choice('c1','3.3~6.6㎸ 20% 가산 (120%)',1.2),choice('c2','22.9㎸ 이하 50% 가산 (150%)',1.5)]},
      countGroup('b1n11','동시포설 열 수','해설 ⑪',{min:1,step:1,unit:'열',perUnit:true,factor:sequence,hint:'수량은 케이블 총길이(m)입니다. 2열 180% · 3열 260% · 4열 340%, 이후 1열당 80% 가산. 예: 경로 100m × 3열 → 수량 300m, 총길이 기준 계수 2.6÷3.'}),
      {id:'b1n12',name:'금속피 여부',basis:'해설 ⑫',choices:[none('일반 외피'),choice('c1','가요성 금속피 (알루미늄·스틸) 150% (앵커볼트 별도)',1.5)]},
      {id:'b1n13',name:'철거 케이블 다시 감기',basis:'해설 ⑬',demolition:true,excludes:{b1n15:true},choices:[none('해당 없음'),choice('c1','철거 케이블을 풀어서 다시 감기 (신설의 40%)',.4)]},
      {id:'b1n15',name:'작업 구분',basis:'해설 ⑮',demolition:true,choices:[none('신설'),choice('c1','철거 (불용) 50%',.5),choice('c2','철거 (재활용, 드럼에 감기) 90%',.9)]}
    ]},
    '4-6-2':{page:96,notes:['① Y접속·T접속 등 절체에 따른 야간작업은 공통 할증 "1-2-2-6 야간작업"에서 선택'],groups:()=>[
      {id:'b1n1',name:'접속 구분',basis:'해설 ①',excludes:{b1n2:true},choices:[none('신설 직선접속'),choice('c1','증설 및 이설 Y접속·T접속(절체) 150%',1.5)]},
      {id:'b1n2',name:'작업 구분',basis:'해설 ②',demolition:true,choices:[none('신설'),choice('c1','철거 (불용) 50%',.5),choice('c2','철거 (재사용) 70%',.7),{...choice('c3','재배치 170%',1.7),demolition:false}]}
    ]},
    '4-6-3':{page:97,notes:['① 케이블 헤드를 포함한 단말처리 기준','③ 절체접속에 따른 야간작업은 공통 할증 "1-2-2-6 야간작업"에서 선택','④ 16㎟ 미만 단심 통신용 전력케이블 단말처리는 전력케이블 포설 품셈에 포함 (별도 계상하지 않음)'],groups:()=>[
      {id:'b1n2',name:'단말 방식',basis:'해설 ②',choices:[none('케이블 헤드 포함 단말처리'),choice('c1','압착단자만 · 신설 30%',.3),choice('c2','압착단자만 · 살아있는 케이블 100%',1)]},
      {id:'b1n3',name:'증설·이설',basis:'해설 ③',excludes:{b1n2:['c1']},choices:[none('신설'),choice('c1','증설 및 이설 Y접속(절체) 150%',1.5)]}
    ]},
    // 3-1-1·4-1-1·4-2-1·4-5-1은 원문 이미지(PDF 91·109~110·118·124쪽) 대조. 행(관 종류·포설 방식)에 해당하는 조건만 표시한다.
    '3-1-1':{page:61,notes:[
      '① 콘크리트 매입 기준. 관의 절단·나사내기·구부리기·나사조임·관내청소·점검 포함',
      '② 콘크리트 노출 시 앵커볼트 설치 및 구멍뚫기는 3-7 부대공사 별도',
      '⑥ 지중 매설 시 굴착·되메우기·잔토처리 별도. 합성수지 주름관 지중 매설은 2-1-3 적용',
      '⑧ 여러 개의 전선관을 동시에 배관해도 각각의 해당 품셈 적용 (동시 할증 없음)',
      '⑨ 신호수 등 안전 인력·안전시설은 1-1-27-1 안전시설 적용'
    ],groups:t=>[
      {id:'b1n2',name:'설치 장소·구조',basis:'해설 ②',choices:[none('콘크리트 매입 (기본)'),choice('c3','콘크리트 노출·블록칸막이 벽 내 120%',1.2),choice('c2','목조건물 110%',1.1),choice('c1','철강조 노출 125%',1.25)]},
      {id:'b1n3',name:'천장속·마루밑',basis:'해설 ③',choices:[none('해당 없음'),choice('c1','천장속·마루밑 공사 130%',1.3)]},
      {id:'b1n4',name:'방폭 설비',basis:'해설 ④',choices:[none('일반'),choice('c1','방폭 설비 120%',1.2)]},
      /합성수지/.test(t)&&{id:'b1n5',name:'관 종류',basis:'해설 ⑤',choices:[none('합성수지 전선관'),choice('c1','폴리에틸렌 전선관·합성수지제 휨(가요) 전선관(CD·PF관) 80%',.8)]},
      /후강|합성수지/.test(t)&&{id:'b1n6',name:'지중 매설',basis:'해설 ⑥',excludes:{b1n2:true,b1n3:true},choices:[none('건물 내 배관'),choice('c1','지중 매설 70% (KS규격품 4m 기준, 굴착 등 별도)',.7)]},
      {id:'b1n7',name:'반복 공정',basis:'해설 ⑦',choices:[none('일반'),choice('c1','공동주택·교실 등 동일 반복공정 90%',.9)]},
      {id:'b1n10',name:'작업 구분',basis:'해설 ⑩',demolition:true,choices:[none('신설'),choice('c1','철거 (불용) 30%',.3),choice('c2','철거 (재사용) 40%',.4)]}
    ]},
    '4-1-1':{page:79,notes:[
      '② 기계견인포설 장비사용시간 10분/100m, 가공포설(고소작업차) 124분/100m 기준. 기계경비는 1-4 기준으로 별도 계상(⑳)',
      '③ 주관로 청소는 2-1-7 적용 · ⑤ 견인선 인력포설(4㎜)은 내관청소·선통 포함',
      '⑦ 인공내 스파이럴슬리브 설치는 4-7-1 해설 ⑫ 적용',
      '⑨ 젤리충진·해킹방지(IB)·가요성 금속피 광섬유케이블도 본 품셈 적용 (할증 없음)',
      '⑪ 교량·터널·지상 공동관로(트로프) 내 포설은 지중 인력견인포설 품셈 적용',
      '⑭ 공기압력포설품에는 내관청소, 정리·소운반, 맨홀내 여장정리·고정 포함',
      '⑱ 슬림형 내관에 케이블 포설 시 견인선 포설 품셈 미적용 · ⑲ SCD관 포설은 내관포설 품셈 · ㉑ 슬림형 내관을 PE(결합형) 내관·트로프에 포설해도 본 품셈',
      '㉓ 열차감시원은 보통인부 1.0인을 별도 행으로 가산',
      '㉔ 신호수 등 안전 인력·안전시설은 1-1-27-1, 위험 할증은 공통 할증 1-2-2-5에서 선택'
    ],groups:t=>{
      const cable=/싱글\/멀티모드/.test(t),underground=cable&&/지중/.test(t),aerial=cable&&/가공/.test(t);
      return [
      cable&&{id:'b1n1',name:'코어 수',basis:'해설 ①',choices:[none('720코어 미만'),choice('c1','720코어 110%',1.1)]},
      /내관포설/.test(t)&&!/슬림형/.test(t)&&countGroup('b1n4','내관 동시 포설 열 수','해설 ④',{min:1,step:1,unit:'열',perUnit:true,factor:sequence,hint:'수량은 내관 총길이(m)입니다. 2열 180% · 3열 260% · 4열 340%, 이후 1열당 80% 가산(내관견인을 위한 견인선 포설 포함). 예: 경로 100m × 3열 → 수량 300m, 계수 2.6÷3.'}),
      underground&&{id:'b1n6',name:'통신구·동도',basis:'해설 ⑥',choices:[none('일반 관로 (슬림형 내관 사용 포함)'),choice('c1','통신구·동도내 포설 115%',1.15)]},
      aerial&&{id:'b1n8',name:'가공 이설·처짐 조정',basis:'해설 ⑧',excludes:{b1n26:true,b1n25:true},choices:[none('신설'),choice('c1','철거가 수반되지 않는 가공 이설 70%',.7),choice('c2','처짐(정도) 조정 20%',.2)]},
      /인력견인포설/.test(t)&&cable&&{id:'b1n10',name:'8자 포설',basis:'해설 ⑩',choices:[none('일반'),{...choice('c1','8자 포설 · 보통인부에 한하여 15% 가산',1.15),trades:{보통인부:1.15}}]},
      /공기압력포설/.test(t)&&cable&&{id:'b1n12',name:'양방향 포설',basis:'해설 ⑫',choices:[none('단방향'),{...choice('c1','양방향 포설 · 광케이블설치사 128%, 통신외선공 123%, 특별인부 131%',1),trades:{광케이블설치사:1.28,통신외선공:1.23,특별인부:1.31}}]},
      /내관이음/.test(t)&&{id:'b1n13',name:'내관할입이음',basis:'해설 ⑬',choices:[none('일반 내관이음'),choice('c1','통과인공내 내관할입이음 175% (내관인출 포함)',1.75)]},
      /슬림형/.test(t)&&countGroup('b1n15','슬림형 내관 조 수','해설 ⑮',{min:1,step:1,unit:'조',factor:n=>n<=2?1:1+.8*(n-2),hint:'본 품셈은 2조 이하 기준입니다. 3조부터 1조 추가당 80%를 더합니다(3조 180%, 4조 260%). 수량은 경로길이(m)로 입력합니다.'}),
      /슬림형/.test(t)&&{id:'b1n16',name:'추가 포설',basis:'해설 ⑯',choices:[none('신규 관로'),choice('c1','케이블 수용관로내 슬림형 내관 추가 포설 130%',1.3)]},
      underground&&{id:'b1n17',name:'슬림형 내관 용적률',basis:'해설 ⑰',choices:[none('용적률 16% 이하 또는 해당 없음'),choice('c1','관로내 슬림형 내관 · 용적률 16% 초과 32% 이하 115% (광케이블 1조당)',1.15)]},
      aerial&&{id:'b1n22',name:'자기지지형',basis:'해설 ㉒',choices:[none('일반'),choice('c1','자기지지형 광섬유케이블 120%',1.2)]},
      cable&&{id:'b1n25',name:'철거 케이블 다시 감기',basis:'해설 ㉕',demolition:true,excludes:{b1n26:true},choices:[none('해당 없음'),choice('c1','철거 케이블을 풀어서 다시 감기 (신설의 40%)',.4)]},
      cable&&{id:'b1n26',name:'작업 구분',basis:'해설 ㉖',demolition:true,choices:[none('신설'),choice('c1','철거 (불용) 50%',.5),choice('c2','철거 (재활용, 드럼에 감기) 90%',.9)]}
    ];}},
    '4-2-1':{page:88,notes:[
      '① 터파기·되메우기·관로설치·트로프 설치는 별도',
      '③ PE 내관·견인선 포설은 4-1-1 적용',
      '⑥ 인입선 가설은 조당 본 품셈의 48% (바인딩 별도) — 단위가 달라 추가 배율로 직접 입력',
      '⑦ RG(17, 8/H, 11/U) 케이블은 지하관로 포설 품셈 적용',
      '⑨ 가요성 금속피 케이블의 앵커볼트 설치는 별도 계상',
      '⑩ 신호수 등 안전 인력·안전시설은 1-1-27-1 안전시설 적용'
    ],groups:t=>{
      const duct=/지하관로/.test(t),indoor=/옥내/.test(t);
      return [
      duct&&{id:'b1n2',name:'자기지지형',basis:'해설 ②',excludes:{b1n5:true},choices:[none('일반'),choice('c1','자기지지형 케이블 120% (가공 포함)',1.2)]},
      duct&&{id:'b1n4',name:'통신구·동도',basis:'해설 ④',excludes:{b1n5:true},choices:[none('지하관로'),choice('c1','통신구·동도내 포설 115%',1.15)]},
      duct&&{id:'b1n5',name:'가공 설치',basis:'해설 ⑤',choices:[none('지하관로'),choice('c1','가공 설치 120% (자기지지형 제외)',1.2),choice('c2','가공케이블 이설 · 가공설치품(120%)의 70% = 84%',.84)]},
      countGroup('b1n8','동시 설치 열 수','해설 ⑧',{min:1,step:1,unit:'열',perUnit:true,factor:sequence,hint:'수량은 케이블 총길이(m)입니다. 2열 180% · 3열 260% · 4열 340%, 이후 1열당 80% 가산.'}),
      indoor&&{id:'b1n9',name:'금속피 여부',basis:'해설 ⑨',choices:[none('일반 외피'),choice('c1','가요성 금속피 (알루미늄·스틸) 옥내 포설 150% (앵커볼트 별도)',1.5)]},
      {id:'b1n11',name:'철거 케이블 다시 감기',basis:'해설 ⑪',demolition:true,excludes:{b1n12:true},choices:[none('해당 없음'),choice('c1','철거 케이블을 풀어서 다시 감기 (신설의 40%)',.4)]},
      {id:'b1n12',name:'작업 구분',basis:'해설 ⑫',demolition:true,choices:[none('신설'),choice('c1','철거 (불용) 50%',.5),choice('c2','철거 (재활용, 드럼에 감기) 90%',.9)]}
    ];}},
    '4-5-1':{page:94,notes:[
      '① 앵커볼트·클램프 설치 포함',
      '③ 드럼 풀기와 감기는 포장해체 및 점검 품셈 적용',
      '⑤ 본 품셈은 ⅞″ 기준'
    ],groups:t=>{
      const lay=/포설/.test(t);
      return [
      lay&&countGroup('b1n2','체감 적용 포설 연장 (구내 제외)','해설 ②',{min:1,step:1,unit:'m',factor:n=>{
        const bands=[[300,1],[500,.8],[1000,.7],[2000,.6],[3000,.5],[Infinity,.4]];let prev=0,sum=0;
        for(const [to,rate] of bands){if(n<=prev)break;sum+=(Math.min(n,to)-prev)*rate;prev=to;}
        return sum/n;},hint:'구내 포설이면 비워 두세요. 한 번에 포설하는 전체 연장(m)을 넣으면 구간별 적용률(300m 이하 100%, 301~500m 80%, 501~1,000m 70%, 1,001~2,000m 60%, 2,001~3,000m 50%, 3,001m 이상 40%)을 구간마다 적용한 평균 계수를 씁니다. 예: 800m → (300 + 200×0.8 + 300×0.7) ÷ 800 = 0.8375.'}),
      lay&&{id:'b1n4',name:'2선 동시 설치',basis:'해설 ④',choices:[none('1선'),choice('c1','2선 동시 180% · 수량 = 경로길이(1선분)',1.8),choice('c2','2선 동시 180% ÷ 2 · 수량 = 케이블 총길이',.9)]},
      lay&&{id:'b1n5',name:'케이블 규격',basis:'해설 ⑤',choices:[none('⅞″ (기준)'),choice('c1','½″ 80%',.8),choice('c3','1¼″ 110%',1.1),choice('c2','1⅝″ 120%',1.2)]},
      lay&&{id:'b1n6',name:'작업 구분',basis:'해설 ⑥',demolition:true,choices:[none('신설'),choice('c1','철거 (불용) 30%',.3),choice('c2','철거 (재사용) 80%',.8)]}
    ];}},
    '4-3-1':{page:90,notes:['① 몰딩 설치는 3-5-3 몰딩(Molding) 적용','④ 성단은 4-3-3 별도 계상','⑨ 철가 및 케이블 포설포박은 5-1-1 기초설치(공통) 적용','⑪ 신호수·안전시설은 1-1-27-1 안전시설 적용'],groups:t=>[
      /구내/.test(t)&&{id:'place',name:'설치 장소',basis:'해설 ①',choices:[none('관로 및 Pit (기본)'),choice('tray','벽잠핑·플로어덕트·케이블 트레이·랙 120%',1.2),choice('floor','바닥 노출 80%',.8)]},
      /(^|[^0-9])100P/.test(t)&&countGroup('pairs','UTP·STP·FTP 실제 대수 (P)','해설 ②',{min:100,step:100,unit:'P',factor:n=>{if(n%100)throw Error('대수는 100P 단위로 입력하세요.');return sequence(n/100);},hint:'200P 180% · 300P 260% · 400P 340% · 400P 초과는 100P당 80% 가산'}),
      {id:'bind',name:'포박',basis:'해설 ③',choices:[none('포박 없음'),choice('thread','포박실 포박 148%',1.48),choice('tie','케이블 타이 포박 110%',1.1)]},
      {id:'cable',name:'케이블 형태',basis:'해설 ⑤⑥⑩',choices:[none('일반 케이블'),choice('figure8','8자 케이블 115% (⑤)',1.15),choice('armored','강대가 있는 케이블 120% (⑥)',1.2),choice('flexible','가요성 금속피 케이블 옥내 포설 150% (⑩, 앵커볼트 별도)',1.5)]},
      /옥외/.test(t)&&{id:'support',name:'옥외 케이블',basis:'해설 ⑦',choices:[none('일반 (인입 클램프 포함)'),choice('self','자기지지형 120%',1.2)]},
      work('해설 ⑫',.5,.9)]},
    '4-3-2':{page:91,notes:['③ Outlet Box는 별도 계상 (4-3-3)','⑤ 철가 및 케이블 포설포박은 5-1-1 기초설치(공통) 적용'],groups:t=>[
      /RS-?232/i.test(t)&&{id:'pins',name:'RS-232C 핀 수',basis:'해설 ①',choices:[none('10Pin 이하'),choice('pin11','11Pin 이상 130%',1.3)]},
      /Modular|RJ45|Outlet|콘센트/i.test(t)&&{id:'shield',name:'케이블 종류',basis:'해설 ②',choices:[none('UTP'),choice('stp','STP·FTP용 Modular Jack 130%',1.3)]},
      /Outlet|콘센트/i.test(t)&&countGroup('ports','Outlet 구수','해설 ③',{min:1,step:1,unit:'구',perPort:true,factor:n=>{if(n<=4)return 1+.2*(n-1);if(n%2)throw Error('4구 초과는 2구 단위(6구, 8구…)로 입력하세요. 그 외는 추가 배율 직접입력을 사용하세요.');return 1.6+.2*(n-4)/2;},hint:'1구 100% · 2구 120% · 3구 140% · 4구 160% · 4구 초과 2구당 20% 가산. 노무 수량은 포트 수(콘센트 개수 × 구수)로 셉니다. 수량에는 콘센트 개수를 입력하세요.'}),
      /RJ45|Plug/i.test(t)&&{id:'cat6',name:'등급',basis:'해설 ④',choices:[none('Cat5e 이하'),choice('cat6','Cat6 Modular 135%',1.35)]},
      work('해설 ⑥',.3,.8)]},
    '4-3-3':{page:92,notes:['④ 단순 도통시험은 Port당 통신케이블공·보통인부 각 0.01인, 링크성능 테스트는 회선시험 품셈 적용, 시험성적서는 Port당 통신관련산업기사 0.01인 가산 (별도 행으로 계상)','⑧ 철가 및 케이블 포설포박은 5-1-1 기초설치(공통) 적용'],groups:t=>{
      const termination=/성\s*단/.test(t),install=!termination;
      return [
      install&&/Outlet\s*Box|Box\s*설\s*치/i.test(t)&&{id:'box',name:'Outlet Box 구수',basis:'해설 ①',choices:[none('4구 이하'),choice('box6','6구 130%',1.3),choice('box12','12구 (6구의 250%) 325%',3.25)]},
      install&&/110\s*Block/i.test(t)&&countGroup('sets','동시 설치 세트 수','해설 ②',{min:1,step:1,unit:'세트',perUnit:true,factor:sequence,hint:'2세트 180% · 3세트 260% · 4세트 340% · 4세트 초과 1세트당 80% 가산. 수량은 전체 세트 수로 입력합니다.'}),
      termination&&{id:'jelly',name:'성단 케이블',basis:'해설 ③',choices:[none('일반 케이블'),choice('jelly','젤리충진 케이블 150%',1.5)]},
      install&&/Rack|랙/i.test(t)&&{id:'rackType',name:'랙 형식',basis:'해설 ⑤',choices:[none('고정형 (수평조정 포함)'),choice('mobile','이동형 20%',.2)]},
      install&&/Patch\s*Panel|패치\s*패널/i.test(t)&&!/Cord/i.test(t)&&{id:'panel',name:'Patch Panel',basis:'해설 ⑥',choices:[none('현장조립 및 설치'),choice('assembled','조립된 Patch Panel 설치 70%',.7)]},
      install&&/Rack|랙|M\s*D\s*F/i.test(t)&&countGroup('rows','동시 설치 열 수 (MDF·랙)','해설 ⑦',{min:1,step:1,unit:'열',perUnit:true,factor:sequence,hint:'2열 180% · 3열 260% · 4열 340% · 4열 초과 1열당 80% 가산. 수량은 전체 대수(열 수)로 입력합니다.'}),
      work('해설 ⑨',.3,.8)];}}
  };
  // 4-3-1~4-3-3 외의 절은 tools/extract_commentary.cjs가 원문 [해 설]에서 자동 추출한 데이터(src/commentary-data.js)를 사용한다.
  let extractedCatalog=null;
  function extracted(){
    if(extractedCatalog)return extractedCatalog;
    extractedCatalog=root.commentaryCatalog||(typeof require==='function'?(()=>{try{return require('./commentary-data.js');}catch{return null;}})():null)||{sections:{}};
    return extractedCatalog;
  }
  const shortText=(text,max=70)=>text.length>max?text.slice(0,max-1)+'…':text;
  function extractedGroups(code,section){
    const groups=[];
    for(const g of section.groups){
      const basis=`${code} 해설 ${g.ref} (인쇄 ${g.page}쪽) · 자동 추출`;
      const common={key:`해설 ${g.ref}`,ref:g.ref,text:g.text,page:g.page,extracted:true,partial:g.partial};
      if(g.type==='count'){
        const hundred=g.unit==='×100P';
        groups.push({...common,id:g.id,type:'count',name:`${g.ref} ${hundred?'100P 기준 배수':'동시 설치 '+g.unit+' 수'}`,basis,min:1,step:1,unit:hundred?'×100P':g.unit,perUnit:g.perUnit!==false,factor:sequence,
          hint:g.perUnit!==false?'2 → 180%, 3 → 260%, 4 → 340%, 이후 1당 80% 가산. 수량은 전체 합계로 입력하며 1단위당 (비율 ÷ 개수)를 적용합니다.':'2 → 200P 180%, 3 → 300P 260%, 4 → 400P 340%, 이후 100P당 80% 가산'});
        continue;
      }
      groups.push({...common,id:g.id,type:'choice',demolition:g.demolition,name:`${g.ref} ${shortText(g.text,40)}`,basis,choices:[none('해당 없음'),...g.choices.map(c=>choice(c.id,c.name,c.factor))]});
    }
    return groups;
  }
  function commentary(standard){
    if(Number(standard?.year)!==2026)return {groups:[],notes:[],page:null,extracted:false};
    const registered=new Set((standard.adjustments||[]).map(a=>String(a.basis||'').trim()));
    const rule=commentaryRules[standard.code];
    if(rule){
      const text=`${standard.name||''} ${standard.spec||''}`.replace(/Patch\s*Panel\s*및\s*성단\s*등/i,''); // 4-3-3 절 제목(Patch Panel 및 성단 등)은 행 구분에 쓰지 않는다.
      // 품셈에 같은 해설 번호의 계수가 이미 등록되어 있으면 중복 적용하지 않도록 그룹을 숨긴다.
      const groups=rule.groups(text).filter(g=>g&&!registered.has(g.basis)).map(g=>({...g,basis:`${standard.code} ${g.basis} (인쇄 ${rule.page}쪽)`}));
      return {groups,notes:rule.notes,page:rule.page,extracted:false};
    }
    const section=extracted().sections?.[standard.code];
    if(!section)return {groups:[],notes:[],page:null,extracted:false};
    const groups=extractedGroups(standard.code,section).filter(g=>!registered.has(g.key));
    const notes=section.notes.map(n=>`${n.ref} ${n.kind==='common'?'[공통 할증 화면에서 선택] ':n.kind==='manual'?'[비율 확인 후 추가 배율 직접입력] ':''}${n.text}`);
    const partial=section.groups.filter(g=>g.partial).map(g=>`${g.ref} [일부 비율은 자동 계수에서 제외 · 추가 배율 직접입력] ${g.text}`);
    return {groups,notes:[...partial,...notes],page:(section.groups[0]||section.notes[0])?.page??null,extracted:true};
  }
  function commentaryFactors(standard,row){
    const {groups}=commentary(standard),values=row.commentary??{};
    if(typeof values!=='object'||Array.isArray(values))throw Error('공종 해설 조건 형식 오류');
    const known=new Set(groups.map(g=>g.id));
    for(const key of Object.keys(values))if(!known.has(key))throw Error(`이 공종에 없는 해설 조건입니다: ${key}`);
    const applied=[],tradeFactors={};let factor=1,demolition=false;
    for(const g of groups){
      const raw=values[g.id];
      if(g.type==='count'){
        if(raw==null||raw==='')continue;
        const n=Number(raw);
        if(!Number.isInteger(n)||n<g.min||n>1e6||(g.step>1&&n%g.step))throw Error(`${g.name}: ${g.min}${g.unit} 이상 ${g.step>1?g.step+g.unit+' 단위':'정수'}로 입력하세요.`);
        if(n===g.min)continue;
        // perPort: 노무 수량을 포트 수로 센다(사용자 결정, 2026-11-12). 콘센트 1개 = n포트이므로 계수에 n을 곱한다. 재료비는 콘센트 개수 기준 그대로.
        const total=g.factor(n),f=g.perUnit?total/n:g.perPort?total*n:total;
        applied.push({group:g.id,name:`${g.name} ${n}${g.unit}${g.perPort?` (포트 ${n} × ${Number((total*100).toFixed(4))}%)`:''}`,factor:f,basis:`${g.basis}: ${Number((total*100).toFixed(4))}%${g.perUnit?` ÷ ${n} (수량 1단위당)`:''}${g.perPort?` × 포트 ${n} (포트 수 산정: 콘센트 1개 = ${n}포트)`:''}`});
        factor*=f;continue;
      }
      if(raw==null||raw==='none')continue;
      const c=g.choices.find(c=>c.id===raw);
      if(!c)throw Error(`${g.name}: 허용되지 않은 선택입니다.`);
      if(c.demolition??g.demolition)demolition=true;
      // trades: 원문이 직종을 지정한 비율(예: 4-1-1 ⑩ 보통인부에 한하여 15% 가산)은 해당 직종 품에만 곱한다.
      if(c.trades){
        for(const [trade,f] of Object.entries(c.trades))tradeFactors[trade]=(tradeFactors[trade]??1)*f;
        applied.push({group:g.id,name:c.name,factor:1,trades:c.trades,basis:g.basis});continue;
      }
      applied.push({group:g.id,name:c.name,factor:c.factor,basis:g.basis});factor*=c.factor;
    }
    const chosen=id=>{const v=values[id];return v==null||v===''||v==='none'?null:v;};
    for(const g of groups)for(const [other,ids] of Object.entries(g.excludes||{})){
      const o=groups.find(x=>x.id===other);
      if(!o||chosen(g.id)==null||chosen(other)==null||(ids!==true&&!ids.includes(chosen(other))))continue;
      throw Error(`"${g.name}"과(와) "${o.name}" 조건은 같은 작업을 두 번 반영하므로 함께 선택할 수 없습니다. 행을 나누세요.`);
    }
    return {factor,applied,demolition,tradeFactors};
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
      if(!String(row.standardFactorBasis||'').trim())throw Error('추가 배율의 근거(해설 번호·원문)를 입력하세요.');
      special={id:'custom',name:'추가 배율 직접입력',factor,basis:row.standardFactorBasis};
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
    const notes=commentaryFactors(standard,row);
    if(notes.demolition&&row.materialPrice!=null&&row.materialPrice!=='')throw Error('철거 행에는 신규 재료 단가를 입력하지 마세요. 재료가 필요하면 신설 행을 따로 만드세요.');
    if(notes.demolition&&materialPercent)throw Error('철거 행에는 재료 할증을 적용하지 않습니다.');
    const laborFactor=finite(special.factor)*notes.factor*parallelWork.perCableFactor*(1+laborPercent/100),wageFactor=1+wagePercent/100;
    const parallelBasis=parallelWork.runs>1?`4-3-1 해설 ⑧ (인쇄 90쪽): ${parallelWork.runs}열 동시포설, 경로길이 기준 ×${parallelWork.bundleFactor} / 케이블 총길이 기준 ×(${parallelWork.bundleFactor}÷${parallelWork.runs}); 입력 기준: ${parallelWork.mode==='route'?'1열 경로길이':'케이블 총길이'}`:'';
    const commentaryText=notes.applied.filter(a=>!a.trades).map(a=>`×${Number(a.factor.toFixed(6))}`).join(' ');
    const tradeText=Object.entries(notes.tradeFactors).map(([t,f])=>`${t} ×${Number(f.toFixed(6))}`).join(', ');
    return {id:special.id,name:[special.name,...notes.applied.map(a=>a.name),parallelWork.runs>1?`${parallelWork.runs}열 동시포설`:'',...selected.map(i=>i.name)].filter(Boolean).join(' / '),factor:laborFactor*wageFactor,laborFactor,wageFactor,laborPercent,wagePercent,materialPercent,materialFactor:1+materialPercent/100,specialFactor:Number(special.factor),commentaryFactor:notes.factor,tradeFactors:notes.tradeFactors,commentary:notes.applied,demolition:notes.demolition,selected,parallel:parallelWork,
      basis:[special.basis,...notes.applied.map(a=>`${a.name} · ${a.basis}`),parallelBasis,...selected.map(i=>`${i.name} ${i.rate}%${i.wageRate?` + 노임 ${i.wageRate}%`:''} · ${i.basis}`),`공종계수 ${special.factor}${commentaryText?` × 해설 조건(${commentaryText})`:''}${tradeText?` × 직종별(${tradeText})`:''}${parallelWork.runs>1?` × 동시포설(${parallelWork.bundleFactor}÷${parallelWork.runs})`:''} × 품(1 + ${laborPercent}%) × 노임(1 + ${wagePercent}%)`].filter(Boolean).join(' / ')};
  }
  // 추가 배율(직접입력)이 해설 조건과 겹치거나 개수로 잘못 입력된 것으로 보이면 경고한다. 저장 시 사용자가 확인해야 한다.
  function customWarnings(standard,row){
    if(row.adjustment!=='custom'||!standard)return [];
    const factor=Number(row.standardFactor),warnings=[];
    if(!Number.isFinite(factor))return [];
    let applied=[];try{applied=commentaryFactors(standard,row).applied;}catch{}
    if(applied.length)warnings.push(`위에서 선택한 해설 조건(${applied.map(a=>`${a.name} ×${Number(a.factor.toFixed(6))}`).join(', ')})에 추가 배율(×${factor})이 한 번 더 곱해집니다. 같은 조건을 두 번 넣은 것이면 추가 배율을 '기본 조건'으로 되돌리세요.`);
    if(factor>2)warnings.push(`추가 배율 ×${factor} = 본 품셈의 ${Number((factor*100).toFixed(4))}%입니다. 구·열·대 같은 개수를 넣은 것이 아닌지 확인하세요. 예: 130% → 1.3`);
    if(factor===1)warnings.push('추가 배율 1은 할증이 없는 것과 같습니다. 필요 없으면 기본 조건을 선택하세요.');
    return warnings;
  }
  root.Surcharges={groups,items,resolve,combined,parallel,supportsParallel,commentary,commentaryFactors,customWarnings};
  if(typeof module!=='undefined')module.exports=root.Surcharges;
})(globalThis);

