const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../src/engine.js');
const S=require('../src/surcharges.js');
require('../src/standards.js');
// Factors are the 2026 4-3-1~4-3-3 commentary rules (printed pages 90-92); quantities and wages are synthetic.
const builtin=id=>structuredClone(globalThis.initialStandards.find(s=>s.id===id));
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('4-4-1 manually verified commentary preserves saved ids and counts total cable length',()=>{
  const standard=require('../src/standards-verified.js').find(s=>s.code==='4-4-1');
  const info=S.commentary(standard);assert.equal(info.extracted,false);assert.equal(info.page,93);
  assert.deepEqual(info.groups.map(g=>g.id),['b1n4','b1n5','b1n7','b1n8','b1n9']);
  for(const [n,f] of [[1,1],[2,.9],[3,2.6/3],[4,.85],[5,.84]])close(S.commentaryFactors(standard,{commentary:{b1n8:n}}).factor,f);
  const row={commentary:{b1n4:'c1',b1n5:'c1',b1n7:'c1',b1n8:4}};
  close(S.commentaryFactors(standard,row).factor,.8*1.2*1.5*.85);
  const s=state(standard,{...row,length:400,materialPrice:100});const r=E.calculate(s);
  assert.deepEqual(r.errors,[]);assert.equal(r.material,40000);close(r.labor[0].details[0].manDays,standard.labor[0].base*400/10*.8*1.2*1.5*.85);
  assert.equal(S.commentaryFactors(standard,{commentary:{b1n9:'c2'}}).demolition,true);
  assert.throws(()=>S.combined(standard,{adjustment:'base',materialPrice:1,commentary:{b1n9:'c1'}}),/철거/);
  assert.throws(()=>S.commentaryFactors(standard,{commentary:{b1n8:1.5}}),/정수/);
});
const state=(standard,row)=>({project:{year:2026,date:'2026-06-01'},rounding:'floor',materials:[],expenses:[],standards:[standard],
  quantities:[{id:'q',standardId:standard.id,length:10,count:1,reviewed:true,adjustment:'base',...row}],
  wages:['통신케이블공','통신내선공','통신설비공','보통인부','광케이블설치사','통신외선공','특별인부'].map(trade=>({trade,price:100000,from:'2026-01-01',to:'2026-12-31',source:'TEST ONLY'})),rates:[],ratesReviewed:true});

