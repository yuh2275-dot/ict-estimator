const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
require('../src/catalog-data.js');
const data=globalThis.standardCatalog;
const E=require('../src/engine.js');

test('complete source pages, thirteen chapters and unique numbered sections',()=>{
 assert.equal(data.pageCount,587);assert.equal(data.pages.length,587);
 assert.deepEqual(data.pages.map(p=>p.pdfPage),Array.from({length:587},(_,i)=>i+1));
 assert.deepEqual([...new Set(data.sections.map(s=>s.chapter))],Array.from({length:13},(_,i)=>i+1));
 assert.equal(new Set(data.sections.map(s=>s.code)).size,data.sections.length);
 for(const p of data.pages)assert.ok(fs.existsSync(path.join(__dirname,'../src/reference/page-'+String(p.pdfPage).padStart(3,'0')+'.webp')));
});
test('table and candidate source references remain valid',()=>{
 const tables=new Map(data.tables.map(t=>[t.id,t]));
 assert.equal(tables.size,726);assert.equal(data.sections.length,822);
 for(const s of data.sections){assert.ok(s.pdfPage>=1&&s.pdfPage<=587);for(const id of s.tableIds)assert.equal(tables.get(id).code,s.code);}
 for(const d of data.drafts){
  const t=tables.get(d.tableId);assert.equal(t.pdfPage,d.pdfPage);assert.equal(t.code,d.code);
  assert.ok(t.grid[d.rowIndex]);assert.ok(d.unitUnresolved?d.baseQuantity===null:d.baseQuantity>0);assert.ok(d.labor.length);
  assert.equal(d.verified,false);assert.equal(d.reviewStatus,'source-review-required');
  const sourceNumbers=t.grid[d.rowIndex].flatMap(v=>(v||'').match(/\d+(?:\.\d+)?/g)||[]).map(Number);
  for(const labor of d.labor)assert.ok(sourceNumbers.includes(labor.base));
 }
});
test('deleted items cannot produce automatic calculation candidates',()=>{
 const deleted=data.sections.filter(s=>s.deleted);assert.equal(deleted.length,26);
 assert.ok(deleted.every(s=>s.draftIds.length===0));
});
test('merged labels, multiline specifications and ditto units retain source meaning',()=>{
 const rows=data.drafts.filter(d=>d.code==='4-3-1');assert.equal(rows.length,11);
 const indoor=rows.filter(d=>d.spec.includes('구내'));
 assert.deepEqual(indoor.map(d=>d.labor[0].base),[0.15,0.24,0.35,0.5]);
 assert.ok(indoor.every(d=>d.baseQuantity===10&&d.unit==='m'));
 const outdoor=rows.find(d=>d.spec.includes('옥외'));assert.equal(outdoor.labor[0].base,0.05);
 const card=data.drafts.find(d=>d.spec==='L3스위치 / Card 설치');assert.equal(card.unit,'대');assert.deepEqual(card.labor.map(l=>l.base),[0.18,0.18]);
});
test('unreviewed extracted rows are rejected by the calculation engine',()=>{
 for(const d of data.drafts){
  const result=E.calculate({project:{year:2026,date:'2026-01-01'},materials:[],quantities:[{standardId:d.id,reviewed:true,length:1,count:1,adjustment:'base'}],standards:[d],wages:[],rates:[],ratesReviewed:true});
  assert.equal(result.errors.length,1);assert.equal(result.directLabor,0);
 }
});
test('catalog entry points support search, source review and registration with a required review check',()=>{
 const listeners={},messages=[],registered=[];
 const context={standardCatalog:data,Estimator:E,crypto:require('node:crypto').webcrypto,structuredClone,console,
 document:{addEventListener:(type,handler)=>(listeners[type]??=[]).push(handler),querySelector:()=>({scrollIntoView(){}})}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/catalog-ui.js'),'utf8'),context);
 const ui=context.CatalogUI;ui.connect({refresh(){},message:m=>messages.push(m),register:s=>registered.push(s)});
 const click=(dataset={},id='')=>listeners.click.forEach(fn=>fn({target:{closest:()=>({dataset,id})}}));
 click({catalogSection:'4-3-1'});
 assert.match(ui.render({standards:[]}),/page-120\.webp/);
 click({reviewDraft:'p120-t1-r2-l1'});click({},'catalog-commit');
 assert.equal(registered.length,0);assert.match(messages.at(-1),/원문 대조/);
 listeners.input.forEach(fn=>fn({target:{dataset:{editor:'conditions'},type:'text',value:' '}}));
 listeners.input.forEach(fn=>fn({target:{dataset:{},id:'catalog-review',checked:true}}));
 click({},'catalog-commit');assert.equal(registered.length,1);assert.equal(registered[0].reviewStatus,'user-reviewed');
 assert.equal(registered[0].conditions,'');
 assert.equal(registered[0].adjustments.find(a=>a.id==='base').factor,1);
 assert.equal(registered[0].sourceHash,data.sha256);
 click({catalogSection:data.sections.find(s=>s.deleted).code});
 assert.doesNotMatch(ui.render({standards:[]}),/id="catalog-new"/);
 listeners.input.forEach(fn=>fn({target:{dataset:{},id:'catalog-search',value:'중대재해'}}));
 assert.match(ui.render({standards:[]}),/전체 문서 본문 일치/);
});
function startApp(){
 const listeners={},elements=new Map();
 const element=selector=>{if(!elements.has(selector))elements.set(selector,{innerHTML:'',textContent:'',scrollIntoView(){}});return elements.get(selector);};
 const context={standardCatalog:data,structuredClone,Estimator:E,crypto:require('node:crypto').webcrypto,
 FormData:class {constructor(form){this.fields=form.fields;}get(name){return this.fields[name];}getAll(name){return this.fields[name]||[];}has(name){return Object.hasOwn(this.fields,name);}},
 document:{querySelector:element,addEventListener:(type,handler)=>(listeners[type]??=[]).push(handler)},window:{addEventListener(){}}};
 vm.createContext(context);
 for(const name of ['surcharges.js','rate-sheet.js','standards.js','catalog-ui.js','estimate-ui.js','basis-ui.js','design-xlsx.js','takeoff.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name),'utf8'),context);
 const click=(id='',dataset={})=>Promise.all(listeners.click.map(listener=>listener({target:{closest:()=>({id,dataset})}})));
 const submit=(type,fields)=>Promise.all(listeners.submit.map(listener=>listener({preventDefault(){},target:{dataset:{basisForm:type},fields}})));
 const submitForm=(id,fields)=>Promise.all(listeners.submit.map(listener=>listener({preventDefault(){},target:{id,dataset:{},fields}})));
 return {element,click,submit,submitForm};
}
test('dashboard opens first and cost estimation is the third navigation entry',()=>{
 const {element}=startApp();assert.equal(element('#title').textContent,'대시보드');
 assert.deepEqual([...element('#nav').innerHTML.matchAll(/data-nav="(\d+)"/g)].slice(0,3).map(m=>Number(m[1])),[0,1,11]);
});
test('reference rate table preserves entered values and supports manual amount and blank exclusion',async()=>{
 const {element,click,submit,submitForm}=startApp();await click('',{nav:'10'});
 await submit('rates',{name:'간접노무비',rate:'5',bases:['directLabor'],status:'include',source:'TEST',from:'2026-01-01',to:'2026-12-31'});
 await click('rate-sheet-template');element('#config-type').value='rates';await click('load-config');
 const rows=JSON.parse(element('#config').value);assert.equal(rows.length,17);assert.equal(rows[0].rate,5);
 assert.ok(rows.find(r=>r.templateKey==='care').bases.includes(rows.find(r=>r.templateKey==='health').id));
 const fields={};rows.forEach((r,i)=>Object.assign(fields,{['status_'+i]:'exclude',['method_'+i]:r.method||'percent',['rate_'+i]:'',['fixed_'+i]:'',['addition_'+i]:'',['bases_'+i]:r.bases,['source_'+i]:'TEST',['from_'+i]:'2026-01-01',['to_'+i]:'2026-12-31'}));
 const i=rows.findIndex(r=>r.templateKey==='safety');fields['status_'+i]='include';fields['method_'+i]='fixed';fields['fixed_'+i]='12345';
 await submitForm('rate-sheet-form',fields);await click('load-config');
 const saved=JSON.parse(element('#config').value);assert.equal(saved[i].fixedAmount,12345);assert.ok(saved.every(r=>r.reviewed));assert.equal(saved[0].rate,null);
 await click('',{nav:'7'});assert.match(element('#view').innerHTML,/12,345/);
});
test('main navigation renders the complete catalog through the app entry point',async()=>{
 const {element,click}=startApp();
 await click('',{nav:'2'});
 assert.equal(element('#title').textContent,'공종 및 품셈 검색');
 assert.match(element('#view').innerHTML,/목차 항목 822개/);
 assert.match(element('#view').innerHTML,/4032개/);
 assert.doesNotMatch(element('#view').innerHTML,/광케이블·광분배함·L2\/L3·전송장비·배관·장비 이설은 기준자료 미등록/);
});
test('settings apply the offered rate example and accept the earlier wrapped format',async()=>{
 const {element,click}=startApp();
 await click('',{nav:'10'});
 element('#config-type').value='rates';
 await click('load-config');
 assert.match(element('#config-status').textContent,/등록된 항목이 없습니다/);
 await click('config-example');
 const example=JSON.parse(element('#config').value);
 assert.equal(example[0].enabled,false);
 await click('apply-config');
 assert.match(element('#config-status').textContent,/1건을 적용/);
 await click('',{nav:'7'});
 assert.match(element('#view').innerHTML,/간접노무비 · 적용 근거 및 적용 여부 검토 필요/);
 await click('',{nav:'10'});
 element('#config').value=JSON.stringify({rates:[{...example[0],reviewed:true,enabled:true,rate:5}]});
 await click('apply-config');
 assert.match(element('#config-status').textContent,/1건을 적용/);
 await click('',{nav:'7'});
 assert.match(element('#view').innerHTML,/간 접 노 무 비\(나\)[\s\S]*직접노무비 \* 5%/);
});
test('settings supply the base adjustment when a standard has no surcharges',async()=>{
 const {element,click}=startApp();
 await click('',{nav:'10'});
 element('#config-type').value='standards';
 await click('load-config');
 const standards=JSON.parse(element('#config').value);
 const existing=structuredClone(standards[0].adjustments);
 delete standards[1].adjustments;
 standards[2].adjustments=[];
 element('#config').value=JSON.stringify(standards);
 await click('apply-config');
 assert.match(element('#config-status').textContent,/건을 적용/);
 const saved=JSON.parse(element('#config').value);
 assert.deepEqual(saved[0].adjustments,existing);
 for(const standard of saved.slice(1,3)){
  assert.deepEqual(standard.adjustments.map(a=>[a.id,a.factor]),[['base',1]]);
 }
});
test('wage and rate forms save valid rows and keep rate IDs on edit',async()=>{
 const {element,click,submit}=startApp();
 await click('',{nav:'10'});
 const period={from:'2026-01-01',to:'2026-12-31',source:'검증용'};
 await submit('wages',{...period,trade:'통신케이블공',price:'100000'});
 assert.match(element('#view').innerHTML,/100,000/);
 await submit('wages',{...period,trade:'통신케이블공',price:'200000'});
 assert.match(element('#basis-status-wages').textContent,/적용기간이 겹칩니다/);
 const rate={...period,name:'검증 제비율',rate:'5',status:'include',bases:['directLabor']};
 await submit('rates',rate);
 element('#config-type').value='rates';
 await click('load-config');
 const first=JSON.parse(element('#config').value)[0];
 assert.equal(first.enabled,true);
 assert.deepEqual(first.bases,['directLabor']);
 await click('',{basisEdit:'rates',index:'0'});
 await submit('rates',{...rate,rate:'7'});
 await click('load-config');
 const [saved,...rest]=JSON.parse(element('#config').value);
 assert.equal(saved.id,first.id);
 assert.equal(saved.rate,7);
 assert.equal(rest.length,0);
});
