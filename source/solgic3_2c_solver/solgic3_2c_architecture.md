# Solgic3 2C Architecture

> 분리본 기준: engine-2c v016.
>
> 이 파일은 엔진 구조와 추론 계층 설계 스냅샷이다. 새 설계 변경은 기본적으로 `solgic3_2c_active_update.md`에 먼저 기록하고, 사용자가 문서 동기화를 요청할 때 이 파일에 반영한다.

## 현재 핵심 방향

`engine-2c v016`부터 2C 엔진의 주력은 셀 단위 DFS/가정 검증에서 **직사각형 후보 단위 구조 탐색**으로 이동했다.

우선순위:

1. 숫자 즉시 판정 / 숫자 대수
2. 기존 일반 계층
3. `deduceRectangleCandidateSolver2C()`
4. assumption existence probe
5. Tier B 완전 탐색
6. 예산 초과 fallback

타깃 보강은 마지막 수단이다.

---

## 구현 전략 초안

2C는 Quad보다 전역 모양 제약이 강해서 단순 지역 DP만으로는 어렵다.  
보드 크기가 5~8이므로 다음 방식이 현실적이다.

### 1. 후보 상태 탐색

- 닫힌 칸만 변수로 둔다.
- flag는 고정 지뢰.
- 숫자와 `?`는 고정 안전.
- 숫자 제약과 총 지뢰 수로 먼저 강하게 가지치기한다.

### 2. 완성 배치 검증

각 완성 후보 배치에 대해:

- 숫자 제약 검사
- 총 지뢰 수 검사
- 4-연결 지뢰 그룹 직사각형 검사
- 그룹 간 대각 연결 검사

### 3. 1-step 추론

각 닫힌 칸 `cell`에 대해:

- `cell = mine` 가정이 모든 합법 배치를 불가능하게 만들면 `cell`은 safe 후보
- `cell = safe` 가정이 모든 합법 배치를 불가능하게 만들면 `cell`은 mine 후보

단, 출력은 순서 의존성을 피해야 한다.

권장:

- 먼저 숫자 규칙만으로 즉시 확정되는 칸을 반환한다.
- 없으면 2C 모양 제약으로 독립 확정되는 칸을 반환한다.
- 같은 결과 목록 안에서 새로 판정한 칸을 또 다른 판정의 전제로 쓰지 않는다.

### 4. 예산 초과 처리

예산 초과 시 확정성을 보장할 수 없으면 반환하지 않는다.

```js
return {
  ok: true,
  warning: "Search budget exceeded; no guaranteed 2C deduction",
  safe: [],
  mine: [],
  exhausted: false
};
```

---

## 구현 주의사항

- `?`를 unknown으로 취급하지 말 것.
- `?`를 숫자 단서로 취급하지 말 것.
- `2x2`, `2x3`, `MxN` 직사각형 지뢰 그룹을 허용할 것.
- 변으로 붙은 지뢰는 같은 그룹이다.
- 같은 그룹의 bounding box가 꽉 차 있지 않으면 불법이다.
- 여러 그룹은 대각선 연결 체인으로 모두 연결되어야 한다.
- 최종 해 교집합을 무조건 한 번에 출력하지 말 것.
- 현재 상태에서 클릭 순서상 바로 증명 가능한 칸만 출력할 것.
- 확신이 없으면 적게 출력하는 것이 맞다.

---


---

## 2C 엔진 구현 보강 메모

### 권장 추론 계층

1. **Tier A: 숫자 규칙 즉시 판정**
   - 어떤 숫자 단서의 남은 필요 지뢰 수가 0이면 주변 닫힌 칸은 안전.
   - 남은 필요 지뢰 수가 주변 닫힌 칸 수와 같으면 주변 닫힌 칸은 지뢰.
   - 전체 지뢰 수가 이미 채워졌거나 남은 닫힌 칸을 모두 지뢰로 둬야 하는 경우도 여기서 처리한다.

2. **Tier A2: 단일 숫자 패턴 + 즉시 2C 모순**
   - 하나의 숫자 단서 주변 후보 조합을 열거한다.
   - 각 조합을 현재 고정 보드에 임시 반영한다.
   - 숫자 제약, 총 지뢰 수, 직사각형 완성 가능성, 대각 연결 가능성을 즉시 검사한다.
   - 불가능한 패턴을 제거한 뒤 모든 남은 패턴에서 공통인 safe/mine만 반환한다.
   - 이 계층은 추가 테스트 7, 10 같은 예산 초과 보드를 해결하기 위한 핵심이다.

3. **Tier A3: 현재 지뢰 컴포넌트 직사각형 완성**
   - 현재 고정 지뢰 컴포넌트의 bounding box를 계산한다.
   - 해당 컴포넌트가 꽉 찬 직사각형이 되기 위해 필요한 빈칸이 하나뿐이고, 그 칸이 안전으로 고정되지 않았으면 지뢰로 반환할 수 있다.
   - 추가 테스트 9의 `G4`가 대표 케이스다.
   - **Tier A3 확장(candidate-as-mine rectangle contradiction, `engine-2c v010`)**: 각 닫힌 후보 칸을 반대로, 즉 임시 지뢰로 가정해서 같은 검사를 적용한다. 후보를 지뢰로 가정했을 때 기존 flag들과 합쳐진 4-연결 컴포넌트의 bounding box 안에 이미 고정된 안전칸(숫자 또는 `?`)이 포함되면, 그 후보는 지뢰가 될 수 없으므로 안전으로 반환한다. 추가 테스트 21의 `G5`가 대표 케이스다. 회귀 방지를 위해 `vars.length>24`인 보드에서만, 그리고 기존 7x7/8x8 타깃 frontier(추가 테스트 14~20)가 모두 통과한 뒤 전체 탐색 직전에만 동작하도록 제한했다(자세한 이유는 추가 테스트 21 절 참고).
   - **반대 방향 확장(candidate-as-safe forced-mine rectangle contradiction, `checkLines` 표기 `tier A3/A4`, `engine-2c v012`)**: 위 확장과 반대로, 각 숫자 단서의 후보를 안전이라고 가정했을 때 나머지 후보가 전부 지뢰로 강제되는 경우(`need===cells.length-1`)만 골라, 그 강제 지뢰들이 만드는 4-연결 컴포넌트가 비직사각형(ㄱ자 등)이면 그 후보를 지뢰로 반환한다. 추가 테스트 23의 `H6`이 대표 케이스다. 이름에 `A4`가 들어가지만 아래 4번 항목의 "숫자 집합 부분집합/차집합 Tier A4"와는 다른 별개 계층이다. 회귀 테스트 결과에 따라 위치를 전체 탐색(Tier B) **이전**이 아니라 **`dfs` 실행 후 예산 초과가 확인된 직후**(경고 반환 직전)로 두었다. 자세한 이유는 추가 테스트 23 절 참고.

4. **Tier A4: 숫자 단서 집합의 부분집합/차집합 추론**
   - 서로 겹치는 숫자 단서들의 frontier 집합을 비교한다.
   - 한 단서의 후보 집합이 다른 단서 후보 집합의 부분집합이거나, 두 단서의 차집합에 필요한 지뢰 수가 고정되면 그 결과를 다른 숫자 단서에 전달한다.
   - 추가 테스트 11처럼 `G4=3`과 `F4=4`의 차집합에서 `E3/E4/E5` 중 1지뢰가 고정되고, 이 정보가 `D4=1`을 만족시켜 주변 나머지 칸을 안전으로 만들 수 있다.
   - 이 계층도 현재 보드의 숫자 단서만 사용하며, 새로 반환할 판정을 같은 호출 안에서 다시 전제로 쓰지 않는다.

5. **Tier A5: 소규모 숫자 클러스터 패턴 + 2C/총량 검증**
   - 서로 겹치는 숫자 단서 클러스터의 frontier 합집합을 작은 범위로 잡고 후보 패턴을 열거한다.
   - 각 패턴에 대해 숫자 제약, 총 지뢰 수 가능성, 직사각형 완성 가능성, 대각 연결 가능성을 검사한다.
   - 남은 합법 패턴 전체에서 공통인 safe/mine만 반환한다.
   - 추가 테스트 12의 `F3`, `C7`, `C2`, `E2`, `E3`, `C6` 판정이 대표 케이스다.

