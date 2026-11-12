const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../src/catalog-data.js');
require('../src/standards.js');
const V=require('../src/standards-verified.js');
const E=require('../src/engine.js');
const C=globalThis.standardCatalog;
const TRADES=new Set(['통신내선공','통신설비공','통신외선공','통신케이블공','무선안테나공','광케이블설치사','H/W 시험사','S/W 시험사','통신관련기사','통신관련 산업기사','통신관련기능사','보통인부','특별인부','착암공','방수공','건축목공','배전전공','저압케이블전공','고압케이블전공','변전전공','송전전공','통신기능공','전기공사기사','미장공']);
const by=(code,spec)=>V.find(s=>s.code===code&&s.spec===spec);

test('verified standards are well formed and point at real sections and pages',()=>{
  assert.equal(new Set(V.map(s=>s.id)).size,V.length);
  assert.ok(!V.some(s=>globalThis.initialStandards.filter(x=>x.id===s.id).length!==1),'initialStandards에 한 번씩');
  for(const s of V){
    const section=C.sections.find(x=>x.code===s.code);
    assert.ok(section,`${s.code} 절 없음`);
    assert.ok(Math.abs(section.page-s.page)<=2,`${s.code} 쪽 ${s.page} / 목차 ${section.page}`);
    assert.ok(s.verified&&s.year===2026&&s.baseQuantity>0&&s.unit&&s.spec);
    for(const l of s.labor){assert.ok(TRADES.has(l.trade),`${s.code} 직종 ${l.trade}`);assert.ok(l.base>0&&l.base<100,`${s.code} ${s.spec} 품 ${l.base}`);}
  }
});
test('spot values from the source pages, including tables that exist only as images',()=>{
  assert.deepEqual(by('3-1-1','합성수지 전선관 호칭 16').labor,[{trade:'통신내선공',base:.5}]);assert.equal(by('3-1-1','합성수지 전선관 호칭 16').baseQuantity,10);
  assert.equal(by('3-2-1','풀박스 벽면 단면적 40,000㎠ 이하(깊이 30㎝ 이하)').labor[0].base,5.64);
  assert.equal(by('3-2-2','후강 전선관 Ø104㎜').labor[0].base,.23);assert.equal(by('3-2-2','후강 전선관 Ø104㎜').baseQuantity,10);   // 이미지 전용 표
  assert.deepEqual(by('3-3-2','단자함 600P 이하').labor,[{trade:'통신케이블공',base:1.61},{trade:'보통인부',base:1.09}]);           // 이미지 전용 표
  assert.equal(by('3-4-2','알루미늄재 폭 1,000㎜ 이하').labor[0].base,4.2);                                                         // 이미지 전용 표
  assert.deepEqual(by('3-6-1','우드 Floor').labor.map(l=>l.trade),['건축목공','보통인부']);    // 자동 후보는 건축목공을 놓쳤음
  assert.deepEqual(by('3-5-2','덕트 뚜껑 열기').labor,[{trade:'통신케이블공',base:.12},{trade:'보통인부',base:1}]);
  assert.equal(by('3-7-2-2','규격 0.4㎡ 두께 400㎜ 이하').labor[0].base,2.6);
  assert.match(by('3-7-2-3','벽면 구경 400㎜ 두께 300㎜ 이하 (코어드릴 6.47Hr 별도)').spec,/6\.47Hr/);
  // 4장: 자동 후보에 없던 표 포함
  assert.deepEqual(by('4-1-5','연선 이륜보조활차공법 200㎟ 이하').labor.map(l=>[l.trade,l.base]),[['전기공사기사',1.92],['통신관련기사',2.61],['광케이블설치사',2.27],['송전전공',29.89],['특별인부',20.48]]);
  assert.equal(by('4-4-1','24C 6㎟').labor[0].base,1.03);assert.equal(by('4-4-1','30C 4㎟'),undefined);   // 원문 "-"
  assert.equal(by('4-6-2','1,000㎟ 이하 1C').labor[0].base,1.08);assert.equal(by('4-6-3','240㎟ 이하 4C').labor[0].base,1.62);
  assert.deepEqual(by('4-7-1','가공케이블 900P 이하 심선 0.65㎜ 이상').labor,[{trade:'통신케이블공',base:1.89},{trade:'보통인부',base:1.69}]);
  assert.equal(by('4-7-1','가공케이블 3,600P 이하 심선 0.5㎜ 이하'),undefined);                         // 원문 "-"
  assert.deepEqual(by('4-11-9-3','특수방음형').labor.map(l=>l.trade),['통신설비공','미장공','보통인부']); // 자동 후보는 미장공 누락
  assert.deepEqual(by('4-3-3','성단 110 Block 25P').labor,[{trade:'통신케이블공',base:.1},{trade:'보통인부',base:.1}]);
  // 기본 등록 6개와 겹치지 않음
  for(const [code,spec] of [['4-3-1','UTP, STP, FTP 구내 4P'],['4-3-2','Modular(RJ45-8Pin Plug)'],['4-3-3','19″Rack 높이 2.2m 미만']])assert.equal(by(code,spec),undefined);
});
test('verified standards calculate through the engine with their source commentary',()=>{
  const s=by('3-5-3','금속몰딩 소형 210㎟ 이하');
  const S=require('../src/surcharges.js');const g=S.commentary(s).groups.find(g=>g.ref==='①');const wall=g.choices.find(c=>/벽면/.test(c.name));
  assert.equal(wall.factor,1.1);
  const state={project:{year:2026,date:'2026-06-01'},rounding:'floor',materials:[],expenses:[],rates:[],ratesReviewed:true,standards:[s],
    quantities:[{id:'q',standardId:s.id,length:15,count:1,adjustment:'base',reviewed:true,commentary:{[g.id]:wall.id}}],
    wages:[{trade:'통신내선공',price:284880,from:'2026-01-01',to:'2026-12-31',source:'T'}]};
  const r=E.calculate(state);assert.deepEqual(r.errors,[]);
  assert.equal(r.directLabor,Math.floor(.16*15*1.1*284880));                // 벽면 110% (해설 ①, 자동 추출 조건)
});
