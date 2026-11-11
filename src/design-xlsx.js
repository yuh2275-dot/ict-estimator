// 설계내역서 통합문서: 표지 · 원가계산서 · 집계표 · 설계내역서 · 일위대가표 · 물량산출근거 · 인건비산출기초 · 자재단가산출기초.
// 시트끼리 수식으로 연결하고(물량·단가·노임을 바꾸면 Excel에서 재계산), 각 수식 셀에는 앱 계산값을 캐시로 넣는다.
(function(root){
  'use strict';
  const NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const OREL='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const PREL='http://schemas.openxmlformats.org/package/2006/relationships';
  const TRADES=['통신내선공','통신설비공','통신외선공','통신케이블공','무선안테나공','광케이블설치사','H/W 시험사','S/W 시험사','통신관련기사','통신관련 산업기사','통신관련기능사','보통인부','특별인부'];
  const xmlText=v=>String(v??'').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const colName=n=>{let s='';for(n++;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
  const colIndex=s=>[...s].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1;
  const num=v=>Number(Number(v).toPrecision(12));

  // 스타일 번호
  const S={plain:0,title:1,head:2,text:3,center:4,money:5,decimal:6,totalLabel:7,totalMoney:8,section:9,cover:10,coverText:11,qty:12,coverBox:13,coverAmount:14,note:15,totalDecimal:16,label:17};
  const STYLES=`<styleSheet xmlns="${NS}"><numFmts count="3"><numFmt numFmtId="164" formatCode="#,##0"/><numFmt numFmtId="165" formatCode="#,##0.0000##"/><numFmt numFmtId="166" formatCode="#,##0.###"/></numFmts>
<fonts count="5"><font><sz val="10"/><name val="맑은 고딕"/></font><font><b/><sz val="10"/><name val="맑은 고딕"/></font><font><b/><sz val="18"/><name val="맑은 고딕"/></font><font><b/><sz val="24"/><name val="맑은 고딕"/></font><font><b/><sz val="14"/><name val="맑은 고딕"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDDE6F0"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/></patternFill></fill></fills>
<borders count="2"><border/><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="18">
<xf fontId="0"/>
<xf fontId="2" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf fontId="0" borderId="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf fontId="0" borderId="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf fontId="0" borderId="1" numFmtId="164" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf fontId="0" borderId="1" numFmtId="165" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf fontId="1" fillId="3" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf fontId="1" fillId="3" borderId="1" numFmtId="164" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf fontId="1" borderId="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf fontId="3" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf fontId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf fontId="0" borderId="1" numFmtId="166" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf fontId="1" borderId="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf fontId="4" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf fontId="0" applyAlignment="1"><alignment vertical="center"/></xf>
<xf fontId="1" fillId="3" borderId="1" numFmtId="165" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf fontId="1" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf>
</cellXfs></styleSheet>`;

  function sheet(name){
    const cells=new Map(),merges=[],heights={};let widths=[];
    const api={name,cells,merges,heights,
      set(ref,value,style=S.text,formula){cells.set(ref,{value,style,formula});return api;},
      merge(range,style){merges.push(range);if(style!=null){const [a,b]=range.split(':'),[,c1,r1]=a.match(/([A-Z]+)(\d+)/),[,c2,r2]=b.match(/([A-Z]+)(\d+)/);for(let r=+r1;r<=+r2;r++)for(let c=colIndex(c1);c<=colIndex(c2);c++){const ref=colName(c)+r;if(!cells.has(ref))cells.set(ref,{value:null,style});}}return api;},
      widths(list){widths=list;return api;},height(row,h){heights[row]=h;return api;},
      xml(landscape=true){
        const rows=new Map();
        for(const [ref,cell] of cells){const r=+ref.match(/\d+/)[0];if(!rows.has(r))rows.set(r,[]);rows.get(r).push([ref,cell]);}
        const body=[...rows.keys()].sort((a,b)=>a-b).map(r=>`<row r="${r}"${heights[r]?` ht="${heights[r]}" customHeight="1"`:''}>${rows.get(r).sort((a,b)=>colIndex(a[0].match(/[A-Z]+/)[0])-colIndex(b[0].match(/[A-Z]+/)[0])).map(([ref,c])=>cellXml(ref,c)).join('')}</row>`).join('');
        const cols=widths.length?`<cols>${widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols>`:'';
        return `<worksheet xmlns="${NS}" xmlns:r="${OREL}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="16.5"/>${cols}<sheetData>${body}</sheetData>${merges.length?`<mergeCells count="${merges.length}">${merges.map(m=>`<mergeCell ref="${m}"/>`).join('')}</mergeCells>`:''}<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="${landscape?'landscape':'portrait'}" fitToWidth="1" fitToHeight="0"/></worksheet>`;
      }};
    return api;
  }
  function cellXml(ref,{value,style,formula}){
    const s=style?` s="${style}"`:'';
    if(formula){
      if(typeof value==='number'&&Number.isFinite(value))return `<c r="${ref}"${s}><f>${xmlText(formula)}</f><v>${num(value)}</v></c>`;
      if(value==null||value==='')return `<c r="${ref}"${s}><f>${xmlText(formula)}</f></c>`;
      return `<c r="${ref}"${s} t="str"><f>${xmlText(formula)}</f><v>${xmlText(value)}</v></c>`;
    }
    if(value==null||value==='')return `<c r="${ref}"${s}/>`;
    if(typeof value==='number'&&Number.isFinite(value))return `<c r="${ref}"${s}><v>${num(value)}</v></c>`;
    return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xmlText(value)}</t></is></c>`;
  }

  // Excel NUMBERSTRING(n,1)과 같은 한글 금액 읽기 (예: 12,345 → 일만이천삼백사십오)
  function koreanAmount(n){
    n=Math.floor(Math.abs(n));if(!n)return '영';
    const digits='영일이삼사오육칠팔구',small=['','십','백','천'],big=['','만','억','조','경'];
    let out='',unit=0;
    while(n>0){
      const part=n%10000;
      if(part){let text='';String(part).padStart(4,'0').split('').forEach((d,i)=>{if(d!=='0')text+=digits[d]+small[3-i];});out=text+big[unit]+out;}
      n=Math.floor(n/10000);unit++;
    }
    return out;
  }

  function build(state,result){
    if(result.errors.length)throw Error('공사원가계산의 검토 항목을 먼저 해결하세요.');
    const project=state.project||{},title=project.name||'정보통신공사';
    const RD=state.rounding==='round'?'ROUND':'ROUNDDOWN';
    const round=n=>state.rounding==='round'?Math.round(n+Number.EPSILON):Math.floor(n+1e-8);
    const linked=new Map(result.materials.filter(m=>m.quantityId).map(m=>[m.quantityId,m]));
    const looseMaterials=result.materials.filter(m=>!m.quantityId);

    // ---------- 물량산출근거 ----------
    const qs=sheet('물량산출근거').widths([24,26,11,8,46,24]);
    qs.set('A1','물   량   산   출   서',S.title).merge('A1:F1').height(1,30);
    qs.set('A2',`공사명 : ${title}`,S.note,'원가계산서!A3').merge('A2:F2');
    ['공 정 별','규  격','수  량','단  위','산 출 근 거','비  고'].forEach((h,i)=>qs.set(colName(i)+'3',h,S.head));
    const qtyRef=new Map();let r=4;
    for(const row of result.labor){
      const q=state.quantities.find(x=>x.id===row.id)||row,p=row.adjustment.parallel;
      const basis=[q.basis,Number(q.count)!==1?`${num(q.length)} × ${num(q.count)}`:''].filter(Boolean).join(' / ');
      const note=[q.location,p.runs>1?`${p.runs}열 동시포설 · 1열 경로 ${num(row.routeLength)}m`:'',q.note].filter(Boolean).join(' · ');
      qs.set('A'+r,row.standard.name).set('B'+r,row.standard.spec).set('C'+r,num(row.quantity),S.qty).set('D'+r,row.standard.unit,S.center).set('E'+r,basis).set('F'+r,note);
      qtyRef.set(row.id,'C'+r);r++;
    }
    for(const m of looseMaterials){
      qs.set('A'+r,m.name).set('B'+r,m.spec).set('C'+r,num(Number(m.quantity)),S.qty).set('D'+r,m.unit,S.center).set('E'+r,'').set('F'+r,'');
      qtyRef.set(m,'C'+r);r++;
    }
    mergeRuns(qs,4,r-1);

    // ---------- 자재단가산출기초 ----------
    const ms=sheet('자재단가산출기초').widths([24,26,8,14,46]);
    ms.set('A1','자   재   단   가   표',S.title).merge('A1:E1').height(1,30);
    ms.set('A2',`공사명 : ${title}`,S.note,'원가계산서!A3').merge('A2:E2');
    ['품   명','규   격','단   위','단   가','비   고'].forEach((h,i)=>ms.set(colName(i)+'3',h,S.head));
    const materials=[...result.labor.filter(l=>linked.has(l.id)).map(l=>({m:linked.get(l.id),row:l})),...looseMaterials.map(m=>({m,row:null}))];
    const priceRef=new Map();r=4;
    for(const {m,row} of materials){
      ms.set('A'+r,row?row.standard.name:m.name).set('B'+r,row?row.standard.spec:m.spec).set('C'+r,row?row.standard.unit:m.unit,S.center).set('D'+r,num(Number(m.price)),S.money).set('E'+r,String(m.source||'').replace(/ · 재료 할증.*$/,''));
      priceRef.set(m,'D'+r);r++;
    }
    mergeRuns(ms,4,r-1);

    // ---------- 인건비산출기초 ----------
    const ws=sheet('인건비산출기초').widths([8,22,18,52]);
    const wages=[...new Map(state.wages.filter(w=>w.from<=project.date&&w.to>=project.date).map(w=>[w.trade,w])).values()];
    ws.set('A1',`${project.year||String(project.date||'').slice(0,4)}년 적용 시중노임단가표`,S.title).merge('A1:D1').height(1,30);
    ws.set('A3',`적용 기준일 : ${project.date||''}`,S.note).merge('A3:D3');
    ['번호','직  종','시중노임 (원/일)','비  고 (근거 · 적용기간)'].forEach((h,i)=>ws.set(colName(i)+'5',h,S.head));
    wages.forEach((w,i)=>ws.set('A'+(6+i),i+1,S.center).set('B'+(6+i),w.trade,S.center).set('C'+(6+i),num(Number(w.price)),S.money).set('D'+(6+i),`${w.source} (${w.from} ~ ${w.to})`));
    const wageRange=`인건비산출기초!$B$6:$C$${Math.max(6,5+wages.length)}`;

    // ---------- 일위대가표 ----------
    const used=new Set(result.labor.flatMap(l=>l.details.map(d=>d.trade)));
    const trades=[...TRADES,...[...used].filter(t=>!TRADES.includes(t))];
    const tcol=new Map(trades.map((t,i)=>[t,4+i*2]));
    const codeCol=4+trades.length*2,noteCol=codeCol+1,last=colName(noteCol);
    const us=sheet('일위대가표').widths([24,22,9,8,...trades.flatMap(()=>[8,9]),10,46]);
    us.set('A1','일    위    대    가    표',S.title).merge(`A1:${last}1`).height(1,30);
    us.set('A2',`공사명 : ${title}`,S.note,'원가계산서!A3').merge(`A2:${last}2`);
    for(const [i,h] of ['품       명','규     격','수량','단위'].entries())us.set(colName(i)+'3',h,S.head).merge(`${colName(i)}3:${colName(i)}4`,S.head);
    for(const t of trades){const c=tcol.get(t);us.set(colName(c)+'3',t,S.head).merge(`${colName(c)}3:${colName(c+1)}3`,S.head).set(colName(c)+'4','품셈',S.head).set(colName(c+1)+'4','공량',S.head);}
    us.set(colName(codeCol)+'3','품셈 번호',S.head).merge(`${colName(codeCol)}3:${colName(codeCol)}4`,S.head).set(last+'3','할증·해설 근거',S.head).merge(`${last}3:${last}4`,S.head);
    us.set('A5',title,S.section).merge(`A5:${last}5`,S.section);
    const tradeTotal=new Map();r=6;const first=r;
    for(const row of result.labor){
      const a=row.adjustment,bq=Number(row.standard.baseQuantity),factor=a.laborFactor*a.wageFactor;
      us.set('A'+r,row.standard.name).set('B'+r,row.standard.spec).set('C'+r,num(row.quantity),S.qty,`물량산출근거!${qtyRef.get(row.id)}`).set('D'+r,bq!==1?`${num(bq)}${row.standard.unit}`:row.standard.unit,S.center);
      for(const t of trades){const c=tcol.get(t);us.set(colName(c)+r,null,S.decimal).set(colName(c+1)+r,null,S.decimal);}
      for(const d of row.details){
        const c=tcol.get(d.trade),pc=colName(c)+r,perUnit=d.base*factor;
        us.set(pc,num(perUnit),S.decimal,num(factor)===1?undefined:`${num(d.base)}*${num(factor)}`);
        if(num(factor)===1)us.set(pc,num(d.base),S.decimal);
        us.set(colName(c+1)+r,d.manDays*a.wageFactor,S.decimal,`${pc}*C${r}${bq!==1?'/'+num(bq):''}`);
        tradeTotal.set(d.trade,(tradeTotal.get(d.trade)||0)+d.manDays*a.wageFactor);
      }
      us.set(colName(codeCol)+r,row.standard.code,S.center);
      us.set(last+r,[a.basis,a.wageFactor!==1?`노임 할증 ×${num(a.wageFactor)}는 품셈에 포함 (공량 = 노임 환산)`:''].filter(Boolean).join(' / '));
      r++;
    }
    const totalRow=r;
    us.set('A'+r,'공량 합계',S.totalLabel).merge(`A${r}:D${r}`,S.totalLabel);
    for(const t of trades){const c=tcol.get(t);us.set(colName(c)+r,null,S.totalLabel).set(colName(c+1)+r,tradeTotal.get(t)||0,S.totalDecimal,`SUM(${colName(c+1)}${first}:${colName(c+1)}${Math.max(first,r-1)})`);}
    us.set(colName(codeCol)+r,null,S.totalLabel).set(last+r,null,S.totalLabel);
    mergeRuns(us,first,r-1);

    // ---------- 설계내역서 ----------
    const ds=sheet('설계내역서').widths([24,26,10,7,12,14,12,14,15,36]);
    ds.set('A1','설  계  내  역  서',S.title).merge('A1:J2');
    ds.set('A4',`공사명 : ${title}`,S.note,'원가계산서!A3').merge('A4:F4');
    for(const [c,h] of [['A','품      명'],['B','규   격'],['C','수량'],['D','단위'],['I','합   계'],['J','비   고']])ds.set(c+'5',h,S.head).merge(`${c}5:${c}6`,S.head);
    ds.set('E5','직 접 재 료 비',S.head).merge('E5:F5',S.head).set('G5','직 접 노 무 비',S.head).merge('G5:H5',S.head);
    for(const [c,h] of [['E','단   가'],['F','금   액'],['G','단   가'],['H','금   액']])ds.set(c+'6',h,S.head);
    const blankRow=row=>{for(const c of 'ABCDEFGHIJ')if(!ds.cells.has(c+row))ds.set(c+row,null,S.text);};
    r=7;ds.set('A'+r,'1. 재료비',S.section);blankRow(r);r++;
    const matStart=r;
    for(const {m,row} of materials){
      const factor=row?Number(m.materialFactor||1):1,q=qtyRef.get(row?row.id:m),qty=Number(m.quantity);
      ds.set('A'+r,row?row.standard.name:m.name).set('B'+r,row?row.standard.spec:m.spec)
        .set('C'+r,num(qty),S.qty,`물량산출근거!${q}${factor!==1?'*'+num(factor):''}`).set('D'+r,row?row.standard.unit:m.unit,S.center)
        .set('E'+r,num(Number(m.price)),S.money,`자재단가산출기초!${priceRef.get(m)}`).set('F'+r,m.amount,S.money,`${RD}(C${r}*E${r},0)`)
        .set('I'+r,m.amount,S.money,`F${r}`).set('J'+r,factor!==1?`재료 할증 ${num((factor-1)*100)}% (1-1-6)`:'');
      blankRow(r);r++;
    }
    mergeRuns(ds,matStart,r-1);
    const matSub=r;
    ds.set('A'+r,'소   계',S.totalLabel).merge(`A${r}:E${r}`,S.totalLabel).set('F'+r,result.material,S.totalMoney,`SUM(F${matStart}:F${Math.max(matStart,r-1)})`).set('G'+r,null,S.totalLabel).set('H'+r,null,S.totalLabel).set('I'+r,result.material,S.totalMoney,`F${r}`).set('J'+r,null,S.totalLabel);r++;
    ds.set('A'+r,'2. 노무비',S.section);blankRow(r);r++;
    const labStart=r;
    for(const t of trades.filter(t=>used.has(t))){
      const c=colName(tcol.get(t)+1),wage=Number(wages.find(w=>w.trade===t)?.price||0),manDays=tradeTotal.get(t)||0,amount=round(manDays*wage);
      ds.set('A'+r,'노   무   비',S.center).set('B'+r,t,S.center).set('C'+r,manDays,S.decimal,`일위대가표!${c}${totalRow}`).set('D'+r,'인',S.center)
        .set('G'+r,wage,S.money,`VLOOKUP(B${r},${wageRange},2,0)`).set('H'+r,amount,S.money,`${RD}(C${r}*G${r},0)`).set('I'+r,amount,S.money,`H${r}`);
      blankRow(r);r++;
    }
    if(r>labStart+1)ds.merge(`A${labStart}:A${r-1}`);
    const labSub=r;
    ds.set('A'+r,'소   계',S.totalLabel).merge(`A${r}:G${r}`,S.totalLabel).set('H'+r,result.directLabor,S.totalMoney,`SUM(H${labStart}:H${Math.max(labStart,r-1)})`).set('I'+r,result.directLabor,S.totalMoney,`H${r}`).set('J'+r,null,S.totalLabel);r++;
    let expSub=null;
    if(result.expenseRows.length){
      ds.set('A'+r,'3. 경비',S.section);blankRow(r);r++;
      const expStart=r;
      for(const e of result.expenseRows){
        const machine=e.kind==='machine';
        ds.set('A'+r,e.name).set('B'+r,e.spec||(machine?'기계경비':'기타경비')).set('C'+r,machine?num(Number(e.hours)):1,S.qty).set('D'+r,machine?'시간':'식',S.center)
          .set('I'+r,e.amount,S.money,machine?`${RD}(C${r}*${num(Number(e.unitPrice))},0)`:undefined).set('J'+r,[machine?`시간당 ${Number(e.unitPrice).toLocaleString('ko-KR')}원`:'',e.source].filter(Boolean).join(' · '));
        blankRow(r);r++;
      }
      expSub=r;
      ds.set('A'+r,'소   계',S.totalLabel).merge(`A${r}:H${r}`,S.totalLabel).set('I'+r,result.expense,S.totalMoney,`SUM(I${expStart}:I${r-1})`).set('J'+r,null,S.totalLabel);r++;
    }
    const grand=r;
    ds.set('A'+r,'합   계',S.totalLabel).merge(`A${r}:E${r}`,S.totalLabel).set('F'+r,result.material,S.totalMoney,`F${matSub}`).set('G'+r,null,S.totalLabel).set('H'+r,result.directLabor,S.totalMoney,`H${labSub}`)
      .set('I'+r,result.material+result.directLabor+result.expense,S.totalMoney,`F${r}+H${r}${expSub?`+I${expSub}`:''}`).set('J'+r,null,S.totalLabel);

    // ---------- 집계표 ----------
    const ss=sheet('집계표').widths([26,7,7,12,15,12,15,12,15,16,18]);
    ss.set('A1',`□ ${title} (총괄내역서)`,S.label).merge('A1:K1').height(1,26);
    for(const [c,h] of [['A','구  분'],['B','단위'],['C','수량'],['J','합     계'],['K','비  고']])ss.set(c+'3',h,S.head).merge(`${c}3:${c}4`,S.head);
    for(const [c,h] of [['D','재    료    비'],['F','노     무     비'],['H','경           비']]){ss.set(c+'3',h,S.head).merge(`${c}3:${colName(colIndex(c)+1)}3`,S.head);ss.set(c+'4','단   가',S.head).set(colName(colIndex(c)+1)+'4','금   액',S.head);}
    ss.set('A5',project.type||'정보통신공사',S.center).set('B5','식',S.center).set('C5',1,S.center)
      .set('D5',result.material,S.money,`설계내역서!F${grand}`).set('E5',result.material,S.money,'C5*D5')
      .set('F5',result.directLabor,S.money,`설계내역서!H${grand}`).set('G5',result.directLabor,S.money,'C5*F5')
      .set('H5',result.expense,S.money,expSub?`설계내역서!I${expSub}`:undefined).set('I5',result.expense,S.money,'C5*H5')
      .set('J5',result.material+result.directLabor+result.expense,S.money,'E5+G5+I5').set('K5','');
    ss.set('A6','합                    계',S.totalLabel).merge('A6:D6',S.totalLabel).set('E6',result.material,S.totalMoney,'SUM(E5:E5)').set('F6',null,S.totalLabel).set('G6',result.directLabor,S.totalMoney,'SUM(G5:G5)').set('H6',null,S.totalLabel)
      .set('I6',result.expense,S.totalMoney,'SUM(I5:I5)').set('J6',result.material+result.directLabor+result.expense,S.totalMoney,'SUM(J5:J5)').set('K6',null,S.totalLabel);

    // ---------- 원가계산서 (예시 양식: 재료비(A)·노무비(B)·경비(C) → 순공사원가(D) → 일반관리비(E)·이윤(F) → 총원가(G) → 부가가치세(H) → 총금액) ----------
    const cs=sheet('원가계산서').widths([7,7,28,16,30,34]);
    cs.set('A1','공  사  원  가  계  산  서',S.title).merge('A1:F1').height(1,32);
    cs.set('A3',`공사명 : ${title}`,S.label).merge('A3:F3');
    cs.set('A4','비    목',S.head).merge('A4:C4',S.head).set('D4','금     액',S.head).set('E4','구  성  비',S.head).set('F4','비  고',S.head);
    const costs=new Map(result.costs.map(c=>[c.id,c]));
    const kind=rule=>/간접\s*재료/.test(rule.name)?'material':/간접\s*노무/.test(rule.name)?'labor':/일반\s*관리/.test(rule.name)?'overhead':/이\s*윤/.test(rule.name)?'profit':/부가\s*가치/.test(rule.name)?'vat':'expense';
    const rules=state.rates.map(rule=>({rule,kind:kind(rule),cost:costs.get(rule.id)}));
    const of=k=>rules.filter(x=>x.kind===k);
    const spaced=name=>{const t=String(name).replace(/\s+/g,'');return t.length<=10?[...t].join(' '):t;};
    const SUB='가나다라마바사아자차카타파하';
    const ref={},label={material:'직접재료비',directLabor:'직접노무비',expense:'직접경비'},letterOf={};
    const groupIds={A:['material',...of('material').map(x=>x.rule.id)],B:['directLabor',...of('labor').map(x=>x.rule.id)],
      C:[...(result.expenseRows.length?['expense']:[]),...of('expense').map(x=>x.rule.id)]};
    const after=[...of('overhead'),...of('profit')];
    // 기준 항목이 한 구분을 모두 포함하면 (A)·(B)·(C)·(D)·(G)와 행 기호로 줄여 쓴다.
    const baseText=bases=>{
      const rest=new Set(bases),parts=[],take=ids=>ids.forEach(id=>rest.delete(id));
      const has=ids=>ids.length&&ids.every(id=>rest.has(id));
      const groups=['A','B','C'].filter(k=>groupIds[k].length);
      const fullD=groups.length&&groups.every(k=>has(groupIds[k]));
      if(fullD&&after.length&&after.every(x=>rest.has(x.rule.id))){parts.push('G');groups.forEach(k=>take(groupIds[k]));take(after.map(x=>x.rule.id));}
      else if(fullD&&groups.length>1){parts.push('D');groups.forEach(k=>take(groupIds[k]));}
      else for(const k of groups)if(has(groupIds[k])&&groupIds[k].length>1||k==='A'&&has(groupIds[k])&&bases.length>1){parts.push(k);take(groupIds[k]);}
      for(const id of bases)if(rest.has(id))parts.push(letterOf[id]||label[id]||id);
      const letters=parts.every(x=>/^[A-H]$/.test(x));
      return letters||parts.length>1?`(${parts.join(' + ')})`:parts[0]||'';
    };
    const pending=[];
    const ruleRow=(row,item)=>{
      const {rule,cost}=item;ref[rule.id]='D'+row;label[rule.id]=rule.name;
      pending.push(()=>{
        const rate=`${baseText(rule.bases||[])} * ${num(Number(rule.rate))}%${Number(rule.addition??0)?` + ${Number(rule.addition).toLocaleString('ko-KR')}원`:''}`;
        if(!rule.enabled){cs.set('D'+row,null,S.money).set('E'+row,rule.method==='fixed'?'금액 직접입력':rate,S.center).set('F'+row,['적용 제외',rule.source].filter(Boolean).join(' · '));return;}
        if(rule.method==='fixed'){cs.set('D'+row,cost?.amount??0,S.money,`${RD}(${num(Number(rule.fixedAmount))},0)`).set('E'+row,'금액 직접입력',S.center).set('F'+row,rule.source||'');return;}
        const bases=rule.bases.map(b=>ref[b]||'0');
        cs.set('D'+row,cost?.amount??0,S.money,`${RD}((${bases.join('+')})*${num(Number(rule.rate))}%${Number(rule.addition??0)?'+'+num(Number(rule.addition)):''},0)`).set('E'+row,rate,S.center).set('F'+row,rule.source||'');
      });
    };
    r=5;const top=r;
    const block=(code,head,direct,optional,items)=>{
      const start=r;let n=0;const mark=()=>`(${SUB[n++]||n})`;
      const multi=(direct?1:0)+items.length+(optional&&!items.length?1:0)>1;
      if(direct){cs.set('C'+r,spaced(direct.name)+(multi?mark():''),S.center).set('D'+r,direct.value,S.money,direct.formula).set('E'+r,'',S.center).set('F'+r,'');if(direct.key)ref[direct.key]='D'+r;r++;}
      for(const item of items){cs.set('C'+r,spaced(item.rule.name)+(multi?mark():''),S.center);ruleRow(r,item);r++;}
      if(optional&&!items.length){cs.set('C'+r,spaced(optional),S.center).set('D'+r,null,S.money).set('E'+r,'',S.center).set('F'+r,'');r++;}
      cs.set('C'+r,'소    계',S.totalLabel).set('D'+r,0,S.totalMoney,r>start?`SUM(D${start}:D${r-1})`:'0').set('E'+r,null,S.totalLabel).set('F'+r,null,S.totalLabel);
      const sub=r;cs.set('B'+start,head,S.center).merge(`B${start}:B${r}`,S.center);r++;
      return {code,sub};
    };
    const blocks=[
      block('A','재\n료\n비\n(A)',{name:'직접재료비',value:result.material,formula:'집계표!E6',key:'material'},'간접재료비',of('material')),
      block('B','노\n무\n비\n(B)',{name:'직접노무비',value:result.directLabor,formula:'집계표!G6',key:'directLabor'},'간접노무비',of('labor')),
      block('C','경\n비\n(C)',result.expenseRows.length?{name:'직접경비',value:result.expense,formula:'집계표!I6',key:'expense'}:null,null,of('expense'))
    ];
    ref.expense??='0';ref.material??='0';ref.directLabor??='0';
    cs.set('A'+top,'순\n\n공\n\n사\n\n원\n\n가',S.center).merge(`A${top}:A${r-1}`,S.center);
    const costOf=list=>list.reduce((n,x)=>n+(x.rule.enabled?x.cost?.amount||0:0),0);
    const subValue={A:result.material+costOf(of('material')),B:result.directLabor+costOf(of('labor')),C:result.expense+costOf(of('expense'))};
    for(const b of blocks)cs.set('D'+b.sub,subValue[b.code],S.totalMoney,cs.cells.get('D'+b.sub).formula);
    const line=(name,value,formula,text,bold)=>{
      const ls=bold?S.totalLabel:S.center;
      cs.set('A'+r,name,ls).merge(`A${r}:C${r}`,ls).set('D'+r,value,bold?S.totalMoney:S.money,formula).set('E'+r,text,bold?S.totalLabel:S.center).set('F'+r,'',bold?S.totalLabel:S.text);return r++;
    };
    const net=line('순 공 사 원 가 (D)',subValue.A+subValue.B+subValue.C,blocks.map(b=>'D'+b.sub).join('+'),'(A) + (B) + (C)',true);
    const letters='EFGHIJKLMNOP';let li=0;
    const afterRows=after.map(item=>{const letter=letters[li++];letterOf[item.rule.id]=letter;cs.set('A'+r,`${spaced(item.rule.name)} (${letter})`,S.center).merge(`A${r}:C${r}`,S.center);ruleRow(r,item);return r++;});
    const gLetter=letters[li++];
    const totalCost=line(`총   원   가 (${gLetter})`,subValue.A+subValue.B+subValue.C+costOf(after),[`D${net}`,...afterRows.map(x=>'D'+x)].join('+'),`(${['D',...after.map(x=>letterOf[x.rule.id])].join(') + (')})`,true);
    for(const x of after)letterOf[x.rule.id]=letterOf[x.rule.id];
    const vatRows=of('vat').map(item=>{const letter=letters[li++];letterOf[item.rule.id]=letter;cs.set('A'+r,`${spaced(item.rule.name)} (${letter})`,S.center).merge(`A${r}:C${r}`,S.center);ruleRow(r,item);return r++;});
    const beforeCut=result.total;
    const contract=line('총   금   액',Math.floor(beforeCut/1000)*1000,`ROUNDDOWN(${[`D${totalCost}`,...vatRows.map(x=>'D'+x)].join('+')},-3)`,'',true);
    cs.set('F'+contract,`천원 미만 절사 (절사 전 ${beforeCut.toLocaleString('ko-KR')}원)`,S.totalLabel);
    pending.forEach(f=>f());
    if(Object.values(ref).some(v=>v===undefined))throw Error('제비율 참조 오류');
    for(let k=4;k<r;k++)cs.height(k,22);

    // ---------- 표지 ----------
    const cover=sheet('표지').widths([7,10,7,10,7,10,12,12,12,12]);
    const date=String(project.date||'');
    cover.set('A1','담\n당\n자',S.coverBox).set('B1',null,S.coverBox).set('C1','팀\n\n장',S.coverBox).set('D1',null,S.coverBox).set('E1','과\n\n장',S.coverBox).set('F1',null,S.coverBox).merge('F1:G1',S.coverBox).height(1,66);
    cover.set('H1',`${date.slice(0,4)}년  ${date.slice(5,7)}월      일  설계`,S.note).merge('H1:J1');
    cover.set('B3',`${project.year||date.slice(0,4)}년도`,S.coverAmount).merge('B3:D3');
    cover.set('A5',title,S.cover).merge('A5:J5').height(5,90);
    const overview=String(project.summary||'').split(/\n|;/).map(s=>s.trim()).filter(Boolean);
    const outline=['o 공사개요',...(overview.length?overview:[...new Set(result.labor.map(l=>l.standard.name))].slice(0,6)).map(s=>` - ${s}`)];
    cover.set('G7',outline.join('\n'),S.coverText).merge('G7:J8').height(7,60).height(8,60);
    if(project.location)cover.set('G9',`o 공사위치 : ${project.location}`,S.note).merge('G9:J9');
    const amount=Math.floor(result.total/1000)*1000;
    cover.set('A10',`공 사 금 액 : ￦${amount.toLocaleString('ko-KR')}(금${koreanAmount(amount)}원)`,S.coverAmount,`IFERROR("공 사 금 액 : ￦"&TEXT(원가계산서!D${contract},"#,##0")&"(금"&NUMBERSTRING(원가계산서!D${contract},1)&"원)","공 사 금 액 : ￦"&TEXT(원가계산서!D${contract},"#,##0"))`).merge('A10:J10').height(10,40);
    if(project.agency)cover.set('A12',project.agency,S.coverAmount).merge('A12:J12').height(12,40);

    const sheets=[cover,cs,ss,ds,us,qs,ws,ms];
    return {sheets,landscape:{'일위대가표':true,'설계내역서':true,'집계표':true},summary:{grand,totalRow,contract}};
  }
  // 같은 품명이 연속되면 A열을 병합한다(규격만 다른 행).
  function mergeRuns(sh,start,end){
    let runStart=start;
    for(let r=start+1;r<=end+1;r++){
      const cur=sh.cells.get('A'+r)?.value,prev=sh.cells.get('A'+runStart)?.value;
      if(r<=end&&cur&&cur===prev&&!sh.cells.get('A'+r)?.formula)continue;
      if(r-1>runStart){for(let k=runStart+1;k<r;k++)sh.cells.set('A'+k,{value:null,style:S.text});sh.merge(`A${runStart}:A${r-1}`);}
      runStart=r;
    }
  }
  async function write(state,result){
    const {sheets}=build(state,result);
    const Zip=root.JSZip||(typeof require==='function'?require('../vendor/jszip.min.js'):null);
    const zip=new Zip();
    zip.file('[Content_Types].xml',`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
    zip.file('_rels/.rels',`<Relationships xmlns="${PREL}"><Relationship Id="rId1" Type="${OREL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
    zip.file('xl/workbook.xml',`<workbook xmlns="${NS}" xmlns:r="${OREL}"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${sheets.map((s,i)=>`<sheet name="${xmlText(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`);
    zip.file('xl/_rels/workbook.xml.rels',`<Relationships xmlns="${PREL}">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="${OREL}/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="${OREL}/styles" Target="styles.xml"/></Relationships>`);
    zip.file('xl/styles.xml',STYLES.replace(/\n/g,''));
    sheets.forEach((s,i)=>zip.file(`xl/worksheets/sheet${i+1}.xml`,s.xml(s.name!=='표지'&&s.name!=='원가계산서'&&s.name!=='인건비산출기초'&&s.name!=='자재단가산출기초'&&s.name!=='물량산출근거')));
    return zip.generateAsync({type:typeof Blob!=='undefined'&&root.document?'blob':'uint8array',compression:'DEFLATE',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }
  root.DesignWorkbook={build,write,koreanAmount,TRADES};
  if(typeof module!=='undefined')module.exports=root.DesignWorkbook;
})(globalThis);