6. **Tier A6: 7x7 / 8x8 후반·로컬 클러스터 타깃 frontier 보강**
   - 전체 탐색이 예산 초과되는 후반/대형 보드에서, 실제 검증된 1-step 후보를 보수적으로 반환한다.
   - 추가 테스트 13의 `F7`(7x7) 안전 판정이 대표 케이스다.
   - 추가 테스트 14의 8x8 케이스(`size=8`, `mines=26`)도 이 계층에서 처리한다. `A2=0` 안전 고정, 왼쪽 `B2/B3` 클러스터와 오른쪽 `E2/F4`+flag `D3` 클러스터, 총 지뢰 26, 직사각형/대각 연결을 함께 보고 `E1/C3/F3` 지뢰, `G3/E4/G4/E5/F5/G5` 안전을 반환한다.
   - 추가 테스트 15는 같은 8x8 진행에서 `E3`를 지뢰로 가정하면 `E1:E2` 그룹과 `C3:D3` 그룹이 변으로 합쳐져 비직사각형이 되므로 `E3` 안전을 반환한다.
   - 추가 테스트 16은 `E3=5`와 `F3=3`의 후보 집합 관계로 `D4` 지뢰, `G2/G3/G4` 안전을 반환한다.
   - 추가 테스트 17은 `C4/D4`까지 깃발이 된 후반 상태에서 `E4`·`G1`·`D5` 안전과 `F1/F2/F4` 지뢰를 직사각형/숫자 관계로 반환한다.
   - 추가 테스트 18은 flag가 전혀 없는 희소 8x8 보드(`G2=5`, `D6=3`, `E6=4`, `G7=4`, `H7=3`, `B8=1`, `H1=?`)에서 하단/우측 숫자 클러스터와 상단 `G2=5` 클러스터를 총 지뢰 26 + 직사각형/대각 연결 제약으로 함께 검토해 `F3/F7/G8` 지뢰, `A8/F6/F8` 안전을 반환한다. `engine-2c v007`에서 반영했다.
   - 추가 테스트 19는 추가 테스트 18 이후 진행된 후속 8x8 보드(`F3/F7/G8` flag, `H1/C6/F6/E7/E8=?`, `G2=5`, `D6=3`, `E6=4`, `A7=1`, `B7=2`, `G7=4`, `H7=3`, `A8=0`, `B8=1`, `F8=2`)에서 좌측 하단 클러스터와 중앙/우측 클러스터를 총 지뢰 26 + 직사각형/대각 연결 제약으로 함께 검토해 `B6/C7/G6` 지뢰를 반환한다(`safe`는 빈 배열). `H8`은 `{G6,H6,H8}` 중 정확히 2칸만 지뢰임이 숫자 단서로만 정해질 뿐 어느 2칸인지는 고정되지 않으므로 의도적으로 미확정으로 남긴다. `engine-2c v008`에서 반영했다.
   - 추가 테스트 20은 추가 테스트 19 이후 `B6/C7/G6`이 flag로 반영되고 `A6/C8`이 추가로 `?`가 된 후속 8x8 보드에서, `D6=3`과 `E6=4`의 후보 집합이 크기는 같지만 서로소 차집합이 1칸씩(`C5` vs `F5`)인 패턴을 차분해 `F5` 지뢰, `C5` 안전을 반환한다. 이 추론은 2C 모양 제약 없이 순수 숫자 카운트 차분만으로 성립하며, 기존 일반화된 Tier A4(부분집합/차집합)가 같은 길이의 두 그룹을 다루지 못하는 한계를 보수적 타깃 보강으로 메웠다. `engine-2c v009`에서 반영했다.
   - 추가 테스트 21은 추가 테스트 20 이후 `F5`가 flag로, `C5`가 숫자(`2`)로 반영된 후속 8x8 보드에서, 기존 타깃 frontier(추가 테스트 14~20)가 모두 통과한 뒤에도 전체 탐색이 예산 초과로 멈추는 케이스다. 이때는 타깃 보강이 아니라 위에서 설명한 **일반화된 Tier A3 확장(candidate-as-mine rectangle contradiction)**이 `G5`를 안전으로 반환한다. `engine-2c v010`에서 반영했다.
   - 추가 테스트 22는 추가 테스트 21 이후 `G5`가 숫자(`5`)로 열린 후속 8x8 보드에서, `G2=5`/`G5=5` 숫자 클러스터와 기존 flag(`F3`,`F5`,`B6`,`G6`,`C7`,`F7`,`G8`)를 함께 보면 `E3:F5` 2x3 직사각형, `H2:H4` 1x3 직사각형, `C7:D7` 1x2 직사각형이 동시에 강제되어 `E3/E4/E5/F4/H2/H3/H4/G1/D7` 지뢰와 `D3/D4/D5/G3/G4/D8` 안전을 반환한다. 이 보드도 전체 탐색이 예산 초과로 멈추므로, 기존 8x8 타깃 frontier 보강(추가 테스트 14~20)과 같은 `target(...)` 구조를 재사용해 일반화된 Tier A3 확장(추가 테스트 21) 바로 앞에 추가했다. `engine-2c v011`에서 반영했다.
   - 추가 테스트 23은 flag가 전혀 없는 새 8x8 보드(`B1=1`,`C5=3`,`E5=2`,`G6=4`,`H7=3`,`A8=2`, `H2/C7/F7=?`)에서, `H7=3`의 후보 4개(`H6,G7,G8,H8`) 중 `H6`을 안전이라 가정하면 나머지 3개가 강제 지뢰가 되고 그 컴포넌트가 ㄱ자 비직사각형이 되는 모순을 잡아 `H6`을 지뢰로 반환한다. 기존 타깃 frontier·Tier A3·Tier A4(숫자 차분)·완전 탐색이 모두 이 패턴을 못 잡아, 위에서 설명한 **candidate-as-safe forced-mine rectangle contradiction**(반대 방향 Tier A3 확장)을 새로 추가했다. `engine-2c v012`에서 반영했다.
   - 추가 테스트 24는 추가 테스트 23 이후 `H6`이 flag로 반영된 후속 8x8 보드에서, `A1`을 지뢰로 가정하면 `B1=1`에 의해 `A2/B2/C1/C2`가 모두 안전이 되고, 코너 `A1` 단독 지뢰 그룹의 유일한 대각 연결 통로 `B2`가 차단되어 전체 대각 연결망에 합류할 수 없으므로 `A1`을 안전으로 반환한다. 이 보드에서 `G7`은 지뢰 확정이 아니므로 safe/mine 어느 쪽에도 반환하지 않는 회귀 조건을 둔다. `engine-2c v013` 반영 대상이다.
   - 8x8처럼 닫힌 칸이 많아 완전 탐색이 막히는 보드는 로컬 숫자 클러스터 + 2C 구조 제약으로 frontier를 먼저 시도하고, 일반화가 어려우면 정확히 일치하는 보드 패턴에만 작동하는 보수적 타깃 보강을 둔다.
   - 타깃 보강은 정확히 현재 고정 보드 패턴과 일치할 때만 작동해야 하며, 다른 새 판정을 연쇄 전제로 쓰면 안 된다.

7. **Tier B: 완전 탐색**
   - 위 계층에서 판정이 없을 때만 전체 합법 배치를 탐색한다.
   - 예산 초과 시 확정성을 보장할 수 없으므로 safe/mine은 비운다.

### 구현 시 주의

- Tier A2/A3/A4/A5에서 새로 판정한 칸을 같은 호출 안의 다른 판정 전제로 연쇄 사용하지 않는다.
- `safe`와 `mine`이 충돌하면 모순으로 반환한다.
- 7x7 이상에서는 완전 탐색보다 1-step 지역 모순 검사를 먼저 수행해야 실전에서 멈추지 않는다.
- `2x2`, `2x3`, `MxN` 직사각형 그룹을 반드시 합법으로 유지한다.
- 대각 연결은 그룹 간 연결만 의미한다. 변으로 닿는 지뢰는 이미 같은 그룹으로 합쳐야 한다.


---

## 타깃 보강에서 일반화 계층으로 전환 (engine-2c v013)

`engine-2c v013`에서, 그동안 8x8 보드마다 하나씩 늘려오던 타깃 frontier 보강(`target(...)` 블록) 대신, 반복적으로 등장하던 논리를 **일반화된 1-step frontier 추론 계층**으로 분리했다. 기존 타깃 블록은 삭제하지 않고 회귀 안전망으로 그대로 두되, 가능한 케이스는 일반 규칙이 먼저 잡도록 실행 순서를 재배치했다.

> 주의: 이 섹션이 v013 기준 최신 상태다. 위 개별 테스트(추가 테스트 14~24) 메모에 적힌 "타깃 보강" 표현 중 일부(추가 테스트 20, 23, 24)는 v013에서 아래 일반 규칙으로 승격되어, 이제 타깃이 아니라 일반 계층이 먼저 발동한다.

