const {test}=require('node:test');
const assert=require('node:assert/strict');
global.RateSheet={render:()=>''};
const B=require('../src/basis-ui.js');
const E=require('../src/engine.js');
// 합성 노임: 엑셀에서 가져온 기본 기간(1/1~8/31)이 하반기 공사 기준일과 맞지 않는 경우
const wages=()=>[
  {trade:'통신내선공',price:284880,from:'2026-01-01',to:'2026-08-31',source:'상반기 시중노임'},
  {trade:'보통인부',price:172068,from:'2026-01-01',to:'2026-08-31',source:'상반기 시중노임'},
  {trade:'통신설비공',price:315528,from:'2026-01-01',to:'2026-12-31',source:'연간'}];

test('selected wages get the new period and keep the old one in the source',()=>{
  const next=B.applyWagePeriod(wages(),[0,1],{from:'2026-09-01',to:'2026-12-31',today:'2026-11-12'});
  assert.deepEqual(next.map(w=>[w.from,w.to]),[['2026-09-01','2026-12-31'],['2026-09-01','2026-12-31'],['2026-01-01','2026-12-31']]);
  assert.equal(next[0].source,'상반기 시중노임 · 적용기간 수정 2026-11-12 (이전 2026-01-01 ~ 2026-08-31)');
  assert.equal(next[0].price,284880);                                   // 단가는 그대로
  assert.equal(B.applyWagePeriod(wages(),[0],{from:'2026-09-01',to:'2026-12-31',keepHistory:false})[0].source,'상반기 시중노임');
  const original=wages();B.applyWagePeriod(original,[0],{from:'2026-09-01',to:'2026-12-31'});assert.equal(original[0].from,'2026-01-01'); // 원본 불변
});
test('the engine stops warning once the period covers the project date',()=>{
  const state={project:{year:2026,date:'2026-09-01'},rounding:'floor',materials:[],expenses:[],rates:[],ratesReviewed:true,
    standards:[{id:'s',verified:true,year:2026,code:'T',name:'T',unit:'m',baseQuantity:1,labor:[{trade:'통신내선공',base:1}],adjustments:[{id:'base',name:'기본',factor:1,basis:'T'}]}],
    quantities:[{id:'q',standardId:'s',length:1,count:1,adjustment:'base',reviewed:true}],wages:wages()};
  assert.match(E.calculate(state).errors.join(),/일괄 수정/);
  state.wages=B.applyWagePeriod(state.wages,[0,1],{from:'2026-09-01',to:'2026-12-31'});
  assert.deepEqual(E.calculate(state).errors,[]);
});
test('invalid input and overlapping periods of the same trade are rejected',()=>{
  assert.throws(()=>B.applyWagePeriod(wages(),[0],{from:'2026-12-31',to:'2026-09-01'}),/종료일/);
  assert.throws(()=>B.applyWagePeriod(wages(),[0],{from:'',to:'2026-09-01'}),/시작일과 종료일/);
  assert.throws(()=>B.applyWagePeriod(wages(),[],{from:'2026-09-01',to:'2026-12-31'}),/선택/);
  const w=[...wages(),{trade:'통신내선공',price:290000,from:'2026-09-01',to:'2026-12-31',source:'하반기'}];
  assert.throws(()=>B.applyWagePeriod(w,[0],{from:'2026-01-01',to:'2026-12-31'}),/통신내선공/);  // 하반기 노임과 겹침
  assert.doesNotThrow(()=>B.applyWagePeriod(w,[0],{from:'2026-01-01',to:'2026-08-31'}));
});
