# Solgic3 2C Active Update Log

## 목적

이 파일은 앞으로 2C 엔진 작업에서 **기본적으로 유일하게 업데이트하는 문서**다.

다른 분리 문서들은 읽기용 기준 문서로 둔다.

- `solgic3_2c_solver_source.md`: 안정 규칙 / 입력 / 반환 원칙
- `solgic3_2c_architecture.md`: 현재 엔진 구조와 일반 계층 설계
- `solgic3_2c_test_cases.md`: 누적 테스트 케이스 스냅샷
- `solgic3_2c_changelog.md`: 버전별 변경 이력 스냅샷
- `solgic3_2c_active_update.md`: 앞으로 새 보드/새 실패/새 구현 결과를 append하는 단일 업데이트 파일

## 업데이트 정책

일반 작업에서는 Claude Cowork / Codex / ChatGPT가 **이 파일 하나만 append 수정**한다.

다른 문서는 다음 경우에만 갱신한다.

1. 사용자가 “문서 정리”, “분리 문서 동기화”, “스냅샷 갱신”을 요청한 경우
2. 큰 버전 마일스톤이 끝나서 테스트 케이스와 아키텍처 문서를 다시 정리해야 하는 경우
3. 기존 안정 규칙 자체가 바뀐 경우

즉, 다음 작업부터는 새 보드가 나오면 이 파일 끝에 `신규 작업 기록` 섹션을 추가하고, 분리된 기준 문서들은 읽기 전용으로 참조한다.

## 현재 기준 버전

- 기준 엔진: `engine-2c v016`
- 핵심 신규 계층: `deduceRectangleCandidateSolver2C()`
- 현재 주력 방향: 셀 단위 가정-검증보다 **직사각형 후보 단위 구조 탐색** 우선
- 타깃 보강 원칙: 마지막 수단. 먼저 일반 계층 또는 rectangle candidate solver로 잡을 수 있는지 확인한다.

## 다음 작업 지시 기본 문구

```text
작업 폴더: C:\solgic

문서 업데이트는 기본적으로 다음 파일 하나에만 append해줘.

- C:\solgic\source\solgic3_2c_active_update.md

다른 문서는 읽기용 기준 문서로만 사용한다.

참조 문서:
- C:\solgic\source\solgic3_2c_solver_source.md
- C:\solgic\source\solgic3_2c_architecture.md
- C:\solgic\source\solgic3_2c_test_cases.md
- C:\solgic\source\solgic3_2c_changelog.md

새 보드가 나오면 active_update 파일 끝에 신규 작업 기록을 추가한다.
규칙/테스트/아키텍처 기준 문서로 정리하는 작업은 사용자가 별도로 요청할 때만 수행한다.
```

## 신규 작업 기록 템플릿

```markdown
---

## 신규 작업 YYYY-MM-DD: 제목

### 상황

- 엔진 버전:
- 보드 크기:
- 총 지뢰:
- 모드: 2C
- 실패 증상:

### 보드

```text
...
```

### 현재 고정 상태

- numbers:
  - A1 = n
- opened safe without number:
  - B2 = ?
- flags:
  - C3

### 확인된 판정

우클릭 / mine:

```text
...
```

좌클릭 / safe:

```text
...
```

### 기대 반환

```js
safe: [...]
mine: [...]
```

### 반례 / 비반환 조건

- ...
- `?` 칸은 opened safe without number이며 반환 후보가 아니다.
- 기존 flag / 열린 숫자는 반환 후보가 아니다.

### 엔진 검토

- 어떤 일반 계층이 통과/실패했는지:
- rectangle candidate solver 결과:
- existence probe / Tier B 결과:
- 예산 초과 여부:

### 구현 결과

- 새 엔진 버전:
- 추가/수정한 함수:
- 실행 순서:
- checkLines:
- 회귀 테스트 결과:

### 후속 메모

- ...
```

---

## v016 기준 요약

