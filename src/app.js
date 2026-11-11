'use strict';
const menus=['대시보드','공사정보 관리','공종 및 품셈 검색','수량산출','자재단가 관리','일위대가 계산','설계내역서 작성','공사원가계산','Excel 파일 가져오기','Excel 파일 내보내기','적용 기준 및 설정','공사비 산정'];
const estimatePage=11;
let state={version:1,project:{name:'',location:'',date:'2026-01-01',year:2026,duration:0,type:'정보통신공사',agency:''},standards:structuredClone(initialStandards),quantities:[],materials:[],expenses:[],wages:[],rates:[],ratesReviewed:false,rounding:'floor',history:[]};
let active=0,template=null,returnToEstimate=false;
const $=s=>document.querySelector(s), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),money=n=>n.toLocaleString('ko-KR');
const message=t=>{$('#message').textContent=t;};
const configExamples={
 wages:[{trade:'직종명',price:0,from:'2026-01-01',to:'2026-12-31',source:'공식 자료명 및 페이지'}],
 rates:[{id:'indirect',name:'간접노무비',rate:0,bases:['directLabor'],from:'2026-01-01',to:'2026-12-31',source:'공식 자료명 및 페이지',reviewed:false,enabled:false,cell:'D9'}]
};
function readConfigList(type,content){
 let parsed;
 try{parsed=JSON.parse(content);}catch{throw Error('JSON 형식을 확인하세요. 목록 표시 또는 예제 넣기에서 시작할 수 있습니다.');}
 const list=Array.isArray(parsed)?parsed:parsed?.[type];
 if(!Array.isArray(list))throw Error('선택한 기준의 목록을 입력하세요. 목록은 [ ]로 묶습니다.');
 return list;
}
function calculationIssues(errors){
 return errors.length?`<div class="card"><h2>계산 전 확인할 항목</h2><ul>${errors.map(error=>`<li class="error">${esc(error)}</li>`).join('')}</ul></div>`:'';
}
function costSheet(result){
 const detail=[['재료비',result.material,'',''],['직접노무비',result.directLabor,'',''],
  ...result.expenseRows.map(e=>[`${e.kind==='machine'?'기계경비':'기타경비'} · ${e.name}`,e.amount,'',e.kind==='machine'?[`${e.hours}시간 × ${money(e.unitPrice)}원`,e.source].filter(Boolean).join(' · '):e.source]),
  ...result.costs.map(c=>[c.name+(c.enabled?'':' (제외)'),c.amount,c.enabled?(c.method==='fixed'?'금액 직접입력':`${c.rate}%`):'',c.enabled?(c.method==='fixed'?c.source:`${money(c.base)}원 × ${c.rate}% + ${money(c.addition??0)}원 · ${c.source}`):c.source])];
 return `<div class="card estimate-panel"><div class="estimate-section-head"><h2>공사원가계산서</h2><div class="toolbar"><button data-nav="11">돌아가기</button><button class="primary" id="estimate-export" ${result.errors.length?'disabled':''}>엑셀 저장</button></div></div>
 <p>${esc(state.project.name||'공사명 미입력')} · ${esc(state.project.date)}</p>
 ${table(['비목','금액 (원)','적용요율','산출 근거'],detail.map(([name,amount,rate,basis])=>`<tr><td>${esc(name)}</td><td class="num">${money(amount)}</td><td>${esc(rate)}</td><td>${esc(basis)}</td></tr>`).concat(`<tr class="estimate-total"><th>총공사금액</th><td class="num"><strong>${money(result.total)}</strong></td><td colspan="2">${result.errors.length?'검토 중 금액':''}</td></tr>`))}
 <label><input type="checkbox" data-key="ratesReviewed" ${state.ratesReviewed?'checked':''}> 제비율 전체 적용·제외 검토 완료</label>
 <p class="muted">제비율은 적용 기준 및 설정에서 직접 입력합니다. 빈 목록을 검토 완료하면 모든 제비율을 제외합니다.</p></div>`;
}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function saveJson(data,name){download(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),name);}
function input(key,value,type='text'){return `<input data-key="${key}" value="${esc(value)}" type="${type}" ${type==='number'?'min="0" step="any"':''}>`;}
function table(headers,rows){return `<div class="scroll"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;}
function rowActions(i){return `<button data-copy="${i}">복사</button> <button data-delete="${i}">삭제</button>`;}
function render(){
 $('#title').textContent=menus[active];$('#nav').innerHTML=[0,1,estimatePage,2,3,4,10,5,6,7,8,9].map(i=>`<button data-nav="${i}" class="${active===i?'active':''}">${menus[i]}</button>`).join('');
 let result;try{result=Estimator.calculate(state);}catch(e){message(e.message);return;}
 let html='';
 if(active===0)html=`<div class="card"><span class="tag">2026 정보통신공사</span><h2>${esc(state.project.name||'새 공사 설계를 시작하세요')}</h2><p class="muted">공사정보 입력 → 품셈 선택 → 수량 및 단가 입력 → 기준 검토 → Excel 저장</p><button class="primary" data-nav="1">공사정보 입력</button></div><div class="grid">${[['재료비',result.material],['직접노무비',result.directLabor],['검토 중 총액',result.total]].map(([label,n])=>`<div class="card">${label}<div class="metric">${money(n)}<small> 원</small></div></div>`).join('')}</div><div class="card"><h2>검토 현황</h2>${result.errors.length?result.errors.map(e=>`<p class="error">${esc(e)}</p>`).join(''):'현재 입력의 계산 검토 항목 없음'}<p>품셈 ${state.standards.length}건 · 수량 ${state.quantities.length}건 · 자재 ${state.materials.length}건</p><p class="muted">기관 내부 보안정책에 따른 외부 웹사이트 업무자료 처리 승인은 별도로 확인해야 합니다.</p></div>`;
 if(active===1)html=`<div class="card grid">${Object.entries({name:'공사명',location:'공사 위치',date:'적용 기준일',year:'품셈 기준연도',duration:'공사기간 (일)',type:'공사종류',agency:'발주기관'}).map(([k,l])=>`<label class="field">${l}${input('project.'+k,state.project[k],k==='date'?'date':['year','duration'].includes(k)?'number':'text')}</label>`).join('')}</div>`;
 if(active===3)html=table(['공종','위치 / 산출근거','길이·단위수량','개수','시공수량','적용 조건','조건 확인','행'],state.quantities.map((q,i)=>{const s=state.standards.find(s=>s.id===q.standardId);return `<tr><td>${esc(s?.name)}<p>${esc(s?.unit)}</p></td><td>${input('quantities.'+i+'.location',q.location)}${input('quantities.'+i+'.basis',q.basis)}</td><td>${input('quantities.'+i+'.length',q.length,'number')}</td><td>${input('quantities.'+i+'.count',q.count,'number')}</td><td>${money(q.length*q.count*Surcharges.parallel(s,q).quantityMultiplier)}<small>${q.parallelRuns>1?esc(q.parallelRuns+'열 · 입력: '+(q.parallelQuantityMode==='route'?'1열 경로길이':'케이블 총길이')):''}</small></td><td><select data-key="quantities.${i}.adjustment">${s?.adjustments.map(a=>`<option value="${esc(a.id)}" ${a.id===q.adjustment?'selected':''}>${esc(a.name)} × ${a.factor}</option>`).join('')}${q.adjustment==='custom'?'<option value="custom" selected>해설 계수 직접입력 × '+esc(q.standardFactor)+'</option>':''}</select><details><summary>적용 근거</summary>${esc(s?.conditions)}</details><button data-estimate-edit-line="${i}">공통 할증 편집</button><small>${esc((q.surcharges||[]).map(a=>Surcharges.items.find(x=>x.id===a.id)?.name).join(' / '))}</small></td><td><input type="checkbox" data-key="quantities.${i}.reviewed" ${q.reviewed?'checked':''}></td><td>${rowActions(i)}</td></tr>`;}));
 if(active===4)html=`<div class="toolbar"><button id="add-material" class="primary">자재 추가</button><span class="muted">셀에서 탭으로 이동 · 여러 셀의 탭 구분 붙여넣기 지원</span></div>${table(['자재명','규격','단위','단가','수량','조사일','출처','비고','금액','행'],state.materials.map((m,i)=>`<tr>${['name','spec','unit','price','quantity','date','source','note'].map(k=>`<td>${input('materials.'+i+'.'+k,m[k],['price','quantity'].includes(k)?'number':k==='date'?'date':'text')}</td>`).join('')}<td class="num">${money(result.materials[i].amount)}</td><td>${rowActions(i)}</td></tr>`))}`;
 if(active===5 || active===6)html=table(['공종','수량','직종별 품량 / 노임 근거','노무비'],result.labor.map(l=>`<tr><td>${esc(l.standard.name)}<p>${esc(l.adjustment.basis)}</p></td><td>${l.quantity} ${esc(l.standard.unit)}</td><td>${l.details.map(d=>`${esc(d.trade)} · ${d.base} × ${l.quantity} ÷ ${l.standard.baseQuantity} × ${l.adjustment.laborFactor} = ${d.manDays.toFixed(6)}인<br>${money(d.wage)}원 × 노임 ${l.adjustment.wageFactor} = ${money(d.appliedWage)}원 · ${esc(d.source)}`).join('<hr>')}</td><td class="num">${money(l.amount)}</td></tr>`))+`<div class="card">재료비 ${money(result.material)}원 / 직접노무비 ${money(result.directLabor)}원<p class="muted">직접노무비는 Excel과 동일하게 직종별 공량을 합산한 뒤 원 단위 처리합니다.</p></div>`;
 if(active===8)html=`<div class="card"><h2>빈 설계내역서 연결</h2><input id="template-file" type="file" accept=".xlsx"><p class="muted">원본은 메모리에 유지됩니다. 제공된 빈내역 양식의 구조를 검사합니다. XLSM, 임베디드 개체 및 서명 파일은 지원하지 않습니다. 원본 외부 참조는 보존하며 별도 안내합니다.</p>${template?'<p>불러온 시트 · '+template.sheets.map(s=>esc(s.name)).join(' / ')+'</p>':''}</div><div class="card"><h2>노임단가 / 자재단가 가져오기</h2><select id="import-type"><option value="wages">노임단가</option><option value="materials">자재단가</option></select><input id="data-file" type="file" accept=".xlsx"><p class="muted">제공 양식의 인건비산출기초 B6:C18 또는 자재단가산출기초 A4:E25를 읽습니다. 노임 적용기간은 설정에서 확인하세요.</p></div>`;
 if(active===9)html=`<div class="card"><h2>원본 양식으로 Excel 생성</h2><p>재료비 9행 · 직종 7행 · 공종 19행까지 지원</p><p>기존 수식 변경 이력을 함께 저장할 수 있습니다. Excel에서 열면 전체 수식을 재계산합니다.</p><button id="export" class="primary">XLSX 다운로드</button> <button id="audit">최근 수식 변경 이력 저장</button><p class="muted">제공 빈 양식의 #REF! 2곳을 수정하고, 검토한 제비율로 기존 고정 요율을 교체합니다. 원본의 천원 단위 최종 절사는 원 단위 합계로 변경합니다.</p></div>`;
 if(active===10)html=`<div class="card"><label>원 단위 처리 <select data-key="rounding"><option value="floor" ${state.rounding==='floor'?'selected':''}>절사</option><option value="round" ${state.rounding==='round'?'selected':''}>반올림</option></select></label><p>노임단가와 제비율은 아래 입력란에서 관리할 수 있습니다.</p></div>${BasisUI.render(state)}<div class="card"><details id="basis-json"><summary>기준 데이터 JSON 편집</summary><p>JSON을 적용하면 선택한 기준의 목록 전체를 교체합니다.</p><select id="config-type"><option value="wages">노임단가</option><option value="rates">제비율</option><option value="standards">품셈</option></select><button id="load-config">편집할 목록 표시</button><button id="config-example">예제 넣기</button><textarea id="config" aria-label="기준 데이터 JSON"></textarea><button id="apply-config" class="primary">입력 검증 후 적용</button><p id="config-status" role="status"></p><details><summary>등록 형식</summary><p>예제 넣기를 누르면 선택한 기준의 목록 형식이 입력됩니다. 제비율의 rate는 퍼센트 숫자입니다. reviewed는 근거를 검토한 경우 true, enabled는 적용할 때 true입니다.</p><p>산정금액 ID는 material, directLabor, expense 및 앞서 등록한 제비율 id를 사용합니다. 출력 셀은 원가계산서 D9, D11~D19, D22, D23, D25입니다.</p></details></details><button id="security">현재 정적 리소스 요청 검사</button><pre id="security-result"></pre></div>`;
 if(active===2)html=CatalogUI.render(state);
 if(active===estimatePage)html=EstimateUI.render(state,result);
 if(active===7)html=costSheet(result);
 if([5,6,7].includes(active))html+=calculationIssues(result.errors);
 $('#view').innerHTML=html||'<div class="card">공종 검색에서 항목을 추가하세요.</div>';
}
function setValue(key,value){const parts=key.split('.');let target=state;for(const p of parts.slice(0,-1))target=target[p];target[parts.at(-1)]=value;}
function validate(next){
 if(next.version!==1||!next.project||!Array.isArray(next.history))throw Error('작업 파일 형식 오류');
 if(!['floor','round'].includes(next.rounding))throw Error('반올림 방식 오류');
 const text=(v)=>{if(typeof v!=='string'||v.length>10000||/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(v))throw Error('문자열 형식 오류');};
 const date=v=>{text(v);if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v)))throw Error('날짜 형식 오류');};
 date(next.project.date);Estimator.number(next.project.year);
 next.expenses??=[];
 for(const k of ['materials','quantities','expenses','wages','rates','standards'])if(!Array.isArray(next[k])||next[k].length>50000)throw Error('목록 형식 또는 허용 건수 오류');
 for(const s of next.standards){
 if(!s.id||!s.source||!Array.isArray(s.labor)||s.baseQuantity<=0)throw Error('품셈 구조 오류');
 if(s.adjustments==null||Array.isArray(s.adjustments)&&s.adjustments.length===0){
  s.adjustments=[{id:'base',name:'기본 조건',factor:1,basis:s.code+' 본문 표'}];
 }
 if(!Array.isArray(s.adjustments))throw Error('할증 목록 형식 오류');
 Estimator.number(s.year);Estimator.number(s.page);Estimator.number(s.baseQuantity);
 for(const l of s.labor){text(l.trade);Estimator.number(l.base);}
 for(const a of s.adjustments){text(a.id);text(a.name);text(a.basis);Estimator.number(a.factor);}
 }
 for(const q of next.quantities){Estimator.number(q.length);Estimator.number(q.count);if(q.materialPrice!=null)Estimator.number(q.materialPrice);if(q.surcharges!=null&&(!Array.isArray(q.surcharges)||q.surcharges.length>100))throw Error('공통 할증 목록 형식 오류');}
 for(const expense of next.expenses){
  if(!['machine','other'].includes(expense.kind))throw Error('경비 종류 오류');
  text(expense.name);text(expense.source);
  Estimator.expenseAmount(expense,next.rounding);
 }
 for(const w of next.wages){text(w.trade);text(w.source);Estimator.number(w.price);date(w.from);date(w.to);if(w.from>w.to)throw Error('노임 적용기간 오류');}
 for(const r of next.rates){
 if(!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(r.id)||['constructor','prototype','__proto__'].includes(r.id))throw Error('제비율 ID 오류');
 text(r.name);text(r.source);if(r.rate!=null)Estimator.number(r.rate);if(r.fixedAmount!=null)Estimator.number(r.fixedAmount);if(r.addition!=null)Estimator.number(r.addition);date(r.from);date(r.to);if(r.from>r.to)throw Error('제비율 적용기간 오류');
 if(!['percent','fixed'].includes(r.method||'percent'))throw Error('제비율 계산방식 오류');
 if(!Array.isArray(r.bases)||!r.bases.every(b=>typeof b==='string'))throw Error('기준금액 구조 오류');
 }
 if(new Set(next.standards.map(s=>s.id)).size!==next.standards.length)throw Error('품셈 ID 중복');
 for(const q of next.quantities){const standard=next.standards.find(s=>s.id===q.standardId);if(!standard)throw Error('수량의 품셈 참조 오류');Surcharges.combined(standard,q);}
 Estimator.calculate(next);return next;
}
document.addEventListener('change',async event=>{try{
 const t=event.target;
 if(t.dataset.key){const old=structuredClone(state);setValue(t.dataset.key,t.type==='checkbox'?t.checked:t.type==='number'?Number(t.value):t.value);try{validate(state);}catch(e){state=old;throw e;}state.history.push({at:new Date().toISOString(),field:t.dataset.key,value:t.type==='checkbox'?t.checked:t.value});if(active!==estimatePage||!t.dataset.key.startsWith('project.'))render();}
 if(t.id==='open'){const data=JSON.parse(await t.files[0].text());state=validate(data);template=null;EstimateUI.reset();BasisUI.reset();render();message('작업을 불러왔습니다. Excel 양식은 다시 연결하세요.');}
 if(t.id==='template-file'){template=await ExcelIO.open(t.files[0]);render();message(['양식 파일을 브라우저 메모리에서 읽었습니다.',...template.warnings].join(' '));}
 if(t.id==='data-file'){
 const book=await ExcelIO.open(t.files[0]),type=$('#import-type').value;
 const sheet=book.sheets.find(s=>s.name===(type==='wages'?'인건비산출기초':'자재단가산출기초'));if(!sheet)throw Error('단가 시트를 찾을 수 없습니다.');
 const rows=[];
 for(let r=type==='wages'?6:4;r<=(type==='wages'?18:25);r++){
 const c=col=>sheet.cells[col+r]?.value||'';
 if(type==='wages'&&c('B')&&c('C')&&!sheet.cells['C'+r]?.formula)rows.push({trade:c('B'),price:Estimator.number(c('C')),from:'2026-01-01',to:'2026-08-31',source:'사용자 Excel 인건비산출기초 '+r+'행 (기간 확인 필요)'});
 if(type==='materials'&&c('A')&&c('D')&&!sheet.cells['D'+r]?.formula)rows.push({name:c('A'),spec:c('B'),unit:c('C'),price:Estimator.number(c('D')),quantity:1,source:c('E')||'사용자 Excel',date:'',note:''});
 }
 state[type]=rows;render();message('단가 '+rows.length+'건을 가져왔습니다. 적용기간과 출처를 확인하세요.');
 }
}catch(e){message(e.message);}});
document.addEventListener('input',e=>{if(e.target.id==='search')document.querySelectorAll('[data-search]').forEach(r=>r.hidden=!r.dataset.search.toLowerCase().includes(e.target.value.toLowerCase()));});
document.addEventListener('click',async e=>{try{const t=e.target.closest('button');if(!t)return;
 if(t.dataset.nav!==undefined){active=Number(t.dataset.nav);returnToEstimate=false;BasisUI.reset();render();}
 if(t.dataset.addStandard){state.quantities.push({id:crypto.randomUUID(),standardId:t.dataset.addStandard,location:'',length:1,count:1,basis:'',note:'',adjustment:'base',reviewed:false});active=3;render();}
 if(t.id==='add-material'){state.materials.push({id:crypto.randomUUID(),name:'',spec:'',unit:'개',price:0,quantity:1,date:'',source:'',note:''});render();}
 const list=active===3?'quantities':'materials';
 if(t.dataset.copy!==undefined){const r=structuredClone(state[list][Number(t.dataset.copy)]);r.id=crypto.randomUUID();state[list].push(r);render();}
 if(t.dataset.delete!==undefined){state[list].splice(Number(t.dataset.delete),1);render();}
 if(t.id==='save')saveJson(state,'ict-project.json');
 if(t.id==='load-config'){
  const list=state[$('#config-type').value];
  $('#config').value=JSON.stringify(list,null,2);
  $('#config-status').textContent=list.length?`기존 ${list.length}건을 불러왔습니다.`:'등록된 항목이 없습니다. 예제 넣기로 입력을 시작하세요.';
 }
 if(t.id==='config-example'){
  const type=$('#config-type').value;
  $('#config').value=JSON.stringify(configExamples[type]??state[type].slice(0,1),null,2);
  $('#config-status').textContent='예제의 숫자는 입력 형식 설명용입니다. 적용하기 전에 실제 공식 자료와 적용기간을 입력하세요.';
 }
 if(t.id==='apply-config'){
  const type=$('#config-type').value;
  try{
   const next=structuredClone(state);
   next[type]=readConfigList(type,$('#config').value);
   if(type==='rates')next.ratesReviewed=false;
   state=validate(next);
   BasisUI.reset();
   render();
   $('#basis-json').open=true;
   $('#config-type').value=type;
   $('#config').value=JSON.stringify(state[type],null,2);
   $('#config-status').textContent=`${state[type].length}건을 적용했습니다. ${type==='rates'?'공사원가계산에서 적용 결과와 검토 항목을 확인하세요. ':''}작업 JSON을 저장하면 변경사항을 보관할 수 있습니다.`;
  }catch(error){$('#config-status').textContent=error.message;}
 }
 if(t.id==='export'){if(!template)throw Error('먼저 빈 XLSX 양식을 연결하세요.');if(!state.project.name)throw Error('공사명을 입력하세요.');const out=await ExcelIO.write(template,state,Estimator.calculate(state));globalThis.lastAudit=out.changes;download(out.blob,'설계내역서.xlsx');message('파일 생성 완료. Excel에서 수량을 변경해 재계산을 확인하세요.');}
 if(t.id==='audit'){if(!globalThis.lastAudit)throw Error('먼저 Excel을 생성하세요.');saveJson(lastAudit,'수식변경이력.json');}
 if(t.id==='estimate-export'){
  const workbook=await ExcelIO.writeEstimate(state,Estimator.calculate(state));
  download(workbook,'공사비 산정.xlsx');message('공사비 산정 Excel을 저장했습니다.');
 }
 if(t.id==='security'){
 const entries=performance.getEntriesByType('resource');const allowed=['src/style.css?v=utp-parallel-1','vendor/jszip.min.js','src/engine.js?v=utp-parallel-1','src/standards.js?v=utp-parallel-1','src/surcharges.js?v=utp-parallel-1','src/rate-sheet.js?v=utp-parallel-1','src/catalog-data.js','src/catalog-ui.js?v=utp-parallel-1','src/xlsx.js?v=utp-parallel-1','src/estimate-ui.js?v=utp-parallel-1','src/app.js?v=utp-parallel-1','src/basis-ui.js?v=utp-parallel-1'];
 const unexpected=entries.filter(r=>!allowed.some(a=>r.name===new URL(a,location.href).href) && !/^page-[0-9]{3}\.webp$/.test(r.name.startsWith(new URL('src/reference/',location.href).href)?r.name.slice(new URL('src/reference/',location.href).href.length):''));
 $('#security-result').textContent=`정적 리소스 ${entries.length}건 / 허용 목록 외 ${unexpected.length}건\nCSP connect-src 'none' 적용\n추가 검증은 README의 브라우저 네트워크 절차를 따르세요.`;
 }
}catch(e){message(e.message);}});
document.addEventListener('paste',e=>{
 const target=e.target;if(!target.dataset.key?.startsWith('materials.')||!e.clipboardData.getData('text').includes('\t'))return;
 e.preventDefault();try{const next=structuredClone(state),[,row,key]=target.dataset.key.split('.'),keys=['name','spec','unit','price','quantity','date','source','note'];
 e.clipboardData.getData('text').trimEnd().split(/\r?\n/).forEach((line,offset)=>{const index=Number(row)+offset;if(!next.materials[index])next.materials[index]={name:'',spec:'',unit:'',price:0,quantity:0,date:'',source:'',note:''};line.split('\t').forEach((v,j)=>{const k=keys[keys.indexOf(key)+j];if(k)next.materials[index][k]=['price','quantity'].includes(k)?Estimator.number(v.replace(/,/g,'')):v;});});state=validate(next);render();}catch(err){message(err.message);}
});
window.addEventListener('beforeunload',e=>{if(state.materials.length||state.quantities.length||state.expenses.length||state.wages.length||state.rates.length){e.preventDefault();e.returnValue='';}});
CatalogUI.connect({refresh:render,message,register:standard=>{
 const next=structuredClone(state);
 next.standards.push(standard);
 next.history.push({at:new Date().toISOString(),field:'standards.register',id:standard.id,code:standard.code,sourceHash:standard.sourceHash,reviewStatus:standard.reviewStatus});
 state=validate(next);
 if(returnToEstimate){EstimateUI.choose(standard.id);returnToEstimate=false;active=estimatePage;}
}});
EstimateUI.connect({getState:()=>state,refresh:render,message,
 openEstimate(){active=estimatePage;},
 update(collection,apply){const next=structuredClone(state);apply(next[collection]);state=validate(next);},
 openDraft(id){active=2;returnToEstimate=true;CatalogUI.openDraft(id);},
 calculate(){active=7;message('');render();}
});
BasisUI.connect({refresh:render,update(type,apply){
 const next=structuredClone(state);
 apply(next[type]);
 if(type==='rates')next.ratesReviewed=false;
 state=validate(next);
}});
RateSheet.connect({getState:()=>state,refresh:render,
 update(apply){const next=structuredClone(state);apply(next.rates);next.ratesReviewed=false;state=validate(next);},
 loadTemplate(rows){const next=structuredClone(state);next.rates=rows;next.ratesReviewed=false;state=validate(next);}
});
render();
