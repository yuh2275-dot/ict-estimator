const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../src/engine.js');
const S=require('../src/surcharges.js');
require('../src/xlsx.js');
// Synthetic quantities and wages; surcharge percentages are source rules.
const fixture=()=>({project:{year:2026,date:'2026-06-01',name:'회귀 검증'},rounding:'floor',materials:[],expenses:[],quantities:[{id:'q',standardId:'s',length:10,count:1,reviewed:true,adjustment:'base',materialPrice:100}],standards:[{id:'s',verified:true,year:2026,code:'TEST',name:'TEST',unit:'m',baseQuantity:10,labor:[{trade:'TEST',base:1}],adjustments:[{id:'base',name:'기본',factor:1,basis:'TEST'},{id:'tray',name:'TEST',factor:1.2,basis:'TEST'}]}],wages:[{trade:'TEST',price:100000,from:'2026-01-01',to:'2026-12-31',source:'TEST ONLY'}],rates:[],ratesReviewed:true});
function selection(state,items){state.quantities[0].surcharges=items;return E.calculate(state);}
function utpFixture(){const s=fixture();s.standards[0].code='4-3-1';s.standards[0].labor[0].base=.15;Object.assign(s.quantities[0],{length:400,parallelRuns:4,parallelQuantityMode:'total'});return s;}
test('UTP four runs use one-route 340 percent, not 340 percent of all cable lengths',()=>{
  const s=utpFixture(),r=E.calculate(s);
  assert.deepEqual(r.errors,[]);assert.equal(r.labor[0].quantity,400);assert.equal(r.labor[0].routeLength,100);
  assert.equal(r.directLabor,510000);assert.equal(r.material,40000);assert.equal(r.labor[0].adjustment.parallel.bundleFactor,3.4);assert.equal(r.labor[0].adjustment.factor,.85);
  s.quantities[0].length=100;s.quantities[0].parallelQuantityMode='route';
  const route=E.calculate(s);assert.equal(route.directLabor,r.directLabor);assert.equal(route.material,r.material);assert.equal(route.total,r.total);
});
test('UTP simultaneous rules and material allowances combine without multiplying material twice',()=>{
  const s=utpFixture();s.quantities[0].adjustment='tray';s.quantities[0].surcharges=[{id:'night'},{id:'material_0',value:7.5,note:'TEST'}];
  const r=E.calculate(s);assert.deepEqual(r.errors,[]);assert.equal(r.directLabor,1147500);assert.equal(r.material,43000);assert.equal(r.materials[0].quantity,430);
});
test('UTP count boundaries and unsupported standards reject invalid simultaneous entries',()=>{
  const s=utpFixture();
  for(const [runs,bundle] of [[1,1],[2,1.8],[3,2.6],[4,3.4],[5,4.2],[8,6.6]])assert.equal(S.parallel(s.standards[0],{parallelRuns:runs}).bundleFactor,bundle);
  for(const runs of [0,1.5,-2,'',null])assert.throws(()=>S.parallel(s.standards[0],{parallelRuns:runs}));
  assert.throws(()=>S.parallel({...s.standards[0],code:'4-3-2'},s.quantities[0]));
  assert.throws(()=>S.parallel({...s.standards[0],year:2027},s.quantities[0]));
  assert.equal(S.parallel(s.standards[0],{}).perCableFactor,1);
  const restored=JSON.parse(JSON.stringify(s));assert.equal(E.calculate(restored).total,550000);
});
test('UTP Excel carries total cable length, route length and simultaneous factor',()=>{
  const D=require('../src/design-xlsx.js');
  const s=utpFixture();s.quantities[0].length=100;s.quantities[0].parallelQuantityMode='route';
  const r=E.calculate(s),sheets=D.build(s,r).sheets,cell=(n,ref)=>sheets.find(x=>x.name===n).cells.get(ref);
  assert.equal(cell('물량산출근거','C4').value,400);assert.match(cell('물량산출근거','F4').value,/4열 동시포설 · 1열 경로 100m/);
  assert.equal(cell('일위대가표','C6').formula,'물량산출근거!C4');
  // 4열 동시포설: 총길이 기준 계수 0.85가 품셈에 반영
  const k=sheets.find(x=>x.name==='일위대가표');const perUnit=[...k.cells.entries()].find(([ref,c])=>/^[A-Z]+6$/.test(ref)&&/^0\.15\*0\.85$/.test(c.formula||''));
  assert.ok(perUnit);assert.match(cell('일위대가표',[...k.cells.keys()].filter(x=>/6$/.test(x)).pop()).value,/해설 ⑧/);
});
test('all fourteen common sections plus wage and material are reachable with unique option IDs',()=>{
  for(let n=1;n<=14;n++)assert.ok(S.groups.some(g=>g.code===`1-2-2-${n}`));
  assert.ok(S.groups.some(g=>g.code==='1-2-1'));assert.ok(S.groups.some(g=>g.code==='1-1-6'));
  assert.equal(new Set(S.items.map(i=>i.id)).size,S.items.length);
});
test('common labor surcharges add, and night wage premium multiplies without changing man-days',()=>{
  const s=fixture();s.quantities[0].adjustment='tray';
  const r=selection(s,[{id:'height_no',value:3},{id:'night'}]);
  assert.deepEqual(r.errors,[]);
  assert.equal(r.labor[0].details[0].manDays,1.62);
  assert.equal(r.labor[0].details[0].appliedWage,150000);
  assert.equal(r.directLabor,243000);assert.equal(r.material,1000);
  const night=selection(fixture(),[{id:'night'}]);assert.equal(night.directLabor,187500);
});
test('blank surcharge lists preserve old projects and optional entry',()=>{
  const s=fixture();assert.equal(E.calculate(s).directLabor,100000);
  assert.equal(selection(s,[]).directLabor,100000);
});
test('source exclusions and duplicate selections reject undercount or double count',()=>{
  for(const items of [[{id:'night'},{id:'night_wage',value:50,note:'TEST'}],[{id:'tunnel_0'},{id:'tunnel_ladder'},{id:'height_vehicle',value:8}],[{id:'catenary_0_0'},{id:'train_0'}],[{id:'terrain_1'},{id:'terrain_2'}],[{id:'tunnel_ladder'}]]){
    const r=selection(fixture(),items);assert.equal(r.labor.length,0);assert.equal(r.errors.length,1);
  }
});
test('source thresholds for heights, floors and travel times',()=>{
  for(const [id,value,rate] of [['height_no',1.19,0],['height_no',1.2,10],['height_no',5,20],['height_no',60,90],['height_scaffold',60,50],['height_vehicle',9.9,7],['height_vehicle',10,10],['floor_above',5,1],['floor_above',6,3],['floor_above',31,8],['floor_below',6,2.2],['remote',1,0],['remote',3,100/3],['remote',5,50]])assert.ok(Math.abs(S.resolve({id,value}).rate-rate)<1e-10,`${id}:${value}`);
  assert.throws(()=>S.resolve({id:'floor_above',value:1.5}));
  assert.throws(()=>S.resolve({id:'height_no',value:''}));
});
test('ceiling bounds, manual bases and missing values are enforced',()=>{
  assert.equal(S.resolve({id:'security',value:15,note:'TEST'}).rate,15);
  for(const input of [{id:'security',value:16,note:'TEST'},{id:'special',value:4,note:'TEST'},{id:'security',value:10},{id:'security',value:null}])assert.throws(()=>S.resolve(input));
  assert.equal(S.resolve({id:'catenary_0_0'}).rate,45);
  assert.equal(S.resolve({id:'catenary_10_3'}).rate,130);
  assert.equal(S.resolve({id:'enclosed_0'}).rate,40);
});
test('material allowance increases only material purchase quantity',()=>{
  const r=selection(fixture(),[{id:'material_0',value:7.5,note:'TEST'}]);
  assert.deepEqual(r.errors,[]);assert.equal(r.material,1075);assert.equal(r.materials[0].quantity,10.75);
  assert.equal(r.directLabor,100000);assert.equal(r.labor[0].quantity,10);
});
test('custom chapter factor needs source and combines with common labor',()=>{
  const s=fixture();Object.assign(s.quantities[0],{adjustment:'custom',standardFactor:.8,standardFactorBasis:'TEST 해설'});
  assert.equal(selection(s,[{id:'enclosed_0'}]).directLabor,112000);
  delete s.quantities[0].standardFactorBasis;assert.equal(E.calculate(s).errors.length,1);
});
test('fixed rates, additive basic amount, dependent totals and blank exclusions',()=>{
  const s=fixture(),p={from:'2026-01-01',to:'2026-12-31',source:'TEST',enabled:true,reviewed:true};
  s.rates=[{...p,id:'safety',name:'TEST',method:'percent',rate:2,bases:['directLabor','material'],addition:1000},{...p,id:'fee',name:'TEST',method:'fixed',fixedAmount:500,bases:[],rate:null},{...p,id:'exclude',name:'TEST',enabled:false,bases:[],rate:null},{...p,id:'general',name:'TEST',rate:10,bases:['directLabor','material','safety','fee','exclude']}];
  const r=E.calculate(s);assert.deepEqual(r.errors,[]);assert.deepEqual(r.costs.map(c=>c.amount),[3020,500,0,10452]);assert.equal(r.total,114972);
  s.rates[0].rate=null;assert.match(E.calculate(s).errors.join(),/요율/);
  s.rates[0].rate=0;s.rates[1].fixedAmount=null;assert.match(E.calculate(s).errors.join(),/직접 산정금액/);
});
test('Excel folds the wage premium into man-days so trade totals match the calculation',()=>{
  const D=require('../src/design-xlsx.js');
  const s=fixture(),r=selection(s,[{id:'night'},{id:'height_no',value:3}]);
  const sheets=D.build(s,r).sheets,cell=(n,ref)=>sheets.find(x=>x.name===n).cells.get(ref);
  const u=sheets.find(x=>x.name==='일위대가표');
  const per=[...u.cells.entries()].find(([ref,c])=>/^[A-Z]+6$/.test(ref)&&c.formula==='1*'+String(Number((1.35*1.5).toPrecision(12))));
  assert.ok(per,'품셈 = 기본품 × 품 계수 1.35 × 노임 계수 1.5');
  const design=sheets.find(x=>x.name==='설계내역서');
  const labor=[...design.cells.entries()].find(([,c])=>c.formula&&/^ROUNDDOWN\(C\d+\*G\d+,0\)$/.test(c.formula));
  assert.equal(labor[1].value,r.directLabor);assert.equal(r.directLabor,202500);assert.equal(r.total,203500);
  assert.equal(cell('원가계산서','D5').value,r.material);
  assert.rejects(ExcelIO.write({},s,r),/행별 노임 할증/);
});