test('each built-in item offers only its own commentary groups and hides already-registered ones',()=>{
  const ids=id=>S.commentary(builtin(id)).groups.map(g=>g.id);
  assert.deepEqual(ids('utp4'),['bind','cable','work']);
  assert.deepEqual(ids('rj45'),['shield','work']);
  assert.deepEqual(ids('outlet'),['shield','ports','work']);
  assert.deepEqual(ids('rack'),['rows','work']);
  assert.deepEqual(ids('panel24'),['work']);
  assert.deepEqual(ids('termination'),['jelly','work']);
  assert.deepEqual(S.commentary({...builtin('utp4'),year:2027}).groups,[]);
});
test('catalog rows registered from 4-3-x get row-specific commentary',()=>{
  const ids=(code,name,spec)=>S.commentary({code,year:2026,name,spec,adjustments:[{id:'base',basis:'x'}]}).groups.map(g=>g.id);
  assert.deepEqual(ids('4-3-1','꼬임케이블 포설','UTP, STP, FTP / 구내 / 100P'),['place','pairs','bind','cable','work']);
  assert.deepEqual(ids('4-3-1','꼬임케이블 포설','UTP, STP, FTP / 옥외 / 4P이하'),['bind','cable','support','work']);
  assert.deepEqual(ids('4-3-2','커넥터 및 Jack 접속','RS-232C(10Pin)'),['pins','work']);
  assert.deepEqual(ids('4-3-2','커넥터 및 Jack 접속','Modular(RJ45-8Pin Plug)'),['shield','cat6','work']);
  assert.deepEqual(ids('4-3-3','Patch Panel 및 성단 등','Box 설치 / Outlet Box (4구이하 노출/매입)'),['box','work']);
  assert.deepEqual(ids('4-3-3','Patch Panel 및 성단 등','110 Block 설 치 / 100P'),['sets','work']);
  assert.deepEqual(ids('4-3-3','Patch Panel 및 성단 등','M D F 설 치 / 23″ Standard (공 철가기준)'),['rows','work']);
  assert.deepEqual(ids('4-3-3','Patch Panel 및 성단 등','19″Rack / 높이 2.2m이상'),['rackType','rows','work']);
  assert.deepEqual(ids('4-3-3','Patch Panel 및 성단 등','Patch Panel 설 치 / 48 Port “'),['panel','work']);
  assert.deepEqual(ids('4-3-3','Patch Panel 및 성단 등','성 단 / Patch Panel'),['jelly','work']);
});
test('count rules follow the printed percentage sequences',()=>{
  const outlet=builtin('outlet'),rack=builtin('rack');
  // 포트 수 산정: 구수 할증 × 포트 수 (6구 = 180% × 6포트 = ×10.8)
  for(const [n,f] of [[1,1],[2,2.4],[3,4.2],[4,6.4],[6,10.8],[8,16]])close(S.commentaryFactors(outlet,{commentary:{ports:n}}).factor,f);
  for(const n of [5,7,0,1.5])assert.throws(()=>S.commentaryFactors(outlet,{commentary:{ports:n}}));
  // 4 racks installed together = 340% of one rack, i.e. 0.85 per rack when the quantity is the total count.
  for(const [n,f] of [[2,.9],[3,2.6/3],[4,.85],[5,4.2/5]])close(S.commentaryFactors(rack,{commentary:{rows:n}}).factor,f);
  const p100={code:'4-3-1',year:2026,name:'꼬임케이블 포설',spec:'UTP, STP, FTP / 구내 / 100P',adjustments:[]};
  for(const [n,f] of [[200,1.8],[300,2.6],[400,3.4],[500,4.2]])close(S.commentaryFactors(p100,{commentary:{pairs:n}}).factor,f);
  assert.throws(()=>S.commentaryFactors(p100,{commentary:{pairs:250}}));
});
test('different commentary conditions multiply into the base labor before common surcharges',()=>{
  const s=state(builtin('utp4'),{adjustment:'tray',commentary:{bind:'tie',cable:'armored'},surcharges:[{id:'night'}]});
  const r=E.calculate(s);assert.deepEqual(r.errors,[]);
  close(r.labor[0].adjustment.laborFactor,1.2*1.1*1.2*1.25);close(r.labor[0].adjustment.wageFactor,1.5);
  assert.equal(r.directLabor,Math.floor(.15*1.2*1.1*1.2*1.25*150000+1e-8));
  assert.match(r.labor[0].adjustment.basis,/해설 ③/);assert.match(r.labor[0].adjustment.basis,/해설 ⑤⑥⑩/);
});
test('demolition applies the removal ratio and refuses new material',()=>{
  const s=state(builtin('rj45'),{commentary:{work:'remove_reuse'}});
  const r=E.calculate(s);assert.deepEqual(r.errors,[]);close(r.labor[0].adjustment.laborFactor,.8);
  s.quantities[0].materialPrice=500;assert.match(E.calculate(s).errors[0],/철거 행/);
  s.quantities[0].materialPrice=null;s.quantities[0].surcharges=[{id:'material_0',value:5,note:'T'}];assert.match(E.calculate(s).errors[0],/재료 할증/);
});
test('unknown or invalid commentary entries are rejected and old rows stay unchanged',()=>{
  assert.throws(()=>S.commentaryFactors(builtin('panel24'),{commentary:{jelly:'jelly'}}),/없는 해설 조건/);
  assert.throws(()=>S.commentaryFactors(builtin('panel24'),{commentary:{work:'other'}}),/허용되지 않은/);
  assert.throws(()=>S.commentaryFactors(builtin('panel24'),{commentary:[]}));
  const old=state(builtin('rack'),{});delete old.quantities[0].commentary;
  const r=E.calculate(old);assert.deepEqual(r.errors,[]);assert.equal(r.labor[0].adjustment.commentaryFactor,1);
});

