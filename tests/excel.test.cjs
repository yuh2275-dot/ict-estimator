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
