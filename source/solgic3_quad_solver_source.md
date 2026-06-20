# Solgic3 Quad Solver Source

## 목적

이 문서는 `engine-q.js` 제작을 위한 상세 소스 문서다.  
다음 채팅창에서도 게임 규칙을 다시 설명하지 않고 Quad 엔진 작업을 바로 이어가기 위해 작성했다.

현재 목표는 **Solgic3에 Quad(쿼드) 모드 전용 추론 엔진 `engine-q.js`를 추가하는 것**이다.  
사용자는 초기 숫자/상태를 입력하고 추론 버튼을 누른다. 엔진은 그 시점에서 논리적으로 확정된 안전칸 또는 지뢰칸만 표시해야 한다.

---

## 프로젝트 개요

Solgic3는 Minesweeper Variants용 브라우저 기반 솔버 UI다.

핵심 파일:

- `index.html`: UI, 보드 입력, 상태 출력, 추론 버튼
- `engine-2g.js`: 기존 2G 모드 추론 엔진
- `engine-q.js`: 새로 만들 Quad 모드 추론 엔진

`engine-q.js`는 기존 엔진과 비슷하게 전역 함수로 연결한다.

```js
window.ENGINE_Q_VERSION = "engine-q v001";
window.inferQ = function inferQ(io) {
  // return inference result
};
```

---

## 좌표 규칙

사용자에게 보여주는 좌표는 **열 문자 + 행 숫자** 형식을 사용한다.

예:

- `E1 = 1`
- `C3 = 3`
- `C4 = 2`

내부 좌표는 기존 Solgic UI처럼 **0-index `(x, y)`**를 사용할 수 있다.

예:

- `C3` = `{ x: 2, y: 2 }`
- `C4` = `{ x: 2, y: 3 }`
- `E1` = `{ x: 4, y: 0 }`

엔진 내부에서는 0-index를 써도 되지만, UI/출력/설명에서는 가능하면 `C3` 같은 표기를 우선한다.

---

## 공통 Minesweeper 규칙

기본은 일반 지뢰찾기다.

- 숫자칸은 주변 8칸의 지뢰 개수를 뜻한다.
- 깃발(`F`)은 이미 확정된 지뢰다.
- 열린 숫자칸은 안전칸이며 숫자 단서를 제공한다.
- 닫힌 빈칸만 다음 추론 대상이다.
- 총 지뢰 수 `io.mines`는 전역 제약으로 사용한다.

중요: 이 게임에서는 단순히 정답인 칸이 아니라, **현재 상태에서 논리적으로 확정 가능한 칸만 정답 처리**된다.  
논리적 이유 없이 클릭하면 최종적으로 맞는 칸이어도 오답 처리될 수 있다.

따라서 솔버는 “가능한 해 중 하나”를 찾으면 안 된다.  
모든 합법 해에서 공통으로 지뢰인 칸과 공통으로 안전한 칸만 반환해야 한다.

---

## `?` 물음표 칸 정의

매우 중요하다.

`?`는 모르는 닫힌 칸이 아니다.

`?`는 이미 열린 **확정 안전칸**이다.  
다만 주변 지뢰 개수를 알 수 없는 안전칸이다.

따라서 `?`는 다음과 같이 처리한다.

- 지뢰가 아니다.
- 추론 대상 변수가 아니다.
- 숫자 제약을 제공하지 않는다.
- Quad 2×2 제약에서는 “안전칸”으로 포함된다.
- UI에서 좌클릭/우클릭 추천 대상으로 다시 나오면 안 된다.

즉, `?`는 “opened safe without number clue”다.

---

## Quad(쿼드) 규칙

현재 우선 구현할 특수 규칙은 Quad다.

Quad 규칙:

> 모든 2×2 정사각형에는 지뢰가 최소 1개 이상 있어야 한다.

즉, 어떤 2×2 영역도 전부 안전칸이면 안 된다.

수식:

```text
for every 2x2 block:
  mine_count(block) >= 1
```

보드 크기가 `N x N`이면 2×2 블록은 `(N-1) x (N-1)`개다.

예: 5×5 보드에는 16개의 2×2 제약이 있다.

---

## Quad 기본 추론 예시

1. 어떤 2×2에서 이미 3칸이 안전이면, 남은 1칸은 확정 지뢰다.

```text
S S
S ?
```

위에서 `?`가 닫힌 칸이면 그 칸은 지뢰 확정.

2. 어떤 칸을 안전이라고 가정했을 때 지뢰 없는 2×2가 생기면, 그 칸은 지뢰 확정이다.

3. 어떤 2×2에 이미 지뢰가 하나 있으면, Quad 규칙만으로 나머지 칸은 결정되지 않는다.

---

## 엔진 입력 모델

현재 UI 상태 출력 예시는 다음과 같다.

```json
{
  "mode": "N",
  "size": 5,
  "mines": 10
}
```

보드 상태 예:

```text
. . . . 1
. 3 F 4 .
. 3 3 4 .
. F 2 F .
. ? ? ? .
```

권장 내부 셀 타입:

```js
// hidden unknown, 추론 대상
{ t: "e" }

// opened number, 안전 + 숫자 단서
{ t: "n", v: 3 }

// confirmed mine / flag
{ t: "f" }

// opened safe but no number clue
{ t: "q" }
```