// ---- 4-3 외 전체 절: 원문 [해 설]에서 자동 추출한 조건 ----
const D=require('../src/commentary-data.js');
const fs=require('node:fs');
const generic=(code,name='',spec='')=>({id:'g',code,year:2026,name,spec,verified:true,unit:'m',baseQuantity:1,labor:[{trade:'보통인부',base:1}],adjustments:[{id:'base',name:'기본',factor:1,basis:code+' 본문 표'}]});
const names=(code)=>S.commentary(generic(code)).groups.map(g=>g.type==='count'?`count:${g.unit}`:g.choices.slice(1).map(c=>c.factor).join(','));
test('extracted data is generated from the bundled catalog text',()=>{
  const text=fs.readFileSync(require.resolve('../src/commentary-data.js'),'utf8');
  require('../src/catalog-data.js');
  assert.equal(D.sha256,globalThis.standardCatalog.sha256);
  assert.match(text,/자동 생성: node tools\/extract_commentary\.cjs/);
  assert.ok(Object.keys(D.sections).length>500);
});
test('extracted commentary turns printed rates of other chapters into choices',()=>{
  assert.deepEqual(names('2-1-1'),['count:열','1.3','0.5,0.8']);          // PVC관: 2열 동시, 나사이음 130%, 철거
  assert.deepEqual(names('2-1-8-1'),['1.5,2','1.5']);                       // 인력 터파기: 협소·용수 50% 가산, 수중 200%, 장애물 50% 가산
  assert.deepEqual(names('4-4-1'),['0.8','1.2','1.5','count:열','0.5,0.9']); // 제어용 케이블
  assert.deepEqual(names('4-2-2'),['0.95','0.3']);                          // 커넥터: 방수처리 미포함 95%, 철거 30%
  assert.equal(S.commentary(generic('4-3-1','꼬임케이블 포설','구내 4P')).extracted,false); // 수작업 대조한 4-3은 그대로
});
test('increments, ranges and rates of a different spec are not turned into automatic factors',()=>{
  for(const [code,s] of Object.entries(D.sections))for(const g of s.groups)for(const c of g.choices||[]){
    assert.ok(c.factor>0&&c.factor<=20,`${code} ${g.ref} ${c.name}`);
    assert.doesNotMatch(c.name,/(당|마다)\s+\d+(\.\d+)?%/,`${code} ${g.ref} ${c.name}`);
    assert.doesNotMatch(c.name,/\d+P\s*의\s*\d+%|\d+구\s*품셈/,`${code} ${g.ref} ${c.name}`);
  }
  const manual=D.sections['8-4-6'].notes.find(n=>n.ref==='⑨');assert.equal(manual.kind,'manual');  // 3대 이상 1대당 80% 가산
  assert.equal(D.sections['2-1-8-2'].groups.find(g=>g.id==='b1n2'),undefined);                    // 잡재료 인력품의 1%까지
});
test('extracted conditions flow through the estimate with their source sentence',()=>{
  const st=generic('2-1-8-1','인력 터파기','보통토사');
  const s=state(st,{commentary:{b1n3:'c2'}});s.quantities[0].length=1;
  const r=E.calculate(s);assert.deepEqual(r.errors,[]);
  close(r.labor[0].adjustment.laborFactor,2);assert.match(r.labor[0].adjustment.basis,/해설 ③ \(인쇄 47쪽\) · 자동 추출/);
  const pipe=generic('2-1-1','PVC관','Ø 30㎜ 이하');
  close(S.commentaryFactors(pipe,{commentary:{b1n2:4}}).factor,.85);
  assert.throws(()=>S.commentaryFactors(pipe,{commentary:{b1n3:'c9'}}),/허용되지 않은/);
  const removal=state(pipe,{commentary:{b1n8:'c1'},materialPrice:100});assert.match(E.calculate(removal).errors[0],/철거 행/);
});
test('a registered adjustment for the same commentary number hides the extracted group',()=>{
  const st=generic('4-4-1','제어용 케이블','1C');st.adjustments.push({id:'shield',name:'실드',factor:1.2,basis:'해설 ⑤'});
  assert.ok(!S.commentary(st).groups.some(g=>g.ref==='⑤'));
});

test('custom multiplier warns when it repeats a selected commentary condition or looks like a count',()=>{
  const outlet=builtin('outlet');
  // 화면 사례: 6구 Outlet에 구수 6 선택 + 추가 배율 6 → ×10.8로 중복
  const row={adjustment:'custom',standardFactor:6,standardFactorBasis:'4구이상',commentary:{ports:6}};
  const w=S.customWarnings(outlet,row);assert.equal(w.length,2);assert.match(w[0],/한 번 더 곱해집니다/);assert.match(w[1],/600%/);
  close(S.combined(outlet,row).laborFactor,6*10.8);
  assert.deepEqual(S.customWarnings(outlet,{...row,commentary:{}, standardFactor:1.3}),[]);
  assert.equal(S.customWarnings(outlet,{...row,standardFactor:1.3}).length,1);
  assert.match(S.customWarnings(outlet,{...row,commentary:{},standardFactor:1})[0],/할증이 없는 것/);
  assert.deepEqual(S.customWarnings(outlet,{adjustment:'base',commentary:{ports:6}}),[]);
});

