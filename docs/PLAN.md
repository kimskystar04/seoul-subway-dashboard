# 구현 계획 (PLAN)

## 구조

- **Python/pandas** (`scripts/analyze.py`): 원본 CSV를 정제·검증·집계하고 `data/processed/dashboard_data.json`을 생성한다.
- **HTML/CSS/JavaScript** (`index.html`, `css/style.css`, `js/*.js`): JSON을 로드해 필터, KPI, 차트, 표를 렌더링한다.
- **Chart.js 4.5.1 (CDN, UMD)**: 상위 역/노선별/날짜별 차트.
- **Python unittest** (`tests/test_analysis.py`): 데이터 파이프라인 검증.
- **Node 내장 테스트 (`node:test`)** (`tests/analysis.test.js`): 웹 필터·집계 순수 함수 검증.

## 파일과 책임

| 파일 | 책임 |
|---|---|
| `scripts/analyze.py` | CSV 해시 검증 → 파싱(`index_col=False`) → 형변환 → 집계 → `docs/baseline.json` 대조 → JSON 저장 |
| `data/processed/dashboard_data.json` | 웹이 읽는 유일한 데이터 소스 |
| `js/data.js` | JSON fetch, 상태 저장 |
| `js/analysis.js` | 순수 함수: 날짜/노선 필터, KPI 집계, 상위 역, 노선별 집계, 날짜별 집계 |
| `js/app.js` | DOM 렌더링, 이벤트 바인딩, Chart.js 인스턴스 관리 |
| `css/style.css` | 반응형 레이아웃, 라이트/다크 테마, 포커스 스타일 |

## JSON 데이터 계약

```json
{
  "metadata": {
    "source_file": "CARD_SUBWAY_MONTH_202608.csv",
    "sha256": "...",
    "generated_at": "ISO-8601",
    "date_start": "2026-08-01",
    "date_end": "2026-08-31",
    "valid_rows": 19133
  },
  "summary": {
    "total_boardings": 208329561,
    "total_alightings": 207340153,
    "total_usage": 415669714,
    "weekday_day_count": 21,
    "weekend_day_count": 10,
    "weekday_daily_average": 15030554.43,
    "weekend_daily_average": 10002807.10
  },
  "records": [
    { "date": "2026-08-01", "line": "중앙선", "station": "양원", "boardings": 1912, "alightings": 1927 }
  ]
}
```

`records`는 원본과 동일한 (날짜, 노선, 역) 단위 그레인을 유지한다. 브라우저는 이 배열을 `js/analysis.js`의 순수 함수로 필터·집계해 KPI/차트/표를 만든다 (같은 역명은 노선 무관 합산, 노선별 집계는 노선 기준 합산).

## 필터·차트 동작

- 날짜 범위 필터 + 노선 필터(전체/단일 노선 선택)를 모든 KPI·차트·표에 동일 적용.
- 시작일 > 종료일: 필터 미적용 + 안내 메시지.
- 필터 결과 0건: "데이터 없음" 메시지, 차트/표는 빈 상태로 렌더링(에러 아님).
- 하루만 선택: KPI/차트/표 정상 동작(단일 날짜 집계).
- 차트 재생성 전 기존 Chart 인스턴스 `.destroy()`.

## 테스트 항목

**Python (`tests/test_analysis.py`)**
- CSV 컬럼 밀림 방지(`index_col=False`) 검증
- 해시 불일치 시 중단 검증
- summary 합계가 `docs/baseline.json`과 일치
- 상위 역 Top3 일치
- 통합 테스트: `tempfile.TemporaryDirectory()`에 출력, 추적 중인 JSON 불변

**Node (`tests/analysis.test.js`)**
- 날짜 범위 필터
- 노선 필터
- KPI 집계(승차/하차/전체 이용량)
- 평일/주말 일평균 계산
- 상위 역 정렬(역명 기준 노선 무관 합산)
- 노선별 집계
- 날짜별 집계
- 시작일 > 종료일 예외 처리
- 결과 0건 처리
- 하루만 선택 처리

## 로컬 실행 방법

```bash
python -m pip install -r requirements.txt
python scripts/analyze.py
python -m unittest discover -s tests -p "test_*.py"
npm test
python -m http.server 8000
```

## 완료 검증 방법

- `python scripts/analyze.py` 실행 후 콘솔에 `docs/baseline.json` 대조 결과 PASS 출력.
- Python/Node 테스트 전체 통과.
- 브라우저에서 KPI/차트/표/필터/다크모드/키보드 접근성 수동 확인.
- 테스트 실행 전후 `git status`로 추적 중인 `dashboard_data.json` 해시 불변 확인.

범위 제외: React/Vue, 데이터베이스, 로그인, 백엔드 서버, GitHub Pages에서 Python 실행.
