(function (root) {
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const baseLabels={material:'재료비',directLabor:'직접노무비',expense:'기계·기타경비'};
  const editing={wages:-1,rates:-1};
  let host;

  function field(label,name,value,type='text',required=true){
    return `<label class="field">${label}<input name="${name}" type="${type}" value="${esc(value)}" ${type==='number'?'min="0" step="any"':''} ${required?'required':''}></label>`;
  }
  function table(headers,rows){
    return `<div class="scroll"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')||`<tr><td colspan="${headers.length}" class="muted">등록된 항목 없음</td></tr>`}</tbody></table></div>`;
  }
  function actions(type,index){
    return `<td class="estimate-row-actions"><button data-basis-edit="${type}" data-index="${index}">수정</button> <button data-basis-delete="${type}" data-index="${index}">삭제</button></td>`;
  }
  function period(row){return `${esc(row.from)} ~ ${esc(row.to)}`;}
  function displayBases(state,id){return Object.hasOwn(baseLabels,id)?baseLabels[id]:state.rates.find(r=>r.id===id)?.name||id;}
  function defaultPeriod(state){
    const year=state.project.date.slice(0,4);
    return {from:`${year}-01-01`,to:`${year}-12-31`};
  }
  function buttons(type){
    return `<div class="toolbar"><button type="submit" class="primary">${editing[type]<0?'추가':'수정 저장'}</button>${editing[type]>=0?`<button type="button" data-basis-cancel="${type}">취소</button>`:''}<span id="basis-status-${type}" role="status"></span></div>`;
  }
  function render(state){
    const wage=state.wages[editing.wages]||defaultPeriod(state);
    const rate=state.rates[editing.rates]||defaultPeriod(state);
    const trades=[...new Set(state.standards.flatMap(s=>s.labor.map(l=>l.trade)))].sort((a,b)=>a.localeCompare(b,'ko'));
    const choices=[...Object.entries(baseLabels),...state.rates.slice(0,editing.rates<0?state.rates.length:editing.rates).map(r=>[r.id,r.name])];
    const status=rate.reviewed?(rate.enabled?'include':'exclude'):'pending';
    return `<section class="card estimate-panel"><h2>노임단가 직접 입력</h2><form data-basis-form="wages"><div class="estimate-fields">
      <label class="field">직종<input name="trade" list="basis-trades" value="${esc(wage.trade)}" required></label><datalist id="basis-trades">${trades.map(t=>`<option value="${esc(t)}"></option>`).join('')}</datalist>
      ${field('일 노임 (원)','price',wage.price,'number')}${field('적용 시작일','from',wage.from,'date')}${field('적용 종료일','to',wage.to,'date')}${field('출처','source',wage.source)}
      </div>${buttons('wages')}</form>
      ${table(['직종','일 노임 (원)','적용기간','출처','관리'],state.wages.map((r,i)=>`<tr><td>${esc(r.trade)}</td><td class="num">${Number(r.price).toLocaleString('ko-KR')}</td><td>${period(r)}</td><td>${esc(r.source)}</td>${actions('wages',i)}</tr>`))}</section>
      ${RateSheet.render(state)}<section class="card estimate-panel"><details id="basis-custom-rate"><summary>제비율 개별 추가·수정</summary><form data-basis-form="rates"><div class="estimate-fields">
      ${field('항목명','name',rate.name)}<label class="field">계산 방식<select name="method"><option value="percent">기준금액 × 요율 + 기초액</option><option value="fixed" ${rate.method==='fixed'?'selected':''}>금액 직접입력</option></select></label>${field('요율 (%)','rate',rate.rate,'number',false)}${field('기초액 (원)','addition',rate.addition??0,'number',false)}${field('직접 산정금액 (원)','fixedAmount',rate.fixedAmount,'number',false)}${field('적용 시작일','from',rate.from,'date')}${field('적용 종료일','to',rate.to,'date')}${field('출처·적용 근거','source',rate.source)}
      <label class="field">검토 결과<select name="status"><option value="pending">검토 대기</option><option value="include" ${status==='include'?'selected':''}>근거 확인 · 적용</option><option value="exclude" ${status==='exclude'?'selected':''}>근거 확인 · 제외</option></select></label></div>
      <fieldset><legend>산정 기준 금액</legend><div class="toolbar">${choices.map(([id,label])=>`<label><input type="checkbox" name="bases" value="${esc(id)}" ${rate.bases?.includes(id)?'checked':''}> ${esc(label)}</label>`).join('')}</div><p class="muted">선택한 금액의 합계에 요율을 적용합니다. 다른 제비율 금액을 포함하려면 그 항목을 먼저 등록하세요.</p></fieldset>
      <details ${rate.cell?'open':''}><summary>기존 빈내역서 양식에 내보낼 때</summary>${field('원가계산서 출력 셀 (선택)','cell',rate.cell,'text',false)}<p class="muted">기존 양식에는 D9, D11~D19, D22, D23, D25 중 항목에 맞는 셀을 지정하세요. 공사비 산정 화면의 엑셀 저장에는 셀 지정이 필요 없습니다.</p></details>
      ${buttons('rates')}</form>
      ${table(['항목','요율 / 직접금액','산정 기준','적용기간','검토 결과','출처·근거','관리'],state.rates.map((r,i)=>`<tr><td>${esc(r.name)}</td><td class="num">${r.method==='fixed'?esc(r.fixedAmount)+'원':esc(r.rate)+'%'}</td><td>${esc(r.bases.map(id=>displayBases(state,id)).join(' + '))}</td><td>${period(r)}</td><td>${r.reviewed?(r.enabled?'적용':'제외'):'검토 대기'}</td><td>${esc(r.source)}</td>${actions('rates',i)}</tr>`))}</details></section>`;
  }

  function notice(type,text){document.querySelector('#basis-status-'+type).textContent=text;}
  document.addEventListener('submit',event=>{
    const type=event.target.dataset.basisForm;
    if(!['wages','rates'].includes(type)||!host)return;
    event.preventDefault();
    try{
      const values=new FormData(event.target);
      const read=name=>String(values.get(name)??'').trim();
      const row={from:read('from'),to:read('to'),source:read('source')};
      if(!row.source)throw Error('출처를 입력하세요.');
      if(row.from>row.to)throw Error('적용 종료일이 시작일보다 빠릅니다.');
      const index=editing[type];
      host.update(type,rows=>{
        const next={...rows[index],...row};
        if(type==='wages'){
          next.trade=read('trade');next.price=Estimator.number(read('price'));
          if(!next.trade)throw Error('직종을 입력하세요.');
          if(rows.some((r,i)=>i!==index&&r.trade===next.trade&&r.from<=next.to&&r.to>=next.from))throw Error('같은 직종의 적용기간이 겹칩니다.');
        }else{
          next.id=next.id||'rate_'+crypto.randomUUID().replaceAll('-','');
          next.name=read('name');next.rate=read('rate')===''?null:Estimator.number(read('rate'));next.method=read('method')||'percent';
          next.addition=read('addition')===''?0:Estimator.number(read('addition'));next.fixedAmount=read('fixedAmount')===''?null:Estimator.number(read('fixedAmount'));
          next.bases=values.getAll('bases');next.cell=read('cell').toUpperCase();
          next.reviewed=read('status')!=='pending';next.enabled=read('status')==='include';
          if(!next.name)throw Error('제비율 항목명을 입력하세요.');
          if(next.enabled&&next.method==='percent'&&(!next.bases.length||next.rate==null))throw Error('요율과 산정 기준 금액을 입력하세요.');
          if(next.enabled&&next.method==='fixed'&&next.fixedAmount==null)throw Error('직접 산정금액을 입력하세요.');
          if(next.cell&&!ExcelIO.rateCells.includes(next.cell))throw Error('기존 양식에서 지원하는 출력 셀을 입력하세요.');
          if(next.cell&&rows.some((r,i)=>i!==index&&r.cell===next.cell))throw Error('이미 사용 중인 출력 셀입니다.');
        }
        if(index<0)rows.push(next);else rows[index]=next;
      });
      editing[type]=-1;host.refresh();notice(type,'저장했습니다. 작업 JSON으로 보관할 수 있습니다.');
      if(type==='rates')document.querySelector('#basis-custom-rate').open=true;
    }catch(error){notice(type,error.message);}
  });
  document.addEventListener('click',event=>{
    const button=event.target.closest('button');
    if(!button||!host)return;
    const {basisEdit,basisDelete,basisCancel,index}=button.dataset;
    const type=basisEdit||basisDelete||basisCancel;
    if(!['wages','rates'].includes(type))return;
    try{
      if(basisDelete){
        host.update(type,rows=>{
          const row=rows[Number(index)];
          if(type==='rates'&&rows.some(r=>r!==row&&r.bases.includes(row.id)))throw Error('다른 제비율이 이 금액을 참조합니다. 먼저 해당 산정 기준을 수정하세요.');
          rows.splice(Number(index),1);
        });
      }
      editing[type]=basisEdit?Number(index):-1;
      host.refresh();
      if(type==='rates')document.querySelector('#basis-custom-rate').open=true;
      if(basisEdit)document.querySelector(`[data-basis-form="${type}"]`)?.scrollIntoView({block:'nearest'});
      if(basisDelete)notice(type,'삭제했습니다.');
    }catch(error){notice(type,error.message);}
  });
  root.BasisUI={render,connect:callbacks=>{host=callbacks;},reset(){editing.wages=-1;editing.rates=-1;}};
})(globalThis);
