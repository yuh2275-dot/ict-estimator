// 도면 물량 가져오기: 도면을 Claude·ChatGPT에 올려 받은 물량 JSON을 공사비 산정 수량 행으로 바꾼다.
// 사이트는 외부에 접속하지 않는다(CSP connect-src 'none'). AI 호출은 사용자가 직접 하고, 이 모듈은
// ① AI 요청문 생성 ② 답변(JSON) 해석·품셈 매칭 ③ 확인 필요 상태로 수량 행 추가만 담당한다.
(function(root){
  'use strict';
  const FORMAT='ict-estimator-takeoff';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=s=>String(s??'').toLowerCase().replace(/[\s·,./()\-_"“”'″″]+/g,'');
  const unitKey=u=>{const n=norm(u);return ({ea:'개',개:'개',개소:'개',대:'대',set:'세트',세트:'세트',m:'m',미터:'m',port:'port',포트:'port',구:'개',면:'면',본:'본'})[n]||n;};
  let host,preview=null,draftText='';
  const MIN_SCORE=4; // 규격 부분 일치(6) 또는 공종명 일치(3)+단위 일치(1) 이상

  // ---------- ① AI 요청문 ----------
  function standardsFor(state){return state.standards.filter(s=>s.verified&&Number(s.year)===Number(state.project.year));}
  function buildPrompt(state){
    const S=root.Surcharges;
    // 품셈 번호별로 묶어 규격을 나열한다(등록 품셈이 수백 건이어도 요청문이 지나치게 길어지지 않게).
    const byCode=new Map();
    for(const s of standardsFor(state)){if(!byCode.has(s.code))byCode.set(s.code,[]);byCode.get(s.code).push(s);}
    const lines=[...byCode.entries()].map(([code,list])=>{
      const first=list[0],units=[...new Set(list.map(s=>`${s.baseQuantity!==1?s.baseQuantity:''}${s.unit}`))].join('·');
      const adj=[...new Set(list.flatMap(s=>(s.adjustments||[]).filter(a=>a.id!=='base').map(a=>`${a.id}=${a.name}×${a.factor}`)))].join(', ');
      const groups=S?[...new Map(list.flatMap(s=>S.commentary(s).groups).map(g=>[g.id,g.type==='count'?`${g.id}(숫자 ${g.min}~, ${g.unit})`:`${g.id}(${g.choices.filter(c=>c.id!=='none').map(c=>c.id).join('|')})`])).values()].join(', '):'';
      return `- ${code} ${first.name} [품셈 단위 ${units}]${adj?` adjustment: ${adj}`:''}${groups?` commentary: ${groups}`:''}${list.some(s=>S?.supportsParallel(s))?' parallelRuns 가능':''}\n  규격: ${list.map(s=>s.id.startsWith('v')?s.spec:`${s.spec} (standardId "${s.id}")`).join(' / ')}`;
    });
    return `첨부한 정보통신공사 도면(평면도·계통도·범례·물량표)을 읽고, 아래 JSON 형식으로 물량을 뽑아 주세요.
이 결과는 "ICT Estimator" 공사비 산정 사이트의 [도면 물량 가져오기]에 붙여 넣어 2026년 정보통신공사 표준품셈으로 계산합니다.

## 규칙
1. JSON 하나만 출력하세요(설명은 JSON의 "assumptions"에). 코드블록으로 감싸도 됩니다.
2. 아래 "등록된 품셈"에 맞는 항목은 품셈 번호를 code에, 목록의 규격 문구를 spec에 **그대로 복사**하세요(standardId가 적힌 항목은 standardId도). 목록에 없는 공종은 2026 표준품셈 번호(code)·공종명(name)·규격(spec)을 쓰면 사이트가 원문 후보와 맞춥니다.
3. quantity는 그 품셈의 기본 단위(m, 개, 대, 개소, 코어 등)로 적습니다. "10m"·"100m"처럼 품셈 단위에 수가 붙어 있어도 quantity는 실제 m 수입니다. 케이블은 m(케이블 총길이), 콘센트·플러그·랙·패널은 개수입니다.
   - 정보콘센트는 콘센트 개수를 quantity로, 구수는 commentary {"ports": 구수}로 적습니다(사이트가 포트 수로 환산).
   - 같은 경로에 여러 가닥을 함께 포설하면 parallelRuns(열 수)를 적고 quantity는 케이블 총길이로 적습니다.
4. basis에 산출 근거(예: "(28m×4)+(25m×2)", "도면 2층 평면도 범례 기준")를, location에 층·실명을 적습니다.
5. 도면에서 읽을 수 없거나 추정한 값은 confidence를 "low"로 하고 assumptions에 이유를 적습니다. 단가·금액은 적지 마세요.
6. 설치 조건이 보이면 adjustment(설치 장소 등)와 commentary(해설 조건) 값을 아래 목록의 id로만 적습니다. 모르면 비워 두세요.
7. 철거 물량은 별도 항목으로 적고 commentary {"work":"remove_unused"} 또는 {"work":"remove_reuse"}를 씁니다.
8. 품셈 공종이 아닌 단순 자재(블랭크 패널, 풀박스 등)는 "materials"에 적습니다.

## 출력 형식
{
  "format": "${FORMAT}", "version": 1,
  "project": {"name": "공사명(도면 표제란)", "location": "위치", "summary": "공사개요; 항목은 ;로 구분"},
  "items": [
    {"standardId": "utp4", "code": "4-3-1", "name": "UTP 케이블 포설", "spec": "구내 4P", "unit": "m",
     "quantity": 355.5, "location": "1F", "basis": "(28m×4)+(25m×2)…", "materialName": "UTP 케이블", "materialSpec": "CAT.5E 4P",
     "adjustment": "tray", "commentary": {"bind": "tie"}, "parallelRuns": 1, "confidence": "high", "note": ""}
  ],
  "materials": [{"name": "블랭크 패널", "spec": "19\\" 1U", "unit": "EA", "quantity": 3, "note": ""}],
  "assumptions": ["도면 축척 1/100 기준으로 길이 산출", "…"]
}

## 등록된 품셈 (공사 기준연도 ${state.project.year})
${lines.join('\n')||'- (등록된 품셈 없음: code·name·spec으로 적어 주세요)'}
`;
  }

  // ---------- ② 답변 해석·매칭 ----------
  function parse(text){
    const raw=String(text||'').trim();
    if(!raw)throw Error('AI 답변을 붙여 넣으세요.');
    const fenced=raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    let body=fenced?fenced[1]:raw;
    if(!fenced){
      const ob=body.indexOf('{'),ab=body.indexOf('[');
      const [open,close]=ab>=0&&(ob<0||ab<ob)?['[',']']:['{','}'];
      const a=body.indexOf(open),b=body.lastIndexOf(close);if(a>=0&&b>a)body=body.slice(a,b+1);
    }
    let data;
    try{data=JSON.parse(body);}catch(e){throw Error('JSON을 읽을 수 없습니다. AI에게 "JSON만 다시 출력해 줘"라고 요청하세요. ('+e.message+')');}
    if(Array.isArray(data))data={items:data};
    if(!data||typeof data!=='object'||!Array.isArray(data.items))throw Error('"items" 목록이 없습니다. 요청문의 출력 형식을 따르도록 AI에게 다시 요청하세요.');
    if(data.items.length>2000)throw Error('항목이 너무 많습니다(최대 2,000건).');
    return data;
  }
  function score(item,s){
    const a=norm(item.spec),b=norm(s.spec),n1=norm(item.name),n2=norm(s.name);
    let v=0;
    if(a&&b&&a===b)v+=10;else if(a&&b&&(a.includes(b)||b.includes(a)))v+=6;
    else if(a&&b){const t=[...new Set(String(item.spec).split(/[\s/,·]+/).map(norm).filter(Boolean))];v+=t.filter(x=>b.includes(x)).length*2;}
    // 숫자(호칭·규격 치수)가 모두 같으면 가산: "16mm" ↔ "호칭 16"
    const nums=t=>(String(t).replace(/,(?=\d{3})/g,'').match(/\d+(?:\.\d+)?/g)||[]);
    const na=nums(item.spec),nb=nums(s.spec);
    if(na.length&&na.every(x=>nb.includes(x)))v+=3;else if(na.length&&nb.length&&!na.some(x=>nb.includes(x)))v-=3;
    if(n1&&n2&&(n1.includes(n2)||n2.includes(n1)))v+=3;
    if(n1&&b.includes(n1)&&n1.length>=2)v+=3; // 공종명(예: 합성수지전선관)이 규격에 들어 있으면 가산
    if(item.unit&&unitKey(item.unit)===unitKey(s.unit))v+=1;
    return v;
  }
  function pick(item,list){
    const ranked=list.map(s=>({s,v:score(item,s)})).sort((x,y)=>y.v-x.v);
    if(!ranked.length)return null;
    const [best,second]=ranked;
    return {standard:best.s,score:best.v,ambiguous:!!second&&second.v===best.v}; // 동점이면 항상 확인 필요
  }
  function match(state,data){
    const S=root.Surcharges,verified=standardsFor(state);
    const drafts=root.standardCatalog?.drafts||[];
    const rows=data.items.map((item,index)=>{
      const issues=[];let status='ok',standard=null,draft=null;
      const qty=Number(item.quantity);
      if(!(qty>0)||!Number.isFinite(qty))issues.push('수량이 없거나 0입니다.');
      if(item.standardId){standard=verified.find(s=>s.id===item.standardId)||null;if(!standard)issues.push(`등록되지 않은 standardId "${item.standardId}"입니다. 품셈 번호로 다시 찾습니다.`);}
      if(!standard&&item.code){
        // 같은 품셈 번호라도 규격·공종명이 비슷해야 연결한다(예: 4-3-3 110 Block을 패치패널에 붙이지 않음).
        const m=pick(item,verified.filter(s=>s.code===String(item.code).trim()));
        if(m&&m.score>=MIN_SCORE){standard=m.standard;if(norm(item.spec)!==norm(m.standard.spec)||m.ambiguous)issues.push(`규격이 정확히 맞지 않아 "${m.standard.spec}"로 연결했습니다${m.ambiguous?'(비슷한 규격이 여러 개)':''}. 확인하세요.`);}
      }
      if(!standard){
        const m=item.code?pick(item,drafts.filter(d=>d.code===String(item.code).trim())):null;
        if(m&&m.score>=MIN_SCORE){draft=m.standard;status='draft';issues.push(`원문 후보(${draft.code} ${draft.spec})를 품셈으로 등록해야 계산됩니다.`);}
        else{
          const section=item.code&&(root.standardCatalog?.sections||[]).find(x=>x.code===String(item.code).trim()&&!x.deleted);
          if(section){status='register';issues.push(`품셈 ${section.code} ${section.title}(인쇄 ${section.page}쪽)은 등록된 계산 항목이 없습니다. 공종 및 품셈 검색에서 "${item.spec||item.name}" 규격을 등록한 뒤 다시 미리보기 하세요.`);}
          else{status='unmatched';issues.push(item.code?`품셈 ${item.code}을(를) 원문에서 찾지 못했습니다.`:'품셈 번호(code)가 없습니다.');}
        }
      }
      const row={id:crypto.randomUUID(),standardId:standard?.id||'',location:String(item.location||'').slice(0,200),length:qty>0?qty:1,count:1,
        basis:String(item.basis||'').slice(0,2000),note:['AI 도면 해석',item.confidence?`신뢰도 ${item.confidence}`:'',item.note].filter(Boolean).join(' · ').slice(0,2000),
        adjustment:'base',reviewed:false,surcharges:[],commentary:{},materialName:String(item.materialName||'').slice(0,200),materialSpec:String(item.materialSpec||'').slice(0,200),materialPrice:null,materialSource:''};
      if(standard){
        if(item.unit&&unitKey(item.unit)!==unitKey(standard.unit))issues.push(`단위가 다릅니다(도면 ${item.unit} / 품셈 ${standard.unit}). 수량을 확인하세요.`);
        if(item.adjustment&&item.adjustment!=='base'){if(standard.adjustments.some(a=>a.id===item.adjustment))row.adjustment=item.adjustment;else issues.push(`설치 조건 "${item.adjustment}"는 이 품셈에 없어 제외했습니다.`);}
        if(item.commentary&&typeof item.commentary==='object'&&S){
          for(const [k,v] of Object.entries(item.commentary)){
            const test={...row.commentary,[k]:v};
            try{S.commentaryFactors(standard,{commentary:test});row.commentary=test;}catch(e){issues.push(`해설 조건 ${k}=${v} 제외: ${e.message}`);}
          }
        }
        if(item.parallelRuns&&Number(item.parallelRuns)>1){
          if(S?.supportsParallel(standard)){row.parallelRuns=Number(item.parallelRuns);row.parallelQuantityMode='total';}
          else issues.push('동시포설 열 수는 이 품셈에 적용하지 않아 제외했습니다.');
        }
        if(S){try{S.combined(standard,row);}catch(e){issues.push('조건 조합 오류: '+e.message);status='error';}}
      }
      if(item.confidence==='low')issues.push('AI가 추정한 값입니다(신뢰도 낮음).');
      if(status==='ok'&&issues.length)status='check';
      return {index,item,standard,draft,row,status,issues,selected:status==='ok'||status==='check'};
    });
    const materials=(Array.isArray(data.materials)?data.materials:[]).filter(m=>m&&m.name&&Number(m.quantity)>0).map(m=>({
      name:String(m.name).slice(0,200),spec:String(m.spec||'').slice(0,200),unit:String(m.unit||'EA').slice(0,20),price:0,quantity:Number(m.quantity),
      date:state.project.date,source:'AI 도면 해석 · 단가 입력 필요',note:String(m.note||'').slice(0,500)}));
    return {rows,materials,project:data.project&&typeof data.project==='object'?data.project:null,
      assumptions:(Array.isArray(data.assumptions)?data.assumptions:[]).map(String).slice(0,50)};
  }
  // ---------- ③ 추가 ----------
  function apply(state,result,{fillProject=true}={}){
    const next=structuredClone(state);
    const picked=result.rows.filter(r=>r.selected&&r.row.standardId);
    const R=root.MaterialRecipes,book=R?R.priceBook(state):null;
    next.quantities.push(...picked.map(r=>{const recipe=R&&r.standard?R.forStandard(r.standard)[0]:null;return recipe?R.apply(r.row,recipe,{book,ports:r.row.commentary?.ports}):r.row;}));
    if(result.includeMaterials!==false)next.materials.push(...result.materials);
    if(fillProject&&result.project)for(const k of ['name','location','summary'])if(!next.project[k]&&typeof result.project[k]==='string')next.project[k]=result.project[k].slice(0,500);
    return {next,added:picked.length,materials:result.includeMaterials!==false?result.materials.length:0};
  }

  // ---------- 화면 ----------
  const badge={ok:'<span class="tag">매칭</span>',check:'<span class="tag warn-tag">확인</span>',draft:'<span class="tag warn-tag">품셈 등록 필요</span>',register:'<span class="tag warn-tag">품셈 등록 필요</span>',unmatched:'<span class="error">매칭 실패</span>',error:'<span class="error">오류</span>'};
  function render(state){
    const p=preview;
    const table=p?`<div class="scroll"><table><thead><tr><th>추가</th><th>상태</th><th>도면 항목</th><th>연결된 품셈</th><th>수량</th><th>위치 / 근거</th><th>확인 사항</th></tr></thead><tbody>${p.rows.map((r,i)=>`<tr>
      <td><input type="checkbox" data-takeoff-row="${i}" ${r.selected?'checked':''} ${r.row.standardId&&r.status!=='error'?'':'disabled'}></td><td>${badge[r.status]}</td>
      <td>${esc([r.item.code,r.item.name,r.item.spec].filter(Boolean).join(' '))}</td>
      <td>${r.standard?esc(`${r.standard.code} ${r.standard.name} · ${r.standard.spec}`):r.draft?`${esc(r.draft.code+' '+r.draft.spec)} <button type="button" data-takeoff-draft="${esc(r.draft.id)}">품셈 등록</button>`:'—'}</td>
      <td class="num">${esc(r.item.quantity)} ${esc(r.standard?.unit||r.item.unit||'')}</td><td>${esc([r.row.location,r.row.basis].filter(Boolean).join(' / '))}</td>
      <td>${r.issues.length?`<ul>${r.issues.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}</td></tr>`).join('')}</tbody></table></div>
      ${p.materials.length?`<label><input type="checkbox" id="takeoff-materials" ${p.includeMaterials!==false?'checked':''}> 단순 자재 ${p.materials.length}건도 자재단가 관리에 추가 (${esc(p.materials.map(m=>m.name).join(', ').slice(0,200))}) · 단가는 0원으로 들어가니 입력하세요</label>`:''}
      ${p.project?`<label><input type="checkbox" id="takeoff-project" checked> 공사정보의 빈 칸 채우기 (${esc([p.project.name,p.project.location].filter(Boolean).join(' · '))})</label>`:''}
      ${p.assumptions.length?`<details><summary>AI가 적은 가정 ${p.assumptions.length}건</summary><ul>${p.assumptions.map(a=>`<li>${esc(a)}</li>`).join('')}</ul></details>`:''}
      <div class="toolbar"><button type="button" class="primary" id="takeoff-apply">선택한 ${p.rows.filter(r=>r.selected).length}건 수량 행에 추가</button><button type="button" id="takeoff-clear">미리보기 닫기</button></div>`:'';
    return `<section class="card estimate-panel"><details id="takeoff" ${p||draftText?'open':''}><summary><strong>도면 물량 가져오기</strong> <span class="muted">Claude·ChatGPT에 도면을 올려 물량을 받아 연결</span></summary>
      <ol class="muted"><li><button type="button" id="takeoff-copy">AI 요청문 복사</button> <button type="button" id="takeoff-save">요청문 파일로 저장</button> — 등록된 품셈 ${standardsFor(state).length}건과 입력 형식이 들어 있습니다.</li>
      <li>Claude 또는 ChatGPT에 도면(PDF·이미지)을 올리고 요청문을 붙여 넣습니다.</li><li>AI 답변 전체를 아래에 붙여 넣고 미리보기를 누릅니다. 추가된 행은 "확인 필요" 상태이며, 공사비 산정에서 확인 체크를 해야 엑셀로 저장됩니다.</li></ol>
      <textarea id="takeoff-input" rows="6" placeholder='AI 답변을 그대로 붙여 넣으세요 ({"format":"${FORMAT}", "items":[…]})'>${esc(draftText)}</textarea>
      <div class="toolbar"><button type="button" id="takeoff-preview">미리보기</button><span id="takeoff-status" role="status"></span></div>${table}</details></section>`;
  }
  const status=t=>{const el=document.querySelector('#takeoff-status');if(el)el.textContent=t;};
  if(typeof document!=='undefined'){
    document.addEventListener('input',e=>{if(e.target.id==='takeoff-input')draftText=e.target.value;});
    document.addEventListener('change',e=>{
      if(!preview)return;
      if(e.target.dataset?.takeoffRow!==undefined){preview.rows[Number(e.target.dataset.takeoffRow)].selected=e.target.checked;host.refresh();}
      if(e.target.id==='takeoff-materials'){preview.includeMaterials=e.target.checked;}
    });
    document.addEventListener('click',async e=>{
      const b=e.target.closest('button');if(!b||!host)return;
      try{
        if(b.id==='takeoff-copy'){const text=buildPrompt(host.getState());try{await navigator.clipboard.writeText(text);status('요청문을 복사했습니다. AI에 도면과 함께 붙여 넣으세요.');}catch{host.download(new Blob([text],{type:'text/plain'}),'AI 도면 해석 요청문.txt');status('클립보드를 쓸 수 없어 파일로 저장했습니다.');}}
        if(b.id==='takeoff-save'){host.download(new Blob([buildPrompt(host.getState())],{type:'text/plain'}),'AI 도면 해석 요청문.txt');}
        if(b.id==='takeoff-preview'){preview=match(host.getState(),parse(draftText));host.refresh();status(`${preview.rows.length}건을 읽었습니다.`);}
        if(b.id==='takeoff-clear'){preview=null;host.refresh();}
        if(b.dataset.takeoffDraft){host.openDraft(b.dataset.takeoffDraft);}
        if(b.id==='takeoff-apply'&&preview){
          const fill=document.querySelector('#takeoff-project')?.checked??false;
          const out=apply(host.getState(),preview,{fillProject:fill});
          if(!out.added&&!out.materials)throw Error('추가할 항목을 선택하세요.');
          host.replace(out.next);preview=null;draftText='';host.refresh();
          host.message(`도면에서 수량 행 ${out.added}건${out.materials?`, 자재 ${out.materials}건`:''}을 추가했습니다. 각 행의 수량·조건을 확인하고 "품셈·적용 조건 확인"을 체크하세요.`);
        }
      }catch(error){status(error.message);}
    });
  }
  root.Takeoff={FORMAT,buildPrompt,parse,match,apply,render,connect:h=>{host=h;}};
  if(typeof module!=='undefined')module.exports=root.Takeoff;
})(globalThis);
