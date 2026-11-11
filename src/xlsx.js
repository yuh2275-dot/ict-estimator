(function(root){
  'use strict';
  const parse = text => { const d=new DOMParser().parseFromString(text,'application/xml'); if(d.querySelector('parsererror')) throw Error('Excel XML 오류'); return d; };
  const nodes=(d,name)=>Array.from(d.getElementsByTagNameNS('*',name));
  const escape = v => String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  async function open(file){
    if(!file.name.toLowerCase().endsWith('.xlsx') || file.size>25*1024*1024) throw Error('25MB 이하 XLSX 파일을 선택하세요.');
    const zip=await JSZip.loadAsync(await file.arrayBuffer());
    const entries=Object.values(zip.files);
    if(entries.length>3000 || entries.reduce((n,e)=>n+(e._data?.uncompressedSize||0),0)>100*1024*1024) throw Error('압축 해제 허용 크기 초과');
    if(entries.some(e=>/vbaProject|embeddings|_xmlsignatures/i.test(e.name))) throw Error('매크로·임베디드 개체·서명이 포함된 파일은 지원하지 않습니다.');
    const warnings=[];
    for(const e of entries.filter(e=>e.name.endsWith('.rels'))){
      if(/TargetMode="External"/i.test(await e.async('string'))) warnings.push('원본에 외부 참조가 있습니다. 브라우저는 참조를 실행하지 않습니다. Excel에서 링크 업데이트를 선택하기 전 대상과 기관 정책을 검토하세요.');
    }
    const workbook=parse(await zip.file('xl/workbook.xml').async('string'));
    const relationships=parse(await zip.file('xl/_rels/workbook.xml.rels').async('string'));
    const sheets=[];
    const shared=zip.file('xl/sharedStrings.xml');
    const strings=shared?nodes(parse(await shared.async('string')),'si').map(si=>nodes(si,'t').map(t=>t.textContent).join('')):[];
    for(const s of nodes(workbook,'sheet')){
      const rel=nodes(relationships,'Relationship').find(r=>r.getAttribute('Id')===s.getAttribute('r:id'));
      let path=rel.getAttribute('Target'); path=path.startsWith('/')?path.slice(1):'xl/'+path;
      const xml=await zip.file(path).async('string'), d=parse(xml),cells={};
      for(const c of nodes(d,'c')){
        const v=nodes(c,'v')[0]?.textContent??'';
        cells[c.getAttribute('r')]={value:c.getAttribute('t')==='s'?strings[Number(v)]:c.getAttribute('t')==='inlineStr'?nodes(c,'t').map(t=>t.textContent).join(''):v,formula:nodes(c,'f')[0]?.textContent};
      }
      sheets.push({name:s.getAttribute('name'),path,xml,cells});
    }
    return {zip,sheets,warnings:[...new Set(warnings)]};
  }
  function patch(xml,address,value,formula){
    if(!/^[A-Z]{1,3}[1-9]\d*$/.test(address)) throw Error('셀 주소 오류');
    const pattern=new RegExp('<c\\b(?=[^>]*\\br="'+address+'")([^>]*?)(?:\\/>|>([\\s\\S]*?)<\\/c>)');
    const match=xml.match(pattern);
    if(!match) throw Error(address+' 셀이 없는 양식입니다.');
    if(match[2] && /<f[^>]*\bt="(?:array|dataTable)"/.test(match[2])) throw Error(address+' 배열·데이터표 수식 셀 수정 미지원');
    const attrs=match[1].replace(/\s+t="[^"]*"/g,'').replace(/\/$/,'');
    const cell=formula?'<c'+attrs+'><f>'+escape(formula)+'</f></c>':typeof value==='number'?'<c'+attrs+'><v>'+value+'</v></c>':'<c'+attrs+' t="inlineStr"><is><t xml:space="preserve">'+escape(value)+'</t></is></c>';
    return xml.replace(pattern,()=>cell);
  }
  const rateCells=['D9','D11','D12','D13','D14','D15','D16','D17','D18','D19','D22','D23','D25'];
  async function write(template,state,result){
    if(result.errors.length) throw Error('검토 항목을 먼저 해결하세요.');
    if(result.expenseRows?.length)throw Error('기계·기타경비가 포함된 작업은 공사원가계산의 엑셀 저장을 사용하세요.');
    if(result.materials.length>9 || result.labor.length>20) throw Error('빈 양식 입력 공간 초과 (재료 9행, 공종 20행)');
    const sheets=template.sheets.map(s=>({...s})),changes=[];
    const set=(name,cell,value,formula)=>{
      const s=sheets.find(s=>s.name===name); if(!s) throw Error('필수 시트 없음 · '+name);
      const before=s.cells[cell]?.formula;
      s.xml=patch(s.xml,cell,value,formula);
      if(before!==formula && (before||formula)) changes.push({sheet:name,cell,before:before||'',after:formula||String(value),reason:'입력값 연결 및 검토한 계산 기준 적용'});
    };
    const design=sheets.find(s=>s.name==='설계내역서');
    if(!design?.cells.F27?.formula || design.cells.A18?.value!=='2. 노무비') throw Error('이 내보내기는 제공된 빈내역 양식 전용입니다.');
    set('원가계산서','A3','공사명 : '+state.project.name);
    set('집계표','A5',state.project.name); set('자재단가산출기초','A2','',"원가계산서!A3");
    const rounding=state.rounding==='round'?'ROUND':'ROUNDDOWN';
    for(let i=0;i<9;i++){
      const r=8+i,m=result.materials[i];
      for(const [col,val] of Object.entries({A:m?.name||'',B:m?.spec||'',C:m?Number(m.quantity):'',D:m?.unit||'',E:m?Number(m.price):''})) set('설계내역서',col+r,val);
      set('설계내역서','F'+r,'',`IF(C${r}="","",${rounding}(C${r}*E${r},0))`);
      const j=4+i;
      for(const [col,val] of Object.entries({A:m?.name||'',B:m?.spec||'',C:m?.unit||'',D:m?Number(m.price):'',E:m?.source||''}))set('자재단가산출기초',col+j,val);
    }
    const tradeColumns={'통신내선공':'E','통신설비공':'G','통신외선공':'I','통신케이블공':'K','무선안테나공':'M','광케이블설치사':'O','H/W 시험사':'Q','S/W 시험사':'S','통신관련기사':'U','통신관련 산업기사':'W','통신관련기능사':'Y','보통인부':'AA','특별인부':'AC'};
    const activeTrades=new Set(result.labor.flatMap(row=>row.details.map(d=>d.trade)));
    const availableColumns=Object.entries(tradeColumns).filter(([trade])=>!activeTrades.has(trade));
    for(const trade of activeTrades){
      if(Object.hasOwn(tradeColumns,trade))continue;
      const available=availableColumns.shift();
      if(!available)throw Error('일위대가표 직종 열 용량을 초과했습니다.');
      delete tradeColumns[available[0]];
      tradeColumns[trade]=available[1];
      set('일위대가표',available[1]+'3',trade);
    }
    const trades={};
    for(let i=0;i<20;i++){
      const r=6+i,row=result.labor[i];
      for(const [col,val] of Object.entries({A:row?.standard.name||'',B:row?.standard.spec||'',C:row?.quantity??'',D:row?.standard.unit||'',AE:row?.standard.code||'',AF:row?row.adjustment.basis:''}))set('일위대가표',col+r,val);
      for(const [trade,col] of Object.entries(tradeColumns)){
        const detail=row?.details.find(d=>d.trade===trade);
        const next=col.length===1?String.fromCharCode(col.charCodeAt(0)+1):'A'+String.fromCharCode(col.charCodeAt(1)+1);
        set('일위대가표',col+r,detail?detail.base/row.standard.baseQuantity*row.adjustment.factor:0);
        set('일위대가표',next+r,'',`C${r}*${col}${r}`);
        if(detail) trades[trade]={column:next,wage:detail.wage};
      }
      if(row?.details.some(d=>!tradeColumns[d.trade]))throw Error('양식에서 지원하지 않는 직종');
      if(i<19){
        for(const [col,val] of Object.entries({A:row?.standard.name||'',B:row?.standard.spec||'',C:row?.quantity??'',D:row?.standard.unit||'',E:row?`${row.location} / ${row.length} × ${row.count} / ${row.basis}`:'',F:row?.note||''}))set('물량산출근거',col+(4+i),val);
      }else if(row)throw Error('물량산출근거는 19행까지 지원합니다.');
    }
    if(Object.keys(trades).length>7)throw Error('노무비 직종 7행 초과');
    for(let i=0;i<7;i++){
      const entry=Object.entries(trades)[i],r=19+i;
      set('설계내역서','A'+r,entry?.[0]||'');set('설계내역서','D'+r,entry?'인':'');
      set('설계내역서','C'+r,entry?'':0,entry?`일위대가표!${entry[1].column}26`:undefined);
      set('설계내역서','G'+r,entry?.[1].wage||0);
      set('설계내역서','H'+r,'',`${rounding}(C${r}*G${r},0)`);
    }
    const used=new Set();
    for(const rule of state.rates){if(!rateCells.includes(rule.cell)||used.has(rule.cell))throw Error('제비율 출력 셀 중복 또는 미지원');used.add(rule.cell);}
    for(const cell of rateCells){set('원가계산서',cell,0);set('원가계산서',cell.replace('D','E'),'검토 결과 제외');}
    const refs={material:'D7',directLabor:'D8',expense:'0'};
    for(const rule of state.rates){
      const formula=rule.enabled?`${rounding}((${rule.bases.map(b=>refs[b]).join('+')})*${Number(rule.rate)}/100,0)`:'0';
      if(formula.includes('undefined'))throw Error('제비율 참조 오류');
      set('원가계산서',rule.cell,'',formula);set('원가계산서',rule.cell.replace('D','E'),`${rule.name} · ${rule.rate}% · ${rule.source}`);refs[rule.id]=rule.cell;
    }
    set('원가계산서','D26','','SUM(D24:D25)');
    for(const sheet of sheets){
      const formulas=nodes(parse(sheet.xml),'f').filter(f=>f.getAttribute('t')==='shared');
      for(const f of formulas)if(!formulas.some(anchor=>anchor.getAttribute('si')===f.getAttribute('si')&&anchor.textContent))throw Error('공유 수식 기준 셀 보존 검증 실패');
    }
    const zip=await JSZip.loadAsync(await template.zip.generateAsync({type:'uint8array'}));
    for(const s of sheets)if(s.xml!==template.sheets.find(o=>o.path===s.path).xml)zip.file(s.path,s.xml);
    let wb=await zip.file('xl/workbook.xml').async('string');
    wb=wb.replace(/<calcPr\b[^>]*\/>/,'<calcPr calcId="0" fullCalcOnLoad="1" forceFullCalc="1"/>');
    if(!wb.includes('fullCalcOnLoad'))wb=wb.replace('</workbook>','<calcPr calcId="0" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>');
    zip.file('xl/workbook.xml',wb);
    return {blob:await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),changes};
  }
  async function writeEstimate(state,result){
    if(result.errors.length)throw Error('공사원가계산의 검토 항목을 먼저 해결하세요.');
    const linkedMaterials=new Map(result.materials.filter(m=>m.quantityId).map(m=>[m.quantityId,m]));
    const detail=result.labor.map(row=>{
      const material=linkedMaterials.get(row.id)?.amount||0;
      return [row.standard.code,row.standard.name,row.standard.spec,row.standard.unit,row.quantity,material,row.amount,0,material+row.amount,row.adjustment.basis];
    });
    for(const m of result.materials.filter(m=>!m.quantityId))detail.push(['',m.name,m.spec,m.unit,Number(m.quantity),m.amount,0,0,m.amount,m.source]);
    for(const row of result.expenseRows)detail.push(['',row.name,row.spec,row.kind==='machine'?'시간':'식',row.kind==='machine'?row.hours:1,0,0,row.amount,row.amount,row.source]);
    const rounding=result.directLabor-result.labor.reduce((sum,row)=>sum+row.amount,0);
    if(rounding)detail.push(['','노무비 원 단위 조정','','',0,0,rounding,0,rounding,'직종별 공량 합산 후 원 단위 처리']);
    const sheets=[
      ['공사원가계산서',[['비목','금액 (원)','요율 (%)','산정금액 (원)','산출 근거'],
        ['재료비',result.material],['직접노무비',result.directLabor],
        ...result.expenseRows.map(e=>[e.name,e.amount,'','',e.kind==='machine'?[`${e.hours}시간 × ${e.unitPrice}원`,e.source].filter(Boolean).join(' · '):e.source]),
        ...result.costs.map(c=>[c.name,c.amount,c.enabled?Number(c.rate):0,c.base,c.enabled?c.source:`적용 제외 · ${c.source}`]),
        ['총공사금액',result.total],[],['공사명',state.project.name],['적용 기준일',state.project.date]]],
      ['산출내역서',[['품셈 번호','공종·항목','규격','단위','수량','재료비','노무비','경비','합계','산출 근거'],...detail]],
      ['표준일위대가',[['품셈 번호','공종','규격','수량 단위','직종','기준수량','기본품','할증 계수','노임단가','단위당 노무비','단위당 재료 단가','근거'],...result.labor.flatMap(row=>row.details.map(d=>[
        row.standard.code,row.standard.name,row.standard.spec,row.standard.unit,d.trade,row.standard.baseQuantity,d.base,row.adjustment.factor,d.wage,d.base*row.adjustment.factor*d.wage/row.standard.baseQuantity,linkedMaterials.get(row.id)?.price??'',row.adjustment.basis]))]],
      ['자재단가표',[['품명','규격','단위','수량','단가','금액','단가 출처'],...result.materials.map(m=>[m.name,m.spec,m.unit,Number(m.quantity),Number(m.price),m.amount,m.source])]],
      ['노임단가표',[['직종','일 노임 (원)','적용 시작일','적용 종료일','근거'],...state.wages.map(w=>[w.trade,Number(w.price),w.from,w.to,w.source])]]
    ];
    const zip=new JSZip();
    const sheetNS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    const officeRel='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    const packageRel='http://schemas.openxmlformats.org/package/2006/relationships';
    zip.file('[Content_Types].xml',`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
    zip.file('_rels/.rels',`<Relationships xmlns="${packageRel}"><Relationship Id="rId1" Type="${officeRel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
    zip.file('xl/workbook.xml',`<workbook xmlns="${sheetNS}" xmlns:r="${officeRel}"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${sheets.map(([name],i)=>`<sheet name="${escape(name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`);
    zip.file('xl/_rels/workbook.xml.rels',`<Relationships xmlns="${packageRel}">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="${officeRel}/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}</Relationships>`);
    for(const [i,[,rows]] of sheets.entries()){
      const data=rows.map((row,j)=>`<row r="${j+1}">${row.map((value,col)=>{
        const ref=String.fromCharCode(65+col)+(j+1);
        if(typeof value==='number'&&Number.isFinite(value))return `<c r="${ref}"><v>${value}</v></c>`;
        return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escape(String(value??'').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,''))}</t></is></c>`;
      }).join('')}</row>`).join('');
      zip.file(`xl/worksheets/sheet${i+1}.xml`,`<worksheet xmlns="${sheetNS}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="${rows[0].length}" width="23" customWidth="1"/></cols><sheetData>${data}</sheetData></worksheet>`);
    }
    return zip.generateAsync({type:'blob',compression:'DEFLATE',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }
  root.ExcelIO={open,write,writeEstimate,patch,rateCells};
})(globalThis);
