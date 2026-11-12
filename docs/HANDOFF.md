# 작업 인계 (2026-11-12)

UTP 동시포설(커밋 `4fa5825`) 이후 공종 해설·설계내역서·원가계산 미리보기·인계 문서 관리·수량 행 자재명(PR #9, 머지됨)이 `main`에 반영되었습니다. 이번 작업은 노임 적용기간 일괄 수정(2.6)입니다.

배포 주소: https://yuh2275-dot.github.io/ict-estimator/

## 1. 머지된 변경

| PR | 내용 | 주요 파일 |
|---|---|---|
| [#1](https://github.com/yuh2275-dot/ict-estimator/pull/1) | 공종 해설 할증 조건. 4-3-1~4-3-3은 원문 대조, 나머지 전체 절은 자동 추출 | `src/surcharges.js`, `src/commentary-data.js`, `tools/extract_commentary.cjs`, `src/estimate-ui.js` |
| [#2](https://github.com/yuh2275-dot/ict-estimator/pull/2) | "해설 계수 직접입력" → "추가 배율", 중복·오입력 경고와 저장 전 확인 | `src/surcharges.js`(`customWarnings`), `src/estimate-ui.js` |
| [#3](https://github.com/yuh2275-dot/ict-estimator/pull/3) | 엑셀 저장을 설계내역서 통합문서(8개 시트, 수식 연결)로 교체. 공사정보에 "공사개요" 필드 추가 | `src/design-xlsx.js`(신규), `src/app.js` |
| [#4](https://github.com/yuh2275-dot/ict-estimator/pull/4) | 원가계산서를 사용자 예시 양식에 맞춤: (A)~(H) 기호, 구성비, 간접재료비 행, 천원 미만 절사 | `src/design-xlsx.js` |
| [#5](https://github.com/yuh2275-dot/ict-estimator/pull/5) | 공사원가계산 화면에 시트 미리보기 탭. 노임을 등록하면 확인 체크 전에도 노무비 자동 계산 | `src/engine.js`(`wageFor`), `src/app.js`(`costSheet`), `src/design-xlsx.js`(`toHtml`) |
| #6, #7 | 인계 문서 `AGENTS.md`, `docs/HANDOFF.md`, `CLAUDE.md`(AGENTS.md 자동 로드) | 문서 |
| [#8](https://github.com/yuh2275-dot/ict-estimator/pull/8) | **인계 문서 자동 갱신 장치** — 아래 2.4 | `tools/handoff-status.cjs`, `tools/update-handoff-log.cjs`, `.github/workflows/handoff-*.yml`, `.claude/` |

| [#9](https://github.com/yuh2275-dot/ict-estimator/pull/9) | 수량 행 자재명·자재 규격 (Codex) — 아래 2.5 | `src/estimate-ui.js`, `src/design-xlsx.js` 등 |
| [#10](https://github.com/yuh2275-dot/ict-estimator/pull/10) | 자동 기록 테스트 결과 수정 | 워크플로 |
| [#11](https://github.com/yuh2275-dot/ict-estimator/pull/11) | 노임 적용기간 일괄 수정 — 아래 2.6 | `src/basis-ui.js`(`applyWagePeriod`), `src/engine.js`, `tests/wage-period.test.cjs` |

### 참고: PR #9 설명

[PR #9](https://github.com/yuh2275-dot/ict-estimator/pull/9)는 수량 행의 자재명·자재 규격 입력과 설계내역서·자재단가산출기초 반영을 구현했습니다. 관련 파일은 `src/estimate-ui.js`, `src/app.js`, `src/engine.js`, `src/design-xlsx.js`, `index.html`, `tests/design-xlsx.test.cjs`입니다.

## 2. 동작 요약

### 2.1 공종 해설 조건 (`Surcharges.commentary`, `commentaryFactors`)
- 4-3-1·4-3-2·4-3-3은 `commentaryRules`에 수작업으로 정의되어 있습니다. 행의 공종명·규격 문자열에 해당하는 조건만 표시합니다.
  - 예: Outlet 행에만 "Outlet 구수"가 나옵니다.
- 그 밖의 절은 `src/commentary-data.js`(자동 추출)를 씁니다. 화면에는 "자동 추출 · 원문 대조 필요" 경고와 원문 문장, 쪽 링크가 함께 나옵니다.
- 선택지 유형은 셋입니다.
  - `choice`: 한 그룹에서 하나를 고릅니다.
  - `count`: 2열 180%·3열 260%·4열 340%… 같은 개수 입력입니다. `perUnit`이면 1단위당 (비율 ÷ 개수)를 적용합니다.
  - `demolition`: 철거입니다. 재료 단가와 재료 할증을 입력할 수 없습니다.
- 품셈에 같은 해설 번호의 계수(`adjustments[].basis`)가 이미 있으면 그 그룹을 숨겨 중복을 막습니다.
- 최종 노무 계수는 다음 순서로 곱합니다.
  - `공종 해설 계수(adjustment) × 해설 조건 곱 × 동시포설 × (1 + 공통 품 할증 합) × 노임 계수`
- 행 데이터에는 `commentary: {groupId: choiceId | count}`로 저장됩니다.

### 2.2 노임·노무비 (`engine.js` `wageFor`)
- 확인 체크(`reviewed`) 전에도 노무비를 계산합니다. 미확인 행은 `errors`로만 남고, 엑셀 저장을 막습니다.
- 공사 기준일에 맞는 노임이 없으면 가장 가까운 기간의 노임으로 임시 계산하고 확인 항목을 남깁니다.
- 기간이 겹치는 노임이 여러 건이면 가장 최근 시작 노임을 씁니다. 출처가 없거나 노임이 없는 경우와 함께, 직종별로 한 번만 알립니다.

### 2.3 엑셀 저장 (`DesignWorkbook.write`)
- 시트: 표지 · 원가계산서 · 집계표 · 설계내역서 · 일위대가표 · 물량산출근거 · 인건비산출기초 · 자재단가산출기초
- 입력값은 세 시트에만 있고, 나머지는 모두 수식으로 연결됩니다.
  - 물량산출근거: 수량
  - 자재단가산출기초: 단가
  - 인건비산출기초: 노임
- 수식 셀에는 앱 계산값을 캐시로 넣고, 파일을 열 때 전체 재계산(`fullCalcOnLoad`)합니다.
- 일위대가표 품셈은 `기본품*계수` 수식입니다. 행별 노임 할증(야간 등)은 직종별 단일 노임을 쓰기 위해 계수에 포함합니다. 금액은 엔진과 같습니다.
- 원가계산서 항목 위치는 제비율 이름으로 정합니다.
  - "간접재료" → 재료비(A), "간접노무" → 노무비(B)
  - "일반관리" → (E), "이윤" → (F), "부가가치" → (H)
  - 그 밖의 항목 → 경비(C)
- 총금액은 `ROUNDDOWN(총원가 + 부가가치세, -3)`입니다. 앱 화면 총액은 절사 전 금액입니다.
- 공사원가계산 화면은 같은 `build()` 결과를 `toHtml()`로 그립니다. 확인 항목이 있어도 `{preview:true}`로 미리보기는 됩니다.

### 2.4 인계 문서 자동 갱신 (사용량이 끊겨도 기록이 남도록)
- **자동 기록**: `main`에 머지될 때마다 `.github/workflows/handoff-log.yml`이 `tools/update-handoff-log.cjs`를 실행합니다.
  - 이 문서 맨 아래 AUTO-LOG 구간을 최근 머지 PR, 바뀐 파일, 테스트 결과로 다시 쓰고, `github-actions[bot]`이 `[skip ci]` 커밋으로 올립니다.
  - AI 토큰을 쓰지 않습니다. 이 구간은 직접 고치지 마세요.
- **PR 검사**: `.github/workflows/handoff-check.yml`이 있습니다.
  - 코드(`src/`, `tests/`, `tools/`, 워크플로, `index.html` 등)를 바꾼 PR에서 이 문서가 함께 바뀌지 않으면 실패합니다.
  - 문서 갱신이 필요 없는 PR은 `skip-handoff` 라벨을 붙이면 통과합니다.
  - 로컬 확인: `node tools/handoff-status.cjs origin/main HEAD`
- **Claude Code 훅**: `.claude/settings.json`에 설정했습니다.
  - Stop: 응답을 끝내기 전에 "코드는 바뀌었는데 이 문서는 그대로"이면 한 번 막고 갱신을 지시합니다.
  - SessionStart(compact·resume): 대화 요약·재개 직후 같은 내용을 상기시킵니다.
  - Codex에는 이런 훅이 없어서 AGENTS.md 규칙과 PR 검사로 대신합니다.
- 자동 기록의 테스트 결과는 `--test-reporter=tap` 출력에서 읽습니다. Node 24 기본 출력 형식에서는 숫자를 찾지 못해 첫 실행이 "?"로 기록되었습니다.
- **한계**: 한 응답 도중 사용 한도에 걸리면 그 응답의 작업은 기록되지 않습니다. 직전 PR까지의 판단 내용과 머지된 내용은 남습니다.

### 2.5 수량 행 자재명·자재 규격
- 공사비 산정과 수량산출에서 `materialName`과 `materialSpec`을 편집하고 작업 JSON에 저장합니다.
- 연결된 재료비 행의 설계내역서와 자재단가산출기초에 반영하며, 같은 통합문서를 사용하는 화면 미리보기에도 표시됩니다.
- `materialName`과 `materialSpec`은 각각 앞뒤 공백을 제거해 사용합니다. 값이 없거나 공백이면 해당 필드의 품셈 공종명 또는 규격을 사용하므로 기존 작업 JSON도 열 수 있습니다.
- 예를 들어 UTP 포설 행에 자재명 `UTP 케이블`, 자재 규격 `CAT.6 4P`를 입력하면 두 시트의 재료비 품명·규격에 표시됩니다.
- 수정한 스크립트의 캐시 버전은 `material-fields-1`이며, `index.html`과 보안 점검 허용 목록에 반영했습니다.

### 2.6 노임 적용기간 일괄 수정
- 노임·제비율 설정의 노임 표에 선택 칸이 있고, 그 위에 "적용기간 일괄 수정" 패널이 있습니다. 공사 기준일 밖 노임이 있으면 패널이 펼쳐지고 그 노임들이 미리 선택됩니다.
- 상반기(01-01~08-31)·하반기(09-01~12-31)·연간 버튼, 기준일 밖/전체/해제 선택 버튼이 있습니다. 새 기간 기본값은 기준일이 속한 반기입니다.
- `BasisUI.applyWagePeriod(wages, indexes, {from,to,keepHistory,today})`는 순수 함수입니다. 단가는 바꾸지 않습니다.
  - 출처 뒤에 "· 적용기간 수정 날짜 (이전 a ~ b)"를 붙입니다(끌 수 있음).
  - 같은 직종끼리 기간이 겹치면 거부합니다.
- 엔진의 "기준일 밖 노임" 경고 문구에 이 기능 안내를 붙였습니다.
- 주의: 하반기 공사에 상반기 노임을 쓰는 것이 맞는지는 발주기관 기준 문제입니다. 화면 안내문에 "새 노임이 공표되었으면 기간을 늘리지 말고 새 노임을 추가"하라고 적었습니다.

### 2.7 도면 물량 가져오기 (Claude·ChatGPT 연동, `src/takeoff.js`)
- 사이트는 외부 접속이 막혀 있어(CSP) AI를 직접 부르지 않습니다. 사용자가 AI에 도면을 올리고, 그 답(JSON)을 붙여 넣는 방식입니다.
- 공사비 산정 화면 맨 위 "도면 물량 가져오기"에서 세 단계로 진행합니다.
  1. **AI 요청문 복사/저장** (`buildPrompt`): 등록 품셈 목록(standardId·번호·규격·단위·adjustment·commentary id·동시포설 가능 여부), 출력 형식(`format: "ict-estimator-takeoff"`), 산정 규칙(콘센트는 개수 + ports, 동시포설은 총길이 + parallelRuns, 철거는 commentary work)이 들어 있습니다.
  2. **답변 붙여넣기 → 미리보기** (`parse`, `match`)
     - 코드블록·앞뒤 설명이 섞여도 JSON을 찾습니다.
     - 매칭 순서: standardId → 같은 품셈 번호의 등록 품셈(규격·공종명 유사도 `MIN_SCORE` 4 이상) → 원문 계산 후보(drafts, 같은 기준) → 절만 있으면 "품셈 등록 필요"
     - adjustment·commentary·parallelRuns는 엔진 규칙으로 검증하고, 맞지 않는 값은 빼고 알립니다. 단위가 다르거나 신뢰도가 낮으면 표시합니다.
  3. **선택 항목 추가** (`apply`)
     - 모든 행은 `reviewed:false`이고 비고에 "AI 도면 해석"이 적힙니다. 사용자가 확인 체크를 해야 엑셀로 저장됩니다.
     - 단순 자재는 단가 0원·"단가 입력 필요"로 자재단가 관리에 들어갑니다.
     - 공사정보는 빈 칸만 채웁니다.
- 품셈 등록이 필요한 행은 "품셈 등록" 버튼으로 원문 후보 등록 화면으로 갑니다. 등록 후 다시 미리보기 하면 연결됩니다.
- 한계: AI가 도면을 읽는 정확도는 보장되지 않습니다. 비고·신뢰도·근거를 남기고 확인 체크를 강제하는 것으로 대응합니다.

### 2.8 원문 대조 품셈 등록 — 3장·4장 전체 (진행 중, `src/standards-verified.js`)
- 사용자 요청(2026-11-12): 3장 배관공사, 4장 통신케이블공사 전체를 원문과 대조해 계산 가능한 품셈으로 등록합니다.
- 방법: 원문 페이지 **이미지**(`src/reference/page-NNN.webp`)를 한 쪽씩 보고 표를 옮깁니다.
  - 텍스트 층에는 이미지로만 들어간 표가 빠져 있습니다(3-2-2 박스용 연결접지선, 3-3-2 배선반, 3-4-2 조립식 케이블트레이). 텍스트만 보면 안 됩니다.
  - 입력 후 두 가지로 교차 검사합니다: 자동 후보(drafts)와 직종·품 값이 같은지, 숫자가 그 쪽 텍스트에 있는지.
- 행 형식: `group(번호, 공종명, 인쇄쪽, [직종…], [[규격, 단위, 기준수량, 품…]])`, `null`은 원문 "-". id는 `v{번호}-{순번 3자리}`이므로 **행 순서를 바꾸지 마세요**(저장된 작업 파일이 id로 참조).
- 예전 작업 파일을 열면 빠진 기본 품셈을 id 기준으로 덧붙입니다(`app.js` open).
- 진행 상황
  - **3장 완료**: 306건 (3-1-1 ~ 3-7-2-3). 3-1-2 부속품률은 재료비 비율이라 제외했습니다.
  - **4장 진행 중**: 다음 작업자는 PDF 109쪽(4-1-1)부터 이어서 하면 됩니다.
- 발견한 자동 후보 오류 (등록 데이터는 원문 기준):
  - 3-6-1 액세스플로어: 건축목공 열 누락(노무비 절반)
  - 3-7-1: 방화폼 행 누락, 도로커팅·기초대의 착암공 누락
- 해설 추출 보완: "벽면은 본 품셈의 110%, 천장은 … 130% 적용"처럼 "본 품셈의"가 붙은 나열을 놓치던 문제를 고쳤습니다(3-5-3).

## 3. 사용자 확인이 필요한 해석 (아직 답을 받지 못함)

세 항목 모두 결정되어 반영했습니다.

1. ~~해설 조건 결합 방식~~ **결정됨 (2026-11-12): 곱한다.** 서로 다른 해설 조건은 곱해서 적용합니다(예: 트레이 1.2 × 케이블타이 1.1 = 1.32). 현재 구현(`commentaryFactors`) 그대로입니다.
2. ~~정보콘센트 구수 산정~~ **결정됨 (2026-11-12): 포트 수로 센다.**
   - 노무 계수 = 구수 할증 × 포트 수입니다(예: 6구 = 180% × 6 = ×10.8). 콘센트 6구 2개면 12포트 × 0.028 × 1.8 = 0.6048인으로, 사용자 예시 엑셀과 같습니다.
   - 수량은 콘센트 개수로 입력하고, 재료비도 콘센트 개수 기준입니다.
   - 구현: `commentaryRules['4-3-2']`의 `ports` 그룹 `perPort:true`.
3. ~~총금액 천원 절사~~ **결정됨 (2026-11-12): 앱 총액에도 적용한다.**
   - `Estimator.calculate`의 `total`은 천원 미만 절사 금액이고, 절사 전 금액은 `totalBeforeCut`입니다.
   - 화면에는 절사 전 금액을 함께 표시합니다. 엑셀 원가계산서 총금액과 같습니다.

## 4. 알려진 한계

- **자동 추출 해설**: 검증 완료 데이터가 아닙니다.
  - PDF 줄바꿈 때문에 선택지 이름이 어색하게 잘린 것이 있습니다.
  - 한 문장이 절 안의 모든 규격에 해당하지는 않습니다(예: "4P는 130%").
  - 다음 문구는 자동 계수에서 제외하고 "그 밖의 해설"로만 표시합니다: 다른 규격 기준 비율("100P의 180%"), 단위당·마다 증분, "N%까지" 상한, 범위, 100% 이상의 "할증" 문구.
- **NUMBERSTRING**: 표지 한글 금액은 Excel 전용 함수라 LibreOffice·한셀·구글시트에서는 숫자만 나옵니다.
- **구 기능**: `ExcelIO.write`(빈 설계내역서 양식에 쓰기)는 그대로 남아 있습니다. 행 수·직종 수 제한이 있고, 행별 노임 할증은 지원하지 않습니다.
- **SECURITY.md**: 검증 기록이 예전 상태(테스트 18개 등)입니다. 갱신이 필요합니다.
- **테스트 브라우저**: Playwright headless Chromium은 한글 다운로드 파일명을 `download`로 표시합니다. 실제 Chrome·Edge는 정상입니다.

## 5. 다음 작업 후보 (우선순위 순)

1. ~~사용자 결정 반영~~ 3장 세 항목 모두 반영 완료.
2. ~~수량 행 자재명·자재 규격~~ 완료(PR #9 머지).
3. 4-4(제어케이블) 등 많이 쓰는 장부터 자동 추출 해설을 **수작업 규칙**(`commentaryRules`)으로 옮기기. 행별 적용 범위를 지정하고 테스트를 추가합니다.
4. 도면 가져오기 후속: 자주 나오는 공종(제어케이블, 관로 등)을 품셈으로 미리 등록해 "품셈 등록 필요"를 줄이기. 실제 도면으로 AI 답변 품질 점검.
5. ~~노임 적용기간 일괄 수정~~ 완료(2.6). 후속 후보: 엑셀에서 노임을 가져올 때 기본 기간을 공사 기준일의 반기로 정하기.
6. SECURITY.md 검증 기록 갱신

## 6. 검증 방법

### PR #9 구현 검증 기록 (2026-11-12)
- `node restore-reference.cjs`로 원문 이미지 587개 복원·검증 완료.
- `node --test tests/*.test.cjs` 결과 60개 통과, 실패 0개.
- `node build.cjs` 정적 빌드 성공.
- 추가 회귀 테스트에서 두 시트의 자재명·자재 규격 출력, 앞뒤 공백 처리, 빈 자재명의 공종명 대체, 별도 등록 자재 출력을 확인했습니다. 기존 테스트로 수량·단가 수식 연결을 확인했습니다.
- 이번 구현 검증은 Node 테스트와 빌드까지 완료했습니다. 브라우저 직접 조작과 LibreOffice 재계산은 후속 확인 항목입니다.

### 재현 절차와 이전 검증 기록

- 단위 테스트: `node --test tests/*.test.cjs`
  - `tests/design-xlsx.test.cjs`: 엑셀 레이아웃·수식 연결
  - `tests/wages.test.cjs`: 노임 자동 계산
  - `tests/commentary.test.cjs`: 해설 조건
  - 엑셀 테스트 데이터: `tests/fixtures-design-state.cjs`(합성 공사)
- 엑셀 재계산 비교: `AGENTS.md`의 절차를 따릅니다. 지난 확인에서 숫자 셀 154개가 모두 앱 값과 일치했습니다. 수량·자재 수량·노임을 바꾼 뒤의 재계산도 일치했습니다.
- 화면: Playwright로 `dist`를 띄워 공사비 산정 → 산정하기 → 미리보기 탭 → 엑셀 저장을 확인합니다. 내려받은 파일이 Node에서 만든 파일과 같은지도 비교했습니다.

<!-- AUTO-LOG:START -->
## 자동 기록 (머지할 때마다 GitHub Actions가 갱신, 직접 수정 금지)

- 기준 커밋: `4fd1fe1` (2026-11-12)
- 테스트: 통과 67개 / 실패 0개

| 날짜 | PR | 제목 | 머지 커밋 |
|---|---|---|---|
| 2026-11-12 | [#13](https://github.com/yuh2275-dot/ict-estimator/pull/13) | 도면 물량 가져오기 (Claude·ChatGPT 연동) + 해설 조건 곱하기 결정 기록 | `4fd1fe1` |
| 2026-11-12 | [#12](https://github.com/yuh2275-dot/ict-estimator/pull/12) | 정보콘센트 포트 수 산정 + 총공사금액 천원 미만 절사 | `5b2c55d` |
| 2026-11-12 | [#11](https://github.com/yuh2275-dot/ict-estimator/pull/11) | 노임 적용기간 일괄 수정 기능 | `9505ac3` |
| 2026-11-12 | [#9](https://github.com/yuh2275-dot/ict-estimator/pull/9) | 수량 행에 자재명·자재 규격 추가 | `18cc462` |
| 2026-11-12 | [#10](https://github.com/yuh2275-dot/ict-estimator/pull/10) | 자동 기록의 테스트 결과가 "?"로 나오는 문제 수정 | `17e1e56` |
| 2026-11-12 | [#8](https://github.com/yuh2275-dot/ict-estimator/pull/8) | 인계 문서(docs/HANDOFF.md) 자동 갱신 장치 | `804bbf7` |
| 2026-11-12 | [#7](https://github.com/yuh2275-dot/ict-estimator/pull/7) | CLAUDE.md 추가 (AGENTS.md 자동 로드) | `707313a` |
| 2026-11-12 | [#6](https://github.com/yuh2275-dot/ict-estimator/pull/6) | Codex 인계 문서 추가 (AGENTS.md, docs/HANDOFF.md) | `07761c3` |
| 2026-11-11 | [#5](https://github.com/yuh2275-dot/ict-estimator/pull/5) | 공사원가계산 화면에서 원가계산서 미리보기 + 노임 등록 시 노무비 자동 계산 | `ef489b5` |
| 2026-11-11 | [#4](https://github.com/yuh2275-dot/ict-estimator/pull/4) | 원가계산서를 예시 양식에 맞게 정리 | `de4a885` |
| 2026-11-11 | [#3](https://github.com/yuh2275-dot/ict-estimator/pull/3) | 엑셀 저장을 설계내역서 통합문서(8개 시트, 수식 연결)로 변경 | `f0c46c3` |
| 2026-11-11 | [#2](https://github.com/yuh2275-dot/ict-estimator/pull/2) | 추가 배율(해설 계수 직접입력) 중복·오입력 경고 | `53f5709` |
| 2026-11-11 | [#1](https://github.com/yuh2275-dot/ict-estimator/pull/1) | 전체 품셈 공종 해설 할증 조건 반영 (4-3 수작업 대조 + 전체 자동 추출) | `c60328e` |

위 기간에 바뀐 파일 (32개): `.claude/hooks/handoff-guard.cjs`, `.claude/settings.json`, `.github/workflows/handoff-check.yml`, `.github/workflows/handoff-log.yml`, `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/HANDOFF.md`, `index.html`, `src/app.js`, `src/basis-ui.js`, `src/commentary-data.js`, `src/design-xlsx.js`, `src/engine.js`, `src/estimate-ui.js`, `src/style.css`, `src/surcharges.js`, `src/takeoff.js`, `src/xlsx.js`, `tests/catalog.test.cjs`, `tests/commentary.test.cjs`, `tests/design-xlsx.test.cjs`, `tests/engine.test.cjs`, `tests/excel.test.cjs`, `tests/fixtures-design-state.cjs`, `tests/surcharges.test.cjs`, `tests/takeoff.test.cjs`, `tests/wage-period.test.cjs`, `tests/wages.test.cjs`, `tools/extract_commentary.cjs`, `tools/handoff-status.cjs`, `tools/update-handoff-log.cjs`
<!-- AUTO-LOG:END -->
