// 사용자 예시와 비슷한 공사 (합성 데이터)
require('../src/standards.js');
const std=structuredClone(globalThis.initialStandards);
const q=(id,standardId,length,extra={})=>({id,standardId,location:'',length,count:1,basis:'',note:'',adjustment:'base',reviewed:true,surcharges:[],...extra});
const wages=[['통신내선공',284880],['통신설비공',315528],['통신외선공',408942],['통신케이블공',436224],['보통인부',172068]].map(([trade,price])=>({trade,price,from:'2026-01-01',to:'2026-08-31',source:'2026년 상반기 적용 시중노임'}));
const rate=(id,name,r,bases,extra={})=>({id,name,rate:r,bases,from:'2026-01-01',to:'2026-12-31',source:'TEST 제비율',reviewed:true,enabled:true,method:'percent',addition:0,...extra});
module.exports={version:1,project:{name:'동부도서관 정보통신시설 정비공사',location:'동부도서관',date:'2026-03-15',year:2026,duration:20,type:'정보통신시설 정비공사',agency:'',summary:'UTP 케이블 배관 · 배선 및 노출형 아울렛 설치;통신랙 신설 및 패치판넬 · 패치코드 설치'},
 standards:std,
 quantities:[
  q('a','utp4',355.5,{adjustment:'tray',materialPrice:1100,materialSource:'물가정보지(2025년 12월호) p.1177',basis:'층별 배선 합계'}),
  q('b','outlet',2,{commentary:{ports:6},materialPrice:9500,materialSource:'견적가',location:'1F'}),
  q('c','outlet',1,{commentary:{ports:4},materialPrice:7500,materialSource:'견적가',location:'2F'}),
  q('d','rack',1,{materialPrice:300000,materialSource:'견적가'}),
  q('e','rack',1,{commentary:{work:'remove_unused'}}),
  q('f','panel24',1,{materialPrice:606000,materialSource:'물가정보 P.1273'}),
  q('g','termination',24),
  q('h','rj45',38,{materialPrice:600,materialSource:'견적가(보호캡 포함)',surcharges:[{id:'night'}]}),
 ],
 materials:[{name:'난연 CD관',spec:'16MM',unit:'M',quantity:24,price:275,source:'물가정보지(2026년 4월호) p.1204'},{name:'난연 CD관',spec:'22MM',unit:'M',quantity:10,price:412,source:'물가정보지(2026년 4월호) p.1204'}],
 expenses:[],wages,
 rates:[rate('indirect','간접노무비',17.5,['directLabor']),rate('injury','산재보험료',3.56,['directLabor','indirect']),rate('employ','고용보험료',1.01,['directLabor','indirect']),
  rate('health','건강보험료',3.595,['directLabor'],{enabled:false}),rate('safety','산업안전보건관리비',2.07,['material','directLabor']),rate('asbestos','석면부담금',0.006,['directLabor','indirect']),
  rate('wageclaim','임금채권부담금',0.09,['directLabor','indirect']),rate('etc','기타경비',5,['material','directLabor','indirect']),
  rate('admin','일반관리비',8,['material','directLabor','indirect','injury','employ','health','safety','asbestos','wageclaim','etc']),
  rate('profit','이윤',6.2,['directLabor','indirect','injury','employ','health','safety','asbestos','wageclaim','etc','admin']),
  rate('vat','부가가치세',10,['material','directLabor','indirect','injury','employ','health','safety','asbestos','wageclaim','etc','admin','profit'])],
 ratesReviewed:true,rounding:'floor',history:[]};
