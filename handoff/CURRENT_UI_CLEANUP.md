# Handoff — UI / State Panel Cleanup

Date: 2026-09-30  
Repository: `4sightt/solgic`  
Branch: `main`

## 목적

Solgic은 수개월간 중단되었다가 다시 점검 중인 프로젝트다. 본격적인 solver 재설계 전에 기존 UI와 오래된 임시 코드부터 정돈한다.

이번 작업의 핵심은 **UI 외형을 최대한 보존하면서 오른쪽 State 패널과 UI/solver 상태 관리만 깨끗하게 정리하는 것**이다.

State 패널의 주된 용도는 일반 사용자용 장식 로그가 아니다.

> 사용자가 현재 퍼즐/solver 상황을 ChatGPT, Codex, Cowork 등에 복붙하여 정확히 전달하기 위한 통신 인터페이스다.

따라서 State 출력은 사람이 보기 좋으면서도 AI가 안정적으로 파싱할 수 있는 compact canonical dump가 되어야 한다.

## 먼저 읽을 파일

- `AGENTS.md`
- `CURRENT_CONTEXT.md`
- `index.html`
- `engine-q.js`
- 필요 시 `engine-2g.js`, `engine-2c.js`, `engine-2f.js`

현재 UI 구조와 solver 동작을 먼저 확인한 뒤 수정한다.

## 보존 원칙

- 보드 중심의 현재 UI 외형은 최대한 보존한다.
- 셀 크기, 좌표축, 어두운 테마, 상단 컨트롤, 우측 State 카드의 전체 배치는 가능한 한 유지한다.
- 이번 작업에서 Common Proof Engine, 2B, 복합 규칙 시스템 등의 대규모 아키텍처 작업을 시작하지 않는다.
- solver의 추론 알고리즘을 불필요하게 변경하지 않는다.
- `?`는 **unknown이 아니라 이미 열린 safe 칸**이라는 기존 의미를 유지한다.
- 추론 결과는 proof로 확정된 safe/mine만 표시한다는 기존 원칙을 유지한다.

## 현재 확인된 문제

### 1. `STATE.last`가 너무 많은 역할을 맡음

현재 `index.html`에서 하나의 `STATE.last`에 다음이 섞인다.

- 마지막 셀 입력/선택
- mines 변경
- copy/paste 상태
- State copy 상태
- solver 추론 결과
- `checkLines`
- `mine` / `safe`
- 2F의 큰 `proofs` 객체

그리고 `render()`가 이를 그대로 `JSON.stringify(STATE.last)` 하여 상단에 출력한다.

결과적으로 사용자/AI용 상태 요약과 내부 디버그 객체가 뒤섞인다.

### 2. 추론 결과가 사소한 UI 액션에 의해 덮어써짐

예:

- Copy 후 `STATE.last = {copy:'ok'}`
- State Copy 후 `STATE.last = {state:'copied'}`
- mines 변경 후 별도 객체로 교체

따라서 직전 추론 결과가 쉽게 사라진다.

### 3. UI 책임이 solver 파일로 새어 나감

`engine-q.js` 안의 `installQuadEngineInfoPatch()`가:

- `document.getElementById('fileInfo')`
- `MutationObserver`
- mode change listener

등을 이용해 UI의 엔진 표시를 직접 덮어쓴다.

반면 `index.html`에도 이미 `updateEngineInfo()`가 있다.

**엔진 파일은 solver I/O만 담당하고 DOM/UI는 `index.html`이 단독 관리하도록 정리하는 것이 목표다.**

### 4. 2G 버전 표시가 잘못될 수 있음

Quad의 UI patch는 `window.ENGINE_2G_VERSION`을 찾지만 현재 `engine-2g.js`는 버전 상수를 `window`에 등록하지 않는다.

따라서 2G가 실제 로드되어 있어도 상태 표시에서 not loaded처럼 보일 수 있다.

### 5. 변경 순서(order) 기능이 반쯤 구현됨

현재 첫 추론 이후 사용자가 입력한 칸에 1, 2, 3... badge를 붙이는 기능이 있다.

이 기능은 의도상 매우 유용하다.

> “직전 추론 이후 사용자가 게임 화면에서 확인하여 새로 입력한 변화”

를 표현할 수 있기 때문이다.

하지만 현재는:

- 다음 추론 시 명확하게 reset되지 않고 계속 누적될 수 있음
- State 복붙 텍스트에 변경 내역이 포함되지 않음

장기적으로는 다음처럼 State dump에 포함하는 것이 유용하다.

```text
CHANGES SINCE LAST INFERENCE:
1. D3 = F
2. G2 = 2
3. G3 = ?
```

### 6. State dump가 canonical protocol이 아님

현재 State Copy는 대략 다음을 합친다.

- selection text
- engine/file info
- raw `lastInfo`
- board를 뺀 IO JSON
- 화면에 보이는 State text

중복과 내부 상태 노이즈가 많다.

## 권장 내부 구조

최소한 다음처럼 역할을 분리한다.

```js
STATE.lastAction
STATE.lastInference
STATE.err
```

- `lastAction`: 필요하면 UI용 최근 입력 표시
- `lastInference`: solver의 가장 최근 결과를 유지
- copy/paste 성공 같은 일시적 UI 상태는 solver inference를 덮어쓰지 않음

