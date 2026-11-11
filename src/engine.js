(function (root) {
  'use strict';
  const number = value => {
    const n = Number(value);
    if (value === '' || !Number.isFinite(n) || n < 0 || n > 1e12) throw Error('0 이상 유효한 숫자를 입력하세요.');
    return n;
  };
  const round = (n, mode = 'floor') => mode === 'round' ? Math.round(n + Number.EPSILON) : Math.floor(n + 1e-8);
  function expenseAmount(row, rounding) {
    return round(row.kind === 'machine' ? number(row.hours) * number(row.unitPrice) : number(row.amount), rounding);
  }
  function calculate(state) {
    const errors = [], labor = [], materials = [], costs = [];
    let material = 0, directLabor = 0, expense = 0;
    for (const row of state.materials) {
      const amount = round(number(row.quantity) * number(row.price), state.rounding);
      materials.push({...row, amount}); material += amount;
    }
    for (const row of state.quantities) {
      try {
        const standard = state.standards.find(s => s.id === row.standardId);
        if (!standard || !standard.verified) throw Error('기준자료 미등록');
        if (standard.year !== Number(state.project.year)) throw Error('품셈 기준연도 불일치');
        const quantity = number(row.length) * number(row.count);
        if (row.materialPrice != null) {
          const price = number(row.materialPrice);
          const amount = round(quantity * price, state.rounding);
          materials.push({quantityId:row.id,name:standard.name,spec:standard.spec,unit:standard.unit,quantity,price,amount,source:row.materialSource||''});
          material += amount;
        }
        if (!row.reviewed) throw Error('적용 조건 확인 필요');
        const adjustment = standard.adjustments.find(a => a.id === row.adjustment);
        if (!adjustment) throw Error('허용되지 않은 할증');
        const details = standard.labor.map(item => {
          const matches = state.wages.filter(w => w.trade === item.trade && w.from <= state.project.date && w.to >= state.project.date);
          if (matches.length !== 1 || !matches[0].source) throw Error(item.trade + ' 적용일 노임단가 확인 필요');
          const wage = matches[0];
          const manDays = number(item.base) * quantity / number(standard.baseQuantity) * number(adjustment.factor);
          return {trade:item.trade, base:item.base, manDays, wage:number(wage.price), amount:manDays * number(wage.price), source:wage.source};
        });
        const amount = round(details.reduce((s,d) => s + d.amount, 0), state.rounding);
        labor.push({...row, standard, quantity, adjustment, details, amount}); directLabor += amount;
      } catch (e) { errors.push((row.location || '수량 행') + ' · ' + e.message); }
    }
    const expenseRows = (state.expenses || []).map(row => ({...row, amount:expenseAmount(row,state.rounding)}));
    expense = expenseRows.reduce((sum,row)=>sum+row.amount,0);
    const totalsByTrade = new Map();
    for (const row of labor) for (const detail of row.details) {
      totalsByTrade.set(detail.trade, (totalsByTrade.get(detail.trade) || 0) + detail.amount);
    }
    directLabor = [...totalsByTrade.values()].reduce((sum, amount) => sum + round(amount, state.rounding), 0);
    const bases = {material, directLabor, expense};
    const ids = new Set(Object.keys(bases));
    for (const rule of state.rates) {
      try {
        if (ids.has(rule.id)) throw Error('제비율 ID 중복');
        ids.add(rule.id);
        if (!rule.reviewed || !rule.source) throw Error('적용 근거 및 적용 여부 검토 필요');
        if (!rule.enabled) { bases[rule.id] = 0; costs.push({...rule, amount:0, base:0}); continue; }
        if (rule.from > state.project.date || rule.to < state.project.date) throw Error('제비율 유효기간 불일치');
        if (!Array.isArray(rule.bases) || !rule.bases.length || rule.bases.some(b => !Object.hasOwn(bases,b))) throw Error('산정 기준금액 순서/참조 오류');
        const base = rule.bases.reduce((sum,id) => sum + bases[id],0);
        const amount = round(base * number(rule.rate) / 100, state.rounding);
        bases[rule.id] = amount; costs.push({...rule,base,amount});
      } catch(e) { errors.push(rule.name + ' · ' + e.message); }
    }
    if (!state.ratesReviewed) errors.push('공사금액·기간·종류·기관별 제비율 검토 필요');
    return {materials,labor,costs,expenseRows,material,directLabor,expense,total:material+directLabor+expense+costs.reduce((s,c)=>s+c.amount,0),errors};
  }
  root.Estimator = {number,round,calculate,expenseAmount};
  if (typeof module !== 'undefined') module.exports = root.Estimator;
})(globalThis);
