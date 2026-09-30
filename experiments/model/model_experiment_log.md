# Solgic 모델 실험 로그

> Canonical location: `4sightt/solgic/experiments/model/model_experiment_log.md`  
> 2026-09-30부터 Solgic 관련 모델 실험 데이터는 이 저장소에서 관리한다. `4sightt/docs`에 생성된 기존 파일은 초기 snapshot으로만 남기며 이후 정본으로 갱신하지 않는다.

이 문서는 Solgic 개발 작업에서 모델·mode·작업 유형별 효율을 비교하기 위한 **전용 실험 로그**다.

목적은 모델을 고정 서열화하는 것이 아니라, 표본이 쌓였을 때 작업 유형에 따라 적절한 모델/mode를 선택하여 **사용량 소모와 재작업 비용을 함께 줄이는 것**이다.

Thought OS의 Essay / Final Review / Radar / Series maintenance 실험은 `model_experiment_log.md`에서 관리하고, Solgic의 코딩·디버깅·테스트·solver 설계 표본은 이 문서에서 분리해 관리한다.

## 기록 원칙

- 실제 실행에서 확인된 모델, mode, 작업 범위, 시간, UI quota 변화만 기록한다.
- UI quota 퍼센트는 정밀 토큰/비용 계량기가 아니므로 동일 task profile 안의 경험적 신호로만 사용한다.
- 단순 완료 여부뿐 아니라 **재작업 필요 여부, 테스트 결과, 회귀 여부, 독립 검증 상태**를 함께 기록한다.
- 낮은 quota로 끝났더라도 후속 High 재작업이 필요하면 실제 비용이 낮았다고 보지 않는다.
- 모델 우위나 canonical routing은 충분한 반복 표본이 생기기 전에는 확정하지 않는다.
- GitHub commit/handoff와 대조 가능한 경우 실제 반영 상태를 확인한다.

## Sample registry

| sample_id | date | environment | model / mode | task | duration | 5h quota | weekly quota | outcome |
|---|---|---|---|---|---:|---:|---:|---|
| SOLGIC-20260930-001 | 2026-09-30 | Codex / local Solgic repo | GPT-6 Sol / High | UI·State protocol cleanup | 17m 31s | remaining 60% → 52% (-8pp) | remaining 42% → 41% (-1pp) | implemented, tested, committed/pushed |

---

## SOLGIC-20260930-001

### 실행

- provider: ChatGPT
- environment: Codex, local Solgic repository
- model: GPT-6 Sol
- mode: High
- started_at: 2026-09-30T17:05:17+09:00
- ended_at: 2026-09-30T17:22:48+09:00
- duration: 00:17:31
- 5-hour remaining: 60% → 52% (**-8pp**)
- weekly remaining: 42% → 41% (**-1pp**)

### 작업

기존 Solgic UI 외형과 solver 동작을 최대한 보존하면서 다음 범위를 정돈했다.

- State 패널을 사용자↔AI 복붙용 canonical 상태 전달 인터페이스로 정리
- UI 상태와 solver inference 상태 분리
- copy / input 이후에도 직전 inference 보존
- Quad 엔진의 DOM/MutationObserver UI 책임 제거
- 2G 엔진 버전 표시 정리
- 추론 이후 변경 셀 추적과 State dump 통합
- raw proof 객체를 기본 State dump에서 제외
- UI 상태 회귀 테스트 추가
- handoff 결과 기록

solver 알고리즘 자체와 2B/Common Proof Engine은 범위에서 제외했다.

### 결과 및 검증

- 최종 구현 커밋: `0f975c533e4e872718402d2e227b2816fad0d556`
- 중간 엔진 정리 커밋: `df0218331dd0a140b3726a2fcc59c0a4bedc6a48`
- `tests/engine-2f.test.js`: **6/6 통과**
- `tests/ui-state.test.js`: 통과
- `git diff --check`: 통과
- inline script syntax check: 통과
- handoff 문서 갱신 완료
- GitHub `main`에 commit/push 완료

Codex의 browser-use 도구는 로컬 `file://` 접근 정책 때문에 직접 화면 검증을 완료하지 못했다. 이후 사용자 화면에서 새 State 패널과 기존 보드 레이아웃이 정상 렌더링되는 것은 육안 확인되었다. 다만 클릭 흐름 전체를 독립적으로 재검증한 표본은 아니다.

### 현재 관찰

이번 단일 표본에서 GPT-6 Sol High는 **기존 코드 파악 → 제한된 multi-file refactor → 회귀 테스트 추가 → 기존 테스트 검증 → handoff 갱신 → commit/push**까지 약 17분 31초에 닫았다.

표시 quota 변화는 5시간 -8pp, 주간 -1pp였다. 작업 결과는 현재까지 별도 재작업 없이 유지되고 있다.

이는 Sol High가 오래 중단된 프로젝트의 상태 복원과 경계 정리, 테스트 보강을 한 번에 처리할 수 있다는 초기 신호다. 그러나 표본 1건이므로 **이 수준의 UI/상태 정리에 High가 필요한지, Medium 또는 더 낮은 mode가 같은 품질을 더 낮은 quota로 달성할지는 아직 판단하지 않는다.**

### 향후 비교에 유용한 대응 표본

같거나 유사한 범위에서 다음을 비교하면 routing 판단에 도움이 된다.

- UI/state cleanup — GPT-6 Sol Medium
- 단순 UI 수정 — Luna/Terra 계열
- solver 버그 수정 — Sol Medium vs High
- 새 rule module 구현 — Sol Medium vs High
- graph/connectivity solver 설계 — High 이상 필요성 검증
- 독립 regression review — 낮은 mode로 충분한지 검증

