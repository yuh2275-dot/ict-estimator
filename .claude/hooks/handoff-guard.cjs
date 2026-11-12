// Claude Code 훅: 코드를 바꾸고 docs/HANDOFF.md를 갱신하지 않았으면 알린다.
// - Stop: 응답을 끝내기 전에 한 번 막고 갱신하라고 지시한다(stop_hook_active면 다시 막지 않는다).
// - SessionStart(compact|resume): 대화가 요약되거나 재개된 직후 같은 내용을 상기시킨다.
'use strict';
const path=require('node:path');
let input={};
try{input=JSON.parse(require('node:fs').readFileSync(0,'utf8')||'{}');}catch{}
const root=process.env.CLAUDE_PROJECT_DIR||input.cwd||process.cwd();
let s;
try{s=require(path.join(root,'tools/handoff-status.cjs')).status({cwd:root});}catch{process.exit(0);} // git이 없거나 저장소 밖이면 아무것도 하지 않음
if(!s.missing)process.exit(0);

const files=s.code.slice(0,12).join(', ')+(s.code.length>12?` 외 ${s.code.length-12}개`:'');
const reason=`코드가 바뀌었지만 docs/HANDOFF.md가 갱신되지 않았습니다(바뀐 코드: ${files}). 사용량이 끊겨도 다음 작업자(Codex 또는 Claude)가 이어받을 수 있도록, 지금 docs/HANDOFF.md의 "머지된 변경"·"동작 요약"·"사용자 확인이 필요한 해석"·"다음 작업"을 이번 변경에 맞게 갱신하세요. 자동 기록 구간(AUTO-LOG 표시 사이)은 고치지 마세요.`;

if(input.hook_event_name==='Stop'){
  if(input.stop_hook_active)process.exit(0);
  process.stdout.write(JSON.stringify({decision:'block',reason}));
}else if(input.hook_event_name==='SessionStart'){
  process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:'SessionStart',additionalContext:reason}}));
}