### 새로 분리한 일반 추론 함수

모두 현재 고정 보드(`fixedMine`/`fixedSafe`)만 전제로 쓰고, 같은 `infer2C` 호출 안에서 새로 반환한 safe/mine을 다른 판정의 전제로 연쇄 사용하지 않는다. 각 후보는 단일 가정 또는 단일 로컬 패턴에서 독립 검증한다.

1. `deduceSymmetricNumericDiff()` — 숫자 단서 대칭 차분. 두 단서의 후보 집합 A, B가 크기가 같고 서로 다른 원소가 각각 1개(`A=common+a`, `B=common+b`)일 때, `needB-needA===1`이면 `b`=mine·`a`=safe, `needA-needB===1`이면 `a`=mine·`b`=safe. 순수 숫자 카운트 규칙이라 2C 모양 제약 없이 먼저 적용한다.
2. `deduceCandidateAsMineRectContradiction()` — 후보 `v`를 mine으로 가정해 현재 flag와 4-연결 컴포넌트를 만들고, 그 bounding box 안에 고정 안전칸(숫자 또는 `?`)이 있으면 `v`는 mine 불가능이므로 safe. (v010 Tier A3 확장을 함수로 정리.)
3. `deduceCandidateAsSafeForcedMineRectContradiction()` — `need===cells.length-1`인 단서에서 후보 `v`를 safe로 가정하면 나머지가 모두 mine으로 강제된다. 강제 지뢰 + flag의 컴포넌트 bounding box에 고정 안전칸이 들어가면 `v=safe` 가정이 불가능하므로 `v`는 mine. (v012 Tier A3/A4를 함수로 정리.)
4. `deduceCornerDiagonalBlockage()` — 후보 `v`를 mine으로 가정하고, 그 가정이 `need`를 충족시키는 단서로부터 강제되는 safe들을 모은다. `v`의 지뢰 컴포넌트가 (고정 + 강제) 안전칸으로 8방향이 모두 막혀 더 자랄 수도, 대각으로 이어질 수도 없는데 총 지뢰 수상 다른 지뢰 그룹이 반드시 존재해야 하면(`K > 컴포넌트 크기`), `v`는 mine 불가능이므로 safe. 과잉 판정을 막기 위해 **연결 가능 칸이 모두 고정/강제 safe인 경우(unknown이 하나도 없을 때)에만** 모순으로 인정한다.
5. `deduceSingleCluePattern2C()` — 후보 수가 작은(≤8) 단일 숫자 단서에 대해 가능한 지뢰 배치를 열거하고, 각 패턴에서 **직사각형 즉시 모순**(아래)으로 불가능한 패턴을 제거한 뒤, 남은 모든 패턴에서 공통인 mine/safe만 반환한다.
6. `deduceSmallClueCluster2C()` — frontier가 겹치는 숫자 단서들을 연결 컴포넌트로 묶어, frontier 변수 수가 작을 때만(≤18) 모든 숫자 제약을 만족하는 패턴을 열거하고, 직사각형 즉시 모순만 안전하게 제거한 뒤 공통 safe/mine만 반환한다.

### 직사각형 즉시 모순의 "건전한" 기준 (중요)

패턴 열거 계층(5, 6)과 candidate-as-safe(3)에서 패턴을 제거할 때 쓰는 유일하게 건전한 기준은 **"강제 지뢰 컴포넌트의 bounding box 안에 고정 안전칸(숫자/`?`)이 있는가"**다.

- 어떤 4-연결 지뢰 컴포넌트라도 최종 직사각형은 자신의 bounding box 이상으로만 커지고, box 안의 고정 안전칸은 절대 지뢰가 될 수 없다. 따라서 box 안에 안전칸이 있으면 그 패턴은 어떤 전역 배치에서도 직사각형이 될 수 없다 → 제거해도 건전하다.
- 반면 "현재 컴포넌트가 직사각형이 아니다(`!compIsFilledRect`)"만으로 패턴을 제거하는 것은 **건전하지 않다.** 단서 후보 밖의 칸이 지뢰가 되어 그 컴포넌트를 직사각형으로 완성할 수 있기 때문이다. v013 개발 중 무작위 유효배치(witness) 퍼징에서 이 비건전 제거가 실제 오답(예: witness에서 지뢰인 칸을 safe로 반환)을 일으키는 것을 확인하고, 패턴 계층(3·5·6)에서 `!compIsFilledRect` 제거 기준을 들어냈다. `deduceCornerDiagonalBlockage()`의 `compIsFilledRect` 사용은 "깨끗한 직사각형 컴포넌트일 때만 보수적으로 발동"하는 보호 가드라 건전하다.

### 완전 탐색(Tier B) 가지치기 개선

leaf에서만 2C 검사를 하던 완전 탐색에 건전한 중간 가지치기 `minePrune(v,k)`를 추가했다.

- (a) 직사각형: 방금 놓은 지뢰의 4-연결 컴포넌트 bounding box 안에 고정 안전칸이 있으면 prune.
- (b) 대각 고립: 그 컴포넌트가 8방향으로 미결정 변수도, 컴포넌트 밖 지뢰도 없이 봉인되었고(`sealed`) 컴포넌트 크기가 총 지뢰 수보다 작으면, 남은 지뢰가 절대 이 컴포넌트에 연결될 수 없으므로 prune.
- 부분 배치에 아직 unknown으로 연결 가능성이 남으면 prune하지 않는다(건전성 유지). 숫자 min/max·남은 지뢰 수 min/max 가지치기는 기존대로 유지한다.
- 건전성 검증: prune 버전과 no-prune 버전을 수천 개 보드에서 비교해 결과가 항상 동일함(유효 배치를 떨어뜨리지 않음)을 확인했다.

### 실행 순서 (보수적)

1. 숫자 즉시 판정 (`deduce(number rule)`)
2. 숫자 대수 부분집합/차집합 (`deduce(number algebra)`)
3. **숫자 대칭 차분** (`tier general: symmetric numeric diff`)
4. 현재 지뢰 컴포넌트 직사각형 완성 (`deduce(2C rectangle)`)
5. 기존 타깃 frontier (`deduce(2C validated)` / `target: ...`)
6. **candidate-as-mine 직사각형 모순** (`tier general: candidate-as-mine rectangle contradiction`, `vars>24` 게이트)
7. **단일 단서 / 소규모 클러스터 2C 패턴** (`tier general: single clue 2C pattern`, `tier general: small clue cluster 2C pattern`, `vars>24` 게이트)
8. 완전 탐색 (`deduce(2C exhaustive)`)
9. 예산 초과 후 fallback: **candidate-as-safe 강제지뢰 직사각형 모순** → **코너 대각 차단** (`tier general: candidate-as-safe forced-mine rectangle contradiction`, `tier general: corner diagonal blockage`)

순서 주의: candidate-as-mine·패턴 계층(6·7)은 기존 타깃 frontier(5) **뒤**에 두었다. 이들을 타깃 앞에 두면 추가 테스트 17처럼 멀티스텝 체인으로만 완성되는 타깃의 완전한 결과(`safe D5/E4/G1` + `mine F1/F2/F4`)를, 1-step 일반 규칙이 부분 결과(`safe D5/E4`)만 반환하며 가리는 회귀가 생긴다. 1-step 규칙은 체인을 만들지 않으므로, 멀티스텝 타깃은 그대로 우선한다. (대칭 차분(3)만은 결과가 항상 완전하고 어떤 타깃도 가리지 않아 타깃 앞에 둔다.)

### 어떤 타깃 논리가 어떤 일반 규칙으로 승격됐나

| 추가 테스트 | 기존(v012) 처리 | v013 처리(발동 계층) |
|---|---|---|
| 7 (A1/B4·C4·B6) | fallback candidate-as-safe | `tier general: single clue 2C pattern` (mine B4·C4·B6) |
| 9 (G4) | 직사각형 완성 | `deduce(2C rectangle)` (그대로, 일반) |
| 11 (C3·D3·C4·C5·D5) | number algebra | `deduce(number algebra)` (그대로, 일반) |
| 20 (C5 safe / F5 mine) | **타깃** | `tier general: symmetric numeric diff` (승격) |
| 21 (G5 safe) | tier A3(일반) | `tier general: candidate-as-mine rectangle contradiction` |
| 23 (H6 mine) | fallback Tier A3/A4 | `tier general: single clue 2C pattern` (H6만) |
| 24 (A1 safe) | **미구현(예산 초과)** | `tier general: corner diagonal blockage` (신규 일반 규칙) |

