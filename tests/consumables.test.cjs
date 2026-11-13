const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../src/engine.js'),C=require('../src/consumables.js'),D=require('../src/design-xlsx.js');
require('../src/standards.js');
const state=()=>({project:{year:2026,date:'2026-06-01',name:'SYNTHETIC'},standards:structuredClone(globalThis.initialStandards),
  quantities:[{id:'q',standardId:'utp4',length:100,count:1,adjustment:'base',reviewed:true,materialPrice:1000,consumableBase:true,
    extraMaterials:[{name:'관 부속품',ratioPercent:20},{name:'추가 케이블',unit:'m',perUnit:2,price:10,consumableBase:true}]}],
  materials:[{name:'시험 배관',unit:'m',quantity:10,price:500,consumableBase:true},{name:'시험 장비',unit:'대',quantity:1,price:1000000}],
  wages:[{trade:'통신케이블공',price:100000,from:'2026-01-01',to:'2026-12-31',source:'TEST'}],expenses:[],rates:[],ratesReviewed:true,rounding:'floor',
  consumables:{enabled:true,rate:3,source:'합성 소액 소모품',reviewed:true}});
test('1-1-12 uses only explicitly selected material amounts and excludes fitting ratios',()=>{
  const s=state(),r=E.calculate(s);assert.deepEqual(r.errors,[]);
  assert.equal(r.consumables.base,107000);assert.equal(r.consumables.amount,3210);
  assert.equal(r.material,1130210);assert.equal(r.materials.length,5);
  s.quantities[0].extraMaterials[0].consumableBase=true;
  assert.equal(E.calculate(s).consumables.base,107000);
});
test('the option is off for old JSON; toggling it off preserves selections without adding cost',()=>{
  const s=state();delete s.consumables;
  assert.equal(E.calculate(s).consumables.amount,0);
  s.consumables={enabled:false,rate:3};assert.equal(E.calculate(s).material,1127000);
  const copy=JSON.parse(JSON.stringify(state()));assert.equal(E.calculate(copy).material,E.calculate(state()).material);
});
test('loss and changed quantities affect the selected base, downstream rates and total',()=>{
  const s=state();s.quantities[0].surcharges=[{id:'material_indoor_cable',value:7.5}];
  // Explicit source id from the source list, avoiding assumptions about UI ids.
  const S=require('../src/surcharges.js');const item=S.items.find(i=>i.target==='material'&&i.max===7.5);
  s.quantities[0].surcharges=[{id:item.id,value:7.5,note:'TEST'}];
  s.rates=[{id:'vat',name:'부가가치세',enabled:true,reviewed:true,source:'TEST',from:'2026-01-01',to:'2026-12-31',rate:10,bases:['material']}];
  const r=E.calculate(s);assert.deepEqual(r.errors,[]);assert.equal(r.consumables.base,114500);assert.equal(r.consumables.amount,3435);
  assert.equal(r.costs[0].base,r.material);assert.equal(r.costs[0].amount,Math.floor(r.material*.1));
  s.quantities[0].length=200;assert.equal(E.calculate(s).consumables.base,224000);
});
test('missing selections, review and reason block export; rates stay in the source range',()=>{
  for(const rate of [0,1.99,5.01,null,'',NaN]){const s=state();s.consumables.rate=rate;assert.match(E.calculate(s).errors.join(),/2~5%/);assert.throws(()=>C.validate(s.consumables));}
  for(const rate of [2,2.5,5]){const s=state();s.consumables.rate=rate;assert.deepEqual(E.calculate(s).errors,[]);}
  const s=state();s.consumables.reviewed=false;s.consumables.source='';s.quantities[0].consumableBase=false;s.quantities[0].extraMaterials[1].consumableBase=false;s.materials[0].consumableBase=false;
  const r=E.calculate(s);assert.match(r.errors.join(),/선택하세요/);assert.match(r.errors.join(),/중복/);assert.match(r.errors.join(),/사유/);assert.throws(()=>D.build(s,r));
  s.project.year=2027;assert.match(E.calculate(s).errors.join(),/2026년 기준/);
});
test('workbook links selected amounts and the editable rate, with no self-reference',()=>{
  const s=state(),r=E.calculate(s),b=D.build(s,r);const ds=b.sheets.find(x=>x.name==='설계내역서'),ms=b.sheets.find(x=>x.name==='자재단가산출기초');
  const row=+[...ds.cells].find(([k,c])=>/^A\d+$/.test(k)&&c.value==='잡재료 및 소모재료')[0].slice(1);
  const rateRow=+[...ms.cells].find(([k,c])=>/^A\d+$/.test(k)&&c.value==='잡재료 및 소모재료')[0].slice(1);
  assert.equal(ms.cells.get('D'+rateRow).value,3);
  assert.equal(ds.cells.get('E'+row).formula,`ROUNDDOWN(SUM(F8,F10,F11)*자재단가산출기초!D${rateRow}/100,0)`);
  assert.equal(ds.cells.get('F'+row).value,3210);assert.equal(ds.cells.get('F'+(row+1)).value,r.material);
  assert.equal(ds.cells.get('F'+(row+1)).formula,`SUM(F8:F${row})`);
});
test('selection stays on the material after an earlier material is removed, and UI escapes input',()=>{
  const s=state();s.materials.unshift({name:'remove',price:10,quantity:1});s.materials.splice(0,1);
  let r=E.calculate(s);assert.equal(C.rows(s,r)[0].source,s.materials[0]);assert.equal(C.rows(s,r)[0].source.consumableBase,true);
  s.consumables.source='<script>BAD</script>';s.materials[0].name='<img src=x>';
  const html=C.render(s,E.calculate(s));assert.doesNotMatch(html,/<script>|<img src=x>/);assert.match(html,/&lt;script&gt;/);
});
test('invalid extra materials do not leave a partial main-material charge',()=>{
  const s=state();s.quantities[0].extraMaterials[1].perUnit=-1;
  const r=E.calculate(s);assert.match(r.errors.join(),/숫자/);assert.equal(r.materials.some(m=>m.quantityId==='q'),false);assert.equal(r.directLabor,0);assert.equal(r.consumables.base,5000);
});
test('standalone material workbooks have zero labor sums rather than circular formulas',()=>{
  const s=state();s.quantities=[];s.wages=[];const r=E.calculate(s);assert.deepEqual(r.errors,[]);
  const b=D.build(s,r),us=b.sheets.find(x=>x.name==='일위대가표'),ds=b.sheets.find(x=>x.name==='설계내역서');
  assert.equal(us.cells.get('F6').formula,'0');
  const laborTotals=[...ds.cells].filter(([ref,c])=>/^H\d+$/.test(ref)&&c.formula==='0');assert.equal(laborTotals.length,1);
});
test('legacy template export explains where to export consumable formulas',async()=>{
  require('../src/xlsx.js');const X=globalThis.ExcelIO,s=state();
  await assert.rejects(()=>X.write({},s,E.calculate(s)),/공사원가계산.*Excel 저장/);
});
test('consumable UI persists material selection and requires renewed review when the rate changes',()=>{
  const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');let handler;
  const ctx={Estimator:E,document:{addEventListener:(name,fn)=>{if(name==='change')handler=fn;}}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/consumables.js'),'utf8'),ctx);
  let s=state(),refreshes=0;ctx.Consumables.connect({getState:()=>s,refresh:()=>refreshes++,message:m=>assert.fail(m),update:fn=>{const next=structuredClone(s);fn(next);C.validate(next.consumables);s=next;}});
  handler({target:{dataset:{consumableRow:'0'},type:'checkbox',checked:false}});
  assert.equal(s.materials[0].consumableBase,false);assert.equal(s.consumables.reviewed,false);
  handler({target:{dataset:{consumables:'reviewed'},type:'checkbox',checked:true}});
  handler({target:{dataset:{consumables:'rate'},type:'number',value:'5'}});
  assert.equal(s.consumables.rate,5);assert.equal(s.consumables.reviewed,false);assert.equal(refreshes,3);
});
test('material editor includes main-material loss and project rounding in the fitting amount',()=>{
  const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),S=require('../src/surcharges.js');
  const s=state();s.quantities[0].materialPrice=1000.0055;s.rounding='round';
  const item=S.items.find(i=>i.target==='material'&&i.max===7.5);s.quantities[0].surcharges=[{id:item.id,value:7.5,note:'TEST'}];
  const listeners={},ctx={structuredClone,Estimator:E,Surcharges:S,Consumables:C,standardCatalog:{drafts:[]},document:{addEventListener:(k,f)=>(listeners[k]??=[]).push(f),querySelector:()=>({scrollIntoView(){}})}};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/estimate-ui.js'),'utf8'),ctx);
  ctx.EstimateUI.connect({getState:()=>s,refresh(){},openEstimate(){}});
  listeners.click.forEach(fn=>fn({target:{closest:()=>({dataset:{estimateEditLine:'0'}})}}));
  const html=ctx.EstimateUI.render(s,E.calculate(s));
  assert.match(html,/재료 할증계수 1\.075 = 107\.5/);assert.match(html,/107,501원/);assert.match(html,/21,500/);
});
