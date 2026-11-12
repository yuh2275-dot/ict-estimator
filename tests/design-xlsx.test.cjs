const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../src/engine.js');
const D=require('../src/design-xlsx.js');
// 합성 공사 데이터(tests/fixtures-design-state.cjs): UTP·정보콘센트·랙·패치패널·성단·RJ45 + 제비율 11개
const fresh=()=>structuredClone(require('./fixtures-design-state.cjs'));
const view=(state)=>{const r=E.calculate(state);assert.deepEqual(r.errors,[]);const {sheets,summary}=D.build(state,r);return {r,summary,cell:(n,ref)=>sheets.find(s=>s.name===n).cells.get(ref),sheet:n=>sheets.find(s=>s.name===n)};};

test('cost statement follows the sample layout and its cached values equal the app calculation',()=>{
  const {r,cell,sheet,summary}=view(fresh());
  const c=ref=>cell('원가계산서',ref);
  assert.equal(c('E4').value,'구  성  비');
  assert.equal(c('C5').value,'직 접 재 료 비(가)');assert.equal(c('D5').formula,'집계표!E6');
  assert.equal(c('C6').value,'간 접 재 료 비');assert.equal(c('D6').value,null);           // 예시처럼 빈 간접재료비 행
  assert.equal(c('C7').value,'소    계');assert.equal(c('D7').formula,'SUM(D5:D6)');
  assert.equal(c('D8').formula,'집계표!G6');
  assert.equal(c('C9').value,'간 접 노 무 비(나)');assert.equal(c('D9').formula,'ROUNDDOWN((D8)*17.5%,0)');assert.equal(c('E9').value,'직접노무비 * 17.5%');
  assert.equal(c('E11').value,'(B) * 3.56%');                                      // 산재: 노무비 소계
  assert.equal(c('D13').value,null);assert.match(c('F13').value,/^적용 제외/);       // 건강보험료 미적용
  assert.equal(c('E17').value,'(A + B) * 5%');                                      // 기타경비
  const rows=[...sheet('원가계산서').cells.entries()];
  const rowOf=l=>rows.find(([ref,x])=>/^A\d+$/.test(ref)&&String(x.value).replace(/\s/g,'').startsWith(l))[0].slice(1);
  assert.equal(c('E'+rowOf('일반관리비')).value,'(D) * 8%');
  assert.equal(c('E'+rowOf('이윤')).value,'(B + C + E) * 6.2%');
  assert.equal(c('E'+rowOf('총원가')).value,'(D) + (E) + (F)');
  assert.equal(c('E'+rowOf('부가가치세')).value,'(G) * 10%');
  assert.ok(!rows.some(([ref,x])=>/^A\d+$/.test(ref)&&String(x.value).replace(/\s/g,'')==='합계'));   // 별도 합계 행 없음
  assert.equal(c('D'+summary.contract).value,Math.floor(r.total/1000)*1000);
  assert.match(c('D'+summary.contract).formula,/^ROUNDDOWN\(D\d+\+D\d+,-3\)$/);
  assert.match(c('F'+summary.contract).value,/7,832,704원/);
  for(const x of r.costs.filter(x=>x.enabled))assert.ok(rows.some(([ref,y])=>/^D/.test(ref)&&y.value===x.amount),x.id);
  assert.equal(cell('설계내역서','F'+summary.grand).value,r.material);assert.equal(cell('설계내역서','H'+summary.grand).value,r.directLabor);
});
test('sheets are linked by formulas: quantity → 일위대가 → 설계내역서, prices and wages from their base sheets',()=>{
  const {cell,summary}=view(fresh());
  assert.equal(cell('일위대가표','C6').formula,'물량산출근거!C4');
  assert.equal(cell('설계내역서','C8').formula,'물량산출근거!C4');assert.equal(cell('설계내역서','E8').formula,'자재단가산출기초!D4');
  assert.equal(cell('설계내역서','F8').formula,'ROUNDDOWN(C8*E8,0)');
  const laborRow=[...Array(40).keys()].map(i=>i+1).find(i=>cell('설계내역서','B'+i)?.value==='통신케이블공');
  assert.match(cell('설계내역서','C'+laborRow).formula,new RegExp(`^일위대가표!L${summary.totalRow}$`));
  assert.match(cell('설계내역서','G'+laborRow).formula,/^VLOOKUP\(B\d+,인건비산출기초!\$B\$6:\$C\$10,2,0\)$/);
  assert.match(cell('표지','A10').formula,/NUMBERSTRING\(원가계산서!D\d+,1\)/);assert.match(cell('표지','A10').value,/칠백팔십삼만이천원/);
});
test('commentary factors, demolition and the night wage premium appear in 일위대가표',()=>{
  const {cell,sheet}=view(fresh());
  const u=sheet('일위대가표'),row=name=>[...u.cells.entries()].filter(([ref,c])=>/^B\d+$/.test(ref)&&c.value===name).map(([ref])=>ref.slice(1));
  const outlet=row('Modular Outlet')[0];assert.equal(cell('일위대가표','E'+outlet).formula,'0.28*1.8');           // 6구
  const rack=row('높이 2.2m 미만')[1];assert.equal(cell('일위대가표','G'+rack).formula,'0.48*0.3');               // 철거 불용 30%
  const rj45=row('8Pin Plug')[0];assert.equal(cell('일위대가표','E'+rj45).formula,'0.13*1.875');                  // 야간 품 25% × 노임 50%
  assert.match(cell('일위대가표','AF'+rj45).value,/노임 할증 ×1.5는 품셈에 포함/);
});
test('rounding mode and empty optional sections are handled',()=>{
  const s=fresh();s.rounding='round';
  const {cell}=view(s);assert.equal(cell('설계내역서','F8').formula,'ROUND(C8*E8,0)');
  const t=fresh();t.rates=[];const v=view(t);
  assert.equal(v.cell('원가계산서','D7').formula,'SUM(D5:D6)');assert.equal(v.cell('원가계산서','C9').value,'간 접 노 무 비');
});

test('linked materials use quantity-row labels with independent fallback to the standard',()=>{
  const state=fresh();
  const [cable,outlet]=state.quantities;
  Object.assign(cable,{materialName:'  UTP 케이블  ',materialSpec:' CAT.6 4P '});
  Object.assign(outlet,{materialName:'  ',materialSpec:'6구'});
  const {r,cell,sheet}=view(state);
  const cableStandard=r.labor.find(row=>row.id===cable.id).standard;
  const outletStandard=r.labor.find(row=>row.id===outlet.id).standard;

  for(const [name,cableRow,outletRow] of [['설계내역서',8,9],['자재단가산출기초',4,5]]){
    assert.equal(cell(name,'A'+cableRow).value,'UTP 케이블');
    assert.equal(cell(name,'B'+cableRow).value,'CAT.6 4P');
    assert.equal(cell(name,'A'+outletRow).value,outletStandard.name);
    assert.equal(cell(name,'B'+outletRow).value,'6구');
    assert.ok([...sheet(name).cells.values()].some(cell=>cell.value==='난연 CD관'));
  }
  assert.equal(cell('물량산출근거','A4').value,cableStandard.name);
  assert.equal(cell('일위대가표','B6').value,cableStandard.spec);
});
