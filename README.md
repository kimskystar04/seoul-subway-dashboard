# 서울 지하철 이용량 대시보드

2026년 8월 서울 지하철 승하차 데이터를 Python으로 분석하고, 정적 웹 대시보드로 시각화한 프로젝트입니다.

- Live Demo: https://kimskystar04.github.io/seoul-subway-dashboard/ (GitHub Pages 활성화 직후 배포됩니다)
- GitHub: https://github.com/kimskystar04/seoul-subway-dashboard

## 사용 기술

- Python, pandas (데이터 정제·분석)
- JSON (분석 결과 전달 계약)
- HTML, CSS, Vanilla JavaScript (프레젠테이션)
- Chart.js 4.5.1 (차트)
- Python `unittest`, Node 내장 `node:test` (테스트)
- GitHub Pages (정적 배포)

## Python → JSON → 웹 구조

```
data/raw/CARD_SUBWAY_MONTH_202608.csv   (원본, 수정하지 않음)
        │  scripts/analyze.py (pandas)
        ▼
data/processed/dashboard_data.json      (metadata, summary, top_stations, records)
        │  fetch()
        ▼
index.html + js/data.js + js/analysis.js + js/app.js (필터·집계·렌더링)
```

GitHub Pages는 정적 파일(HTML/CSS/JS/JSON)만 제공합니다. **Python은 배포 환경에서 실행되지 않으며**, `dashboard_data.json`은 배포 전에 로컬에서 미리 생성해 저장소에 포함합니다.

## 주요 기능

- 날짜 범위 필터 + 노선 필터 (모든 KPI·차트·표에 동일 적용)
- KPI 카드 5개: 전체 승차, 전체 하차, 전체 이용량, 평일 일평균, 주말 일평균
- 이용객 상위 10개 역 차트 (같은 역명은 노선과 무관하게 합산)
- 노선별 이용량 차트
- 날짜별 이용량 추이 차트
- 상세 데이터 표
- 반응형 레이아웃 + 라이트/다크 모드 + 키보드 포커스 표시
- 예외 처리: 시작일 > 종료일 안내, 결과 0건 시 "데이터 없음" 메시지, 하루만 선택해도 정상 동작

## 데이터 출처와 분석 기간

- 원본 파일: `CARD_SUBWAY_MONTH_202608.csv`
- 분석 기간: 2026-08-01 ~ 2026-08-31 (31일)
- 유효 행 수: 19,133건 (결측·중복·음수 없음)

## 검증된 기준값

| 항목 | 값 |
|---|---:|
| 전체 승차 | 208,329,561 |
| 전체 하차 | 207,340,153 |
| 전체 이용량 | 415,669,714 |
| 평일 일평균 (21일) | 15,030,554.43 |
| 주말 일평균 (10일) | 10,002,807.10 |
| 상위 1위 역 | 서울역 (7,320,176) |

기준값은 `docs/baseline.json`에 고정되어 있으며, `scripts/analyze.py`는 실행할 때마다 원본 CSV의 SHA-256과 재계산한 요약값을 이 파일과 자동으로 대조하고, 일치하지 않으면 JSON 생성을 중단합니다. 독립 계산 근거는 `docs/ANALYSIS_BASELINE.md`에 기록되어 있습니다.

데이터 탐색 중 발견한 이슈: 원본 CSV는 각 데이터 행 끝에 이름 없는 빈 필드가 하나 더 있어(헤더 6개 vs 데이터 7개), `pandas.read_csv`를 옵션 없이 호출하면 첫 컬럼이 암묵적으로 인덱스로 사용되며 나머지 컬럼이 한 칸씩 밀립니다. `scripts/analyze.py`는 `index_col=False`를 명시해 이 문제를 방지합니다.

## 로컬 실행 방법

```bash
python -m pip install -r requirements.txt
python scripts/analyze.py
python -m http.server 8000
# 브라우저에서 http://localhost:8000 접속
```

## 테스트 명령

```bash
python -m unittest discover -s tests -p "test_*.py"   # 11개 테스트
npm test                                               # 13개 테스트 (node:test)
```

Python 통합 테스트는 `tempfile.TemporaryDirectory()`에 결과를 생성하므로 저장소에 커밋된 `data/processed/dashboard_data.json`을 변경하지 않습니다.

## GitHub Pages 정적 배포

이 저장소는 `main` 브랜치의 루트(`/`)를 GitHub Pages 소스로 사용합니다. 모든 리소스 경로는 상대경로(`css/style.css`, `js/app.js`, `data/processed/dashboard_data.json`)로 작성되어 프로젝트 하위 경로(`/seoul-subway-dashboard/`)에서도 정상 동작합니다.

## 참고

`ui-ux-pro-max`와 같은 외부 Claude Code Skill은 개발 중 UI 개선을 돕는 도구이며, 배포된 정적 사이트의 실행 의존성이 아닙니다.