`engine-2c v016`은 추가 테스트 27을 계기로 `deduceRectangleCandidateSolver2C()`를 추가했다.

핵심:
- 셀이 아니라 직사각형 지뢰 그룹 후보를 탐색 단위로 사용한다.
- fixedSafe 포함, 겹침, 변접촉을 구조적으로 금지한다.
- 대각 연결성은 leaf에서 직사각형 목록 전체를 다시 계산한다.
- 예산 초과 또는 합법 레이아웃 0개일 때는 이 계층이 단독 모순을 반환하지 않고 다음 계층으로 넘긴다.
- 추가 테스트 26도 기존 existence probe보다 빠르게 해결한다.
- 추가 테스트 27에서 `safe: ["A5","D5","D8","E5"]`, `mine: ["B5","D7","E4"]`를 반환한다.

---

## 신규 작업 2026-06-22: engine-2c v017 — rectangle candidate solver 일반 개선 (탐색 순서/pruning/adaptive budget)

### 목적

`engine-2c v016`의 `deduceRectangleCandidateSolver2C()`가 8x8 고밀도 보드에서 `prune nodes: 8000001`,
`exhausted:false`로 자주 멈추는 문제를 **새 타깃 하드코딩 없이** 일반적으로 개선한다. 신규 실패 케이스 4개
(추가 테스트 28~31)를 회귀 기준으로 사용한다.

v016에서 반복된 두 실패 유형:
- 유형 A: 일부 `rect layouts`는 찾았지만 예산 안에 전체 탐색을 끝내지 못함 (추가 테스트 28, 30).
- 유형 B: `rect layouts: 0`인데 `exhausted:false` — 합법 layout이 없다는 뜻이 아니라, 합법 layout에
  도달하기 전에 예산이 먼저 소진된 것 (추가 테스트 29, 31).

### 신규 실패 케이스 28~31

#### 추가 테스트 28: rectangle solver 일부 layout 발견 후 예산 초과, D6 안전

보드:

```text
1 1 1 . . . . .
F ? 3 . 4 . . .
2 F F ? . . . .
3 4 5 F . . . .
F F 4 F . . . .
. . . . 4 . . .
. . . . 3 . . .
2 . . . . . . 2
```

크기: 8, 총 지뢰: 26, 모드: 2C

현재 고정 상태:
- numbers: A1=1, B1=1, C1=1, C2=3, E2=4, A3=2, A4=3, B4=4, C4=5, C5=4, E6=4, E7=3, A8=2, H8=2
- opened safe without number: B2=?, D3=?
- flags: A2, B3, C3, D4, A5, B5, D5

기대 반환: `safe: ["D6"]`, `mine: []`

v016: `rect candidates: 322`, `rect layouts: 3467`, `exhausted: false`, `prune nodes: 8000001` →
`warning: Search budget exceeded`, safe/mine 둘 다 빈 배열.

#### 추가 테스트 29: rect layouts=0에서 예산 초과, 합법 layout 1개로 수렴

보드:

```text
? 2 F . . . 3 .
0 ? F . . . . .
1 ? . . . . . .
. . . . . . ? .
F . . . . . . .
? 3 . . . . . .
0 ? 2 . . 2 F 3
? 0 ? . . . . .
```

크기: 8, 총 지뢰: 26, 모드: 2C

현재 고정 상태:
- numbers: B1=2, G1=3, A2=0, A3=1, B6=3, A7=0, C7=2, F7=2, H7=3, B8=0
- opened safe without number: A1=?, B2=?, B3=?, G4=?, A6=?, B7=?, A8=?, C8=?
- flags: C1, C2, A5, G7

기대 반환:
```js
safe: ["H1","G2","G3","A4","C4","D4","E4","F4","B5","D5","E5","H5","D6","F6","G6","E7","D8","E8","F8","G8"]
mine: ["D1","E1","F1","D2","E2","F2","H2","C3","D3","E3","F3","H3","B4","H4","C5","F5","G5","C6","E6","H6","D7","H8"]
```

