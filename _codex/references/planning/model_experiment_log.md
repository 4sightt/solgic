# Solgic 모델 실험 로그

이 문서는 Solgic 모델 실험의 **compact 현재 요약판**이다.

모든 실제 실행은 `model_experiment_samples.json`이 구조화 정본 index를 소유하고, 상세 증거는 `_codex/history/model_experiments/`가 소유한다. 이 파일은 반복 표본이 실제 판단을 바꿀 때만 갱신한다.

## 목적

모델의 전체 서열을 만들지 않는다.

목표는 다음 질문에 실제 실행 데이터로 답하는 것이다.

> 특정 Solgic 작업에서 어떤 `model × mode × environment` 조합이 품질·시간·사용량·재작업 비용을 종합했을 때 적합했는가?

평가축은 다음을 함께 본다.

`task type × environment × workflow 범위 × 요구 품질 × wall-clock × UI quota × 산출물 품질 × 독립 review 결과 × operational correctness × 재작업 비용`

UI의 5시간/주간 퍼센트는 정밀 토큰·비용 계량기가 아니다. `used`와 `remaining`을 원래 표시 의미 그대로 보존하며 제품 간 직접 환산하지 않는다.

## 현재 registry 규모

- 총 sample: **1**
- 날짜별: 2026-09-30 **1**

## UI / State cleanup

현재 표본:

- **GPT-6 Sol / High / Codex local repo**
  - 17분 31초
  - 5-hour remaining 60% → 52% (-8pp)
  - weekly remaining 42% → 41% (-1pp)
  - 제한된 multi-file refactor, regression test 추가, 기존 test 검증, handoff 갱신, commit/push까지 완료
  - Codex 자체 browser verification은 로컬 `file://` 정책 때문에 미완료
  - 사용자 제공 실제 브라우저 화면에서는 새 State 패널과 기존 보드 레이아웃의 정상 렌더링을 육안 확인

현재 관찰:

GPT-6 Sol High가 오래 중단된 기존 코드를 파악하고 UI/solver 책임 경계를 정리하는 작업을 한 실행에서 닫을 수 있다는 초기 신호가 있다.

현재 가설:

아직 이 종류의 refactor에 High가 필요한지는 판단하지 않는다. Sol Medium 또는 더 낮은 mode가 유사한 검증 수준을 더 낮은 quota로 달성하는지 대응 표본이 필요하다.

남은 비교:

- UI/state cleanup: Sol High ↔ Sol Medium
- 단순 UI 수정: Sol Medium ↔ 더 낮은 mode
- solver bug fix: Sol Medium ↔ Sol High
- 새 rule module: Sol Medium ↔ Sol High
- graph/connectivity solver 설계: High 필요성 검증
- 독립 regression review: production보다 낮은 mode로 충분한지 검증

## 갱신 규칙

새 sample 하나가 생길 때마다 이 파일을 자동으로 늘리지 않는다.

다음 경우에만 갱신한다.

- 기존 모델 평가가 바뀌었을 때
- 동일 task type의 반복 표본이 생겼을 때
- Medium/High 등 직접 비교가 가능해졌을 때
- 실패 패턴이 반복됐을 때
- 기존 routing 가설을 수정할 근거가 생겼을 때

정리하면:

- registry = 모든 실행의 구조화 원장
- history = 각 실행의 상세 증거
- compact log = 지금까지 무엇을 배웠는가

Solgic 관련 모델 실험 데이터는 이 저장소가 정본이다. `4sightt/docs`에는 자동 복제하지 않는다.