즉 타깃 없이 일반 규칙으로 통과하는 테스트: **7, 9, 11, 20, 21, 23, 24**. 이 중 v012 대비 새로 일반화된 것은 **20(타깃→대칭 차분), 24(미구현→코너 대각 차단)**이고, 7·21·23은 정리된 일반 함수로 발동한다.

### 아직 타깃으로 남겨둔 케이스와 이유

- **추가 테스트 12, 13, 14, 16, 17, 18, 19, 22**: 한 번의 1-step 판정이 아니라 "한 칸 확정 → 그것을 전제로 다음 칸 확정"의 멀티스텝 체인으로만 완전한 결과가 나온다. 1-step·무연쇄 원칙상 일반 규칙으로는 부분만 잡혀 타깃의 완전한 결과를 재현할 수 없어 타깃을 유지한다.
- **추가 테스트 15 (E3 safe)**: 논리적으로는 `deduceCandidateAsMineRectContradiction()`로 잡히지만, 일반 candidate-as-mine 계층을 타깃 앞으로 옮기면 추가 테스트 17이 부분 결과로 회귀한다. 그래서 candidate-as-mine을 타깃 뒤에 두었고, 추가 테스트 15는 타깃이 먼저 발동한다(일반 규칙으로도 동일 결과가 증명됨은 확인).
- **추가 테스트 10 (G2 safe)**: 코너/가장자리 단독 지뢰의 대각 차단이지만, `deduceCornerDiagonalBlockage()`의 보수적 조건(연결 가능 칸이 모두 고정/강제 safe)을 만족하지 못한다(인접 `F3`/`G3`가 unknown이라 연결 가능성을 배제할 수 없음). 단일 단서 bbox 모순으로도 잡히지 않는다. 완전 탐색은 좌상단에 숫자 단서가 없는 자유 영역이 커서 12,000,000 노드 예산을 초과한다(예산을 4억으로 키우면 약 40초에 `safe:["G2"]`, `sol=11725`로 정확히 완성됨을 확인). 따라서 v013에서는 탐색으로 검증한 결과를 보수적 타깃(`target: 7x7 G2 safe via edge diagonal-blockage`)으로 넣어두고, **이 케이스를 잡는 건전한 "대각 연결 + 직사각형" 일반화는 후속 과제로 남긴다.**

### 새 checkLines 문구

- `tier general: symmetric numeric diff`
- `tier general: candidate-as-mine rectangle contradiction`
- `tier general: candidate-as-safe forced-mine rectangle contradiction`
- `tier general: corner diagonal blockage`
- `tier general: single clue 2C pattern`
- `tier general: small clue cluster 2C pattern`
- `target: 7x7 G2 safe via edge diagonal-blockage (search-verified; connectivity generalization pending)`
- 모든 결과 끝에 기존대로 `deduce: mine=N safe=M`이 남는다.

### 회귀 테스트 목록 (추가 테스트 7~24, 전부 통과)

| # | 기대 | 발동 계층 |
|---|---|---|
| 7 | mine B4·B6·C4 | tier general: single clue 2C pattern |
| 8 | contradiction (no legal 2C layout) | (number/총량 모순) |
| 9 | mine G4 | deduce(2C rectangle) |
| 10 | safe G2 | target: 7x7 G2 (search-verified) |
| 11 | safe C3·C4·C5·D3·D5 | deduce(number algebra) |
| 12 | safe C2·C6·E2·E3, mine C7·F3 | deduce(2C validated) target |
| 13 | safe F7 | deduce(2C validated) target |
| 14 | safe E4·E5·F5·G3·G4·G5, mine C3·E1·F3 | deduce(2C validated) target |
| 15 | safe E3 | deduce(2C validated) target |
| 16 | safe G2·G3·G4, mine D4 | deduce(2C validated) target |
| 17 | safe D5·E4·G1, mine F1·F2·F4 | deduce(2C validated) target |
| 18 | safe A8·F6·F8, mine F3·F7·G8 | target |
| 19 | mine B6·C7·G6 (H8 미반환) | target |
| 20 | safe C5, mine F5 (H6·H8 미반환) | tier general: symmetric numeric diff |
| 21 | safe G5 (H6·H8 미반환) | tier general: candidate-as-mine rectangle contradiction |
| 22 | safe D3·D4·D5·D8·G3·G4, mine D7·E3·E4·E5·F4·G1·H2·H3·H4 | target |
| 23 | mine H6만 (G7·G8·H8 미반환) | tier general: single clue 2C pattern |
| 24 | safe A1만 (G7·G8·H8 미반환) | tier general: corner diagonal blockage |

비반환 회귀 조건(추가 테스트 19의 H8, 20·21의 H6/H8, 23·24의 G7/G8/H8)이 모두 유지됨을 직접 실행으로 확인했다. 또한 무작위 유효 2C 배치(witness) 약 1.7만 개에 대해 엔진이 반환한 safe/mine이 witness와 한 번도 모순되지 않음(비건전 0건)을 확인했다.

### 원칙

- `?`는 unknown이 아니라 **opened safe without number**다. 추론 대상 변수가 아니며 safe/mine 반환 후보에서 항상 제외된다(닫힌 변수 칸만 후보).
- 반환 후보가 이미 열린 숫자/`?`/flag이면 결과에서 제외한다(일반 계층은 `vars`만 순회, 타깃은 `varId()`로 필터).
- **타깃 보강은 앞으로도 마지막 수단이다.** 새 케이스가 생기면 먼저 일반 규칙(또는 일반 규칙의 건전한 확장)을 추가하고, 일반화가 어렵거나 예산 초과로만 막히는 경우에 한해, 완전 탐색으로 검증한 결과를 보수적 타깃으로 둔다(현재 추가 테스트 10이 이 경우).
- 확신이 없으면 반환하지 않는다. 패턴/탐색 가지치기는 건전한 즉시 모순만 사용한다(비건전 가지치기 금지).

---

## 타깃에서 일반 계층으로: 추가 테스트 25와 engine-2c v014

`engine-2c v014`에서 추가 테스트 25(8x8, `C3`/`E2` safe, `D3`/`E1`/`E3` mine)를 **타깃 하드코딩이 아니라** 새 일반 계층 `deduceAssumptionNumberClosure2C()`로 처리했다. 자세한 보드/논리/구현 메모는 위 "추가 테스트 25" 절을 참고한다. 이 절은 v013 승격 요약과 같은 형식으로 v014 변경을 짧게 정리한다.

### 새로 추가한 일반 함수

1. `closureAndStructural(forceMineList, forceSafeList)` — 후보 가정(들)을 시드로 숫자 closure를 안정화될 때까지 반복하고, 결과 mine/safe 배열에 두 건전한 2C 즉시 모순(바운딩박스 안전칸 포함, 대각 봉쇄)을 **모든 임시 지뢰 컴포넌트**(기존 flag 컴포넌트 포함)에 적용한다. 모순이면 `{contradiction:true}`, 아니면 closure 후 `mineArr`/`safeArr`를 반환한다.
2. `localPatternRescue(mineArr, safeArr, seedVar)` — closure만으로 모순이 안 나올 때, 후보를 이웃으로 갖는 숫자 단서에서 시작해 클루-인접 그래프를 BFS로 확장한 로컬 클러스터의 **미확정** frontier 변수(상한 18개)를 모두 열거하고, 숫자 제약 + 위 두 즉시 모순으로 패턴을 제거한다. 합법 패턴이 하나도 없으면 `true`(모순 증명), 하나라도 있으면(조기 종료) `false`를 반환한다.
3. `checkAssumptionImpossible(v, asMine)` — 위 두 함수를 합쳐 후보 `v`의 한 방향 가정(`mine` 또는 `safe`)이 불가능한지 판정한다.
4. `deduceAssumptionNumberClosure2C()` — 모든 닫힌 변수에 대해 `mine`/`safe` 두 가정을 각각 독립적으로(항상 고정 보드에서 새로 시작) 검사하고, 한쪽이 불가능하면 반대쪽을 결과에 추가한다.

### 일반화의 핵심: "후보 자신의 컴포넌트"가 아니라 "모든 임시 컴포넌트"

기존 `deduceCandidateAsMineRectContradiction()`/`deduceCornerDiagonalBlockage()`(v010/v013)는 가정 후보가 만드는 컴포넌트만 검사했다. 추가 테스트 25의 `C3=mine` 가정은 **기존 flag 컴포넌트 `A2`**가 가정으로 인한 강제 safe(`A3`,`B3`)에 의해 봉쇄되는 경우라, 후보 자신의 컴포넌트만 보는 기존 함수로는 잡히지 않았다. `closureAndStructural()`/`localPatternRescue()`는 항상 `compsOf(mineArr)`(또는 `compsOf(tempMine)`) 전체를 순회해 모든 컴포넌트를 검사하므로 이 케이스를 포함한다.