v016: `rect candidates: 391`, `rect layouts: 0`, `exhausted: false`, `prune nodes: 8000001`. 중요: `rect
layouts: 0 && exhausted:false`는 합법 배치가 없다는 뜻이 아니라, 합법 layout에 도달하기 전에 예산이
소진됐다는 뜻이다 — 실제로는 합법 layout이 정확히 1개로 수렴한다.

#### 추가 테스트 30: 많은 합법 layout 중 A2/B2만 공통으로 고정

보드:

```text
2 F . 3 . . ? .
. . . F . . . .
2 . . . 5 . . .
2 . . . . ? . .
. . . . . . . .
1 ? 2 . . . . .
? 1 . . . . . .
0 1 . . . . . .
```

크기: 8, 총 지뢰: 26, 모드: 2C

현재 고정 상태:
- numbers: A1=2, D1=3, A3=2, E3=5, A4=2, A6=1, C6=2, B7=1, A8=0, B8=1
- opened safe without number: G1=?, F4=?, B6=?, A7=?
- flags: B1, D2

기대 반환: `safe: ["B2"]`, `mine: ["A2"]`

v016: `rect candidates: 383`, `rect layouts: 17`, `exhausted: false`, `prune nodes: 8000001`. 합법 layout이
많지만(최종적으로 76,119개) `A2`/`B2`만 모든 layout에 공통이라, layout 하나를 빨리 찾는 것만으로는 부족하고
전체 교집합을 끝까지 봐야 한다.

#### 추가 테스트 31: rect candidates 551, D6/D7 과판정 금지 회귀

보드:

```text
. . ? . . . . .
. . . . . . . .
. . . . . . . .
. . . . . . . .
. . . . . . F 3
. . F . F 4 3 F
1 3 . . F 4 4 .
0 1 . ? ? F F .
```

크기: 8, 총 지뢰: 26, 모드: 2C

현재 고정 상태:
- numbers: H5=3, F6=4, G6=3, A7=1, B7=3, F7=4, G7=4, A8=0, B8=1
- opened safe without number: C1=?, D8=?, E8=?
- flags: G5, C6, E6, H6, E7, F8, G8

기대 반환: `safe: ["B6","C8"]`, `mine: ["A6","C7"]`

반례/비반환 조건(중요, 반드시 회귀 유지):
- `D6`은 mine으로 반환하면 안 된다.
- `D7`은 mine으로 반환하면 안 된다.
- D6/D7은 현재 보드에서 모든 합법 2C 배치에 공통인 칸이 아니므로, safe/mine 어느 쪽에도 반환하지 않아야 한다.

v016: `rect candidates: 551`, `rect layouts: 0`, `exhausted: false`, `prune nodes: 8000001`.

### 구현한 solver 개선 내용 (`engine-2c v017`)

`deduceRectangleCandidateSolver2C()`와 그 호출부만 수정했다. 다른 일반 계층(Tier A류, assumption
closure/existence probe, Tier B)은 건드리지 않았다.

