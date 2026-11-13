// 2026 1-1-12 (인쇄 7쪽). 선택한 전선·케이블·배관 직접재료비만 기준으로 한다.
(function(root){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const defaults=()=>({enabled:false,rate:2,reviewed:false,source:''});
  function validate(config){
    if(config==null)return;
    if(typeof config!=='object'||Array.isArray(config)||typeof config.enabled!=='boolean')throw Error('잡재료 설정 형식 오류');
    if(config.reviewed!=null&&typeof config.reviewed!=='boolean')throw Error('잡재료 검토 여부 형식 오류');
    if(config.source!=null&&(typeof config.source!=='string'||config.source.length>10000))throw Error('잡재료 적용 근거 형식 오류');
    if(config.enabled&&(config.rate==null||config.rate===''||!Number.isFinite(Number(config.rate))||Number(config.rate)<2||Number(config.rate)>5))throw Error('1-1-12 잡재료 적용률은 2~5%로 입력하세요.');
  }
  function calculate(state,materials,round){
    const config=state.consumables??defaults(),errors=[];
    const selected=materials.filter(m=>m.consumableBase===true&&m.role!=='ratio');
    const base=selected.reduce((sum,m)=>sum+m.amount,0);
    const result={...config,base,amount:0,errors};
    try{validate(config);}catch(e){errors.push(e.message);return result;}
    if(!config.enabled)return result;
    if(Number(state.project.year)!==2026){errors.push('잡재료 1-1-12는 2026년 기준입니다. 기준연도를 확인하세요.');return result;}
    if(!selected.length)errors.push('잡재료 기준금액에 포함할 전선·케이블·배관자재를 선택하세요.');
    if(!config.reviewed)errors.push('잡재료: 소액 소모품 일괄 계상 및 별도 계상 자재와의 중복 여부를 확인하세요.');
    if(!String(config.source||'').trim())errors.push('잡재료: 적용 사유를 입력하세요.');
    result.amount=round(base*Number(config.rate)/100,state.rounding);
    return result;
  }
  // 선택은 자재 자체에 저장한다. 앞 행 삭제·복사·순서 변경으로 다른 자재가 선택되지 않는다.
  function rows(state,result){
    return result.materials.map((m,index)=>{
      const q=m.quantityId?state.quantities.find(q=>q.id===m.quantityId):null;
      const source=q?(m.role==='main'?q:m.role==='extra'?q.extraMaterials?.[m.extra]:null):state.materials[index];
      return {m,source};
    }).filter(x=>x.source&&x.m.role!=='ratio');
  }
  function render(state,result){
    const c=state.consumables??defaults(),calc=result.consumables;
    const entries=rows(state,result),fmt=n=>Number(n||0).toLocaleString('ko-KR');
    return `<section class="card"><h2>잡재료 및 소모재료 · 1-1-12</h2>
      <label><input type="checkbox" data-consumables="enabled" ${c.enabled?'checked':''}> 소액 소모품을 일괄 계상</label>
      <p class="muted">품목별 계상이 어렵고 금액이 근소한 소모품에 적용합니다. 선택한 전선·케이블·배관자재 직접재료비의 2~5%입니다. <a href="src/reference/page-037.webp" target="_blank" rel="noopener">원문 7쪽</a></p>
      ${c.enabled?`<div class="estimate-fields"><label class="field">적용률 (%)<input data-consumables="rate" type="number" min="2" max="5" step="any" value="${esc(c.rate)}"></label><label class="field">적용 사유<input data-consumables="source" value="${esc(c.source)}" placeholder="품목별 계상이 어려운 소액 소모품과 적용 사유"></label></div>
      <p>기준금액에 넣을 자재를 선택하세요. 장비·랙·콘센트 완제품 등은 포함하지 않습니다. 부속품률(3-1-2) 금액은 제외합니다.</p>
      <div class="scroll"><table><thead><tr><th>포함</th><th>자재명</th><th>규격</th><th>금액 (원)</th></tr></thead><tbody>${entries.map(({m,source},i)=>`<tr><td><input aria-label="${esc(m.name+' '+(m.spec||'')+' 기준금액 포함')}" type="checkbox" data-consumable-row="${i}" ${source.consumableBase===true?'checked':''}></td><td>${esc(m.name)}</td><td>${esc(m.spec)}</td><td class="num">${fmt(m.amount)}</td></tr>`).join('')||'<tr><td colspan="4">먼저 공종의 자재 구성 또는 자재단가 관리에 자재를 입력하세요.</td></tr>'}</tbody></table></div>
      <p><b>선택 재료비 ${fmt(calc?.base)}원 × ${esc(c.rate)}% = ${fmt(calc?.amount)}원</b></p>
      <label><input type="checkbox" data-consumables="reviewed" ${c.reviewed?'checked':''}> 소액 소모품 계상 조건과 별도 계상 자재·부속품률과의 중복 여부를 확인했습니다.</label>
      ${(calc?.errors||[]).map(e=>`<p class="error">${esc(e)}</p>`).join('')}`:''}</section>`;
  }
  let host;
  if(typeof document!=='undefined')document.addEventListener('change',event=>{
    const t=event.target;if(!host||(!t.dataset?.consumables&&t.dataset?.consumableRow===undefined))return;
    try{
      host.update(state=>{
        state.consumables??=defaults();
        if(t.dataset.consumableRow!==undefined){
          const entry=rows(state,root.Estimator.calculate(state))[Number(t.dataset.consumableRow)];
          if(!entry)throw Error('대상 자재가 변경되었습니다. 화면을 다시 확인하세요.');
          entry.source.consumableBase=t.checked;state.consumables.reviewed=false;
        }else{
          const k=t.dataset.consumables;
          if(!['enabled','rate','source','reviewed'].includes(k))return;
          state.consumables[k]=t.type==='checkbox'?t.checked:t.type==='number'?(t.value===''?null:Number(t.value)):t.value;
          if(k!=='reviewed')state.consumables.reviewed=false;
        }
      });host.refresh();
    }catch(e){host.message(e.message);host.refresh();}
  });
  root.Consumables={defaults,validate,calculate,rows,render,connect:value=>host=value};
  if(typeof module!=='undefined')module.exports=root.Consumables;
})(globalThis);
