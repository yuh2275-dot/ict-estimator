(function (root) {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = value => value.toLocaleString('ko-KR');
  const newLine = () => ({standardId:'',length:1,count:1,adjustment:'base',reviewed:false,materialPrice:null});
  let line = newLine(), lineIndex = -1;
  let quantityInput = null;
  let expenseEditor = null;
  let search = {mode:'related',term:''};
  let host;

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
      ${field('수량','quantity',quantityInput??line.length*line.count,'number',true)}${field('재료 단가 (원/단위)','materialPrice',line.materialPrice,'number')}
      <label class="field">할증<select name="adjustment">${(selected?.adjustments||[{id:'base',name:'할증 없음',factor:1}]).map(a=>`<option value="${esc(a.id)}" ${a.id===line.adjustment?'selected':''}>${a.id==='base'?'할증 없음':esc(a.name)} × ${a.factor}</option>`).join('')}</select></label>
      ${field('재료 단가 출처','materialSource',line.materialSource)}
      </div>${selected?.conditions?`<details><summary>적용 조건</summary>${esc(selected.conditions)}</details>`:''}
      <div class="toolbar"><label><input type="checkbox" name="reviewed" ${line.reviewed?'checked':''}> 품셈·적용 조건 확인</label><button type="submit" class="primary">${lineIndex<0?'항목 저장':'수정 저장'}</button>${lineIndex<0?'':'<button type="button" id="estimate-cancel-line">취소</button>'}</div></form>
      <div class="scroll"><table><thead><tr><th>공종</th><th>규격</th><th>단위</th><th>수량</th><th>재료 단가</th><th>재료비</th><th>노무비</th><th>할증</th><th>관리</th></tr></thead><tbody>
      ${state.quantities.map((q,i)=>{const s=byId.get(q.standardId);const adjustment=s?.adjustments.find(a=>a.id===q.adjustment);return `<tr><td>${esc(s?.name)}</td><td>${esc(s?.spec)}</td><td>${esc(s?.unit)}</td><td class="num">${money(q.length*q.count)}</td><td class="num">${q.materialPrice==null?'—':money(Number(q.materialPrice))}</td><td class="num">${money(materials.get(q.id)||0)}</td><td class="num">${labor.has(q.id)?money(labor.get(q.id)):'검토 필요'}</td><td>${adjustment?.id==='base'?'없음':esc(adjustment?.name||'')}</td><td class="estimate-row-actions">${rowButtons(i)}</td></tr>`;}).join('')||'<tr><td colspan="9" class="muted">저장한 공종 없음</td></tr>'}
      </tbody></table></div></section>
      <div class="estimate-expenses">${expenseSection('machine',expenseRows.filter(x=>x.row.kind==='machine'))}${expenseSection('other',expenseRows.filter(x=>x.row.kind==='other'))}</div>
      <section class="card estimate-footer"><div><small>검토 중 공사비</small><strong>${money(result.total)}원</strong></div><div class="toolbar"><button data-nav="10">노임·제비율 설정</button><button class="primary" id="estimate-calculate">산정하기</button></div></section>`;
  }

  function choose(id) {
    line={...line,standardId:id,adjustment:'base',reviewed:false};
  }

  function updateRow(collection,index,action) {
    const rows=host.getState()[collection];
    const row=rows[index];
    if (!row) return;
    if (action==='edit') {
      if(collection==='quantities'){line={...row};lineIndex=index;quantityInput=null;}
      else expenseEditor={index,row:{...row}};
      host.refresh();
      document.querySelector(collection==='quantities'?'#estimate-line':`[data-estimate-expense="${row.kind}"]`)?.scrollIntoView({block:'nearest'});
      return;
    }
    host.update(collection,list=>{
      if(action==='copy')list.splice(index+1,0,{...row,id:crypto.randomUUID()});
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
  });
  document.addEventListener('change',event=>{
    if(event.target.form?.id==='estimate-line'&&event.target.name==='standardId'){
      choose(event.target.value);host.refresh();
    }
  });
  document.addEventListener('click',event=>{
    const button=event.target.closest('button');
    if(!button||!host)return;
    try {
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
