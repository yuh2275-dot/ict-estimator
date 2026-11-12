# AGENTS.md — ICT Estimator 작업 안내 (Codex·Claude 공용)

2026년 정보통신공사 표준품셈 기반 공사비 산정 정적 웹앱입니다. 빌드 도구·서버·외부 CDN 없이 `index.html` + `src/*.js`로 동작하고, `main`에 push하면 GitHub Pages로 배포됩니다.
최근 작업 내역과 남은 과제는 `docs/HANDOFF.md`를 먼저 읽으세요.

## 명령

```bash
node restore-reference.cjs        # 원문 이미지(src/reference) 복원. 테스트·빌드 전에 1회
node --test tests/*.test.cjs      # 전체 테스트 (현재 59개 통과)
node build.cjs                    # dist/ 생성 (index.html, src, vendor만 복사)
node tools/extract_commentary.cjs # 원문 [해 설] → src/commentary-data.js 재생성 (직접 수정 금지)
```

로컬 확인: `python3 -m http.server 8765 --directory dist` 후 브라우저로 `http://localhost:8765/`.

## 구조

| 파일 | 역할 |
|---|---|
| `src/engine.js` | `Estimator.calculate(state)` — 재료비·노무비·경비·제비율·총액. 직종별 노무비 합산 후 원 단위 처리 |
| `src/surcharges.js` | 공통 할증(1-2-2), 동시포설(4-3-1 ⑧), 공종 해설 조건(`commentary`, `commentaryFactors`), 추가 배율 경고(`customWarnings`), `combined()`가 최종 계수 산출 |
| `src/commentary-data.js` | 자동 생성. 555개 절의 해설 항목·선택지 |
| `src/standards.js` | 기본 등록 6개 품셈 (4-3-1~4-3-3, 원문 대조 완료) |
| `src/catalog-data.js` | 원문 587쪽 텍스트·표·계산 후보 4,032개 (5.6MB, 직접 수정 금지) |
| `src/design-xlsx.js` | `DesignWorkbook` — 엑셀 저장(8개 시트, 수식 연결)과 화면 미리보기(`toHtml`) |
| `src/xlsx.js` | `ExcelIO` — 엑셀 읽기, 기존 "빈 설계내역서 양식에 쓰기"(구 기능) |
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

## 엑셀 출력 검증 (LibreOffice가 있을 때)

캐시 값을 지운 뒤 강제 재계산해서 앱 값과 비교합니다. LibreOffice는 캐시가 있으면 재계산하지 않으므로 반드시 openpyxl로 다시 저장해 캐시를 지우세요.

```bash
python3 -c "import openpyxl; openpyxl.load_workbook('design.xlsx').save('nocache.xlsx')"
soffice --headless --calc --convert-to xlsx --outdir rc nocache.xlsx
# design.xlsx(data_only)와 rc/nocache.xlsx(data_only)의 숫자 셀을 비교
```

표지의 `NUMBERSTRING`은 Excel 전용이라 LibreOffice에서는 IFERROR 대체 문구(숫자만)가 나옵니다.
