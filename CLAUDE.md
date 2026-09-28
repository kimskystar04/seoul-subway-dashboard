# 프로젝트 규칙

- 원본 CSV는 `data/raw`에 보존하고 수정하지 않는다.
- 데이터 정제와 분석은 Python과 pandas가 담당한다.
- 웹은 `data/processed/dashboard_data.json`만 읽는다.
- 브라우저에서 원본 CSV를 직접 파싱하지 않는다.
- 자동 검증은 `docs/baseline.json`을 읽고, 사람이 읽는 분석 근거는 `docs/ANALYSIS_BASELINE.md`에 기록한다.
- `docs/baseline.json`과 원본 CSV의 해시는 임의로 변경하지 않는다.
- 테스트는 Python unittest와 Node 내장 테스트(`node:test`)를 사용한다.
- 통합 테스트는 임시 출력 경로를 사용해 추적 중인 JSON을 변경하지 않는다.
- 파일 수정 전 변경 범위를 설명한다.
- 명시적 승인 없이 commit, push, Notion 쓰기를 하지 않는다.
- 비밀정보를 코드와 저장소에 넣지 않는다.
