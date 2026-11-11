const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../src/engine.js');
// 합성 데이터: 노임이 입력되어 있으면 확인 체크 전에도 노무비가 계산되어야 한다.
const state=(row={},wages)=>({project:{year:2026,date:'2026-09-01'},rounding:'floor',materials:[],expenses:[],rates:[],ratesReviewed:true,
  standards:[{id:'s',verified:true,year:2026,code:'TEST',name:'TEST 공종',unit:'m',baseQuantity:10,labor:[{trade:'통신내선공',base:1}],adjustments:[{id:'base',name:'기본',factor:1,basis:'T'}]}],
  quantities:[{id:'q',standardId:'s',length:10,count:1,adjustment:'base',reviewed:false,materialPrice:1000,...row}],
  wages:wages??[{trade:'통신내선공',price:284880,from:'2026-09-01',to:'2026-12-31',source:'TEST'}]});

test('labor is calculated from the registered wage before the review box is ticked',()=>{
  const r=E.calculate(state());
  assert.equal(r.directLabor,284880);assert.equal(r.material,10000);assert.equal(r.total,294880);
  assert.match(r.errors.join(),/TEST 공종 · 품셈·적용 조건 확인 필요/);
  const ok=E.calculate(state({reviewed:true}));assert.deepEqual(ok.errors,[]);assert.equal(ok.directLabor,284880);
});
test('a wage outside the project date still calculates with the nearest period and asks for a check',()=>{
  const r=E.calculate(state({reviewed:true},[{trade:'통신내선공',price:280000,from:'2026-01-01',to:'2026-08-31',source:'상반기'},{trade:'통신내선공',price:250000,from:'2025-01-01',to:'2025-12-31',source:'전년'}]));
  assert.equal(r.directLabor,280000);
  assert.match(r.errors.join(),/통신내선공 노임 적용기간\(2026-01-01 ~ 2026-08-31\)이 공사 기준일 2026-09-01을 포함하지 않습니다/);
});
test('missing, duplicated or unsourced wages are reported once per trade',()=>{
  const none=E.calculate(state({reviewed:true},[]));assert.equal(none.directLabor,0);assert.equal(none.errors.length,1);assert.match(none.errors[0],/노임단가가 없습니다/);
  const s=state({reviewed:true},[{trade:'통신내선공',price:1,from:'2026-01-01',to:'2026-12-31',source:'A'},{trade:'통신내선공',price:2,from:'2026-06-01',to:'2026-12-31',source:'B'}]);
  s.quantities.push({...s.quantities[0],id:'q2'});
  const dup=E.calculate(s);assert.equal(dup.errors.length,1);assert.match(dup.errors[0],/2건/);assert.equal(dup.directLabor,4);
  assert.match(E.calculate(state({reviewed:true},[{trade:'통신내선공',price:1,from:'2026-01-01',to:'2026-12-31',source:' '}])).errors[0],/출처를 입력/);
});
test('the workbook uses the same wage the calculation used, even outside its period',()=>{
  const D=require('../src/design-xlsx.js');
  const s=state({reviewed:true},[{trade:'통신내선공',price:280000,from:'2026-01-01',to:'2026-08-31',source:'상반기'}]);
  const r=E.calculate(s),sheets=D.build(s,r,{preview:true}).sheets,cell=(n,ref)=>sheets.find(x=>x.name===n).cells.get(ref);
  assert.equal(cell('인건비산출기초','C6').value,280000);assert.match(cell('인건비산출기초','D6').value,/기준일이 적용기간 밖/);
  const d=sheets.find(x=>x.name==='설계내역서');const wageCell=[...d.cells.values()].find(c=>/^VLOOKUP/.test(c.formula||''));
  assert.equal(wageCell.value,280000);
  assert.throws(()=>D.build(s,r),/검토 항목/);
});
