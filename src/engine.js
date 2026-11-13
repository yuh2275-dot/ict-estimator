(function (root) {
  'use strict';
  const Surcharges=root.Surcharges||(typeof require==='function'?require('./surcharges.js'):null);
  const Consumables=root.Consumables||(typeof require==='function'?require('./consumables.js'):null);
  const number = value => {
    const n = Number(value);
    if (value === '' || !Number.isFinite(n) || n < 0 || n > 1e12) throw Error('0 이상 유효한 숫자를 입력하세요.');
    return n;
  };
  const round = (n, mode = 'floor') => mode === 'round' ? Math.round(n + Number.EPSILON) : Math.floor(n + 1e-8);
  function expenseAmount(row, rounding) {
    return round(row.kind === 'machine' ? number(row.hours) * number(row.unitPrice) : number(row.amount), rounding);
  }
  // 공사 기준일에 맞는 노임단가를 찾는다. 맞는 것이 없으면 가장 가까운 기간의 노임으로 계산하고 확인 사항을 남긴다.
  function wageFor(state, trade, issues) {
    const date = state.project.date, all = (state.wages || []).filter(w => w.trade === trade);
    const matches = all.filter(w => w.from <= date && w.to >= date);
    const note = message => issues.set(trade, `노임단가 · ${trade} ${message}`);
    if (matches.length === 1) { if (!String(matches[0].source || '').trim()) note('출처를 입력하세요.'); return matches[0]; }
    if (matches.length > 1) { note(`기준일 ${date}에 해당하는 노임단가가 ${matches.length}건입니다. 하나만 남기세요. 가장 최근 시작 노임으로 계산했습니다.`); return [...matches].sort((a,b)=>b.from.localeCompare(a.from))[0]; }
    if (all.length) {
      const nearest = [...all].sort((a,b)=>Math.abs(Date.parse(a.to<date?a.to:a.from)-Date.parse(date))-Math.abs(Date.parse(b.to<date?b.to:b.from)-Date.parse(date)))[0];
      note(`노임 적용기간(${nearest.from} ~ ${nearest.to})이 공사 기준일 ${date}을 포함하지 않습니다. 이 노임(${Number(nearest.price).toLocaleString('ko-KR')}원)으로 임시 계산했습니다. 노임·제비율 설정의 "적용기간 일괄 수정"에서 고칠 수 있습니다.`);
      return nearest;
    }
    note('노임단가가 없습니다. 노임·제비율 설정에서 입력하면 자동으로 계산됩니다.');
    return {trade, price:0, from:'', to:'', source:'', missing:true};
  }
  function calculate(state) {
    const errors = [], labor = [], materials = [], costs = [], wageIssues = new Map();
    let material = 0, directLabor = 0, expense = 0;
    for (const row of state.materials) {
      const amount = round(number(row.quantity) * number(row.price), state.rounding);
      materials.push({...row, amount}); material += amount;
    }
    for (const row of state.quantities) {
      const materialStart=materials.length, materialBefore=material;
      try {
        const standard = state.standards.find(s => s.id === row.standardId);
        if (!standard || !standard.verified) throw Error('기준자료 미등록');
        if (standard.year !== Number(state.project.year)) throw Error('품셈 기준연도 불일치');
        const inputQuantity = number(row.length) * number(row.count);
        const adjustment = Surcharges.combined(standard,row);
        const quantity = inputQuantity * adjustment.parallel.quantityMultiplier;
        let mainAmount = null;
        if (row.materialPrice != null) {
          const price = number(row.materialPrice);
          const materialQuantity=quantity*adjustment.materialFactor;
          const amount = round(materialQuantity * price, state.rounding);
          materials.push({quantityId:row.id,role:'main',consumableBase:row.consumableBase===true,name:row.materialName?.trim()||standard.name,spec:row.materialSpec?.trim()||standard.spec,unit:standard.unit,quantity:materialQuantity,installationQuantity:quantity,perUnit:1,materialFactor:adjustment.materialFactor,price,amount,source:[row.materialSource,adjustment.materialPercent?`재료 할증 ${adjustment.materialPercent}% (1-1-6)`:''].filter(Boolean).join(' · ')});
          material += amount; mainAmount = amount;
        }
        // 자재 구성: 작업 1단위당 들어가는 부자재(예: 패치코드 1개 = UTP 케이블 3m + RJ45 2개)와 부속품률(3-1-2, 주자재 금액 × %)
        const extras = Array.isArray(row.extraMaterials) ? row.extraMaterials : [];
        if (extras.length && adjustment.demolition) throw Error('철거 행에는 자재 구성을 넣지 마세요.');
        for (const [k, x] of extras.entries()) {
          const name = String(x.name||'').trim();
          if (!name) throw Error('자재 구성에 품명이 없는 줄이 있습니다.');
          if (x.ratioPercent != null) {
            const pct = number(x.ratioPercent);
            if (pct > 100) throw Error(`${name}: 부속품률은 100% 이하로 입력하세요.`);
            if (mainAmount == null) errors.push(`${standard.name} · ${name}: 부속품률을 적용할 주자재 단가가 없습니다.`);
            const amount = round((mainAmount || 0) * pct / 100, state.rounding);
            materials.push({quantityId:row.id,role:'ratio',extra:k,name,spec:String(x.spec||''),unit:'식',quantity:1,installationQuantity:quantity,ratioPercent:pct,price:amount,amount,source:[x.source,`주자재 금액 × ${pct}% (3-1-2 부속품률)`].filter(Boolean).join(' · ')});
            material += amount; continue;
          }
          const per = number(x.perUnit), loss = x.lossPercent==null||x.lossPercent===''?0:number(x.lossPercent);
          if (loss > 100) throw Error(`${name}: 재료 할증은 100% 이하로 입력하세요.`);
          const priced = x.price != null && x.price !== '';
          const price = priced ? number(x.price) : 0;
          if (!priced) errors.push(`${standard.name}${row.location ? ` (${row.location})` : ''} · 자재 "${name}${x.spec?` ${x.spec}`:''}" 단가 입력 필요`);
          const qty = quantity * per * (1 + loss / 100);
          const amount = round(qty * price, state.rounding);
          materials.push({quantityId:row.id,role:'extra',consumableBase:x.consumableBase===true,extra:k,name,spec:String(x.spec||''),unit:String(x.unit||'개'),quantity:qty,installationQuantity:quantity,perUnit:per,materialFactor:1+loss/100,price,amount,source:[x.source,loss?`재료 할증 ${loss}% (1-1-6)`:''].filter(Boolean).join(' · ')});
          material += amount;
        }
        // 확인이 끝나지 않았어도 노무비는 계산해 보여 준다. 확인 필요 사항은 errors에 남겨 엑셀 저장만 막는다.
        if (!row.reviewed) errors.push(standard.name + (row.location ? ` (${row.location})` : '') + ' · 품셈·적용 조건 확인 필요 (공사비 산정에서 체크)');
        const details = standard.labor.map(item => {
          const wage = wageFor(state, item.trade, wageIssues);
          const manDays = number(item.base) * quantity / number(standard.baseQuantity) * adjustment.laborFactor;
          const appliedWage=number(wage.price)*adjustment.wageFactor;
          return {trade:item.trade, base:item.base, manDays, wage:number(wage.price), appliedWage, amount:manDays * appliedWage, source:wage.source||'', wageFrom:wage.from, wageTo:wage.to, missingWage:!!wage.missing};
        });
        const amount = round(details.reduce((s,d) => s + d.amount, 0), state.rounding);
        labor.push({...row, standard, quantity, inputQuantity, routeLength:quantity/adjustment.parallel.runs, adjustment, details, amount}); directLabor += amount;
      } catch (e) {
        // 잘못된 부자재가 있는 행의 주자재만 부분 합산하지 않는다.
        materials.splice(materialStart);material=materialBefore;
        errors.push((row.location || '수량 행') + ' · ' + e.message);
      }
    }
    errors.push(...wageIssues.values());
    const expenseRows = (state.expenses || []).map(row => ({...row, amount:expenseAmount(row,state.rounding)}));
    expense = expenseRows.reduce((sum,row)=>sum+row.amount,0);
    const totalsByTrade = new Map();
    for (const row of labor) for (const detail of row.details) {
      totalsByTrade.set(detail.trade, (totalsByTrade.get(detail.trade) || 0) + detail.amount);
    }
    directLabor = [...totalsByTrade.values()].reduce((sum, amount) => sum + round(amount, state.rounding), 0);
    const consumables=Consumables.calculate(state,materials,round);
    material+=consumables.amount;errors.push(...consumables.errors);
    const bases = {material, directLabor, expense};
    const ids = new Set(Object.keys(bases));
    for (const rule of state.rates) {
      try {
        if (ids.has(rule.id)) throw Error('제비율 ID 중복');
        ids.add(rule.id);
        if (!rule.reviewed || !rule.source) throw Error('적용 근거 및 적용 여부 검토 필요');
        if (!rule.enabled) { bases[rule.id] = 0; costs.push({...rule, amount:0, base:0}); continue; }
        if (rule.from > state.project.date || rule.to < state.project.date) throw Error('제비율 유효기간 불일치');
        if (!['percent','fixed'].includes(rule.method||'percent')) throw Error('제비율 계산방식 오류');
        if (rule.method!=='fixed'&&(!Array.isArray(rule.bases) || !rule.bases.length || rule.bases.some(b => !Object.hasOwn(bases,b)))) throw Error('산정 기준금액 순서/참조 오류');
        const base = rule.method==='fixed'?0:rule.bases.reduce((sum,id) => sum + bases[id],0);
        if(rule.method!=='fixed'&&rule.rate==null)throw Error('요율을 입력하세요.');
        if(rule.method==='fixed'&&rule.fixedAmount==null)throw Error('직접 산정금액을 입력하세요.');
        const amount = round(rule.method==='fixed'?number(rule.fixedAmount):base * number(rule.rate) / 100 + number(rule.addition??0), state.rounding);
        bases[rule.id] = amount; costs.push({...rule,base,amount});
      } catch(e) { errors.push(rule.name + ' · ' + e.message); }
    }
    if (!state.ratesReviewed) errors.push('공사금액·기간·종류·기관별 제비율 검토 필요');
    // 총공사금액은 천원 미만을 절사한다(사용자 결정, 2026-11-12). 절사 전 금액은 totalBeforeCut.
    const totalBeforeCut = material+directLabor+expense+costs.reduce((s,c)=>s+c.amount,0);
    return {materials,labor,costs,expenseRows,consumables,material,directLabor,expense,totalBeforeCut,total:Math.floor(totalBeforeCut/1000)*1000,errors};
  }
  root.Estimator = {number,round,calculate,expenseAmount};
  if (typeof module !== 'undefined') module.exports = root.Estimator;
})(globalThis);

