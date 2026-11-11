(function(root){
  'use strict';
  const source='2026 건축·산업환경설비공사 간접공사비 적용기준 (2026.04.13.)';
  // 서식 구조만 제공. 요율 및 적용/제외 판단은 사용자가 입력한다.
  const definitions=[
    ['indirect','간접노무비',['directLabor'],'노무비','직접노무비 × 율. 직접공사비 규모·공사기간 구간 확인.'],
    ['other_expense','기타경비',['material','directLabor','indirect'],'경비','(재료비 + 직접·간접노무비) × 율. 공사규모·기간별 구간 확인.'],
    ['industrial','산재보험료',['directLabor','indirect'],'경비','직접·간접노무비 × 율.'],
    ['employment','고용보험료',['directLabor','indirect'],'경비','직접·간접노무비 × 율. 공사배정규모·시공자 적용조건 확인.'],
    ['health','건강보험료',['directLabor'],'경비','직접노무비 × 율. 공사기간 1개월(30일) 이상 여부 확인.'],
    ['care','노인장기요양보험료',['health'],'경비','건강보험료 × 율. 첨부표의 요율 소수점 처리 기준 확인.'],
    ['pension','연금보험료',['directLabor'],'경비','직접노무비 × 율. 공사기간 1개월(30일) 이상 여부 확인.'],
    ['retirement','퇴직공제부금비',['directLabor'],'경비','직접노무비 × 율. 첨부표의 추정금액·가입대상 확인.'],
    ['safety','산업안전보건관리비',['material','directLabor'],'경비','대상액 × 율 + 기초액. 도급자관급 포함 시 두 산식 중 작은 금액을 직접 산정금액으로 입력. 기초액은 원 단위로 입력.'],
    ['environment_fee','환경보전비',['material','directLabor','expense'],'경비','직접공사비 × 율. 첨부표에서 정보통신·전기·소방 등 적용 제외.'],
    ['rental_guarantee','건설기계대여대금 지급보증액 발급금액',['material','directLabor','expense'],'경비','직접공사비 × 율. 첨부표에서 정보통신·전기·소방 등 적용 제외.'],
    ['subcontract_guarantee','건설하도급대금지급보증서발급수수료',['material','directLabor','expense'],'경비','직접공사비 × 율. 추정가격·계약방식·적용 제외 여부 확인.'],
    ['performance_guarantee','공사이행보증수수료',[],'경비','직접공사비 구간별 산식 × 공기(년). 구간 기초액·기준금액을 확인하여 최종 금액 직접 입력.'],
    ['asbestos','석면분담금',['directLabor','indirect'],'경비','직접·간접노무비 × 율.'],
    ['wage_claim','임금채권부담금',['directLabor','indirect'],'경비','직접·간접노무비 × 율.'],
    ['general','일반관리비',[],'일반관리비','(재료비 + 노무비 + 경비) × 율. 전문·전기·통신·소방·기타의 별도 요율란 확인.'],
    ['profit','이윤',[],'이윤','(노무비 + 경비 + 일반관리비) × 율. 재료비 제외.']
  ];
  const labels={material:'재료비',directLabor:'직접노무비',expense:'직접경비'};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let host;
  function template(existing,year){
    const ids=new Map(),used=new Set(existing.map(r=>r.id));
    for(const [key,name] of definitions){const found=existing.find(r=>r.templateKey===key||r.name===name);let id=found?.id||`sheet_${key}`;while(!found&&used.has(id))id+='_new';ids.set(key,id);used.add(id);}
    const expenseKeys=definitions.filter(d=>d[3]==='경비').map(d=>d[0]);
    const rows=definitions.map(([key,name,bases,category,note])=>{
      const found=existing.find(r=>r.id===ids.get(key));
      if(found)return {...found,templateKey:key,category,condition:found.condition||note};
      if(key==='general')bases=['material','directLabor','expense','indirect',...expenseKeys];
      if(key==='profit')bases=['directLabor','expense','indirect',...expenseKeys,'general'];
      return {id:ids.get(key),templateKey:key,name,category,condition:note,bases:bases.map(b=>ids.get(b)||b),rate:null,method:key==='performance_guarantee'?'fixed':'percent',addition:0,fixedAmount:null,reviewed:false,enabled:false,source,from:`${year}-01-01`,to:`${year}-12-31`,cell:''};
    });
    const remaining=[...rows,...existing.filter(r=>!rows.some(n=>n.id===r.id))],ordered=[],ready=new Set(Object.keys(labels));
    while(remaining.length){const index=remaining.findIndex(r=>r.method==='fixed'||r.bases.every(b=>ready.has(b)));if(index<0)throw Error('기존 제비율의 순환 참조 또는 없는 기준금액을 확인하세요.');const [row]=remaining.splice(index,1);ordered.push(row);ready.add(row.id);}
    return ordered;
  }
  function baseName(state,id){return labels[id]||state.rates.find(r=>r.id===id)?.name||id;}
  function numeric(name,value,label){return `<input aria-label="${esc(label)}" name="${name}" type="number" min="0" step="any" value="${esc(value)}">`;}
  function render(state){
    return `<section class="card rate-sheet"><div class="estimate-section-head"><h2>제비율 적용표</h2><button type="button" id="rate-sheet-template">첨부 서식의 17개 항목 불러오기</button></div>
      <p class="muted">2026.04.13. 건축공사 간접공사비 서식의 항목·산정 기준을 사용합니다. 요율은 자동 입력하지 않습니다. 공사종류·금액·기간별 적용 여부를 선택하세요. 기존에 입력한 같은 항목의 값은 유지합니다.</p>
      <div class="rate-context"><span>공사종류: ${esc(state.project.type)}</span><span>공사기간: ${esc(state.project.duration)}일</span><span>적용 기준일: ${esc(state.project.date)}</span><button data-nav="1">공사정보 수정</button></div>
      <p class="muted">재 = 재료비, 노 = 직접·간접노무비, 직노 = 직접노무비, 경 = 직접경비·제경비. 첨부표는 2026.04.13. 입찰공고분부터이며, 통신공사는 일반관리비 별도 구분과 환경보전비·기계대여보증 적용 제외를 확인하세요.</p>
      ${state.rates.length?`<form id="rate-sheet-form"><div class="scroll"><table class="rate-entry-table"><thead><tr><th>구분·비목 / 적용 조건</th><th>적용 여부</th><th>계산 방식</th><th>요율 (%)</th><th>기초액 (원)</th><th>직접 산정금액 (원)</th><th>산정 기준·근거</th></tr></thead><tbody>${state.rates.map((r,i)=>{
        const choices=[...Object.entries(labels),...state.rates.slice(0,i).map(p=>[p.id,p.name])];
        return `<tr><td><small>${esc(r.category||'추가 항목')}</small><b>${esc(r.name)}</b><p class="muted">${esc(r.condition)}</p></td><td><select name="status_${i}" aria-label="${esc(r.name)} 적용 여부"><option value="pending" ${!r.reviewed?'selected':''}>미검토</option><option value="include" ${r.reviewed&&r.enabled?'selected':''}>적용</option><option value="exclude" ${r.reviewed&&!r.enabled?'selected':''}>제외</option></select></td><td><select name="method_${i}" aria-label="${esc(r.name)} 계산 방식"><option value="percent">기준금액 × 요율 + 기초액</option><option value="fixed" ${r.method==='fixed'?'selected':''}>금액 직접입력</option></select></td><td>${numeric('rate_'+i,r.rate,r.name+' 요율')}</td><td>${numeric('addition_'+i,r.addition??0,r.name+' 기초액')}</td><td>${numeric('fixed_'+i,r.fixedAmount,r.name+' 직접 산정금액')}</td>
          <td><details><summary>${esc(r.bases.map(b=>baseName(state,b)).join(' + ')||'기준금액 선택')}</summary>${choices.map(([id,label])=>`<label class="rate-base"><input type="checkbox" name="bases_${i}" value="${esc(id)}" ${r.bases.includes(id)?'checked':''}> ${esc(label)}</label>`).join('')}</details><label class="field">출처·산출 근거<input name="source_${i}" value="${esc(r.source)}"></label><div class="rate-period"><label>시작일<input type="date" name="from_${i}" value="${esc(r.from)}"></label><label>종료일<input type="date" name="to_${i}" value="${esc(r.to)}"></label></div></td></tr>`;
      }).join('')}</tbody></table></div><p class="muted">금액 직접입력은 요율·기초액을 사용하지 않습니다. 요율 방식에서는 기초액 빈칸을 0원으로 처리합니다. 적용 항목의 요율 또는 직접금액은 필수이며, 제외 항목은 빈칸으로 둘 수 있습니다.</p><button type="submit" class="primary">제비율 표 저장</button> <span id="rate-sheet-status" role="status"></span></form>`:'<p>위 버튼을 누르면 간접노무비부터 이윤까지 입력할 수 있는 표가 열립니다.</p><span id="rate-sheet-status" role="status"></span>'}
      </section>`;
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('button');if(button?.id!=='rate-sheet-template'||!host)return;
    try{host.loadTemplate(template(host.getState().rates,host.getState().project.date.slice(0,4)));host.refresh();document.querySelector('#rate-sheet-status').textContent='서식을 불러왔습니다. 요율과 적용 여부를 입력한 후 표 저장을 누르세요.';}catch(error){document.querySelector('#rate-sheet-status').textContent=error.message;}
  });
  document.addEventListener('submit',event=>{
    if(event.target.id!=='rate-sheet-form'||!host)return;event.preventDefault();
    try{
      const values=new FormData(event.target),read=n=>String(values.get(n)??'').trim(),optional=n=>read(n)===''?null:Estimator.number(read(n));
      host.update(rows=>rows.forEach((r,i)=>{
        const status=read('status_'+i),method=read('method_'+i);
        Object.assign(r,{method,rate:optional('rate_'+i),addition:optional('addition_'+i)??0,fixedAmount:optional('fixed_'+i),bases:values.getAll('bases_'+i),source:read('source_'+i),from:read('from_'+i),to:read('to_'+i),reviewed:status!=='pending',enabled:status==='include'});
        if(r.reviewed&&!r.source)throw Error(r.name+': 출처·산출 근거를 입력하세요.');
        if(r.enabled&&method==='percent'&&(r.rate==null||!r.bases.length))throw Error(r.name+': 요율과 산정 기준을 입력하세요.');
        if(r.enabled&&method==='fixed'&&r.fixedAmount==null)throw Error(r.name+': 직접 산정금액을 입력하세요.');
      }));
      host.refresh();document.querySelector('#rate-sheet-status').textContent='제비율 표를 저장했습니다. 공사원가계산에서 결과를 확인하세요.';
    }catch(error){document.querySelector('#rate-sheet-status').textContent=error.message;}
  });
  root.RateSheet={render,template,definitions,connect:callbacks=>{host=callbacks;}};
})(globalThis);