2F의 `proofs`는 버리지 않는다. 다만 기본 State dump에 raw 전체를 출력하지 않는다.

## 권장 State dump 형태

정확한 문구는 구현하면서 다듬어도 되지만, 정보 구조는 대략 다음을 목표로 한다.

```text
SOLGIC STATE v1

MODE: 2F
ENGINE: engine-2f v003
SIZE: 7x7
TOTAL MINES: 14

LEGEND:
. = unopened
? = opened safe
F = mine/flag

BOARD:
    A B C D E F G
1 | . . ? . . . .
2 | . 1 1 . F . .
...

CHANGES SINCE LAST INFERENCE:
1. D3 = F
2. G2 = 2

LAST INFERENCE:
STATUS: OK
MINE: ...
SAFE: ...
EXHAUSTED: true

CHECK:
- ...
```

핵심은 **현재 보드 + 활성 모드/엔진 + 직전 추론 요약 + 추론 이후 변경점**만 복붙해도 다른 AI가 현재 상태를 정확히 복원할 수 있게 하는 것이다.

선택 좌표, copy 성공 여부, 거대한 proof JSON 등은 기본 canonical dump에 넣지 않는다.

## 이번 작업에서 권장하는 실제 변경 범위

1. `engine-q.js`의 DOM / MutationObserver UI patch 제거
2. 엔진 표시 책임을 `index.html` 한 곳으로 통합
3. 활성 엔진 버전을 정확히 표시하도록 정리
4. `STATE.last` 역할 분리
5. copy / State copy / 입력 등의 UI 액션이 직전 inference를 덮어쓰지 않게 수정
6. canonical `buildStateDump()` 같은 단일 생성 함수 도입
7. 직전 추론 이후 변경 사항을 State dump에 포함하고 추론 시점 기준으로 reset
8. 기본 State dump에서는 큰 `proofs` 객체 제외
9. 기존 보드 입출력/추론/표시 동작이 깨지지 않았는지 확인

필요하면 아주 작은 보조 함수/구조 정리는 가능하지만, 이번 단계에서 대규모 UI 재작성이나 solver 아키텍처 변경은 하지 않는다.

## 완료 기준

- 기존 UI 외형과 보드 입력 흐름이 사실상 그대로다.
- Q/2G/2C/2F 활성 엔진 표시가 정확하다.
- solver 파일이 DOM을 직접 조작하지 않는다.
- 추론 결과가 copy, selection, 숫자 입력 같은 동작 때문에 소실되지 않는다.
- State 버튼으로 복사되는 텍스트만으로 현재 퍼즐 상태를 AI에게 전달할 수 있다.
- State dump에 raw proof/debug 객체가 불필요하게 포함되지 않는다.
- “직전 추론 이후 변경”이 명시적으로 확인 가능하다.
- 기존 2F 회귀 테스트가 계속 통과한다.
- 가능한 범위에서 브라우저 UI 동작도 직접 확인한다.

## 작업 시 주의

- 현재 코드를 실제로 다시 읽고 위 메모와 다르면 **GitHub 최신 코드가 우선**이다.
- 오래된 코드 때문에 이상한 패치가 보이면 단순 삭제 전에 현재 의도를 확인하고 최소 변경으로 정리한다.
- 새 기능 욕심보다 경계 정리와 상태 전달의 신뢰성이 우선이다.

## 작업 결과

- 변경 파일: `index.html`, `engine-q.js`, `engine-2g.js`, `tests/ui-state.test.js`, 이 문서. 엔진 두 파일의 변경은 작업 중 `main`의 `df02183`에 반영되었다.
- 핵심 변경: Quad 엔진의 DOM/MutationObserver 패치를 제거하고, UI에서 활성 모드의 엔진 버전을 표시한다. 2G 버전을 브라우저에 명시적으로 등록했다. `STATE.lastAction`과 `STATE.lastInference`를 분리하여 복사·선택·입력 후에도 직전 추론 요약을 유지한다. 화면의 State와 State 버튼 복사는 같은 `SOLGIC STATE v1` 생성 함수를 사용한다. 보드, 모드, 엔진, 총 지뢰 수, 열린 안전칸 `?`의 의미, 마지막 추론 요약/검사 내용, 추론 이후 변경된 칸의 최종값을 담고 raw `proofs`는 제외한다. 변경 badge/목록은 매 추론 시 초기화되며 기준 상태로 되돌린 칸은 목록에서 제거한다. 모드·크기·붙여넣기·Clear는 해당 보드의 추론 기준을 초기화한다.
- 테스트/검증: `node tests/engine-2f.test.js` 6/6 통과. `node tests/ui-state.test.js` 통과(활성 엔진 표시, State/IO 복사와 JSON 붙여넣기, 추론 유지, 변경 순서/초기화, W 표현). `git diff --check` 통과. 인라인 스크립트 구문 검사 통과. 브라우저의 로컬 `file://` 접근이 도구 보안 정책으로 거부되어 실제 브라우저 화면 검증은 수행하지 못했다.
- 남은 문제: 실제 브라우저에서 배치와 클릭 흐름의 육안 확인은 미검증이다. solver 추론 알고리즘과 2B/Common Proof Engine은 이번 범위에서 변경하지 않았다.