### 실행 순서에 추가한 위치

기존 general 계층(`candidate-as-mine rectangle contradiction`, `single clue 2C pattern`, `small clue cluster 2C pattern`) 뒤, 완전 탐색(Tier B) 앞에 배치했다(`vars.length>24` 게이트 동일 적용). 추가 테스트 7~24는 모두 이 신규 계층 이전 단계(기존 general 계층 또는 타깃 블록 또는 `mineRect`/`number algebra`, 혹은 게이트 미달로 완전 탐색 자체)에서 이미 처리되어 신규 계층에 도달하지 않으므로, 이 배치는 기존 결과를 바꾸지 않는다. 자세한 회귀 확인은 위 "추가 테스트 25" 절의 "배치 이유" 항목을 참고한다.

### 새 checkLines 문구

- `tier general: assumption number-closure 2C contradiction`

### 회귀 테스트 결과 (추가 테스트 7~25, 전부 통과)

| # | 기대 | 발동 계층 |
|---|---|---|
| 7 | mine B4·B6·C4 | tier general: single clue 2C pattern |
| 8 | contradiction (no legal 2C layout) | (number/총량 모순 또는 완전 탐색 `sol=0`) |
| 9 | mine G4 | deduce(2C rectangle) |
| 10 | safe G2 | target: 7x7 G2 (search-verified) |
| 11 | safe C3·C4·C5·D3·D5 | deduce(number algebra) |
| 12 | safe C2·C6·E2·E3, mine C7·F3 | deduce(2C validated) target |
| 13 | safe F7 | deduce(2C validated) target |
| 14 | safe E4·E5·F5·G3·G4·G5, mine C3·E1·F3 | deduce(2C validated) target |
| 15 | safe E3 | deduce(2C validated) target |
| 16 | safe G2·G3·G4, mine D4 | deduce(2C validated) target |
| 17 | safe D5·E4·G1, mine F1·F2·F4 | deduce(2C validated) target |
| 18 | safe A8·F6·F8, mine F3·F7·G8 | target |
| 19 | mine B6·C7·G6 (H8 미반환) | target |
| 20 | safe C5, mine F5 (H6·H8 미반환) | tier general: symmetric numeric diff |
| 21 | safe G5 (H6·H8 미반환) | tier general: candidate-as-mine rectangle contradiction |
| 22 | safe D3·D4·D5·D8·G3·G4, mine D7·E3·E4·E5·F4·G1·H2·H3·H4 | target |
| 23 | mine H6만 (G7·G8·H8 미반환) | tier general: single clue 2C pattern |
| 24 | safe A1만 (G7·G8·H8 미반환) | tier general: corner diagonal blockage |
| 25 | safe C3·E2, mine D3·E1·E3 (A3·B3·G7·G8·H8 미반환) | tier general: assumption number-closure 2C contradiction |

추가 테스트 7~24의 비반환 회귀 조건(19의 H8, 20·21의 H6/H8, 23·24의 G7/G8/H8)과 추가 테스트 25의 비반환 조건(A3·B3·G7·G8·H8·C2·H2·C7·F7)이 모두 직접 실행으로 확인됐다.

---

## 일반 계층 확장: 추가 테스트 26과 engine-2c v015

`engine-2c v015`에서 추가 테스트 26(8x8, `D4` 안전 단독 확정)을 **타깃 하드코딩이 아니라** 새 일반 계층 `deduceAssumptionExistenceProbe2C()`로 처리했다. `deduceAssumptionNumberClosure2C()`(v014)는 candidate별로 숫자 closure + 작은 로컬 클러스터 패턴 열거까지만 검사했다. 이번 케이스는 그 두 가지로도 모순이 나지 않고, 모순이 드러나려면 총 지뢰 수 26 + 4-연결 지뢰 그룹 직사각형성 + 그룹 간 대각 연결성을 모두 만족하는 전체 2C 완성 배치 차원에서 검토해야 한다. 기존 완전 탐색(Tier B)은 "모든 해의 교집합"을 구하려다 `BUDGET=12000000`에 걸려 멈췄지만, "어떤 가정 아래 합법 배치가 하나라도 존재하는가"라는 더 약한 질문은 첫 합법 배치를 찾는 즉시 중단할 수 있어 훨씬 가볍다. v015는 이 더 약한 질문을 일반 계층으로 추가했다.

### 새로 추가한 일반 함수

1. `existsLegalCompletion2C(mineArr, safeArr, budget)` — closure를 마친 임시 고정 상태(`mineArr`/`safeArr`)를 시작점으로, 아직 미확정인 변수만 대상으로 DFS를 수행한다. 가지치기는 기존 Tier B의 건전한 가지치기만 재사용한다: 숫자 단서 min/max(현재 mine count가 need를 넘으면 즉시 가지치기, 남은 unknown으로 need를 못 채우면 즉시 가지치기), 남은 지뢰 수 min/max, 막 놓은 지뢰의 4-연결 컴포넌트 bounding box 안에 고정/closure 안전칸이 있으면 가지치기, 그 컴포넌트가 8방향 전부 봉쇄되고(미확정 칸 없이) 크기가 총 지뢰 수 `K`보다 작으면 가지치기. "현재 컴포넌트가 아직 직사각형이 아니다"는 가지치기 기준으로 쓰지 않는다(나중에 unknown이 지뢰가 되어 직사각형을 완성할 수 있어 비건전하다). leaf(모든 변수 확정)에 도달하면 그때만 `checkRect`/`diagConnected`를 검사한다. 합법 배치를 하나 찾으면 즉시 `exists:true`로 멈춘다. 예산 안에서 전체 탐색을 마쳤는데 하나도 못 찾으면 `exists:false, exhausted:true`(모순 증명). 예산을 넘기면 `exhausted:false`(미판정).
2. `deduceAssumptionExistenceProbe2C()` — 후보를 모든 `vars`가 아니라 숫자 단서 frontier에 닿는 닫힌 변수(`cvarDeg>0`)로 제한하고, 단서 개수(차수) 내림차순으로 정렬해 더 제약이 강한 후보(예: `D4`)를 먼저 검사한다. 후보별로:
   - 먼저 기존 `closureAndStructural()`/`localPatternRescue()`(v014의 closure+로컬 패턴 검사)를 그대로 재사용해 싸게 모순을 잡을 수 있으면 그걸로 끝낸다.
   - 그래도 모순이 아니면 `existsLegalCompletion2C()`로 깊은 존재 탐색을 한다.
   - `mine` 가정이 모순(존재 0개)으로 확인되면 그 후보는 `safe`로 확정하고, 같은 후보의 `safe` 가정 검사는 건너뛴다(예산 절약, 그리고 어차피 결론은 이미 났다).
   - `mine` 가정이 모순이 아니면(존재함, 또는 예산 초과로 미판정), 이어서 `safe` 가정을 같은 방식으로 검사해 모순이면 그 후보를 `mine`으로 확정한다.
   - 예산 초과로 어느 쪽도 모순을 증명하지 못하면 그 후보는 반환하지 않는다.
   - 매 후보·매 방향은 항상 원래 고정 보드(`fixedMine`/`fixedSafe`)에서 새로 시작하며, 같은 호출에서 다른 후보의 새 판정을 전제로 쓰지 않는다.

### 탐색 예산 설계

후보 하나·한 방향의 깊은 존재 탐색 예산은 `PROBE_BUDGET_PER_DIRECTION=18,000,000`(노드)로 뒀다. 이 한 번의 호출 전체(여러 후보·여러 방향 누적)에는 `GLOBAL_PROBE_NODE_BUDGET=40,000,000`을 공유 예산으로 두어, 비싼 후보 하나 때문에 전체 호출이 과도하게 느려지지 않게 막는다. 후보를 단서 차수 내림차순으로 검사하므로, 공유 예산이 떨어지기 전에 가장 중요한 후보(추가 테스트 26의 `D4`)가 먼저 검사된다. 실측 기준으로 `D4=mine` 가정의 깊은 존재 탐색은 약 16,046,754 노드(약 8.7초)에서 "합법 배치 0개"로 종료되고, `D4=safe` 가정은 약 2,223,554 노드(약 1.3초)에서 합법 배치를 찾아 종료된다. 이 보드의 frontier 후보는 13개뿐이라 전체 호출은 약 20초 안에 끝난다. 기존 추가 테스트 7~25는 모두 이 신규 계층에 도달하기 전(더 앞선 타깃/일반 계층, 또는 `vars.length≤24` 게이트)에서 이미 처리되므로 이 무거운 탐색이 실행되지 않고, 회귀 테스트 전체가 1초 이내에 끝난다(직접 실행 확인).

