# Solgic Experiments / Model

이 폴더는 Solgic 개발 작업에서 사용하는 모델·mode별 실험 데이터를 관리한다.

## 목적

표본이 쌓였을 때 작업 유형별로 적절한 모델/mode를 선택하여 사용량과 재작업 비용을 줄이는 것이 목적이다.

## 정본

- `model_experiment_log.md` — Solgic 모델 실험의 현재 정본
- 외부 `docs` 저장소에 만들어진 기존 Solgic 로그는 초기 snapshot으로만 남기고 앞으로 갱신하지 않는다.

## 기록 대상

- UI / 상태 관리
- 일반 구현
- 디버깅
- 회귀 테스트
- solver 알고리즘
- 새 rule module
- graph/connectivity 규칙
- 아키텍처 변경
- 독립 검토 / repair

단순 시간·quota뿐 아니라 재작업 필요 여부, 테스트 결과, 회귀 여부, commit/push 완료 여부를 함께 기록한다.