1. **탐색 순서: orientation-aware canonical scan (`chooseRectScanOrientation()`)**
   - 기존 row-major 직사각형 anchor 스캔(완전성/중복 방지가 보장된 알고리즘)은 그대로 유지하고, 보드를
     8가지 대칭(transpose 여부 × x/y 독립 flip) 중 하나로 "재명명"한 뒤 그 좌표계에서 동일한 row-major
     스캔을 수행한다.
   - 정사각형의 모든 dihedral 대칭은 축에 정렬된 직사각형을 축에 정렬된 직사각형으로 보내고 4-/8-연결을
     보존하므로, "anchor = 현재 스캔 순서상 첫 미결정 칸"이라는 기존 중복 방지 증명이 8가지 대칭 전부에
     대해 동일하게 성립한다. 즉 **건전성/완전성은 전혀 바뀌지 않고, 어떤 칸을 먼저 결정하는지만 바뀐다.**
   - flag 개수 + 각 칸이 속한 숫자 clue 개수로 가중치를 매기고, 8가지 대칭 중 가중치 높은 칸을 스캔
     순서상 가장 먼저 방문하게 되는 대칭을 선택한다. v016처럼 항상 좌상단부터 스캔하면, 넓은 무제약
     자유 영역을 먼저 탐색하면서 그 영역의 직사각형 분할 조합을 전부 세어보는 동안 정작 좁고 강하게
     제약된 flag/숫자 클러스터는 한참 뒤에야 만나게 되어, pruning이 본격적으로 효과를 내기 전에 예산을
     자유 영역에서 다 써버린다. 제약된 영역을 먼저 결정하면 전역 지뢰 수 하한(아래)이 훨씬 빨리
     타이트해져 자유 영역 탐색이 그만큼 빨리 잘려나간다.
   - `checkLines`에 `rect search mode: oriented row-major (primary=..,sx=..,sy=..)`로 남긴다.

