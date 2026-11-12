const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../src/catalog-data.js');
require('../src/standards.js');
const V=require('../src/standards-verified.js');
const E=require('../src/engine.js');
const R=require('../src/material-recipes.js');
const D=require('../src/design-xlsx.js');
// 합성 데이터: 수량·단가는 시험용 값
const std=id=>structuredClone(globalThis.initialStandards.find(s=>s.id===id));
const cord=V.find(s=>s.code==='4-3-3'&&/Cord/.test(s.spec)),pvc16=V.find(s=>s.spec==='합성수지 전선관 호칭 16');
const state=(standard,row)=>({project:{year:2026,date:'2026-06-01',name:'시험'},rounding:'floor',materials:[],expenses:[],rates:[],ratesReviewed:true,standards:[standard],
  quantities:[{id:'q',standardId:standard.id,length:1,count:1,adjustment:'base',reviewed:true,...row}],
  wages:['통신케이블공','보통인부','통신내선공'].map(trade=>({trade,price:100000,from:'2026-01-01',to:'2026-12-31',source:'TEST'}))});

test('extra materials follow the work quantity: 100 hand-made patch cords = 300m cable + 200 connectors',()=>{
  const s=state(cord,{length:100,extraMaterials:[{name:'UTP 케이블',spec:'4P',unit:'m',perUnit:3,lossPercent:0,price:1000},{name:'랜 커넥터',spec:'RJ45',unit:'개',perUnit:2,price:500}]});
  const r=E.calculate(s);assert.deepEqual(r.errors,[]);
  assert.deepEqual(r.materials.map(m=>[m.name,m.quantity,m.amount,m.role]),[['UTP 케이블',300,300000,'extra'],['랜 커넥터',200,100000,'extra']]);
  assert.equal(r.material,400000);
});
test('fitting ratio of 3-1-2 is a share of the main pipe amount; loss percent raises the quantity',()=>{
  const s=state(pvc16,{length:100,materialName:'합성수지 전선관',materialSpec:'16㎜',materialPrice:500,
    extraMaterials:[{name:'부속품',unit:'식',ratioPercent:20},{name:'새들',spec:'16㎜',unit:'개',perUnit:.5,lossPercent:10,price:100}]});
  const r=E.calculate(s);assert.deepEqual(r.errors,[]);
  const [main,ratio,saddle]=r.materials;
  assert.equal(main.amount,50000);assert.equal(ratio.amount,10000);assert.equal(ratio.quantity,1);
  assert.ok(Math.abs(saddle.quantity-55)<1e-9);assert.equal(saddle.amount,5500);
  assert.equal(r.material,65500);
});
test('missing prices are reported and demolition rows refuse materials',()=>{
  const r=E.calculate(state(cord,{length:10,extraMaterials:[{name:'패치코드',spec:'3m',unit:'개',perUnit:1,price:null}]}));
  assert.match(r.errors.join(),/자재 "패치코드 3m" 단가 입력 필요/);assert.equal(r.material,0);
  const ratioOnly=E.calculate(state(pvc16,{length:10,extraMaterials:[{name:'부속품',unit:'식',ratioPercent:20}]}));
  assert.match(ratioOnly.errors.join(),/부속품률을 적용할 주자재 단가가 없습니다/);
  const rack=std('rack');
  const demo=E.calculate(state(rack,{commentary:{work:'remove_unused'},extraMaterials:[{name:'볼트',unit:'개',perUnit:4,price:10}]}));
  assert.match(demo.errors.join(),/철거 행에는 자재 구성/);
});
test('the workbook keeps material quantities and the fitting ratio as formulas',()=>{
  const s=state(pvc16,{length:100,materialName:'합성수지 전선관',materialSpec:'16㎜',materialPrice:500,
    extraMaterials:[{name:'부속품',unit:'식',ratioPercent:20},{name:'새들',spec:'16㎜',unit:'개',perUnit:.5,lossPercent:10,price:100}]});
  const r=E.calculate(s),sheets=D.build(s,r).sheets,cell=(n,ref)=>sheets.find(x=>x.name===n).cells.get(ref);
  assert.equal(cell('설계내역서','C8').formula,'물량산출근거!C4');
  assert.equal(cell('설계내역서','A9').value,'부속품');assert.equal(cell('설계내역서','C9').value,1);assert.equal(cell('설계내역서','C9').formula,undefined);
  assert.equal(cell('자재단가산출기초','D5').formula,'ROUNDDOWN(설계내역서!F8*20%,0)');assert.equal(cell('자재단가산출기초','D5').value,10000);
  assert.equal(cell('설계내역서','C10').formula,'물량산출근거!C4*0.55');assert.equal(cell('설계내역서','F10').value,5500);
  assert.match(cell('설계내역서','J10').value,/1m당 0\.5개/);
});
test('recipes suggest sets per standard and reuse prices from the same project',()=>{
  assert.deepEqual(R.forStandard(cord).map(x=>x.id),['cord-made','cord-diy']);
  const diy=R.forStandard(cord)[1];assert.deepEqual(diy.extras.map(e=>[e.name,e.perUnit]),[['UTP 케이블',3],['랜 커넥터',2],['보호캡',2]]);
  assert.deepEqual(R.forStandard(pvc16).map(x=>x.id),['pipe','cd']);
  assert.deepEqual(R.forStandard(V.find(s=>s.spec==='후강 전선관 호칭 22')).map(x=>x.id),['pipe']);
  assert.equal(R.forStandard(V.find(s=>s.spec==='나사 없는 전선관 호칭 19'))[0].extras.length,0);
  const outlet=R.apply({commentary:{ports:6}},R.forStandard(std('outlet'))[0]);
  assert.deepEqual(outlet.extraMaterials.map(e=>[e.name,e.perUnit,e.perPorts||false]),[['모듈러 잭',6,true],['아울렛 플레이트',1,false]]);
  const s=state(cord,{extraMaterials:[{name:'랜 커넥터',spec:'RJ45 8P8C',unit:'개',perUnit:2,price:600,source:'견적'}]});
  const book=R.priceBook(s);
  const plug=R.apply({materialName:'기존 주자재'},R.forStandard(std('rj45'))[0],{book});
  assert.equal(plug.materialName,'기존 주자재');                               // 주자재는 덮어쓰지 않음
  assert.equal(plug.extraMaterials[0].price,600);assert.equal(plug.extraMaterials[0].source,'견적'); // 같은 품명·규격 단가 재사용
  assert.equal(plug.extraMaterials[1].price,null);
});
