# AGENTS.md — ICT Estimator 작업 안내 (Codex·Claude 공용)

## 작업 시작 전 필수 (사용자에게 묻기 전에 먼저 할 것)

1. `main`을 최신으로 받습니다: `git fetch origin main` 후 작업 브랜치를 최신 `main` 위에서 시작합니다. 인계 문서는 자주 바뀌므로 오래된 사본으로 판단하지 마세요.
2. `docs/HANDOFF.md` 전체를 읽습니다. 지금까지 한 일, 동작 방식, 사용자 결정 사항, "다음 작업"이 모두 여기 있습니다.
3. **진행 상황·이전 작업자(Claude/Codex)가 어디까지 했는지·결과물 위치를 사용자에게 묻지 마세요.** HANDOFF.md, 맨 아래 AUTO-LOG(머지된 PR 목록), `git log`로 확인합니다. 문서에 없는 것을 정할 때만 사용자에게 묻습니다.
4. 사용자가 "이어서 해줘"라고만 하면 HANDOFF.md 5장 "다음 작업"의 첫 항목부터 진행합니다.

2026년 정보통신공사 표준품셈 기반 공사비 산정 정적 웹앱입니다. 빌드 도구·서버·외부 CDN 없이 `index.html` + `src/*.js`로 동작하고, `main`에 push하면 GitHub Pages로 배포됩니다.
최근 작업 내역과 남은 과제는 `docs/HANDOFF.md`를 먼저 읽으세요.

## 명령

```bash
node restore-reference.cjs        # 원문 이미지(src/reference) 복원. 테스트·빌드 전에 1회
node --test tests/*.test.cjs      # 전체 테스트 (현재 108개 통과)
node build.cjs                    # dist/ 생성 (index.html, src, vendor만 복사)
node tools/extract_commentary.cjs # 원문 [해 설] → src/commentary-data.js 재생성 (직접 수정 금지)
node tools/handoff-status.cjs origin/main HEAD  # 코드 변경에 HANDOFF 갱신이 포함됐는지 확인
```

로컬 확인: `python3 -m http.server 8765 --directory dist` 후 브라우저로 `http://localhost:8765/`.

## 구조

| 파일 | 역할 |
|---|---|
| `src/engine.js` | `Estimator.calculate(state)` — 재료비·노무비·경비·제비율·총액. 직종별 노무비 합산 후 원 단위 처리 |
| `src/surcharges.js` | 공통 할증(1-2-2), 동시포설(4-3-1 ⑧), 공종 해설 조건(`commentary`, `commentaryFactors`), 추가 배율 경고(`customWarnings`), `combined()`가 최종 계수 산출 |
| `src/commentary-data.js` | 자동 생성. 555개 절의 해설 항목·선택지 |
| `src/standards.js` | 기본 등록 6개 품셈 (4-3-1~4-3-3, 원문 대조 완료) |
| `src/standards-verified.js` | 원문 이미지와 대조해 등록한 품셈(3장·4장 779개). 행 순서가 id이므로 순서 변경 금지. 새 장을 추가할 때는 원문 **이미지**를 보고 입력(텍스트 층에 없는 표가 있음) |
| `src/catalog-data.js` | 원문 587쪽 텍스트·표·계산 후보 4,032개 (5.6MB, 직접 수정 금지) |
| `src/design-xlsx.js` | `DesignWorkbook` — 엑셀 저장(8개 시트, 수식 연결)과 화면 미리보기(`toHtml`) |
| `src/xlsx.js` | `ExcelIO` — 엑셀 읽기, 기존 "빈 설계내역서 양식에 쓰기"(구 기능) |
| `src/material-recipes.js` | 자재 구성 추천(품셈별 주자재·부자재·부속품률 세트)과 같은 공사 단가 재사용(`priceBook`) |
| `src/takeoff.js` | 도면 물량 가져오기: AI 요청문 생성, AI 답변(JSON) 해석·품셈 매칭, 수량 행 추가 |
| `src/estimate-ui.js` | 공사비 산정 화면(공종 입력, 해설 조건, 동시포설, 공통 할증) |
| `src/app.js` | 메뉴·상태·JSON 저장/열기·공사원가계산 화면 미리보기 |
| `src/basis-ui.js`, `src/rate-sheet.js` | 노임·제비율 입력 |
| `tools/` | 원문 추출 스크립트 |

## 반드시 지킬 것

- **새 스크립트 파일을 추가하면** `index.html`의 `<script>`와 `src/app.js`의 보안 점검 허용 목록(`allowed=[...]`)에 함께 넣고, 캐시 버전 문자열(`?v=...`)을 두 곳 모두 올리세요. 앱 테스트(`tests/catalog.test.cjs`의 `startApp`) 스크립트 목록에도 추가해야 합니다.
- CSP가 `connect-src 'none'`입니다. fetch·외부 CDN·localStorage를 쓰지 마세요.
- 화면 출력 문자열은 `esc()`로 이스케이프합니다.
- 계산 규칙을 바꾸면 **엔진 값 = 엑셀 수식 재계산 값**이 유지되는지 확인하세요(아래 검증 절차).
- 원문에 없는 계수는 만들지 마세요. 해석이 들어간 부분은 근거 문자열(`basis`)과 README에 적습니다.
- 커밋·PR 메시지에 모델명을 쓰지 마세요. PR은 사용자가 확인 후 머지합니다.
- 업무 Excel 원본, 실제 공사 데이터는 저장소에 넣지 마세요. 테스트 데이터는 합성 데이터만 씁니다.
- **코드를 바꾸는 PR에는 `docs/HANDOFF.md` 갱신을 함께 넣으세요.** PR 검사(`handoff-check`)가 확인합니다. 작업 도중 사용량이 끊겨도 다음 작업자가 이어받을 수 있도록, 큰 작업은 중간중간 커밋할 때마다 갱신하는 것이 좋습니다. 갱신할 곳은 "머지된 변경", "동작 요약", "사용자 확인이 필요한 해석", "다음 작업"입니다. 맨 아래 AUTO-LOG 구간은 GitHub Actions가 쓰므로 고치지 마세요.

## 엑셀 출력 검증 (LibreOffice가 있을 때)

캐시 값을 지운 뒤 강제 재계산해서 앱 값과 비교합니다. LibreOffice는 캐시가 있으면 재계산하지 않으므로 반드시 openpyxl로 다시 저장해 캐시를 지우세요.

```bash
python3 -c "import openpyxl; openpyxl.load_workbook('design.xlsx').save('nocache.xlsx')"
soffice --headless --calc --convert-to xlsx --outdir rc nocache.xlsx
# design.xlsx(data_only)와 rc/nocache.xlsx(data_only)의 숫자 셀을 비교
```

표지의 `NUMBERSTRING`은 Excel 전용이라 LibreOffice에서는 IFERROR 대체 문구(숫자만)가 나옵니다.