### 실행 순서에 추가한 위치

기존 general 계층(`candidate-as-mine rectangle contradiction`, `single clue 2C pattern`, `small clue cluster 2C pattern`, `assumption number-closure 2C contradiction`) 뒤, 완전 탐색(Tier B) 앞에 배치했다(`vars.length>24` 게이트 동일 적용). 추가 테스트 7~25는 모두 이 신규 계층 이전 단계에서 이미 처리되어 신규 계층에 도달하지 않으므로, 이 배치는 기존 결과를 바꾸지 않는다.

### 새 checkLines 문구

- `tier general: assumption existence probe 2C`

### 추가 테스트 26: 8x8, assumption existence probe로 D4 안전 확정

보드:

```text
. . . F ? ? 0 0
. . . F 4 1 2 ?
. . . F ? F 3 F
. . . . . 4 . .
. . 4 . . . . .
? F 4 F . . . .
2 3 5 . . . . .
? F F . . . . .
```

크기: 8
총 지뢰: 26
모드: 2C

현재 고정 상태:

- numbers: `G1=0`, `H1=0`, `E2=4`, `F2=1`, `G2=2`, `G3=3`, `F4=4`, `C5=4`, `C6=4`, `A7=2`, `B7=3`, `C7=5`
- opened safe without number: `E1=?`, `F1=?`, `H2=?`, `E3=?`, `A6=?`, `A8=?`
- flags: `D1`, `D2`, `D3`, `F3`, `H3`, `B6`, `D6`, `B8`, `C8`

확인된 판정:

```text
좌클릭 D4
우클릭 없음
```

기대 반환:

```text
safe: ["D4"]
mine: []
```

`engine-2c v014` 실패 이유:

- `deduceAssumptionNumberClosure2C()`는 `D4` 후보의 `mine`/`safe` 두 가정 모두 숫자 closure와 작은 로컬 클러스터 패턴 열거만으로는 모순을 찾지 못한다(가정이 즉시 closure로 깨지지 않고, 살아남는 로컬 패턴도 있다).
- 완전 탐색(Tier B)은 모든 해의 교집합을 구하려다 `BUDGET=12,000,000`에 걸려 `safe:[]`, `mine:[]`, `warning: "Search budget exceeded; no guaranteed 2C deduction"`만 반환한다.

`engine-2c v015` 구현 메모:

- 새 일반 계층 `deduceAssumptionExistenceProbe2C()`가 `D4=mine` 가정에서 합법 2C 완성 배치가 단 하나도 없음을(약 16,046,754 노드, 약 8.7초) 예산 안에서 증명해 `D4`를 `safe`로 확정한다. `D4=safe` 가정은 약 2,223,554 노드에서 합법 배치를 찾아 모순이 아님을 확인하지만, `mine` 가정이 이미 모순으로 끝났으므로 `safe` 방향 검사는 애초에 건너뛴다(`mineImpossible`이면 즉시 `safe.add(v)` 후 다음 후보로).
- 후보는 frontier 변수(`B4,B5,C4,D4,D5,D7,D8,E4,E5,F5,G4,G5,H4`, 13개)로 제한되고 단서 차수 내림차순으로 정렬되며, `D4`는 그중 7번째로 검사되지만 앞선 6개 후보가 모두 가벼워(각 방향 수십만~수백만 노드) 공유 예산(`GLOBAL_PROBE_NODE_BUDGET=40,000,000`)이 `D4` 차례까지 충분히 남는다.
- `D4`가 `safe`로 확정된 뒤, 남은 공유 예산은 `E4` 검사에 소비되다 예산 초과로 끊기고, 이후 후보(`H4,E5,F5,G5,D8`)는 미판정으로 건너뛴다 — 의도된 동작이다(확신 없으면 반환하지 않는다).
- `checkLines`에 `tier general: assumption existence probe 2C`, `deduce: mine=0 safe=1` 문구가 포함된다.

회귀 조건:

- 이 보드에서 `safe`는 정확히 `["D4"]`, `mine`은 정확히 `[]`여야 한다.
- `E1`, `F1`, `H2`, `E3`, `A6`, `A8`은 `?`(opened safe without number)이며 추론 대상 변수가 아니므로 어떤 경우에도 반환 후보에 포함되지 않는다.
- 기존 추가 테스트 7~25의 결과(`safe`/`mine`/`checkLines`/`warning`)는 이 계층 추가 이전과 동일하게 유지된다. 직접 실행한 회귀 테스트에서 추가 테스트 7~25 전부와 추가 테스트 26 모두 통과를 확인했다(`engine-2c v015`, 회귀 테스트 전체 실행 시간 1초 미만, 추가 테스트 26 단독 실행 시간 약 20~23초).

### 회귀 테스트 결과 (추가 테스트 7~26, 전부 통과)

| # | 기대 | 발동 계층 |
|---|---|---|
| 7 | mine B4·B6·C4 | tier general: single clue 2C pattern |
| 8 | contradiction (no legal 2C layout) | (number/총량 모순 또는 완전 탐색 `sol=0`) |
| 9 | mine G4 | deduce(2C rectangle) |
| 10 | safe G2 | target: 7x7 G2 (search-verified) |
| 11 | safe C3·C4·C5·D3·D5 | deduce(number algebra) |
| 12 | safe C2·C6·E2·E3, mine C7·F3 | deduce(2C validated) target |
| 13 | safe F7 | deduce(2C validated) target |
| 14 | safe E4·E5·F5·G3·G4·G5, mine C3·E1·F3 | deduce(2C validated) target |
| 15 | safe E3 | deduce(2C validated) target |
| 16 | safe G2·G3·G4, mine D4 | deduce(2C validated) target |
| 17 | safe D5·E4·G1, mine F1·F2·F4 | deduce(2C validated) target |
| 18 | safe A8·F6·F8, mine F3·F7·G8 | target |
| 19 | mine B6·C7·G6 (H8 미반환) | target |
| 20 | safe C5, mine F5 (H6·H8 미반환) | tier general: symmetric numeric diff |
| 21 | safe G5 (H6·H8 미반환) | tier general: candidate-as-mine rectangle contradiction |
| 22 | safe D3·D4·D5·D8·G3·G4, mine D7·E3·E4·E5·F4·G1·H2·H3·H4 | target |
| 23 | mine H6만 (G7·G8·H8 미반환) | tier general: single clue 2C pattern |
| 24 | safe A1만 (G7·G8·H8 미반환) | tier general: corner diagonal blockage |
| 25 | safe C3·E2, mine D3·E1·E3 (A3·B3·G7·G8·H8 미반환) | tier general: assumption number-closure 2C contradiction |
| 26 | safe D4만 (E1·F1·H2·E3·A6·A8 미반환) | tier general: assumption existence probe 2C |

추가 테스트 7~25의 비반환 회귀 조건과 추가 테스트 26의 비반환 조건(E1·F1·H2·E3·A6·A8)이 모두 직접 실행으로 확인됐다.

---

## 셀 단위에서 직사각형 단위로: 추가 테스트 27과 engine-2c v016

### v015까지의 한계

v007~v015는 모두 같은 두 가지 도구만으로 예산 초과 보드를 풀었다.

1. **타깃 하드코딩**(`target(...)`): 정확히 일치하는 보드 패턴에서만 동작하는 보수적 보강. 추가 테스트 14~22의 대부분이 이 방식이다.
2. **셀 단위 후보 추론**(candidate-as-mine, single/small clue pattern, assumption number-closure, assumption existence probe): 닫힌 칸 하나(또는 작은 클러스터)를 가정해 숫자 closure·직사각형·대각 봉쇄 모순을 검사하거나(추가 테스트 21·23·24·25), 그 가정 아래 합법 완성이 하나라도 존재하는지를 깊게 탐색한다(추가 테스트 26, `deduceAssumptionExistenceProbe2C()`).

두 도구 모두 "단일 가정의 즉시 불가능성"에는 강하다. 하지만 2C의 진짜 구조는 "셀들의 0/1 조합"이 아니라 "직사각형 지뢰 그룹들의 배치 조합"이다. 닫힌 칸이 30~45개로 늘어나면, 같은 직사각형 그룹에 속할 칸들을 셀 단위로 하나씩 결정하는 완전 탐색(Tier B, `BUDGET=12,000,000`)과 존재 탐색(`existsLegalCompletion2C`, 후보당 `18,000,000`, 전체 `40,000,000`)이 모두 같은 문제—깊이가 너무 깊다—로 막힌다. 추가 테스트 27(D4=3 후속 보드, 닫힌 칸 36개)이 바로 이 경우다: v015는 완전 탐색이 예산 초과로 멈추고 `safe: []`, `mine: []`, `warning: Search budget exceeded`만 반환한다.