test('4-6-1~4-6-3 manually verified commentary keeps saved ids and adds missing printed choices',()=>{
  const V=require('../src/standards-verified.js'),by=code=>V.find(s=>s.code===code);
  const cable=by('4-6-1'),joint=by('4-6-2'),head=by('4-6-3');
  const info=S.commentary(cable);assert.equal(info.extracted,false);assert.equal(info.page,95);
  assert.deepEqual(info.groups.map(g=>g.id),['b1n1','b1n2','b1n4','b1n5','b1n6','b1n7','b1n8','b1n11','b1n12','b1n13','b1n15']);
  // ④ 심수: 이전 자동 추출 id(c1=7심 … c6=6심)를 그대로 해석한다.
  for(const [id,f] of [['c2',1.4],['c3',2],['c4',2.6],['c5',3.2],['c6',3.8],['c1',4.4]])close(S.commentaryFactors(cable,{commentary:{b1n4:id}}).factor,f);
  close(S.commentaryFactors(cable,{commentary:{b1n2:'c1'}}).factor,.8);                       // ② 직매
  close(S.commentaryFactors(cable,{commentary:{b1n11:3}}).factor,2.6/3);                      // ⑪ 총길이 기준
  const row={commentary:{b1n1:'c2',b1n4:'c3',b1n8:'c1'}};close(S.commentaryFactors(cable,row).factor,1.1*2*1.2);
  const s=state(cable,{...row,length:100,materialPrice:100});const r=E.calculate(s);
  assert.deepEqual(r.errors,[]);close(r.labor[0].details[0].manDays,cable.labor[0].base*100/10*1.1*2*1.2);
  assert.equal(S.commentaryFactors(cable,{commentary:{b1n15:'c2'}}).factor,.9);              // ⑮ 재활용 90%
  assert.equal(S.commentaryFactors(cable,{commentary:{b1n13:'c1'}}).demolition,true);
  assert.throws(()=>S.commentaryFactors(cable,{commentary:{b1n13:'c1',b1n15:'c1'}}),/함께 선택할 수 없습니다/);
  assert.throws(()=>S.commentaryFactors(cable,{commentary:{b1n6:'c1',b1n15:'c2'}}),/함께 선택할 수 없습니다/);
  assert.throws(()=>S.combined(cable,{adjustment:'base',materialPrice:1,commentary:{b1n15:'c1'}}),/철거/);
  // 4-6-2: ① 증설·이설 150%, ② 재배치 170%는 철거가 아니다.
  assert.deepEqual(S.commentary(joint).groups.map(g=>g.id),['b1n1','b1n2']);
  close(S.commentaryFactors(joint,{commentary:{b1n1:'c1'}}).factor,1.5);
  const relocate=S.commentaryFactors(joint,{commentary:{b1n2:'c3'}});close(relocate.factor,1.7);assert.equal(relocate.demolition,false);
  assert.equal(S.commentaryFactors(joint,{commentary:{b1n2:'c2'}}).demolition,true);
  assert.throws(()=>S.commentaryFactors(joint,{commentary:{b1n1:'c1',b1n2:'c3'}}),/함께 선택할 수 없습니다/);
  // 4-6-3: ② 압착단자 30%는 신설에 한함, ③ 증설·이설 150%
  close(S.commentaryFactors(head,{commentary:{b1n2:'c1'}}).factor,.3);
  close(S.commentaryFactors(head,{commentary:{b1n2:'c2',b1n3:'c1'}}).factor,1.5);
  assert.throws(()=>S.commentaryFactors(head,{commentary:{b1n2:'c1',b1n3:'c1'}}),/함께 선택할 수 없습니다/);
});
test('3-1-1, 4-1-1, 4-2-1, 4-5-1 manual commentary shows only the conditions of each row',()=>{
  const V=require('../src/standards-verified.js'),row=(code,re)=>V.find(s=>s.code===code&&re.test(s.spec));
  const ids=s=>S.commentary(s).groups.map(g=>g.id),f=(s,c)=>S.commentaryFactors(s,{commentary:c}).factor;
  // 3-1-1: ② 콘크리트 노출 120% 추가, ⑤는 합성수지관, ⑥은 후강·합성수지관에만
  const pvc=row('3-1-1',/합성수지 전선관 호칭 16$/),steel=row('3-1-1',/후강 전선관 호칭 16$/),flex=row('3-1-1',/금속제 가요 전선관 호칭 16$/);
  assert.equal(S.commentary(pvc).extracted,false);
  assert.deepEqual(ids(pvc),['b1n2','b1n3','b1n4','b1n5','b1n6','b1n7','b1n10']);
  assert.deepEqual(ids(steel),['b1n2','b1n3','b1n4','b1n6','b1n7','b1n10']);
  assert.deepEqual(ids(flex),['b1n2','b1n3','b1n4','b1n7','b1n10']);
  close(f(pvc,{b1n2:'c3'}),1.2);close(f(pvc,{b1n2:'c1'}),1.25);close(f(pvc,{b1n5:'c1',b1n7:'c1'}),.72);
  assert.throws(()=>f(steel,{b1n6:'c1',b1n3:'c1'}),/함께 선택할 수 없습니다/);
  // 4-1-1: 행별 조건과 직종별 계수
  const manual=row('4-1-1',/지중 인력견인/),air=row('4-1-1',/지중 공기압력/),aerial=row('4-1-1',/^가공 포설/),duct=row('4-1-1',/^내관포설 23/),slim=row('4-1-1',/슬림형/),pull=row('4-1-1',/견인선 포설 인력/);
  assert.deepEqual(ids(manual),['b1n1','b1n6','b1n10','b1n17','b1n25','b1n26']);
  assert.deepEqual(ids(aerial),['b1n1','b1n8','b1n22','b1n25','b1n26']);
  assert.deepEqual(ids(duct),['b1n4']);assert.deepEqual(ids(slim),['b1n15','b1n16']);assert.deepEqual(ids(pull),[]);
  const eight=S.combined(manual,{adjustment:'base',commentary:{b1n10:'c1'}});
  assert.equal(eight.laborFactor,1);assert.deepEqual(eight.tradeFactors,{보통인부:1.15});assert.match(eight.basis,/직종별\(보통인부 ×1\.15\)/);
  const r=E.calculate(state(manual,{length:1000,commentary:{b1n10:'c1'}}));assert.deepEqual(r.errors,[]);
  const md=t=>r.labor[0].details.find(d=>d.trade===t).manDays;
  close(md('광케이블설치사'),.94*10);close(md('보통인부'),1.41*10*1.15);
  const both=S.combined(air,{adjustment:'base',commentary:{b1n12:'c1',b1n1:'c1'}});
  close(both.laborFactor,1.1);assert.deepEqual(both.tradeFactors,{광케이블설치사:1.28,통신외선공:1.23,특별인부:1.31});
  for(const [n,x] of [[2,1],[3,1.8],[4,2.6]])close(f(slim,{b1n15:n}),x);
  close(f(aerial,{b1n8:'c1',b1n22:'c1'}),.84);
  assert.throws(()=>f(aerial,{b1n8:'c1',b1n26:'c1'}),/함께 선택할 수 없습니다/);
  close(f(manual,{b1n26:'c2'}),.9);
  // 4-2-1: 가공 이설은 가공설치품(120%)의 70%
  const coaxDuct=row('4-2-1',/지하관로 포설 5C/),coaxIn=row('4-2-1',/옥내 포설 5C/);
  assert.deepEqual(ids(coaxIn),['b1n8','b1n9','b1n11','b1n12']);
  close(f(coaxDuct,{b1n5:'c2'}),.84);close(f(coaxDuct,{b1n12:'c2'}),.9);
  assert.throws(()=>f(coaxDuct,{b1n2:'c1',b1n5:'c1'}),/함께 선택할 수 없습니다/);
  // 4-5-1: 구간별 체감, 규격, 2선 동시
  const leaky=row('4-5-1',/^포설$/),unpack=row('4-5-1',/포장해체/);
  assert.deepEqual(ids(unpack),[]);
  // 사용자 결정(2026-11-13): 1가닥 연장이 속한 구간의 적용률 하나를 전체에 적용
  for(const [n,x] of [[200,1],[300,1],[301,.8],[500,.8],[800,.7],[1000,.7],[1500,.6],[3000,.5],[4000,.4]])close(f(leaky,{b1n2:n}),x);
  close(f(leaky,{b1n5:'c1',b1n4:'c2'}),.8*.9);
});
test('trade-specific commentary factors reach the Excel unit-price formulas',async()=>{
  const V=require('../src/standards-verified.js'),D=require('../src/design-xlsx.js');
  const manual=V.find(s=>s.code==='4-1-1'&&/지중 인력견인/.test(s.spec));
  const s=state(manual,{length:500,commentary:{b1n10:'c1',b1n1:'c1'}});s.rates=[];
  const r=E.calculate(s);assert.deepEqual(r.errors,[]);
  const {sheets}=D.build(s,r),us=sheets.find(x=>x.name==='일위대가표');
  const formulas=[...us.cells.values()].map(c=>c.formula).filter(Boolean);
  assert.ok(formulas.includes('0.94*1.1'),formulas.join(' | '));assert.ok(formulas.includes('1.41*1.265'),formulas.join(' | '));
  require('../src/xlsx.js');await assert.rejects(globalThis.ExcelIO.write(null,s,r),/직종별 해설 조건/);   // 구 빈 양식은 행마다 계수 하나뿐
});
test('4-1-2-1~4-1-4, 4-1-6, 4-1-7 manual commentary follows the printed rates per row',()=>{
  const V=require('../src/standards-verified.js'),row=(code,re)=>V.find(s=>s.code===code&&re.test(s.spec));
  const f=(s,c)=>S.commentaryFactors(s,{commentary:c}).factor;
  // 4-1-2-1: 분기마다 30% 가산, 해체·조립 70%, 함체 없는 분기접속 149%
  const closure=row('4-1-2-1',/광접속함체/),splice=row('4-1-2-1',/일반접속 12코어/),cut=row('4-1-2-1',/절체접속 12코어/);
  assert.equal(S.commentary(closure).extracted,false);
  close(f(closure,{b1n4:'c1'}),1.3);close(f(closure,{branches:2}),1.6);close(f(closure,{branches:0}),1);close(f(closure,{b1n4:'c2',branches:1}),.7*1.3);
  assert.throws(()=>f(closure,{b1n4:'c1',branches:2}),/함께 선택할 수 없습니다/);
  assert.equal(S.commentaryFactors(closure,{commentary:{b1n16:'c2'}}).demolition,true);
  close(f(splice,{b1n12:'c1',b1n6:'c1'}),1.49*1.2);
  assert.deepEqual(S.commentary(cut).groups.map(g=>g.id),['b1n6']);
  // 4-1-2-2: 동일장소 수열, OTP 옥내 80%, 광분배기 분배 수
  const otp=row('4-1-2-2',/광단자함/),splitter=row('4-1-2-2',/광분배기/),ofd=row('4-1-2-2',/광분배함/);
  close(f(otp,{b1n3:2}),.9);close(f(otp,{b1n6:'c1'}),.8);close(f(otp,{b1n6:'c2',ijpBranches:2}),.8*1.6);close(f(ofd,{b1n1:'c1'}),.3);
  for(const [n,x] of [[4,1],[8,1.6],[12,2.2],[16,2.8],[32,5.2]])close(f(splitter,{b1n9:n}),x);
  // 4-1-3: 기축·리모델링은 포설 200%, 성단·시험 130% (같은 선택 id)
  const cable24=row('4-1-3',/광섬유케이블 포설 24/),term=row('4-1-3',/^성단$/),air=row('4-1-3',/공압포설.*4코어/),slim=row('4-1-3',/슬림형/);
  close(f(cable24,{b1n1:'c1'}),2);close(f(term,{b1n1:'c1'}),1.3);
  close(f(cable24,{b1n2:'c2'}),1.2);close(f(cable24,{b1n2:'c1'}),1.5);close(f(air,{b1n5:'c2'}),1.19);close(f(air,{b1n5:'c1'}),1.37);
  for(const [n,x] of [[1,1],[2,1.8],[3,2.6]])close(f(slim,{b1n13:n}),x);
  assert.throws(()=>f(cable24,{b1n3:'c1',b1n4:'c1'}),/함께 선택할 수 없습니다/);
  assert.deepEqual(S.commentary(row('4-1-3',/광인출구/)).groups,[]);
  // 4-1-4: 8자포설은 보통인부에만
  const composite=row('4-1-4',/지중포설 단면적 35/);
  const a=S.combined(composite,{adjustment:'base',commentary:{b1n2:'c1',b1n4:'c1'}});
  close(a.laborFactor,1.15);assert.deepEqual(a.tradeFactors,{보통인부:1.15});
  assert.deepEqual(S.commentary(row('4-1-4',/가공포설 단면적 35/)).groups.map(g=>g.id),['b1n2','b1n6','b1n7']);
  // 4-1-6, 4-1-7
  close(f(row('4-1-6',/95/),{b1n6:'c2'}),.8);close(f(row('4-1-7',/방수장치/),{b1n4:3}),2.6/3);
});
test('4-7 local cable commentary: per-row groups, trade-specific spare-pair cut-over and corrected rates',()=>{
  const V=require('../src/standards-verified.js'),row=(code,re)=>V.find(s=>s.code===code&&re.test(s.spec));
  const ids=s=>S.commentary(s).groups.map(g=>g.id),f=(s,c)=>S.commentaryFactors(s,{commentary:c}).factor;
  // 4-7-1: 절 이름 "지중 및 가공케이블"이 아니라 규격으로 지중·가공 구분
  const under=row('4-7-1',/^지중케이블 20P 이하 심선 0\.65/),aerial=row('4-7-1',/^가공케이블 50P/);
  assert.equal(S.commentary(under).extracted,false);
  assert.deepEqual(ids(under),['b1n3','b1n10','b1n11','b1n13','b1n14']);
  assert.deepEqual(ids(aerial),['b1n3','b1n5','b1n6','b1n7','b1n8','b1n13','b1n14']);
  close(f(under,{b1n10:'c2'}),1.15);close(f(under,{b1n10:'c1'}),1);close(f(under,{b1n11:'c1',b1n3:'c1'}),.75);
  close(f(aerial,{b1n6:'c1',b1n7:'c1',b1n3:'c2'}),1.1*1.2*1.2);close(f(aerial,{b1n14:'c2'}),.9);
  assert.throws(()=>f(aerial,{b1n8:'c1',b1n14:'c1'}),/함께 선택할 수 없습니다/);
  // 4-7-3: 심선 0.5㎜ 110% 추가, T·Y와 X 분기 배타
  const small=row('4-7-3',/^10P/);
  close(f(small,{b1n10:'c3'}),1.1);close(f(small,{b1n10:'c1',b1n1:'c3'}),1.3*1.3);
  assert.throws(()=>f(small,{b1n3:'c1',b1n11:'c1'}),/함께 선택할 수 없습니다/);
  // 4-7-4-1: 예비심선 절체는 통신케이블공만 65%
  const cut=row('4-7-4-1',/^국내-국외 2점간 0\.4/),outer=row('4-7-4-1',/^국외 2점간 0\.4/);
  const a=S.combined(cut,{adjustment:'base',commentary:{b1n3:'c1',b1n5:'c2'}});
  close(a.laborFactor,1.3);assert.deepEqual(a.tradeFactors,{통신케이블공:.65});
  assert.ok(!ids(outer).includes('b1n3'));
  const r=E.calculate(state(cut,{length:200,commentary:{b1n3:'c1'}}));assert.deepEqual(r.errors,[]);
  close(r.labor[0].details.find(d=>d.trade==='통신케이블공').manDays,4.45*2*.65);close(r.labor[0].details.find(d=>d.trade==='보통인부').manDays,2.49*2);
  close(f(row('4-7-4-2',/^국내-국외 2점간 0\.4/),{b1n8:'c1'}),.85);
  // 4-7-5: 해체·재접속, 분기 수
  const heat=row('4-7-5-1',/열수축관-32/),closure=row('4-7-5-3',/^80-500/);
  assert.equal(S.commentaryFactors(heat,{commentary:{b1n2:'c1'}}).demolition,true);
  assert.throws(()=>f(heat,{b1n2:'c1',b1n5:'c1'}),/함께 선택할 수 없습니다/);
  close(f(closure,{b1n5:2,b1n3:'c1'}),1.6*1.2);close(f(closure,{b1n5:0,b1n9:'c1'}),.5);
  assert.throws(()=>f(closure,{b1n5:1,b1n9:'c1'}),/함께 선택할 수 없습니다/);
  // 4-7-6: 외피탈피 추가 1회마다 20%
  close(f(row('4-7-6',/0\.65/),{b1n5:2,b1n3:'c1'}),1.4*1.5);
});