2. **pruning 강화**
   - **전역 남은 지뢰 수 하한 (`uncoveredVarCount`, 신규)**: v016은 `placedVarMines>need`(상한)만
     검사했고, "남은 미결정 var 칸을 전부 지뢰로 채워도 `need`에 못 미친다"는 하한 검사가 전혀 없었다.
     이 하한이 없으면 DFS가 넓은 자유 영역에서 너무 많은 칸을 안전으로 미리 확정해버린 뒤, leaf에
     도달해서야 지뢰 수가 부족함을 알게 된다. 신규 하한은 `markSafe`/`placeRectangle`/`unplace*` 양쪽에서
     `uncoveredVarCount`를 증감시키며 매 노드 진입 시 `placedVarMines+uncoveredVarCount<need`면 즉시
     prune한다.
   - **clue underflow 검사를 touched clue로 한정**: 직사각형을 놓은 뒤의 underflow 검사(`curMine[ci]+
     curUnd[ci]<need`)가 v016에서는 매 배치마다 보드의 **모든** clue를 다시 스캔했다(`clueUnderflowPossible()`).
     이번 배치가 건드리지 않은 clue는 부모 호출에서 이미 통과한 상태와 같으므로 다시 볼 필요가 없다.
     `markSafe` 분기가 이미 쓰던 `clueUnderflowPossibleFast(touched)`를 직사각형 배치 분기에도 동일하게
     적용했다(건전성은 동일, 매 노드 비용만 줄어든다).
   - 기존 `curMine>need`, edge-touch illegal/overlap/fixedSafe 포함 금지, 대각 연결 leaf 재계산은 그대로
     유지했다. "현재 부분 컴포넌트가 아직 직사각형이 아니다"류 비건전 pruning은 추가하지 않았다.
   - flag가 반드시 어떤 rectangle에 포함되어야 한다는 제약은 v016 구조상 이미 강제된다(flag 칸에는 "안전
     으로 둔다" 분기 자체가 없고, 스캔이 그 칸에 도달하면 반드시 새 rectangle의 anchor가 되어야 한다).
     이번 작업에서 별도 prune을 추가하지 않았다(이미 안전하게 강제됨).
   - "각 clue의 남은 need를 만족할 candidate rectangle이 없으면 prune" 항목은 일반화된 형태로는 구현하지
     않았다(기존 `curMine`/`curUnd` 기반 underflow/overflow 검사가 같은 효과를 더 싼 비용으로 이미 낸다고
     판단했고, 별도의 "남은 도형 후보 존재성" 검사를 추가하는 것은 구현 위험 대비 이득이 낮다고 봤다).

3. **adaptive budget (staged)**
   - 호출부를 `RECT_BUDGET_STAGES=[8000000,32000000,96000000]`로 바꿨다. 첫 단계(8,000,000, v016과 동일)
     에서 `exhausted:true`가 나오면(합법 layout을 찾았든 0개로 끝났든) 그대로 종료하고, **`exhausted:false`
     로 끝난 보드에서만** 다음 단계로 넘어간다. 즉 기존에 8,000,000으로 충분했던 보드는 v017에서도 정확히
     같은 비용만 쓴다 — 예산 상향은 "막힌 보드"에만 적용된다.
   - 예산 초과(`exhausted:false`) 상태에서 일부 layout만 보고 safe/mine을 반환하지 않는 v016의 원칙은
     그대로 유지했다 — 마지막 단계까지도 `exhausted:false`면 이 계층은 빈 결과로 다음 계층에 넘긴다.
   - `checkLines`에 실제 사용한 단계를 `rect budget: <N>`으로 남긴다.

4. **성능(상수 인자) 개선**: `placeRectangle`/`unplaceRectangle`이 매 시도마다 `cells[]` 배열을
   `rectMask()`로 새로 만드는 대신, 사각형 경계를 직접 순회한다(`unplaceRectangle`도 같은 경계를 다시
   순회). 동작은 동일하고 노드당 비용만 줄어든다.

5. **진단 로그 개선**: `checkLines`에 다음을 남긴다(성공/실패 공통).
   - `tier structural: rectangle candidate solver 2C`
   - `rect search mode: oriented row-major (primary=..,sx=..,sy=..)`
   - `rect candidates: N`
   - `rect budget: N` (이번에 실제로 도달한 마지막 단계의 예산)
   - `rect layouts: M`
   - `exhausted: true/false`
   - 실패 시 추가로 `prune nodes: N`과, `rect layouts===0 && exhausted:false`인 경우 전용 안내 문구
     ("rect layouts: 0 here means budget exhausted before any legal layout was reached, NOT proof that no
     legal layout exists")
   - 성공 시 `deduce: mine=N safe=M`

### 회귀 테스트 결과 (이번 세션에서 직접 실행/확인)

별도 sandbox에서 v016 원본과 v017 수정본을 모두 실행해 비교했다(이 리포지토리에는 JS 테스트 파일을 따로
두지 않는 기존 관례를 따라, 이 문서의 보드/기대값을 회귀 기준으로 삼는다).

- **추가 테스트 26, 27**: v016에서 이미 rectangle solver가 성공하던 케이스. v017에서도 **1단계
  예산(8,000,000)만으로** 동일한 `safe`/`mine`을 반환함을 확인했다 (`rect candidates`/`rect layouts` 값도
  v016과 동일: 26번 `335`/`1909`, 27번 `295`/`458`). `checkLines`에 새 `rect search mode`/`rect budget`
  필드가 추가된 것 외에 결과는 동일하다.
- **추가 테스트 28**: v017이 **1단계 예산(8,000,000)만으로** `safe:["D6"]`, `mine:[]`를 반환한다
  (`rect layouts: 16359`, `exhausted: true`). v016은 같은 예산에서 `exhausted:false`로 멈췄던 보드다.
- **추가 테스트 29**: v017이 **1단계 예산(8,000,000)만으로** 기대 `safe`/`mine` 전체(좌클릭 20칸, 우클릭
  22칸)를 정확히 반환한다(`rect layouts: 1`, `exhausted: true`).
- **추가 테스트 30**: 1단계/2단계(8M/32M)에서는 `exhausted:false`로 멈추고, **3단계(96,000,000)에서**
  `safe:["B2"]`, `mine:["A2"]`를 정확히 반환한다(`rect layouts: 76119`, `exhausted: true`).
- **추가 테스트 31**: 3단계(96,000,000)까지 올려도 `exhausted:false`로 남는다(`rect layouts`는 budget을
  올릴수록 계속 늘어나지만 — 8M:0, 16M:58248, 96M:198209 — 완전히 끝나지 않는다). 이 보드는 1~4행 대부분이
  어떤 숫자 단서와도 접하지 않는 넓은 자유 영역이라, 그 영역 안에서 가능한 직사각형 분할 조합 수 자체가
  매우 크다는 것을 직접 확인했다(orientation/pruning 개선으로 동일 예산에서 발견하는 layout 수는 v016
  대비 수십~백 배 늘었지만, 완전 탐색에는 아직 못 미친다). 따라서 v017은 이 보드에서 **`A6`/`B6`/`C7`/`C8`
  의 완전한 확정 반환까지는 아직 도달하지 못하고, 기존 fallback 체인(assumption existence probe → Tier B
  → 예산 초과 경고)으로 넘어간다.** 다만 핵심 회귀 요구사항인 **`D6`/`D7`을 safe/mine 어느 쪽으로도
  반환하지 않는다는 조건은 항상 만족한다** — 이 계층은 `exhausted:true`이고 `sol>0`일 때만 결과를
  커밋하므로, 예산을 다 써도 끝내지 못한 보드에서는 구조적으로 빈 결과만 반환하고(다른 어떤 칸도, 따라서
  `D6`/`D7`도 반환하지 않고) 다음 계층으로 넘어간다. 이후 계층(assumption existence probe, Tier B)은 이번
  작업에서 수정하지 않았고, v016에서도 이 보드에 대해 동일하게 빈 결과를 반환했으므로 새 오답 위험은
  없다.
- **기존 추가 테스트 1, 7** (rectangle solver 게이트보다 앞서 다른 계층에서 해결되는 케이스): v016과 v017
  양쪽에서 동일한 결과를 반환함을 확인했다(이 계층을 전혀 거치지 않으므로 당연히 영향 없음).
- 변경 범위가 `deduceRectangleCandidateSolver2C()` 본문과 그 호출부(8번 계층)로 한정되어 있고, 그 앞의
  모든 계층(숫자 규칙, number algebra, symmetric diff, 기존 rectangle bbox 완성, 7x7/8x8 타깃 frontier,
  candidate-as-mine, single/small clue pattern, assumption number-closure)과 그 뒤의 모든 계층
  (assumption existence probe, Tier B, 예산 초과 fallback)은 코드 변경이 전혀 없으므로, 추가 테스트
  7~25(이 계층에 도달하지 않는 보드들)는 구조적으로 영향받지 않는다.

### 알려진 한계 / 후속 메모

- 추가 테스트 31처럼 보드의 상당 부분이 어떤 숫자 단서와도 접하지 않는 넓은 자유 영역으로 남는 보드는,
  이 계층이 "모든 합법 layout의 교집합"을 정의상 완전히 봐야 하기 때문에 근본적으로 어렵다. orientation
  변경과 전역 하한 pruning은 이런 보드에서도 실질적인 개선을 줬지만(같은 예산에서 발견하는 layout 수가
  v016 대비 수십~백 배), 완전 탐색을 보장하지는 못한다.
- 다음 단계로 고려할 수 있는 방향(이번 작업에서는 구현하지 않음): 숫자 단서와 전혀 접하지 않는 "자유
  영역"을 감지해, 그 영역에 대해서는 전체 직사각형 분할을 일일이 세는 대신 "정확히 남은 지뢰 수를 채우는
  배치가 존재하는가"라는 더 약한 존재성 질문으로 바꿔 푸는 전용 서브루틴을 추가하는 것. 이번 세션에서는
  대각 연결성 증명을 일반적이고 건전하게 구성하는 난이도가 높아 구현하지 않았다.
- `RECT_BUDGET_STAGES`의 마지막 단계(96,000,000)는 사용자가 제시한 예시(`8M → 32M → 96M`)를 그대로
  따른 것이다. 더 큰 단계를 추가하면 추가 테스트 31류의 보드를 더 밀어붙일 수 있지만, 그만큼 해당 보드의
  응답 시간이 늘어나므로(이미 96,000,000 단계만으로도 수십 초 단위) 이번 작업에서는 사용자가 제시한
  예시 범위를 넘기지 않았다.

---

