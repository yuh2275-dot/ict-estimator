const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../src/xlsx.js');
test('targeted XML patch preserves adjacent formulas and cell style',()=>{
 const xml='<row r="8"><c r="A8" s="23"/><c r="F8" s="42"><f>C8*E8</f><v>0</v></c></row>';
 const out=ExcelIO.patch(xml,'A8','=literal & value');
 assert.match(out,/r="A8" s="23" t="inlineStr"/);
 assert.ok(out.includes('<f>C8*E8</f><v>0</v>'));
 assert.ok(out.includes('=literal &amp; value'));
});
test('formula updates retain style and remove stale cache',()=>{
 const out=ExcelIO.patch('<c r="F8" s="42"><f>C8*E8</f><v>123</v></c>','F8','', 'ROUNDDOWN(C8*E8,0)');
 assert.ok(out.includes('s="42"'));assert.ok(!out.includes('<v>'));assert.ok(out.includes('ROUNDDOWN'));
});
test('missing cells and array formulas reject without modifying template',()=>{
 assert.throws(()=>ExcelIO.patch('<row/>','A1',3));
 assert.throws(()=>ExcelIO.patch('<c r="A1"><f t="array">A2:A3</f></c>','A1',3));
});
test('standalone estimate exports five sheets with expenses and numeric totals',async()=>{
 global.JSZip=require('../vendor/jszip.min.js');
 const state={project:{name:'테스트',date:'2026-01-01'},wages:[]};
 const result={errors:[],material:100,directLabor:0,materials:[{name:'재료',quantity:2,price:50,amount:100}],labor:[],costs:[],expenseRows:[{name:'장비',kind:'machine',hours:2,unitPrice:300,amount:600}],total:700};
 const blob=await ExcelIO.writeEstimate(state,result);
 const zip=await JSZip.loadAsync(await blob.arrayBuffer());
 const workbook=await zip.file('xl/workbook.xml').async('string');
 for(const name of ['공사원가계산서','산출내역서','표준일위대가','자재단가표','노임단가표'])assert.ok(workbook.includes(name));
 const summary=await zip.file('xl/worksheets/sheet1.xml').async('string');
 assert.match(summary,/<v>600<\/v>/);
 assert.match(summary,/<v>700<\/v>/);
 await assert.rejects(ExcelIO.writeEstimate(state,{...result,errors:['검토 필요']}));
});
