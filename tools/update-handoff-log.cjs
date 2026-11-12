// docs/HANDOFF.md의 자동 기록 구간을 git 기록으로 다시 쓴다. AI 없이 GitHub Actions가 머지 때마다 실행한다.
// 사용: node tools/update-handoff-log.cjs [테스트 결과 문구]
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const file=path.join(root,'docs/HANDOFF.md');
const START='<!-- AUTO-LOG:START -->',END='<!-- AUTO-LOG:END -->';
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const cell=v=>String(v??'').replace(/\|/g,'\\|').replace(/\s+/g,' ').trim();

function build(testSummary){
  const head=git(['log','-1','--format=%h|%cs']).split('|');
  const merges=git(['log','--merges','--first-parent','-n','15','--format=%h%x1f%cs%x1f%s%x1f%b%x1e']).split('\x1e').map(s=>s.trim()).filter(Boolean).map(s=>{
    const [hash,date,subject,body]=s.split('\x1f');
    const pr=(subject.match(/#(\d+)/)||[])[1];
    return {hash,date,pr,title:(body||'').split('\n')[0]||subject};
  });
  const lastFiles=merges.length?git(['diff','--name-only',`${merges[merges.length-1].hash}^1`,'HEAD']).split('\n').filter(Boolean):[];
  const lines=[
    START,
    '## 자동 기록 (머지할 때마다 GitHub Actions가 갱신, 직접 수정 금지)',
    '',
    `- 기준 커밋: \`${head[0]}\` (${head[1]})`,
    testSummary?`- 테스트: ${testSummary}`:null,
    '',
    '| 날짜 | PR | 제목 | 머지 커밋 |',
    '|---|---|---|---|',
    ...merges.map(m=>`| ${m.date} | ${m.pr?`[#${m.pr}](https://github.com/yuh2275-dot/ict-estimator/pull/${m.pr})`:'-'} | ${cell(m.title)} | \`${m.hash}\` |`),
    '',
    `위 기간에 바뀐 파일 (${lastFiles.length}개): ${lastFiles.slice(0,40).map(f=>'`'+f+'`').join(', ')}${lastFiles.length>40?' …':''}`,
    END
  ].filter(x=>x!==null);
  return lines.join('\n');
}
const text=fs.readFileSync(file,'utf8');
const section=build(process.argv[2]);
const next=text.includes(START)&&text.includes(END)
  ?text.slice(0,text.indexOf(START))+section+text.slice(text.indexOf(END)+END.length)
  :text.replace(/\s*$/,'\n\n')+section+'\n';
if(next!==text){fs.writeFileSync(file,next);console.log('docs/HANDOFF.md 자동 기록 갱신');}
else console.log('변경 없음');
