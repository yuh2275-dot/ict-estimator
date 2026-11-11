const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const E=require('../src/engine.js');
// All numerical values in these fixtures are fictitious regression data.
const fixture=()=>({project:{year:2026,date:'2026-01-01'},rounding:'floor',materials:[{price:100.25,quantity:3}],quantities:[{standardId:'test',length:20,count:2,reviewed:true,adjustment:'base'}],standards:[{id:'test',verified:true,year:2026,baseQuantity:10,labor:[{trade:'TEST',base:0.5}],adjustments:[{id:'base',factor:1},{id:'extra',factor:1.2}]}],wages:[{trade:'TEST',price:200,from:'2026-01-01',to:'2026-12-31',source:'TEST ONLY'}],rates:[],ratesReviewed:true});
test('base units, material totals and man-days',()=>{const r=E.calculate(fixture());assert.equal(r.material,300);assert.equal(r.directLabor,400);assert.equal(r.labor[0].details[0].manDays,2);});
test('quantity and wage updates',()=>{const s=fixture();s.quantities[0].length=40;s.wages[0].price=300;assert.equal(E.calculate(s).directLabor,1200);});
test('supported adjustment and invalid compound adjustment',()=>{const s=fixture();s.quantities[0].adjustment='extra';assert.equal(E.calculate(s).directLabor,480);s.quantities[0].adjustment='extra+extra';assert.equal(E.calculate(s).errors.length,1);});
test('unverified standard blocked',()=>{const s=fixture();s.standards[0].verified=false;assert.equal(E.calculate(s).errors.length,1);});
test('missing and overlapping wage periods blocked',()=>{const s=fixture();s.wages[0].to='2025-01-01';assert.equal(E.calculate(s).errors.length,1);s.wages.push(...fixture().wages,...fixture().wages);assert.equal(E.calculate(s).errors.length,1);});
test('item-specific bases and tax',()=>{const s=fixture();s.rates=[{id:'overhead',name:'TEST',enabled:true,reviewed:true,source:'TEST',from:'2026-01-01',to:'2026-12-31',bases:['directLabor'],rate:20},{id:'vat',name:'TEST VAT',enabled:true,reviewed:true,source:'TEST',from:'2026-01-01',to:'2026-12-31',bases:['material','directLabor','overhead'],rate:10}];const r=E.calculate(s);assert.equal(r.costs[0].amount,80);assert.equal(r.costs[1].amount,78);assert.equal(r.total,858);});
test('rounding and bad numeric input',()=>{assert.equal(E.round(1.7),1);assert.equal(E.round(1.7,'round'),2);assert.throws(()=>E.number(-1));assert.throws(()=>E.number(Infinity));});
test('linked material and direct expenses are included in the cost and rate bases',()=>{
 const state=fixture();
 Object.assign(state.quantities[0],{id:'line',materialPrice:10});
 state.expenses=[{kind:'machine',hours:2.5,unitPrice:400},{kind:'other',amount:150}];
 state.rates=[{id:'expenseRate',name:'TEST',enabled:true,reviewed:true,source:'TEST',from:'2026-01-01',to:'2026-12-31',bases:['expense'],rate:10}];
 const result=E.calculate(state);
 assert.deepEqual(result.errors,[]);
 assert.deepEqual(result.materials.map(row=>row.amount),[300,400]);
 assert.equal(result.materials[1].quantityId,'line');
 assert.deepEqual(result.expenseRows.map(row=>row.amount),[1000,150]);
 assert.equal(result.costs[0].amount,115);
 assert.equal(result.total,2365);
});
test('security source scan',()=>{for(const file of ['app.js','engine.js','standards.js','xlsx.js','catalog-ui.js','estimate-ui.js','basis-ui.js','rate-sheet.js','surcharges.js']){const text=fs.readFileSync(require('node:path').join(__dirname,'../src',file),'utf8');assert.doesNotMatch(text,/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|indexedDB|console\.log|document\.cookie/);}});
