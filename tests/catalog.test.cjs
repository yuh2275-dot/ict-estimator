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
 listeners.input.forEach(fn=>fn({target:{dataset:{},id:'catalog-review',checked:true}}));
 click({},'catalog-commit');assert.equal(registered.length,1);assert.equal(registered[0].reviewStatus,'user-reviewed');
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
 document:{querySelector:element,addEventListener:(type,handler)=>(listeners[type]??=[]).push(handler)},window:{addEventListener(){}}};
 vm.createContext(context);
 for(const name of ['standards.js','catalog-ui.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name),'utf8'),context);
 const click=(id='',dataset={})=>Promise.all(listeners.click.map(listener=>listener({target:{closest:()=>({id,dataset})}})));
 return {element,click};
}
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
 assert.match(element('#view').innerHTML,/간접노무비.*5%/);
});
