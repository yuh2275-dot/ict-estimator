// 코드가 바뀌었는데 docs/HANDOFF.md가 함께 바뀌지 않았는지 판정한다.
// - Claude Code 훅(.claude/hooks/handoff-guard.cjs)과 PR 검사(.github/workflows/handoff-check.yml)가 함께 쓴다.
// - CLI: node tools/handoff-status.cjs [base] [head]  → 누락이면 종료 코드 1
'use strict';
const {execFileSync}=require('node:child_process');
const git=(args,cwd)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();

const HANDOFF='docs/HANDOFF.md';
// 인계가 필요한 "코드" 경로. 문서·설정만 바꾼 경우는 제외한다.
const isCode=f=>/^(src|tests|tools|\.github\/workflows)\//.test(f)||/^(index\.html|build\.cjs|restore-reference\.cjs|package\.json)$/.test(f);

function changedFiles({cwd=process.cwd(),base,head}={}){
  if(head){ // PR 검사: base...head 커밋 범위
    return git(['diff','--name-only',`${base}...${head}`],cwd).split('\n').filter(Boolean);
  }
  // 작업 중: origin/main에서 갈라진 뒤의 커밋 + 커밋하지 않은 변경 + 새 파일
  let from;
  try{from=git(['merge-base','HEAD',base||'origin/main'],cwd);}catch{from='HEAD';}
  const committed=git(['diff','--name-only',from],cwd).split('\n');
  const untracked=git(['ls-files','--others','--exclude-standard'],cwd).split('\n');
  return [...new Set([...committed,...untracked].filter(Boolean))];
}
function status(options){
  const files=changedFiles(options);
  const code=files.filter(isCode);
  return {files,code,handoffChanged:files.includes(HANDOFF),missing:code.length>0&&!files.includes(HANDOFF)};
}
module.exports={status,isCode,HANDOFF};

if(require.main===module){
  const [base,head]=process.argv.slice(2);
  const s=status({base,head});
  if(s.missing){
    console.error(`코드가 바뀌었지만 ${HANDOFF}가 갱신되지 않았습니다.\n바뀐 코드 파일:\n${s.code.map(f=>'  - '+f).join('\n')}\n${HANDOFF}의 "머지된 변경", "동작 요약", "사용자 확인이 필요한 해석", "다음 작업"을 이번 변경에 맞게 고치세요.`);
    process.exit(1);
  }
  console.log(s.code.length?`${HANDOFF} 갱신 확인 (코드 파일 ${s.code.length}개)`:'코드 변경 없음');
}