기존 UI의 실제 타입명이 다르면 `buildIO()` 또는 엔진 입구에서 normalize해서 위 의미로 맞춘다.

---

## `engine-q.js` 설계

`engine-q.js`는 Quad 모드 전용 CSP 솔버로 구현한다.

핵심 제약은 3개다.

1. 숫자 제약  
   각 숫자칸 주변 8칸의 지뢰 수가 숫자와 정확히 일치해야 한다.

2. Quad 제약  
   모든 2×2 블록의 지뢰 수가 1 이상이어야 한다.

3. 총 지뢰 수 제약  
   전체 지뢰 수는 `io.mines`와 같아야 한다.  
   이미 놓인 flag도 지뢰 수에 포함한다.

---

## 추론 방식

권장 방식은 “모든 합법 해 탐색 후 교집합 추론”이다.

1. 닫힌 칸만 변수로 둔다.
2. flag는 고정 지뢰로 둔다.
3. 숫자칸과 `?`는 고정 안전으로 둔다.
4. 숫자 제약, Quad 제약, 총 지뢰 수 제약을 구성한다.
5. 백트래킹/CSP로 모든 가능한 해를 찾는다.
6. 모든 해에서 항상 지뢰인 변수는 `mine[]`.
7. 모든 해에서 항상 안전인 변수는 `safe[]`.
8. 어떤 해에서는 지뢰, 어떤 해에서는 안전이면 표시하지 않는다.

중요: 이 게임은 추론 가능한 칸이 항상 존재한다는 전제가 있으므로, 엔진은 확정칸만 반환해야 한다.

---

## 반환 형식 권장안

기존 `engine-2g.js`와 최대한 호환되게 만든다.

권장 예:

```js
return {
  ok: true,
  engine: ENGINE_Q_VERSION,
  mode: "Q",
  safe: [
    { x: 0, y: 0, label: "A1", why: "forced safe in all legal Quad solutions" }
  ],
  mine: [
    { x: 2, y: 1, label: "C2", why: "forced mine in all legal Quad solutions" }
  ],
  solutions: 12,
  exhausted: true,
  checkLines: [
    "Quad: every 2x2 block has at least one mine",
    "CSP: returned only cells common to all legal solutions"
  ]
};
```

에러/모순 예:

```js
return {
  ok: false,
  error: "No legal solutions",
  safe: [],
  mine: [],
  solutions: 0,
  exhausted: true,
  checkLines: []
};
```

예산 초과 시:

```js
return {
  ok: true,
  warning: "Search budget exceeded; results may be incomplete",
  safe: [],
  mine: [],
  solutions: partialCount,
  exhausted: false,
  checkLines: []
};
```

단, 예산 초과 상태에서 확정성을 보장할 수 없으면 `safe`/`mine`을 비워야 한다.

---

## 구현 주의사항

- `?`를 닫힌 unknown으로 취급하지 말 것.
- `?`를 숫자 단서로 취급하지 말 것.
- 열린 숫자칸/`?`/flag는 추천 대상에서 제외할 것.
- 총 지뢰 수에서 flag를 이미 배치된 지뢰로 계산할 것.
- 숫자 주변의 flag 수가 숫자를 초과하면 모순이다.
- 숫자 주변의 최대 가능 지뢰 수가 숫자보다 작으면 모순이다.
- 어떤 2×2가 이미 전부 안전으로 고정되어 있으면 모순이다.
- 어떤 2×2에서 아직 지뢰 가능 칸이 하나뿐이면 그 칸은 지뢰 강제다.
- 모든 해 교집합으로 판정하지 않은 칸은 표시하지 말 것.
- UI 표시 좌표는 `A1`, `C3` 형식으로 맞출 것.

---

## 테스트 케이스 1

초기 보드:

```text
. . . . 1
. . . . .
. . 3 . .
. . 2 . .
. . . . .
```

크기: 5  
총 지뢰: 10  
모드: Quad

확정 우클릭:

```text
C2, B4, D4
```

확정 좌클릭:

```text
B2, D2, B3, D3, B5, C5, D5
```

---

## 테스트 케이스 2

중간 보드:

```text
. . . . 1
. 3 F 4 .
. 3 3 4 .
. F 2 F .
. ? ? ? .
```

크기: 5  
총 지뢰: 10  
모드: Quad

확정 우클릭:

```text
C1, D1, A2, E3, E4, A5, E5
```

확정 좌클릭:

```text
A1, B1, E2, A3, A4
```

이 테스트에서 `?`인 `B5`, `C5`, `D5`는 이미 열린 안전칸이므로 다시 safe 추천에 나오면 안 된다.

---

## 다음 작업 순서

1. `engine-q.js` 파일 작성
2. `inferQ(io)` 구현
3. `index.html`에 Quad 모드 추가
4. `<script src="./engine-q.js"></script>` 추가
5. 추론 버튼에서 Quad 모드일 때 `inferQ(buildIO())` 호출
6. 위 테스트 케이스 1, 2로 검증
7. 이후 다른 Minesweeper Variant 규칙을 같은 구조로 추가
