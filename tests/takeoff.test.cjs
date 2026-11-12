const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../src/catalog-data.js');
require('../src/standards.js');
const S=require('../src/surcharges.js');
const E=require('../src/engine.js');
const T=require('../src/takeoff.js');
const BASE=structuredClone(globalThis.initialStandards); // standards-verified.js를 불러오기 전의 기본 6개
// 합성 상태와 합성 AI 답변(실제 도면 아님)
const state=()=>({version:1,project:{name:'',location:'',date:'2026-09-01',year:2026,summary:''},standards:structuredClone(BASE),quantities:[],materials:[],expenses:[],wages:[],rates:[],ratesReviewed:false,rounding:'floor',history:[]});
const answer={format:'ict-estimator-takeoff',version:1,project:{name:'테스트 정비공사',location:'1F',summary:'UTP 배선;랙 신설'},
  items:[
    {standardId:'utp4',code:'4-3-1',name:'UTP 케이블 포설',spec:'구내 4P',unit:'m',quantity:400,location:'1F',basis:'(25m×16)',materialName:'UTP 케이블',adjustment:'tray',commentary:{bind:'tie'},parallelRuns:4,confidence:'high'},
    {code:'4-3-2',name:'정보콘센트 접속',spec:'Modular Outlet',unit:'EA',quantity:2,commentary:{ports:6,unknown:'x'}},
    {code:'4-3-3',name:'19" Rack 설치',spec:'높이 2.2m 미만',unit:'대',quantity:1,commentary:{work:'remove_unused'},confidence:'low'},
    {code:'4-3-3',name:'110 Block 설치',spec:'100P',unit:'세트',quantity:2},
    {code:'4-4-1',name:'제어용 케이블',spec:'2C 1.5㎟',unit:'m',quantity:30},
    {code:'9-9-9',name:'없는 공종',spec:'?',quantity:1},
    {standardId:'rj45',quantity:0}],
  materials:[{name:'블랭크 패널',spec:'1U',unit:'EA',quantity:3}],assumptions:['축척 1/100']};

test('the prompt lists registered standards with their condition ids and the output format',()=>{
  const p=T.buildPrompt(state());
  assert.match(p,/"format": "ict-estimator-takeoff"/);
  assert.match(p,/- 4-3-1 UTP 케이블 포설 \[품셈 단위 10m\] adjustment: tray=/);
  assert.match(p,/규격: 구내 4P \(standardId "utp4"\)/);
  assert.match(p,/commentary: .*ports\(숫자 1~, 구\)/);assert.match(p,/parallelRuns 가능/);
});
test('answers are read from plain JSON, code fences or surrounding text',()=>{
  const json=JSON.stringify(answer);
  assert.equal(T.parse(json).items.length,7);
  assert.equal(T.parse('도면을 분석했습니다.\n```json\n'+json+'\n```\n확인 바랍니다.').items.length,7);
  assert.equal(T.parse('결과: '+json+' 끝').items.length,7);
  assert.equal(T.parse(JSON.stringify(answer.items)).items.length,7);assert.equal(T.parse('목록: '+JSON.stringify(answer.items)).items.length,7);
  assert.throws(()=>T.parse(''),/붙여 넣으세요/);assert.throws(()=>T.parse('{"a":1}'),/items/);assert.throws(()=>T.parse('{bad'),/JSON/);
});
test('items are matched to standards, conditions are validated and problems are reported',()=>{
  const r=T.match(state(),T.parse(JSON.stringify(answer)));
  const [utp,outlet,rack,block,control,none,zero]=r.rows;
  assert.equal(utp.status,'ok');assert.equal(utp.row.standardId,'utp4');assert.equal(utp.row.adjustment,'tray');assert.deepEqual(utp.row.commentary,{bind:'tie'});assert.equal(utp.row.parallelRuns,4);
  assert.equal(utp.row.reviewed,false);assert.match(utp.row.note,/AI 도면 해석/);assert.equal(utp.row.materialName,'UTP 케이블');
  assert.equal(outlet.row.standardId,'outlet');assert.deepEqual(outlet.row.commentary,{ports:6});assert.equal(outlet.status,'check');assert.match(outlet.issues.join(),/unknown/);
  assert.equal(rack.row.standardId,'rack');assert.deepEqual(rack.row.commentary,{work:'remove_unused'});assert.match(rack.issues.join(),/신뢰도 낮음/);
  assert.equal(block.status,'draft');assert.match(block.draft.spec,/110 Block/);assert.match(block.draft.spec,/100P/);assert.equal(block.selected,false);
  assert.equal(control.status,'register');assert.match(control.issues[0],/4-4-1 제어용 케이블/);
  assert.equal(none.status,'unmatched');
  assert.match(zero.issues.join(),/수량이 없거나 0/);
  assert.equal(r.materials[0].price,0);assert.match(r.materials[0].source,/단가 입력 필요/);
  assert.deepEqual(r.assumptions,['축척 1/100']);
});
test('verified standards are matched by spec numbers and names, ties ask for a check',()=>{
  const V=require('../src/standards-verified.js');
  const st=state();st.standards=[...structuredClone(BASE),...structuredClone(V)];
  const r=T.match(st,{items:[{code:'3-1-1',name:'후강전선관',spec:'22',unit:'m',quantity:10},{code:'3-1-1',name:'CD관',spec:'16',unit:'m',quantity:10},{code:'4-4-1',name:'제어케이블',spec:'2C 1.5㎟',unit:'m',quantity:30}]});
  assert.equal(r.rows[0].standard.spec,'후강 전선관 호칭 22');assert.equal(r.rows[0].status,'check');assert.doesNotMatch(r.rows[0].issues.join(),/여러 개/);
  assert.equal(r.rows[1].status,'check');assert.match(r.rows[1].issues.join(),/여러 개/);
  assert.equal(r.rows[2].standard.spec,'2C 1.5㎟');assert.equal(r.rows[2].status,'ok');
  assert.ok(T.buildPrompt(st).length<40000,'요청문 길이');
});
test('apply adds unchecked rows that calculate, and fills only empty project fields',()=>{
  const s=state();s.project.location='기존 위치';
  const r=T.match(s,T.parse(JSON.stringify(answer)));
  r.rows[6].selected=false;
  const out=T.apply(s,r,{fillProject:true});
  assert.equal(out.added,3);assert.equal(out.next.quantities.length,3);assert.equal(out.materials,1);
  assert.equal(out.next.project.name,'테스트 정비공사');assert.equal(out.next.project.location,'기존 위치');
  assert.equal(s.quantities.length,0);                                      // 원본 불변
  const calc=E.calculate({...out.next,wages:[{trade:'통신케이블공',price:100000,from:'2026-01-01',to:'2026-12-31',source:'T'},{trade:'통신내선공',price:100000,from:'2026-01-01',to:'2026-12-31',source:'T'},{trade:'통신설비공',price:100000,from:'2026-01-01',to:'2026-12-31',source:'T'}]});
  assert.ok(calc.labor.length===3&&calc.directLabor>0);
  assert.equal(calc.errors.filter(e=>/품셈·적용 조건 확인 필요/.test(e)).length,3); // 확인 전에는 엑셀 저장 불가
  const utp=calc.labor.find(l=>l.standard.id==='utp4');assert.equal(utp.quantity,400);assert.ok(Math.abs(utp.adjustment.laborFactor-1.2*1.1*3.4/4)<1e-9);
  assert.equal(T.apply(s,{...r,includeMaterials:false}).materials,0);
});
