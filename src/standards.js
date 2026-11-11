globalThis.initialStandards = (() => {
  const source = '2026년도 적용 정보통신공사 표준품셈';
  const make = (id,code,name,spec,unit,baseQuantity,labor,page,conditions,adjustments=[]) => ({id,code,name,spec,unit,baseQuantity,labor:Object.entries(labor).map(([trade,base])=>({trade,base})),year:2026,version:'2026.1',source,page,verified:true,conditions,included:conditions,excluded:'해설에 명시되지 않은 복합 조건은 별도 검토',separate:'재료비, 명시된 별도 계상 공정',revised:'2026',adjustments:[{id:'base',name:'기본 조건',factor:1,basis:code+' 본문'},...adjustments]});
  return [
    make('utp4','4-3-1','UTP 케이블 포설','구내 4P','m',10,{'통신케이블공':0.15},90,'관로 및 Pit 기준. 성단 별도. 해설 ①~⑫ 확인. 동시포설은 해설 ⑧의 열 수를 별도로 입력. 공통 할증은 공사비 산정에서 추가.',[{id:'tray',name:'트레이·랙 등',factor:1.2,basis:'해설 ①'},{id:'floor',name:'바닥 노출',factor:0.8,basis:'해설 ①'}]),
    make('rj45','4-3-2','RJ45 플러그 접속','8Pin Plug','개',10,{'통신내선공':0.13},91,'STP·FTP, Cat6 및 철거 조건 별도 확인.',[{id:'cat6',name:'Cat6 Modular',factor:1.35,basis:'해설 ④'}]),
    make('outlet','4-3-2','정보콘센트 접속','Modular Outlet','개',10,{'통신내선공':0.28},91,'케이블 접속 및 커버 플레이트 포함. Outlet Box 별도. 다구형 조건 확인.'),
    make('rack','4-3-3','19인치 랙 설치','높이 2.2m 미만','대',1,{'통신설비공':0.48},91,'고정형, 수평조정 포함. 해설 ⑤~⑨ 확인.',[{id:'mobile',name:'이동형',factor:0.2,basis:'해설 ⑤'}]),
    make('panel24','4-3-3','패치패널 설치','24 Port 이하','대',1,{'통신설비공':0.21,'보통인부':0.21},91,'현장조립 및 설치 포함. 성단 별도.',[{id:'assembled',name:'조립된 패널',factor:0.7,basis:'해설 ⑥'}]),
    make('termination','4-3-3','패치패널 성단','Port','Port',1,{'통신케이블공':0.02,'보통인부':0.02},91,'젤리충진·철거 별도 조건. 회선시험 별도.')
  ];
})();