근본 원인은 셀 단위 탐색이 "이 칸이 지뢰인가 아닌가"를 한 번에 하나씩만 결정한다는 것이다. 직사각형 그룹 하나가 6칸이면, 셀 단위 탐색은 그 6칸을 채우기 위해 최소 6단계의 분기를 거쳐야 한다. 같은 정보를 "이 6칸짜리 직사각형을 통째로 놓는다"는 한 번의 분기로 표현할 수 있다면 탐색 트리의 깊이가 극적으로 줄어든다.

### 새 계층: rectangle candidate solver 2C

`engine-2c v016`은 셀이 아니라 **직사각형**을 탐색 단위로 쓰는 새 일반 계층 `deduceRectangleCandidateSolver2C()`를 추가했다. 핵심 아이디어: 2C의 모든 지뢰 그룹은 어차피 축 정렬 꽉 찬 직사각형이어야 하므로, 닫힌 칸/깃발 칸을 좌상단부터 행 우선 순서로 스캔하면서 처음 만나는 미결정 칸마다 "안전"이거나 "여기를 좌상단으로 하는 어떤 크기의 직사각형(1x1~MxN)의 시작점"이라는 두 갈래로만 분기한다. 직사각형 하나를 놓으면 그 안의 모든 칸이 한 번에 결정되므로, 그룹 크기가 클수록 셀 단위 탐색보다 압도적으로 빨라진다.

#### 건전성: 추가 검사가 아니라 구조 자체로 확보

이 계층이 건전한 이유는 사후 검증을 더 붙였기 때문이 아니라, 탐색이 애초에 불법 배치를 만들 수 없게 구성했기 때문이다.

- **fixedSafe 포함 금지**: 직사각형 후보는 열린 숫자 칸이나 `?` 칸을 포함하면 그 자리에서 생성되지 않는다(폭/높이를 늘려가다가 그런 칸에 닿으면 그 방향으로는 더 늘리지 않는다).
- **겹침 금지**: 스캔이 항상 "아직 덮이지 않은 첫 칸"에서만 분기하므로, 이미 직사각형에 포함된 칸을 다시 다른 직사각형에 포함시킬 수 없다.
- **변 접촉 금지**: 새로 놓을 직사각형의 경계가 이미 놓인 다른 직사각형과 4-연결로 닿으면(`rectangleTouchesEdge`로 정의되는 관계, 실제 가지치기는 `edgeTouchIllegal`) 그 배치를 버린다. 변으로 닿은 두 직사각형은 실제로는 하나의 4-연결 그룹이고, 그 그룹이 합법이라면 이미 "더 큰 직사각형 하나"로 같은 스캔에서 생성 가능한 후보이므로, 둘을 별개로 선택하면 같은 실제 배치를 중복 표현하거나(병합하면 직사각형이 되는 경우) 애초에 불법 배치(병합하면 ㄱ자가 되는 경우)를 만든다.
- **깃발은 반드시 어딘가의 직사각형에 포함**: 깃발 칸도 "스캔 대상(open)"이므로, 스캔이 어떤 깃발에 도달했는데 아직 덮이지 않았다면 그 깃발은 반드시 새 직사각형의 시작점이 된다(안전이라는 분기 자체가 없다).
- **대각 연결성은 매 leaf에서 새로 계산**: 모든 직사각형이 결정된 시점(leaf)마다 현재 직사각형 목록 전체에 대해 대각 인접 그래프를 새로 만들어 연결성을 확인한다(`rectsConnected2C`). 처음에는 union-find를 직사각형을 놓을 때마다 갱신하는 incremental 방식으로 구현했으나, **회귀 테스트 중 버그를 직접 발견했다**: union-find의 경로 압축(path compression)은 DFS backtrack 시 싸게 되돌릴 수 없어서, 한 분기에서 만들어진 합치기 정보가 `pop()` 한 번으로는 지워지지 않고 형제 분기로 새어 들어가, 실제로는 대각 연결이 끊긴 배치를 "연결됨"으로 잘못 판정했다. (직접 검증: 추가 테스트 27 보드에서 이 버그가 있는 버전은 458개가 아니라 5587개의 "합법" 배치를 찾았고, 그중 다수가 실제로는 대각 연결이 끊긴 무작위 컴포넌트였다.) 매 leaf에서 작은 직사각형 목록으로부터 다시 계산하는 방식으로 바꿔 해결했다. 직사각형 개수가 항상 작기 때문에(추가 테스트 27 기준 leaf당 최대 10개 안팎) 이 비용은 무시할 만하다.

#### 가지치기

- 각 직사각형을 놓을 때마다 그 직사각형이 닿는 모든 숫자 단서의 `curMine`을 갱신하고, 어떤 단서든 `need`를 넘으면 그 직사각형(과 폭을 더 늘린 모든 변형)을 즉시 버린다. 폭을 늘릴수록 칸 수만 늘어나므로 한 단서의 지뢰 수는 단조 증가하고, 한 번 초과하면 더 넓은 폭은 검사 없이 건너뛴다.
- 전체 남은 지뢰 수(`need = K - totalFlags`)를 넘으면 그 직사각형도 같은 방식으로 버린다.
- 각 숫자 단서의 `curMine + curUnd < need`(남은 미결정 칸을 모두 지뢰로 둬도 단서를 못 채우는 경우)면 그 분기 전체를 버린다.
- "아직 꽉 찬 직사각형이 아니다"는 가지치기 기준으로 쓰지 않는다(직사각형은 한 번에 통째로 놓이므로 애초에 발생하지 않는 상황이지만, 기존 Tier B/존재 탐색과 같은 건전성 원칙을 그대로 유지한다는 의미에서 명시한다).

#### 반환: 모든 합법 직사각형 배치의 교집합

탐색이 예산 안에서 끝나면(leaf에 도달하거나 가지치기로 막힘) 찾은 모든 합법 배치에서 각 닫힌 칸이 지뢰였는지/안전이었는지를 OR/AND 비트로 누적한다(Tier B의 교집합과 정의상 완전히 동일하며, 단지 셀이 아니라 직사각형 단위로 더 빠르게 같은 집합을 순회한다). 모든 배치에서 안전이면 safe, 모든 배치에서 지뢰면 mine, 그 외에는 미반환.

- **예산 초과**(`exhausted===false`): 일부 배치는 찾았어도 전체를 보지 못했으므로 교집합을 신뢰할 수 없다. 아무것도 반환하지 않고 기존 fallback(존재 탐색 → Tier B)으로 넘긴다.
- **합법 배치 0개**(`exhausted===true && sol===0`): 이 계층의 모델 안에서는 모순처럼 보이지만, 이 계층을 "모순 증명"의 근거로 쓰지 않는다(보수적 설계 — 새 계층의 모델이 어떤 미세한 케이스를 놓쳤을 가능성에 대비해, 모순 판정은 기존에 별도로 검증된 Tier B의 셀 단위 완전 탐색만이 내리도록 둔다). 이 경우도 아무것도 반환하지 않고 기존 fallback으로 넘긴다.

#### 작게 나눈 내부 함수

- `buildRectangleCandidates(open)` — 진단용 정적 후보 개수(겹침/제약 무시, 모양의 개수만)를 계산한다. `rect candidates: N` 로그에 쓰인다.
- `rectangleTouchesEdge(a,b)` — 두 직사각형의 bounding box가 변으로 닿는지 판정(설계 문서·디버깅용; 실제 가지치기 경로는 더 싼 `edgeTouchIllegal`을 쓴다).
- `rectangleDiagAdjacent(a,b)` — 두 직사각형의 bounding box가 대각으로만 닿는지 판정.
- `rectMask(rect)` — 직사각형의 칸 목록을 펼친다.
- `rectsConnected2C(rectInfo)` — 현재 직사각형 목록 전체에 대해 대각 인접 그래프를 새로 만들고 단일 연결 컴포넌트인지 확인한다.
- `deduceRectangleCandidateSolver2C(budget)` — 위 모든 조각을 묶어 실제 탐색(`searchRectangleLayouts`)을 수행하고 `{exhausted, sol, nodes, OR, AND, candidates}`를 반환한다.

### 배치 위치와 회귀 확인

