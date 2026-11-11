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
test('design workbook exports the eight linked sheets with expenses and numeric totals',async()=>{
 global.JSZip=require('../vendor/jszip.min.js');
 const D=require('../src/design-xlsx.js');
 const state={project:{name:'테스트',date:'2026-01-01',year:2026},wages:[],quantities:[],rates:[],rounding:'floor'};
 const result={errors:[],material:100,directLabor:0,expense:600,materials:[{name:'재료',spec:'S',unit:'개',quantity:2,price:50,amount:100}],labor:[],costs:[],expenseRows:[{name:'장비',kind:'machine',hours:2,unitPrice:300,amount:600}],total:700};
 const zip=await JSZip.loadAsync(await D.write(state,result));
 const workbook=await zip.file('xl/workbook.xml').async('string');
 const names=[...workbook.matchAll(/<sheet name="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(names,['표지','원가계산서','집계표','설계내역서','일위대가표','물량산출근거','인건비산출기초','자재단가산출기초']);
 assert.match(workbook,/fullCalcOnLoad="1"/);
 const design=await zip.file('xl/worksheets/sheet4.xml').async('string');
 assert.match(design,/<f>ROUNDDOWN\(C\d+\*600?,0\)<\/f>|<f>ROUNDDOWN\(C\d+\*300,0\)<\/f><v>600<\/v>/);
 assert.match(await zip.file('xl/worksheets/sheet2.xml').async('string'),/<v>700<\/v>/);
 assert.equal(D.koreanAmount(7832000),'칠백팔십삼만이천');assert.equal(D.koreanAmount(100010000),'일억일만');assert.equal(D.koreanAmount(0),'영');
 await assert.rejects(D.write(state,{...result,errors:['검토 필요']}));
});
