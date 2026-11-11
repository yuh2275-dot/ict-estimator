(function (root) {
  'use strict';
  const data = root.standardCatalog;
  let host = null;
  let query = '';
  let chapter = '';
  let selected = null;
  let page = 33;
  let offset = 0;
  let editor = null;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sections = new Map(data.sections.map(s => [s.code, s]));
  sections.set('document',{code:'document',title:'전체 원문·부록',chapter:'전체',page:1,pdfPage:1,tableIds:[],draftIds:[],referenceOnly:true});
  const tables = new Map(data.tables.map(t => [t.id, t]));
  const drafts = new Map(data.drafts.map(d => [d.id, d]));
  const chapters = [...new Set(data.sections.map(s => s.chapter))];
  const index = data.sections.map(section => ({section, text: (section.code + ' ' + section.title + ' ' + data.pages.slice(section.pdfPage - 1, section.endPdfPage).map(p => p.text).join(' ')).toLowerCase().replace(/\s+/g, '')}));

  function matches() {
    const needle = query.toLowerCase().replace(/\s+/g, '');
    return index.filter(item => (!chapter || String(item.section.chapter) === chapter) && (!needle || item.text.includes(needle))).map(item => item.section);
  }

  function field(name, label, value, type = 'text') {
    return `<label class="field">${escape(label)}<input data-editor="${name}" type="${type}" value="${escape(value)}" ${type === 'number' ? 'min="0" step="any"' : ''}></label>`;
  }

  function editorView() {
    if (!editor) return '';
    return `<div class="card catalog-editor"><h2>계산항목 등록 · ${escape(editor.code)}</h2>
      <p>아래 값과 원문 이미지의 표·단위·해설을 대조하세요. 등록한 항목은 작업 JSON에 함께 저장됩니다.</p>
      <div class="grid">${field('name','공종',editor.name)}${field('spec','규격',editor.spec)}${field('unit','입력 수량 단위',editor.unit)}${field('baseQuantity','표의 기준수량',editor.baseQuantity,'number')}</div>
      <p class="muted">예를 들어 표가 10m당 품량이면 입력 단위는 m, 기준수량은 10입니다. 직종 이름은 노임단가표와 같아야 합니다.</p>
      <div class="scroll"><table><thead><tr><th>직종</th><th>기준수량당 기본품 (인)</th><th>행</th></tr></thead><tbody>${editor.labor.map((l,i)=>`<tr><td><input data-labor="${i}" data-field="trade" value="${escape(l.trade)}"></td><td><input type="number" min="0" step="any" data-labor="${i}" data-field="base" value="${escape(l.base)}"></td><td><button data-remove-labor="${i}">삭제</button></td></tr>`).join('')}</tbody></table></div>
      <button id="catalog-add-labor">직종 추가</button>
      ${field('conditions','적용 조건·포함 작업·별도 계상·제외 조건 (선택)',editor.conditions)}
      <label><input id="catalog-review" type="checkbox" ${editor.reviewed?'checked':''}> 표의 규격·직종·품량·기준단위와 해당 해설 및 공통 적용기준을 확인했습니다.</label>
      <p>할증이 없으면 적용 조건을 비워 두세요. 기본 품에 계수 1을 적용합니다.</p>
      <div class="toolbar"><button class="primary" id="catalog-commit">검토한 계산항목 등록</button><button id="catalog-cancel">편집 닫기</button></div></div>`;
  }

  function detailView(state) {
    if (!selected) return '<div class="card"><h2>전체 품셈 원문</h2><p>목록에서 품셈을 선택하면 표와 해설, 원문 이미지를 확인할 수 있습니다.</p><p>표를 자동으로 읽은 계산 후보는 단위·직종·규격·해설 대조 후 등록할 수 있습니다. 삭제된 항목은 등록을 차단합니다.</p></div>';
    const section = sections.get(selected);
    const candidates = section.draftIds.map(id=>drafts.get(id));
    const registered = state.standards.filter(s=>s.code===section.code);
    const original = data.pages[page-1];
    return `<div class="card"><span class="tag">${section.referenceOnly?'전체 문서':'제 '+section.chapter+'장'} · ${section.deleted?'삭제 항목':'원문 수록'}</span><h2>${section.referenceOnly?'':escape(section.code)} ${escape(section.title)}</h2>
      <p>인쇄면 ${section.page}쪽 · PDF ${section.pdfPage}쪽부터</p>
      <p>등록된 계산항목 ${registered.length}개 · 자동 추출 검토 후보 ${candidates.length}개</p>
      ${registered.map(s=>`<div class="toolbar"><span>${escape(s.name)} / ${escape(s.spec)} · ${s.baseQuantity}${escape(s.unit)}</span><button data-add-standard="${escape(s.id)}">수량에 추가</button></div>`).join('')}
      ${section.deleted?'<p class="error">원문에서 삭제된 항목입니다. 계산용으로 등록할 수 없습니다.</p>':section.referenceOnly?'':`<button id="catalog-new">원문에서 계산항목 등록</button>`}
      ${candidates.length?`<details open><summary>자동 추출 후보 · 원문 대조 필요</summary><div class="scroll"><table><thead><tr><th>규격</th><th>표의 기준단위</th><th>직종별 기본품</th><th>검토</th></tr></thead><tbody>${candidates.map(d=>`<tr><td>${escape(d.spec)}</td><td>${d.unitUnresolved?'단위 확인 필요':d.baseQuantity+escape(d.unit)}</td><td>${d.labor.map(l=>escape(l.trade)+' '+l.base).join(' / ')}</td><td><button data-review-draft="${d.id}">원문 대조·등록</button></td></tr>`).join('')}</tbody></table></div></details>`:''}
      ${editorView()}
      <div class="toolbar"><button id="catalog-page-prev" ${page===1?'disabled':''}>이전 쪽</button><label>PDF 쪽 <input id="catalog-page" type="number" min="1" max="${data.pageCount}" value="${page}"></label><button id="catalog-page-next" ${page===data.pageCount?'disabled':''}>다음 쪽</button><button id="catalog-home-page">품셈 시작 쪽</button></div>
      <p class="muted">해설이 다음 페이지에 이어질 수 있습니다. 표 위·아래의 주석과 제1장 공통 적용기준도 확인하세요. 이미지를 선택하면 확대합니다.</p>
      <button class="source-image" id="catalog-zoom" aria-label="원문 이미지 확대"><img src="src/reference/page-${String(page).padStart(3,'0')}.webp" alt="2026 정보통신공사 표준품셈 PDF ${page}쪽"></button>
      <details><summary>검색용 추출 텍스트 · PDF ${page}쪽</summary><pre>${escape(original.text)}</pre></details>
      <details><summary>원문 표 추출 결과</summary>${section.tableIds.map(id=>{const t=tables.get(id);return `<h3>PDF ${t.pdfPage}쪽 · ${escape(id)}</h3><div class="scroll"><table><tbody>${t.rows.map(row=>`<tr>${row.map(v=>`<td><pre>${escape(v)}</pre></td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}).join('') || '<p>이 항목에서 격자형 표를 자동 인식하지 못했거나 본문형 기준입니다. 원문 이미지를 확인하세요.</p>'}</details>
    </div>`;
  }

  function render(state) {
    const found = matches();
    const slice = found.slice(offset, offset+40);
    const matchingPages=query.trim()?data.pages.filter(p=>p.text.toLowerCase().replace(/\s+/g,'').includes(query.toLowerCase().replace(/\s+/g,''))):[];
    return `<div class="card"><h2>2026년 표준품셈 전체 자료</h2><p>원문 ${data.pageCount}쪽 · 목차 항목 ${data.sections.length}개 · 추출 표 ${data.tables.length}개</p><p class="muted">전체 본문·표·해설을 수록했습니다. 계산용 등록 ${state.standards.length}개 / 자동 추출 검토 후보 ${data.drafts.length}개. 원문 수록과 계산 검증 상태를 확인하세요.</p><button data-catalog-section="document">전체 원문·부록 보기</button></div>
      <div class="toolbar"><input id="catalog-search" value="${escape(query)}" placeholder="품셈 번호·공종·규격·본문 검색"><select id="catalog-chapter"><option value="">전체 장</option>${chapters.map(c=>`<option value="${c}" ${String(c)===chapter?'selected':''}>제 ${c}장</option>`).join('')}</select><button id="catalog-search-button">검색</button><span>${found.length}개 항목</span></div>
      ${matchingPages.length?`<details><summary>전체 문서 본문 일치 ${matchingPages.length}쪽</summary><div class="toolbar">${matchingPages.map(p=>`<button data-source-page="${p.pdfPage}">PDF ${p.pdfPage}쪽</button>`).join('')}</div></details>`:''}
      <div class="catalog-layout"><div class="catalog-list"><div class="toolbar"><button id="catalog-prev" ${offset===0?'disabled':''}>이전</button><span>${found.length?offset+1:0}–${Math.min(offset+40,found.length)}</span><button id="catalog-next" ${offset+40>=found.length?'disabled':''}>다음</button></div>${slice.map(s=>`<button class="catalog-item ${s.code===selected?'selected':''}" data-catalog-section="${s.code}"><b>${escape(s.code)}</b><span>${escape(s.title)}</span><small>p.${s.page} · ${s.deleted?'삭제':s.draftIds.length?'계산 후보 '+s.draftIds.length+'개':'원문 확인'}</small></button>`).join('')}</div><div id="catalog-detail">${detailView(state)}</div></div>`;
  }

  function refresh() { host.refresh(); }
  function startEditor(draft) {
    if (sections.get(selected).deleted || sections.get(selected).referenceOnly) throw Error('계산용 품셈 항목을 선택하세요.');
    editor = structuredClone(draft);
    editor.reviewed = false;
    page = editor.pdfPage;
    refresh();
    document.querySelector('.catalog-editor')?.scrollIntoView({block:'start'});
  }
  function commit() {
    if (!editor.reviewed) throw Error('원문 대조 확인이 필요합니다.');
    if (!editor.name.trim() || !editor.spec.trim() || !editor.unit.trim()) throw Error('공종·규격·단위를 입력하세요.');
    const baseQuantity=Estimator.number(editor.baseQuantity);
    if (!baseQuantity || !editor.labor.length) throw Error('기준수량과 직종별 기본품이 필요합니다.');
    const labor=editor.labor.map(l=>({trade:l.trade.trim(),base:Estimator.number(l.base)}));
    if (labor.some(l=>!l.trade) || new Set(labor.map(l=>l.trade)).size!==labor.length) throw Error('직종명 누락 또는 중복입니다.');
    if (!labor.some(l=>l.base>0)) throw Error('기본품을 입력하세요.');
    const standard={...editor,id:'reviewed-'+crypto.randomUUID(),baseQuantity,labor,conditions:editor.conditions?.trim()??'',unitUnresolved:false,verified:true,reviewStatus:'user-reviewed',reviewedAt:new Date().toISOString(),sourceHash:data.sha256};
    delete standard.reviewed;
    host.register(standard);
    editor=null;refresh();host.message('원문 대조한 계산항목을 등록했습니다. 해당 직종의 적용일 노임단가도 등록하세요.');
  }

  document.addEventListener('input',event=>{
    const t=event.target;
    if(t.id==='catalog-search')query=t.value;
    if(!editor)return;
    if(t.dataset.editor)editor[t.dataset.editor]=t.type==='number'?Number(t.value):t.value;
    if(t.dataset.labor!==undefined)editor.labor[Number(t.dataset.labor)][t.dataset.field]=t.type==='number'?Number(t.value):t.value;
    if(t.id==='catalog-review')editor.reviewed=t.checked;
  });
  document.addEventListener('change',event=>{
    const t=event.target;
    if(t.id==='catalog-chapter'){chapter=t.value;offset=0;refresh();}
    if(t.id==='catalog-page'){const value=Number(t.value);if(Number.isInteger(value)&&value>=1&&value<=data.pageCount){page=value;refresh();}}
  });
  document.addEventListener('keydown',event=>{if(event.target.id==='catalog-search'&&event.key==='Enter'){offset=0;refresh();}});
  document.addEventListener('click',event=>{
    const t=event.target.closest('button');if(!t||!host)return;
    try{
      if(t.dataset.catalogSection){selected=t.dataset.catalogSection;page=sections.get(selected).pdfPage;editor=null;refresh();}
      if(t.dataset.sourcePage){selected='document';page=Number(t.dataset.sourcePage);editor=null;refresh();}
      if(t.id==='catalog-search-button'){offset=0;refresh();}
      if(t.id==='catalog-prev'){offset=Math.max(0,offset-40);refresh();}
      if(t.id==='catalog-next'){offset+=40;refresh();}
      if(t.id==='catalog-page-prev'){page=Math.max(1,page-1);refresh();}
      if(t.id==='catalog-page-next'){page=Math.min(data.pageCount,page+1);refresh();}
      if(t.id==='catalog-home-page'){page=sections.get(selected).pdfPage;refresh();}
      if(t.dataset.reviewDraft)startEditor(drafts.get(t.dataset.reviewDraft));
      if(t.id==='catalog-new'){
        const s=sections.get(selected);
        startEditor({code:s.code,name:s.title,spec:'',unit:'',baseQuantity:1,labor:[{trade:'',base:0}],year:2026,version:'2026.1-user',source:data.source,page:s.page,pdfPage:s.pdfPage,conditions:'',included:'원문 해설 확인',excluded:'원문 해설 확인',separate:'원문 해설 확인',revised:'2026',adjustments:[{id:'base',name:'기본 조건',factor:1,basis:s.code+' 본문 표'}]});
      }
      if(t.id==='catalog-add-labor'){editor.labor.push({trade:'',base:0});refresh();}
      if(t.dataset.removeLabor!==undefined){editor.labor.splice(Number(t.dataset.removeLabor),1);refresh();}
      if(t.id==='catalog-commit')commit();
      if(t.id==='catalog-cancel'){editor=null;refresh();}
      if(t.id==='catalog-zoom')t.classList.toggle('zoomed');
    }catch(error){host.message(error.message);}
  });
  root.CatalogUI={render,connect:callbacks=>{host=callbacks;},openDraft(id){
    const draft=drafts.get(id);
    if(!draft)throw Error('품셈 후보를 찾을 수 없습니다.');
    selected=draft.code;
    startEditor(draft);
  }};
})(globalThis);