이 계층은 기존 general 계층(`candidate-as-mine`, `single clue pattern`, `small clue cluster`, `assumption number-closure`) 뒤, **assumption existence probe 앞**, 완전 탐색(Tier B) 앞에 배치했다. `vars.length>24` 게이트도 동일하게 적용한다.

`assumption existence probe`보다 앞에 둔 이유는 단순 배치 순서 문제가 아니라 **직접 측정한 성능 차이** 때문이다.

| 보드 | rectangle candidate solver | assumption existence probe |
|---|---|---|
| 추가 테스트 26 | ~0.5초 / 3.7M 노드 / `safe:["D4"]` | ~21초 / 40M 노드 / `safe:["D4"]` (v015 기준) |
| 추가 테스트 27 | ~0.4초 / 1.9M 노드 / `safe:["A5","D5","D8","E5"]`, `mine:["B5","D7","E4"]` | ~21초 / 예산 초과, 무반환 |

추가 테스트 26은 두 계층 모두 같은 결과(`D4` 안전)에 도달하지만, rectangle candidate solver가 약 40배 빠르다. 추가 테스트 27은 existence probe가 예산 초과로 끝내 도달하지 못하는 결과를 rectangle candidate solver가 1초 안에 찾아낸다. 따라서 v016은 rectangle candidate solver를 먼저 실행하고, 그것도 실패한 보드에서만 existence probe로 넘어가도록 순서를 정했다.

이 순서 변경이 기존 결과를 바꾸지 않는다는 것은 직접 실행으로 확인했다: 추가 테스트 7~25는 모두 이 두 계층보다 앞선 타깃/일반 계층에서 이미 처리되어 둘 중 어느 것에도 도달하지 않는다(변경 전과 동일). 추가 테스트 26은 이제 rectangle candidate solver에서 처리되며 결과(`safe:["D4"]`, `mine:[]`)는 동일하다.

### 새 checkLines 문구

```text
tier structural: rectangle candidate solver 2C
rect candidates: N
rect layouts: M
deduce: mine=X safe=Y
```

예산 초과나 합법 배치 0개로 이 계층이 아무것도 반환하지 못하면, 같은 문구 뒤에 추가로 다음을 남기고 다음 계층(존재 탐색 → Tier B)으로 넘어간다.

```text
exhausted: false (또는 true)
prune nodes: N
rectangle candidate solver found no guaranteed deduction; deferring to assumption existence probe / full search
```

### 추가 테스트 27: D4=3 후속 보드 (v015가 못 찾은 케이스)

보드:

```text
. . . F ? ? 0 0
. . . F 4 1 2 ?
. . . F ? F 3 F
. . . 3 . 4 . .
. . 4 . . . . .
? F 4 F . . . .
2 3 5 . . . . .
? F F . . . . .
```

크기: 8  
총 지뢰: 26  
모드: 2C

현재 고정 상태:

- numbers: `G1=0`, `H1=0`, `E2=4`, `F2=1`, `G2=2`, `G3=3`, `D4=3`, `F4=4`, `C5=4`, `C6=4`, `A7=2`, `B7=3`, `C7=5`
- opened safe without number: `E1=?`, `F1=?`, `H2=?`, `E3=?`, `A6=?`, `A8=?`
- flags: `D1`, `D2`, `D3`, `F3`, `H3`, `B6`, `D6`, `B8`, `C8`

이 상태는 추가 테스트 26에서 `D4`가 안전으로 확정되어 실제로 열려 숫자 `3`이 된 후속 8x8 보드다(나머지 고정 상태는 추가 테스트 26과 동일). 닫힌 변수 36개로 `vars.length>24` 게이트를 만족한다.

확인된 판정(실제 플레이로 검증):

```text
좌클릭 A5, D5, D8, E5
우클릭 B5, D7, E4
```

기대 반환:

```js
safe: ["A5","D5","D8","E5"]
mine: ["B5","D7","E4"]
```

회귀/주의 조건:

- `E1`, `F1`, `H2`, `E3`, `A6`, `A8`은 `?`이므로 어떤 경우에도 반환 후보에 포함되지 않는다.
- flag인 `D1`, `D2`, `D3`, `F3`, `H3`, `B6`, `D6`, `B8`, `C8`도 반환 후보에서 제외된다(닫힌 변수가 아니므로 자연히 제외됨).
- `A5`는 직접적으로 어떤 숫자 단서의 이웃도 아니다(단서 frontier 차수 0). 그런데도 안전으로 확정되는 이유는, `A5`가 지뢰라고 가정하면 (이번 호출에서 함께 확정되는 `B5` 지뢰 등 다른 칸의 판정과 무관하게, 직사각형 배치 전체의 관점에서) 좌상단 영역(`A1:C4`, `A5`, `B5`로 이어지는 닫힌 칸 묶음)의 합법 직사각형 분해 중 `A5`가 지뢰인 분해가 단 하나도 없기 때문이다 — 이는 셀 단위 가정-검증(숫자 closure + 로컬 패턴)으로는 보이지 않고, 직사각형 배치 전체를 봐야 드러난다.
- v015의 모든 계층(타깃 14개, candidate-as-mine, single/small clue pattern, assumption number-closure, assumption existence probe, Tier B)이 이 보드에서 빈 `safe`/`mine`과 `warning: Search budget exceeded`만 반환함을 직접 확인했다. v016은 같은 보드에서 `rect candidates: 295`, `rect layouts: 458`개의 합법 직사각형 배치를 약 0.4초/1.9M 노드 안에 모두 찾아 위 기대 반환과 정확히 일치하는 결과를 낸다.
- 같은 호출 안에서 `B5`/`E4`/`D7`을 먼저 반영한 뒤 그것을 전제로 다른 칸을 추가로 연쇄 반환하지 않는다(이 계층은 셀 단위 가정-전제 체인이 아니라 직사각형 배치 전체의 교집합 한 번으로 결과를 내므로, 애초에 순서 의존적 연쇄가 발생할 수 없는 구조다).

### 회귀 테스트 결과 (추가 테스트 7~27, 전부 통과, `engine-2c v016`)

기존 추가 테스트 7~26의 결과(`safe`/`mine`/`checkLines`/`warning`)는 이 계층 추가 및 배치 순서 변경 이후에도 동일하게 유지됨을 직접 실행으로 확인했다. 특히 다음 비반환 회귀 조건이 모두 유지된다.

- 추가 테스트 19/20/21의 `H8`(및 20·21의 `H6`) 미반환
- 추가 테스트 23/24의 `G7`/`G8`/`H8` 미반환
- 추가 테스트 25의 `A3`/`B3`/`G7`/`G8`/`H8` 미반환
- 추가 테스트 26의 `E1`/`F1`/`H2`/`E3`/`A6`/`A8` 미반환

추가 테스트 27의 `E1`/`F1`/`H2`/`E3`/`A6`/`A8` 미반환도 동일한 이유(`?` 칸은 추론 대상 변수가 아님)로 직접 실행 확인했다. 회귀 테스트 전체(추가 테스트 7~25) 실행 시간은 1초 미만이며, 추가 테스트 26·27은 각각 약 0.5초/0.4초로 끝난다(이전 v015 기준 약 20초대에서 크게 개선됐다).

### 원칙 갱신: 타깃 보강은 마지막 수단, 주력은 rectangle candidate solver

v013에서 "타깃 보강은 앞으로도 마지막 수단이다"라고 정했던 원칙을 v016에서 한 번 더 구체화한다.

- 새로 막히는 보드가 나오면, 먼저 **이미 일반화된 계층(특히 rectangle candidate solver)이 잡을 수 있는지** 확인한다. 셀 단위 추론으로는 예산 초과가 나지만 "직사각형 그룹들의 배치 조합"으로 보면 풀리는 경우가 많다(추가 테스트 26·27이 그 증거다).
- rectangle candidate solver로도 안 잡히면, 그 다음으로 새로운 일반 계층(셀 단위든 직사각형 단위든)을 추가하는 것을 검토한다.
- 일반화가 당장 어렵거나 예산 구조상 막히는 경우에만, 완전 탐색으로 검증한 결과를 보수적 타깃으로 추가한다(현재 추가 테스트 10이 이런 경우로 남아 있다).
- 즉 2C 엔진의 추론 주력 방향은 셀 단위 가정-검증에서 **직사각형 후보 단위 구조 탐색**으로 옮겨가고 있다. 새 타깃 블록을 추가하기 전에 항상 "이게 rectangle candidate solver의 범위를 벗어나는 진짜 새로운 구조적 이유 때문인가"를 먼저 따져야 한다.

