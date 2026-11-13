const {test}=require('node:test'),assert=require('node:assert/strict');
const B=require('../src/basis-import.js'),E=require('../src/engine.js');require('../src/standards.js');
const state=()=>({version:1,project:{date:'2026-10-01',year:2026},standards:structuredClone(globalThis.initialStandards),wages:[],rates:[],materials:[],quantities:[],expenses:[],history:[],rounding:'floor',ratesReviewed:true});
const wage=(extra={})=>({trade:'통신케이블공',price:'123,456',unit:'원/일',...extra});
const data=(extra={})=>({format:B.FORMAT,version:1,source:'SYNTHETIC TABLE page 1',from:'2026-09-01',to:'2026-12-31',wages:[wage()],rates:[],materials:[],...extra});
const preview=(s,d,options)=>({...B.prepare(s,d,options),confirmed:true});
test('basis JSON accepts fenced/explanatory answers but rejects other formats and malformed lists',()=>{
  const d=data();assert.deepEqual(B.parse('설명\n```json\n'+JSON.stringify(d)+'\n```'),d);
  assert.deepEqual(B.parse('설명 '+JSON.stringify(d)+' 끝'),d);
  for(const value of ['',JSON.stringify({...d,format:'ict-estimator-takeoff'}),JSON.stringify({...d,version:2}),JSON.stringify({...d,wages:{}}),JSON.stringify({...d,wages:[]}),JSON.stringify({...d,wages:Array(2001).fill(wage())})])assert.throws(()=>B.parse(value));
});
test('daily wages normalize whitespace-only trade differences and preserve historical periods',()=>{
  const s=state();s.wages=[{trade:'통신케이블공',price:100000,from:'2026-01-01',to:'2026-08-31',source:'TEST old'}];
  const p=preview(s,data({wages:[wage({trade:' 통신 케이블 공 '})]}));assert.deepEqual(p.rows[0].errors,[]);
  const out=B.apply(s,p);assert.equal(out.next.wages.length,2);assert.equal(out.next.wages[1].trade,'통신케이블공');assert.equal(out.next.wages[1].price,123456);assert.equal(s.wages.length,1);
});
test('exact-period wage update is shown in preview; partially overlapping periods are blocked',()=>{
  const s=state();s.wages=[{trade:'통신케이블공',price:100000,from:'2026-09-01',to:'2026-12-31',source:'TEST'}];
  const p=preview(s,data());assert.equal(p.rows[0].before,100000);assert.equal(p.rows[0].action,'단가 갱신');
  assert.equal(B.apply(s,p).next.wages.length,1);
  const bad=preview(s,data({from:'2026-01-01'}));assert.match(bad.rows[0].errors.join(),/일부 겹칩니다/);bad.rows[0].selected=true;assert.throws(()=>B.apply(s,bad));assert.equal(s.wages[0].price,100000);
});
test('missing dates/source must be supplemented; shared defaults do not replace printed values',()=>{
  const s=state(),d=data({from:null,to:null,source:null});const p=preview(s,d);assert.match(p.rows[0].errors.join(),/출처/);
  const filled=preview(s,d,{from:'2026-09-01',to:'2026-12-31',source:'TEST supplement'});assert.deepEqual(filled.rows[0].errors,[]);
  const original=preview(s,data(),{from:'2000-01-01',to:'2000-12-31',source:'OTHER'});assert.equal(original.rows[0].row.from,'2026-09-01');assert.match(original.rows[0].row.source,/SYNTHETIC/);
  for(const from of ['2026-02-30','2026-13-01','2026-1-01'])assert.match(preview(s,data({from})).rows[0].errors.join(),/날짜/);
});
test('hourly/monthly pay, percentages as money and unreadable prices are not silently converted',()=>{
  for(const item of [wage({unit:'원/시간'}),wage({unit:'원/월'}),wage({price:null}),wage({price:''}),wage({price:true}),wage({price:'3%'}),wage({price:'12,34'})])assert.ok(preview(state(),data({wages:[item]})).rows[0].errors.length);
  assert.equal(preview(state(),data({wages:[wage({price:0})]})).rows[0].row.price,0);
});
test('low confidence and unknown trades start unselected; duplicate candidates require one selection',()=>{
  const s=state();assert.equal(preview(s,data({wages:[wage({confidence:'low'})]})).rows[0].selected,false);
  assert.equal(preview(s,data({wages:[wage({trade:'미등록 직종'})]})).rows[0].selected,false);
  const p=preview(s,data({wages:[wage(),wage({price:222222})]}));assert.ok(p.rows.every(r=>!r.selected));
  p.rows.forEach(r=>r.selected=true);assert.throws(()=>B.apply(s,p),/한 행/);p.rows[0].selected=false;assert.equal(B.apply(s,p).next.wages[0].price,222222);
});
test('selected imported wage periods are validated together and updates are atomic',()=>{
  const s=state(),p=preview(s,data({wages:[wage({from:'2026-01-01',to:'2026-10-31'}),wage()]}));
  assert.throws(()=>B.apply(s,p),/서로 겹칩니다/);assert.equal(s.wages.length,0);
  const valid=preview(s,data());s.wages.push({trade:'통신케이블공',price:1,from:'2026-01-01',to:'2026-12-31',source:'new'});
  assert.throws(()=>B.apply(s,valid),/일부 겹칩니다/);assert.equal(s.wages[0].price,1);
});
test('rates are imported pending even when JSON claims they are approved, and dependencies are ordered',()=>{
  const s=state(),d=data({wages:[],rates:[{id:'care',name:'요양',rate:'12.95%',bases:['health'],reviewed:true,enabled:true},{id:'health',name:'건강',rate:3.5,bases:['directLabor']}]});
  const out=B.apply(s,preview(s,d));assert.deepEqual(out.next.rates.map(r=>r.id),['health','care']);
  assert.equal(out.next.rates[1].rate,12.95);assert.ok(out.next.rates.every(r=>!r.reviewed&&!r.enabled));assert.equal(out.next.ratesReviewed,false);
});
test('rate updates preserve existing ids and template metadata when names match',()=>{
  const s=state();s.rates=[{id:'sheet_indirect',name:'간접노무비',templateKey:'indirect',category:'노무비',rate:5,method:'percent',bases:['directLabor']}];
  const d=data({wages:[],rates:[{id:'indirect',name:'간접 노무비',rate:7,bases:['직접노무비']}]});
  const out=B.apply(s,preview(s,d));assert.equal(out.next.rates.length,1);assert.equal(out.next.rates[0].id,'sheet_indirect');assert.equal(out.next.rates[0].templateKey,'indirect');assert.deepEqual(out.next.rates[0].bases,['directLabor']);
});
test('missing selected dependencies, cycles, reserved ids and unknown bases cannot corrupt rates',()=>{
  const s=state();const p=preview(s,data({wages:[],rates:[{id:'a',name:'A',rate:1,bases:['b']},{id:'b',name:'B',rate:2,bases:['material']}]}));
  p.rows[1].selected=false;assert.throws(()=>B.apply(s,p),/참조하는 항목/);
  const cycle=preview(s,data({wages:[],rates:[{id:'a',name:'A',rate:1,bases:['b']},{id:'b',name:'B',rate:2,bases:['a']}]}));assert.throws(()=>B.apply(s,cycle),/순환/);
  for(const r of [{id:'material',name:'X',rate:1,bases:[]},{id:'constructor',name:'X',rate:1,bases:[]},{name:'X',rate:1,bases:['does_not_exist']}])assert.ok(preview(s,data({wages:[],rates:[r]})).rows[0].errors.length);
  assert.equal(s.rates.length,0);
});
test('unreadable rates can be saved pending for manual completion without guessing their value',()=>{
  const s=state(),out=B.apply(s,preview(s,data({wages:[],rates:[{name:'확인할 비율',rate:null,bases:[],condition:'구간 확인 필요'}]})));
  assert.equal(out.next.rates[0].rate,null);assert.equal(out.next.rates[0].enabled,false);assert.equal(out.next.rates[0].condition,'구간 확인 필요');assert.ok(E.calculate(out.next).errors.length);
});
test('material prices update exact name/spec/unit matches without changing work quantities',()=>{
  const s=state();s.materials=[{name:'UTP 케이블',spec:'CAT.6',unit:'m',price:100,quantity:25}];
  s.quantities=[{id:'q',standardId:'utp4',materialName:'UTP 케이블',materialSpec:'CAT.6',materialPrice:200,length:100,count:1,adjustment:'base',extraMaterials:[{name:'UTP 케이블',spec:'CAT.6',unit:'m',price:300,perUnit:3}]}];
  const p=preview(s,data({wages:[],materials:[{name:'UTP 케이블',spec:'CAT.6',unit:'m',price:500,note:'부가세 별도'}]}));assert.match(p.rows[0].action,/3행/);
  const n=B.apply(s,p).next;assert.equal(n.materials[0].quantity,25);assert.equal(n.materials[0].price,500);assert.equal(n.quantities[0].length,100);assert.equal(n.quantities[0].materialPrice,500);assert.equal(n.quantities[0].extraMaterials[0].price,500);assert.equal(n.quantities[0].extraMaterials[0].perUnit,3);
  assert.equal(s.materials[0].price,100);
});
test('new or differently specified material prices use zero quantity, leaving the estimate amount unchanged',()=>{
  const s=state(),d=data({wages:[],materials:[{name:'시험자재',spec:'A',unit:'개',price:12345,quantity:99}]});
  const n=B.apply(s,preview(s,d)).next;assert.equal(n.materials[0].quantity,0);assert.equal(E.calculate(n).material,0);
  const d2=data({wages:[],materials:[{name:'시험자재',spec:'A',unit:'박스',price:22222}]});assert.equal(B.apply(n,preview(n,d2)).next.materials.length,2);
  assert.deepEqual(B.apply(n,preview(n,d)).next.materials.length,1);
});
test('applying requires explicit review and JSON/text strings cannot inject UI markup',()=>{
  const s=state(),p=B.prepare(s,data({source:'<img src=x>'}));assert.throws(()=>B.apply(s,p),/대조|확인/);
  const prompt=B.buildPrompt(s);assert.match(prompt,/ict-estimator-basis/);assert.match(prompt,/123456/);assert.match(prompt,/추정하거나/);assert.match(prompt,/직접노무비/);
});
test('file opening, preview selection and apply work through UI events with escaped text',async()=>{
  const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),handlers={},elements={};let s=state(),message='';
  const ctx={structuredClone,console,document:{addEventListener:(k,fn)=>(handlers[k]??=[]).push(fn),querySelector:id=>elements[id]??={textContent:''}}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/basis-import.js'),'utf8'),ctx);
  ctx.BasisImport.connect({getState:()=>s,refresh(){},message:v=>message=v,replace:n=>s=n});
  const d=data({source:'<script>TEST</script>'});
  await Promise.all(handlers.change.map(fn=>fn({target:{id:'basis-import-file',files:[{size:100,text:async()=>JSON.stringify(d)}]}})));
  const html=ctx.BasisImport.render(s);assert.match(html,/&lt;script&gt;TEST/);assert.doesNotMatch(html,/<script>TEST/);
  await Promise.all(handlers.change.map(fn=>fn({target:{id:'basis-import-confirm',checked:true}})));
  await Promise.all(handlers.click.map(fn=>fn({target:{closest:()=>({id:'basis-import-apply'})}})));
  assert.equal(s.wages[0].price,123456);assert.match(message,/노임 1건/);assert.doesNotMatch(ctx.BasisImport.render(s),/기존 값 → 새 값/);
});
