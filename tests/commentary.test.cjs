const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../src/engine.js');
const S=require('../src/surcharges.js');
require('../src/standards.js');
// Factors are the 2026 4-3-1~4-3-3 commentary rules (printed pages 90-92); quantities and wages are synthetic.
const builtin=id=>structuredClone(globalThis.initialStandards.find(s=>s.id===id));
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const state=(standard,row)=>({project:{year:2026,date:'2026-06-01'},rounding:'floor',materials:[],expenses:[],standards:[standard],
  quantities:[{id:'q',standardId:standard.id,length:10,count:1,reviewed:true,adjustment:'base',...row}],
  wages:['통신케이블공','통신내선공','통신설비공','보통인부'].map(trade=>({trade,price:100000,from:'2026-01-01',to:'2026-12-31',source:'TEST ONLY'})),rates:[],ratesReviewed:true});

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
  for(const [n,f] of [[1,1],[2,1.2],[3,1.4],[4,1.6],[6,1.8],[8,2]])close(S.commentaryFactors(outlet,{commentary:{ports:n}}).factor,f);
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
