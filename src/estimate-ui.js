(function (root) {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = value => value.toLocaleString('ko-KR');
  const newLine = () => ({standardId:'',length:1,count:1,adjustment:'base',surcharges:[],commentary:{},parallelRuns:1,parallelQuantityMode:'total',reviewed:false,materialPrice:null});
  let line = newLine(), lineIndex = -1;
  let quantityInput = null;
  let expenseEditor = null;
  let search = {mode:'related',term:''};
  let host;
  let surchargeGroup='terrain';
  function factorSummary(a){return `${a.parallel.runs>1?'케이블 총길이 기준 · ':''}공종 해설 ×${a.specialFactor}${a.commentary.length?` × 해설 조건 ×${Number(a.commentaryFactor.toFixed(6))}`:''}${a.parallel.runs>1?` × 동시포설 (${a.parallel.bundleFactor} ÷ ${a.parallel.runs})`:''} × 품 (1 + ${Number(a.laborPercent.toFixed(4))}%) × 노임 (1 + ${a.wagePercent}%) = 노무비 ×${Number(a.factor.toFixed(6))} · 재료 ×${a.materialFactor}`;}
  function parallelSummary(selected){
    try{
      const p=Surcharges.parallel(selected,line),input=Estimator.number(quantityInput??line.length*line.count),total=input*p.quantityMultiplier;
      return `${p.runs}열 동시포설: 1열 경로길이 ${money(total/p.runs)}m / 케이블 총길이 ${money(total)}m. 노무 품은 경로길이 기준 ${Number((p.bundleFactor*100).toFixed(2))}% (×${p.bundleFactor}), 총길이 기준 ×${Number(p.perCableFactor.toFixed(6))}로 계산합니다.`;
    }catch(error){return error.message;}
  }
  function parallelEditor(selected){
    if(!Surcharges.supportsParallel(selected))return '';
    return `<fieldset class="surcharge-editor"><legend>꼬임케이블 동시포설 · UTP / STP / FTP 등</legend><div class="estimate-fields">
      <label class="field">동시포설 열 수<input name="parallelRuns" type="number" min="1" max="1000000" step="1" required value="${esc(line.parallelRuns??1)}"></label>
      <label class="field">수량 입력 기준<select name="parallelQuantityMode"><option value="total">케이블 총길이</option><option value="route" ${line.parallelQuantityMode==='route'?'selected':''}>1열 경로길이</option></select></label></div>
      <p>1열 100% · 2열 180% · 3열 260% · 4열 340% · 4열 초과는 1열당 80% 가산. <a href="src/reference/page-120.webp" target="_blank" rel="noopener">4-3-1 해설 ⑧ 원문</a></p>
      <output id="parallel-summary">${esc(parallelSummary(selected))}</output><p class="muted">예: 같은 경로 100m에 4열이면 총길이 400m 또는 경로길이 100m를 입력합니다. 재료비는 400m로 계산합니다. 길이·규격 또는 동시 시공 조건이 다른 구간은 행을 나누세요. 해설 계수 직접입력에는 동시포설 계수를 중복 포함하지 마세요.</p></fieldset>`;
  }

  function commentaryEditor(selected){
    if(!selected)return '';
    const info=Surcharges.commentary(selected);
    if(!info.groups.length&&!info.notes.length)return '';
    const values=line.commentary||{};
    const controls=info.groups.map(g=>g.type==='count'
      ?`<label class="field">${esc(g.name)}<input type="number" data-commentary="${esc(g.id)}" min="${g.min}" step="${g.step}" value="${esc(values[g.id]??g.min)}"><small>${esc(g.hint)}</small></label>`
      :`<label class="field">${esc(g.name)}<select data-commentary="${esc(g.id)}">${g.choices.map(c=>`<option value="${esc(c.id)}" ${(values[g.id]??'none')===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select><small>${esc(g.basis)}</small></label>`).join('');
    let summary='해설 조건 없음 (×1)';
    try{const r=Surcharges.commentaryFactors(selected,line);if(r.applied.length)summary=`${r.applied.map(a=>`${a.name} ×${Number(a.factor.toFixed(6))}`).join(' · ')} = 해설 조건 ×${Number(r.factor.toFixed(6))}`;}catch(error){summary=error.message;}
    return `<fieldset class="surcharge-editor"><legend>공종 해설 조건 · ${esc(selected.code)} (원문 ${info.page?`<a href="src/reference/page-${String(info.page+30).padStart(3,'0')}.webp" target="_blank" rel="noopener">인쇄 ${info.page}쪽</a>`:''})</legend>
      ${controls?`<div class="estimate-fields">${controls}</div>`:''}<output id="commentary-summary">${esc(summary)}</output>
      <p class="muted">서로 다른 해설 조건은 곱하여 기본 품에 반영한 뒤 공통 품 할증(1-2-2-15)을 적용합니다. 철거를 선택하면 재료 단가와 재료 할증은 입력할 수 없습니다.</p>
      ${info.notes.length?`<details><summary>별도 계상 · 다른 품셈 적용 조건</summary><ul>${info.notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul></details>`:''}</fieldset>`;
  }
  function surchargeEditor(selected){
    const groups=Surcharges.groups,choices=Surcharges.items.filter(i=>i.group===surchargeGroup);
    let summary='할증 없음';
    try{if(selected){summary=factorSummary(Surcharges.combined(selected,line));}}catch(error){summary=error.message;}
    return `<fieldset class="surcharge-editor"><legend>공통 품·노임·재료 할증 (복수 선택)</legend><p class="muted">공통 품 할증은 합산하고 노임 할증은 별도로 곱합니다. 적용 대상이 일부 수량·인력인 경우 행을 나누어 입력하세요.</p>
      <div class="toolbar"><label>할증 종류 <select id="surcharge-group">${groups.map(g=>`<option value="${g.id}" ${g.id===surchargeGroup?'selected':''}>${esc(g.name)} (${g.code})</option>`).join('')}</select></label>
      <label>세부 조건 <select id="surcharge-choice">${choices.map(i=>`<option value="${i.id}">${esc(i.name)}${i.rate==null?'':` · ${i.rate}%`}</option>`).join('')}</select></label><button type="button" id="surcharge-add">할증 추가</button></div>
      <div class="surcharge-list">${(line.surcharges||[]).map((s,i)=>{const item=Surcharges.items.find(x=>x.id===s.id);if(!item)return '<p class="error">알 수 없는 할증</p>';let calculated='입력 필요';try{calculated=Surcharges.resolve(s).rate.toLocaleString('ko-KR',{maximumFractionDigits:4})+'%';}catch{}
        return `<div class="surcharge-row"><div><b>${esc(item.name)}</b> <a href="src/reference/page-${String(item.page).padStart(3,'0')}.webp" target="_blank" rel="noopener">근거 ${item.code}</a><p class="muted">${esc(item.note||'같은 구분에서 하나만 선택합니다.')}</p></div>
        ${item.input?`<label class="field">${{percent:'할증률 (%)',height:'지상 높이 (m)',floor:'층수',hours:'왕복 이동시간 (시간)'}[item.input]}<input type="number" min="${item.min??0}" ${item.max!=null?`max="${item.max}"`:''} step="${item.input==='floor'?1:'any'}" data-surcharge-value="${i}" value="${esc(s.value)}" required></label>`:''}
        <label class="field">적용 근거${item.input==='percent'?' (필수)':' (선택)'}<input data-surcharge-note="${i}" value="${esc(s.note)}" ${item.input==='percent'?'required':''}></label><span>${calculated}${item.wageRate?' + 노임 50%':''}</span><button type="button" data-surcharge-remove="${i}">제거</button></div>`;
      }).join('')||'<p class="muted">선택한 공통 할증 없음 · 입력하지 않아도 저장됩니다.</p>'}</div><output id="surcharge-summary">${esc(summary)}</output>
      <p class="muted">중복가산 근거: 1-2-2-15. 공종별 해설의 추가 조건은 위 공종 해설 계수에서 직접 입력할 수 있습니다.</p></fieldset>`;
  }

  function field(label,name,value='',type='text',required=false) {
    return `<label class="field">${label}<input name="${name}" type="${type}" value="${esc(value)}" ${type==='number'?'min="0" step="any"':''} ${required?'required':''}></label>`;
  }

  function searchResults(standards) {
    if (!search.term) return '';
    const normalized = value => String(value ?? '').toLowerCase().replace(/\s+/g,'');
    const term = normalized(search.term);
    const results = [...standards.filter(s=>s.verified), ...root.standardCatalog.drafts].filter(s => {
      const fields = search.mode==='code'?[s.code]:search.mode==='name'?[s.name,s.spec]:[s.code,s.name,s.spec,...s.labor.map(l=>l.trade)];
      return fields.some(value=>normalized(value).includes(term));
    });
    return `<p class="muted">검색 결과 ${results.length.toLocaleString('ko-KR')}건${results.length>30?' · 처음 30건 표시':''}</p><div class="estimate-results">${results.slice(0,30).map(s=>`<div><span><b>${esc(s.code)} ${esc(s.name)}</b><small>${esc(s.spec)} · ${esc(s.unit||'단위 확인 필요')}</small></span><button type="button" ${s.verified?`data-estimate-standard="${esc(s.id)}">선택`:`data-estimate-draft="${esc(s.id)}">원문 대조·등록`}</button></div>`).join('')}</div>`;
  }

  function rowButtons(index,expense=false) {
    const type=expense?'expense':'line';
    return `<button data-estimate-edit-${type}="${index}">수정</button> <button data-estimate-copy-${type}="${index}">복사</button> <button data-estimate-delete-${type}="${index}">삭제</button>`;
  }

  function expenseSection(kind,rows) {
    const machine=kind==='machine';
    const active=expenseEditor?.row.kind===kind?expenseEditor:null;
    const row=active?.row||{};
    return `<section class="card estimate-panel"><h2>${machine?'기계경비':'기타경비'}</h2>
      <form data-estimate-expense="${kind}"><div class="estimate-fields">
      ${field(machine?'기계장비':'경비 항목','name',row.name,'text',true)}
      ${machine?field('규격','spec',row.spec)+field('사용시간','hours',row.hours,'number',true)+field('시간당 단가 (원)','unitPrice',row.unitPrice,'number',true):field('금액 (원)','amount',row.amount,'number',true)}
      ${field('산정 근거','source',row.source)}</div>
      <button type="submit">${active?'수정 저장':'경비 추가'}</button>${active?` <button type="button" id="estimate-cancel-expense">취소</button>`:''}</form>
      <div class="scroll"><table><thead><tr><th>항목</th>${machine?'<th>규격</th><th>시간</th><th>시간당 단가</th>':''}<th>금액 (원)</th><th>근거</th><th>관리</th></tr></thead><tbody>
      ${rows.map(({row,index})=>`<tr><td>${esc(row.name)}</td>${machine?`<td>${esc(row.spec)}</td><td>${esc(row.hours)}</td><td>${money(row.unitPrice)}</td>`:''}<td class="num">${money(row.amount)}</td><td>${esc(row.source)}</td><td class="estimate-row-actions">${rowButtons(index,true)}</td></tr>`).join('')||`<tr><td colspan="${machine?7:4}" class="muted">등록된 경비 없음</td></tr>`}
      </tbody></table></div></section>`;
  }

  function render(state,result) {
    const standards=state.standards.filter(s=>s.verified);
    const byId=new Map(standards.map(s=>[s.id,s]));
    const selected=byId.get(line.standardId);
    const materials=new Map(result.materials.filter(m=>m.quantityId).map(m=>[m.quantityId,m.amount]));
    const labor=new Map(result.labor.map(l=>[l.id,l.amount]));
    const expenseRows=result.expenseRows.map((row,index)=>({row,index}));
    return `<section class="card estimate-panel"><div class="estimate-section-head"><h2>기본입력</h2><button data-nav="1">공사정보 관리</button></div>
      <div class="estimate-project"><label class="field">공사명<input data-key="project.name" value="${esc(state.project.name)}"></label><label class="field">적용 기준일<input type="date" data-key="project.date" value="${esc(state.project.date)}"></label></div>
      <form id="estimate-search" class="toolbar"><select name="mode" aria-label="검색 구분"><option value="related">연관검색어</option><option value="code" ${search.mode==='code'?'selected':''}>품셈 번호</option><option value="name" ${search.mode==='name'?'selected':''}>공종·규격</option></select><input name="term" aria-label="품셈 검색어" value="${esc(search.term)}" placeholder="공종, 규격 또는 품셈 번호"><button type="submit">검색</button></form>
      ${searchResults(standards)}
      <form id="estimate-line"><div class="estimate-fields">
      <label class="field estimate-standard">공종·규격<select name="standardId" required><option value="">등록 품셈 선택</option>${standards.map(s=>`<option value="${esc(s.id)}" ${s.id===line.standardId?'selected':''}>${esc(s.code+' '+s.name+' · '+s.spec)}</option>`).join('')}</select></label>
      <label class="field">단위<input value="${esc(selected?.unit||'')}" readonly></label>
      ${field(Surcharges.supportsParallel(selected)?(line.parallelQuantityMode==='route'?'1열 경로길이 (m)':'케이블 총길이 (m)'):'수량','quantity',quantityInput??line.length*line.count,'number',true)}${field('재료 단가 (원/단위)','materialPrice',line.materialPrice,'number')}
      <label class="field">공종 해설 계수<select name="adjustment">${(selected?.adjustments||[{id:'base',name:'기본 조건',factor:1}]).map(a=>`<option value="${esc(a.id)}" ${a.id===line.adjustment?'selected':''}>${esc(a.name)} × ${a.factor}</option>`).join('')}<option value="custom" ${line.adjustment==='custom'?'selected':''}>해설 계수 직접입력</option></select></label>
      ${line.adjustment==='custom'?field('해설 적용 계수 (1 = 기본)','standardFactor',line.standardFactor,'number',true)+field('해설 계수 적용 근거','standardFactorBasis',line.standardFactorBasis,'text',true):''}
      ${field('재료 단가 출처','materialSource',line.materialSource)}
      </div>${selected?.conditions?`<details><summary>적용 조건</summary>${esc(selected.conditions)}</details>`:''}${commentaryEditor(selected)}${parallelEditor(selected)}${surchargeEditor(selected)}
      <div class="toolbar"><label><input type="checkbox" name="reviewed" ${line.reviewed?'checked':''}> 품셈·적용 조건 확인</label><button type="submit" class="primary">${lineIndex<0?'항목 저장':'수정 저장'}</button>${lineIndex<0?'':'<button type="button" id="estimate-cancel-line">취소</button>'}</div></form>
      <div class="scroll"><table><thead><tr><th>공종</th><th>규격</th><th>단위</th><th>수량</th><th>재료 단가</th><th>재료비</th><th>노무비</th><th>할증</th><th>관리</th></tr></thead><tbody>
      ${state.quantities.map((q,i)=>{const s=byId.get(q.standardId);let a;try{a=Surcharges.combined(s,q);}catch{}return `<tr><td>${esc(s?.name)}</td><td>${esc(s?.spec)}</td><td>${esc(s?.unit)}</td><td class="num">${money(q.length*q.count*(a?.parallel.quantityMultiplier??1))}${a?.parallel.runs>1?`<small>${a.parallel.runs}열 · 경로 ${money(q.length*q.count*(a.parallel.quantityMultiplier)/a.parallel.runs)}m</small>`:''}</td><td class="num">${q.materialPrice==null?'—':money(Number(q.materialPrice))}</td><td class="num">${money(materials.get(q.id)||0)}</td><td class="num">${labor.has(q.id)?money(labor.get(q.id)):'검토 필요'}</td><td><details><summary>${a?`${a.parallel.runs>1?a.parallel.runs+'열 · ':''}노무비 ×${Number(a.factor.toFixed(6))} / 재료 ×${a.materialFactor}`:'검토 필요'}</summary>${esc(a?.basis)}</details></td><td class="estimate-row-actions">${rowButtons(i)}</td></tr>`;}).join('')||'<tr><td colspan="9" class="muted">저장한 공종 없음</td></tr>'}
      </tbody></table></div></section>
      <div class="estimate-expenses">${expenseSection('machine',expenseRows.filter(x=>x.row.kind==='machine'))}${expenseSection('other',expenseRows.filter(x=>x.row.kind==='other'))}</div>
      <section class="card estimate-footer"><div><small>검토 중 공사비</small><strong>${money(result.total)}원</strong></div><div class="toolbar"><button data-nav="10">노임·제비율 설정</button><button class="primary" id="estimate-calculate">산정하기</button></div></section>`;
  }

  function choose(id) {
    line={...line,standardId:id,adjustment:'base',surcharges:[],commentary:{},parallelRuns:1,parallelQuantityMode:'total',reviewed:false};
  }

  function updateRow(collection,index,action) {
    const rows=host.getState()[collection];
    const row=rows[index];
    if (!row) return;
    if (action==='edit') {
      if(collection==='quantities'){line=structuredClone(row);lineIndex=index;quantityInput=null;}
      else expenseEditor={index,row:{...row}};
      if(collection==='quantities')host.openEstimate?.();
      host.refresh();
      document.querySelector(collection==='quantities'?'#estimate-line':`[data-estimate-expense="${row.kind}"]`)?.scrollIntoView({block:'nearest'});
      return;
    }
    host.update(collection,list=>{
      if(action==='copy')list.splice(index+1,0,{...structuredClone(row),id:crypto.randomUUID()});
      else list.splice(index,1);
    });
    if(collection==='quantities')resetLine();
    else expenseEditor=null;
    host.refresh();
  }

  document.addEventListener('submit',event=>{
    const form=event.target;
    const kind=form.dataset.estimateExpense;
    if (!['estimate-search','estimate-line'].includes(form.id) && !kind) return;
    event.preventDefault();
    try {
      const values=new FormData(form);
      const value=name=>String(values.get(name)??'').trim();
      if(form.id==='estimate-search') {
        search={mode:value('mode'),term:value('term')};
      } else if(form.id==='estimate-line') {
        const standard=host.getState().standards.find(s=>s.id===line.standardId&&s.verified);
        if(!standard)throw Error('공종·규격을 선택하세요.');
        const quantity=Estimator.number(value('quantity'));
        const changed=quantity!==line.length*line.count;
        const row={location:'',basis:'',note:'',...line,id:line.id||crypto.randomUUID(),
          length:changed?quantity:line.length,count:changed?1:line.count,
          materialPrice:value('materialPrice')===''?null:Estimator.number(value('materialPrice')),
          materialSource:value('materialSource'),adjustment:value('adjustment')||'base',reviewed:values.has('reviewed')};
        if(row.adjustment==='custom'){row.standardFactor=Estimator.number(value('standardFactor'));row.standardFactorBasis=value('standardFactorBasis');}
        row.commentary=Object.fromEntries(Object.entries(line.commentary||{}).filter(([,v])=>v!==''&&v!=null&&v!=='none'));
        if(Surcharges.supportsParallel(standard)){row.parallelRuns=Estimator.number(value('parallelRuns'));row.parallelQuantityMode=value('parallelQuantityMode');}
        Surcharges.combined(standard,row);
        host.update('quantities',rows=>{
          if(lineIndex<0)rows.push(row);
          else {
            const index=rows.findIndex(item=>item.id===row.id);
            if(index<0)throw Error('수정 중인 항목이 삭제되었습니다.');
            rows[index]=row;
          }
        });
        resetLine();
      } else {
        const name=value('name');
        if(!name)throw Error('경비 항목을 입력하세요.');
        const row={id:expenseEditor?.row.kind===kind?expenseEditor.row.id:crypto.randomUUID(),kind,name,source:value('source')};
        if(kind==='machine')Object.assign(row,{spec:value('spec'),hours:Estimator.number(value('hours')),unitPrice:Estimator.number(value('unitPrice'))});
        else row.amount=Estimator.number(value('amount'));
        host.update('expenses',rows=>{
          if(expenseEditor?.row.kind!==kind)rows.push(row);
          else {
            const index=rows.findIndex(item=>item.id===row.id);
            if(index<0)throw Error('수정 중인 경비가 삭제되었습니다.');
            rows[index]=row;
          }
        });
        expenseEditor=null;
      }
      host.message('');host.refresh();
    } catch(error){host.message(error.message);}
  });

  document.addEventListener('input',event=>{
    const target=event.target;
    if(target.form?.id!=='estimate-line')return;
    if(target.name==='quantity')quantityInput=target.value;
    if(target.name==='materialPrice')line.materialPrice=target.value===''?null:Number(target.value);
    if(target.name==='materialSource')line.materialSource=target.value;
    if(target.name==='adjustment')line.adjustment=target.value;
    if(target.name==='reviewed')line.reviewed=target.checked;
    if(target.name==='standardFactor')line.standardFactor=target.value;
    if(target.name==='standardFactorBasis')line.standardFactorBasis=target.value;
    if(target.name==='parallelRuns'){line.parallelRuns=target.value;line.reviewed=false;document.querySelector('#estimate-line [name="reviewed"]').checked=false;}
    if(target.dataset.surchargeValue!==undefined)line.surcharges[Number(target.dataset.surchargeValue)].value=target.value;
    if(target.dataset.surchargeNote!==undefined)line.surcharges[Number(target.dataset.surchargeNote)].note=target.value;
    if(target.dataset.commentary!==undefined){line.commentary={...(line.commentary||{}),[target.dataset.commentary]:target.value};line.reviewed=false;document.querySelector('#estimate-line [name="reviewed"]').checked=false;
      const standard=host.getState().standards.find(s=>s.id===line.standardId);
      try{const r=Surcharges.commentaryFactors(standard,line);document.querySelector('#commentary-summary').textContent=r.applied.length?`${r.applied.map(a=>`${a.name} ×${Number(a.factor.toFixed(6))}`).join(' · ')} = 해설 조건 ×${Number(r.factor.toFixed(6))}`:'해설 조건 없음 (×1)';}catch(error){document.querySelector('#commentary-summary').textContent=error.message;}
    }
    if(target.dataset.commentary!==undefined||target.dataset.surchargeValue!==undefined||target.dataset.surchargeNote!==undefined||['standardFactor','parallelRuns','quantity','materialPrice'].includes(target.name)){
      const standard=host.getState().standards.find(s=>s.id===line.standardId);
      try{document.querySelector('#surcharge-summary').textContent=factorSummary(Surcharges.combined(standard,line));}catch(error){document.querySelector('#surcharge-summary').textContent=error.message;}
      if(Surcharges.supportsParallel(standard))document.querySelector('#parallel-summary').textContent=parallelSummary(standard);
    }
  });
  document.addEventListener('change',event=>{
    if(event.target.form?.id==='estimate-line'&&event.target.name==='parallelQuantityMode'){
      const nextMode=event.target.value,oldMode=line.parallelQuantityMode??'total',runs=Number(line.parallelRuns??1),input=Number(quantityInput??line.length*line.count);
      if(oldMode!==nextMode&&Number.isInteger(runs)&&runs>0&&Number.isFinite(input))quantityInput=String(nextMode==='route'?input/runs:input*runs);
      line.parallelQuantityMode=nextMode;line.reviewed=false;host.refresh();
    }
    if(event.target.id==='surcharge-group'){surchargeGroup=event.target.value;host.refresh();}
    if(event.target.form?.id==='estimate-line'&&event.target.name==='adjustment'){line.adjustment=event.target.value;line.reviewed=false;host.refresh();}
    if(event.target.form?.id==='estimate-line'&&event.target.name==='standardId'){
      choose(event.target.value);host.refresh();
    }
  });
  document.addEventListener('click',event=>{
    const button=event.target.closest('button');
    if(!button||!host)return;
    try {
      if(button.id==='surcharge-add'){
        const id=document.querySelector('#surcharge-choice').value,item=Surcharges.items.find(i=>i.id===id);
        line.surcharges??=[];
        if(line.surcharges.some(s=>Surcharges.items.find(i=>i.id===s.id)?.exclusive===item.exclusive))throw Error('같은 구분의 할증이 있습니다. 기존 조건을 제거한 후 선택하세요.');
        line.surcharges.push({id,value:'',note:''});line.reviewed=false;host.message('');host.refresh();
      }
      if(button.dataset.surchargeRemove!==undefined){line.surcharges.splice(Number(button.dataset.surchargeRemove),1);line.reviewed=false;host.refresh();}
      if(button.dataset.estimateStandard){choose(button.dataset.estimateStandard);host.refresh();}
      if(button.dataset.estimateDraft)host.openDraft(button.dataset.estimateDraft);
      if(button.id==='estimate-cancel-line'){resetLine();host.refresh();}
      if(button.id==='estimate-cancel-expense'){expenseEditor=null;host.refresh();}
      if(button.id==='estimate-calculate')host.calculate();
      for(const action of ['edit','copy','delete']){
        const lineKey=button.dataset['estimate'+action[0].toUpperCase()+action.slice(1)+'Line'];
        const expenseKey=button.dataset['estimate'+action[0].toUpperCase()+action.slice(1)+'Expense'];
        if(lineKey!==undefined)updateRow('quantities',Number(lineKey),action);
        if(expenseKey!==undefined)updateRow('expenses',Number(expenseKey),action);
      }
    }catch(error){host.message(error.message);}
  });

  function resetLine(){line=newLine();lineIndex=-1;quantityInput=null;}
  root.EstimateUI={render,choose,connect:callbacks=>{host=callbacks;},reset(){resetLine();expenseEditor=null;}};
})(globalThis);
