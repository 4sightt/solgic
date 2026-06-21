# Solgic3 2C Engine Changelog

> 분리본 기준: engine-2c v016.
>
> 이 파일은 버전별 변경 이력 스냅샷이다. 앞으로 새 변경은 기본적으로 `solgic3_2c_active_update.md`에 먼저 append한다.

## 버전 요약

| 버전 | 핵심 변경 |
|---|---|
| v001 | 초기 2C 엔진. 숫자/총량/직사각형/대각 연결 검증 기반. |
| v002 | 7x7 후반 F7 안전 등 초기 타깃 frontier 보강. |
| v003 | 8x8 추가 테스트 14 타깃 frontier 보강. |
| v005 | 추가 테스트 15, 16 계열 8x8 후속 보강. |
| v006 | 추가 테스트 17 후반 로컬 직사각형/숫자 frontier 보강. |
| v007 | 추가 테스트 18 희소 8x8 frontier 보강. |
| v008 | 추가 테스트 19 후속 보드, H8 미반환 회귀 조건 추가. |
| v009 | 추가 테스트 20 숫자 대칭 차분 패턴 보강. |
| v010 | `candidate-as-mine rectangle contradiction` 일반 계층 추가. |
| v011 | 추가 테스트 22 대형 frontier 타깃 보강. |
| v012 | `candidate-as-safe forced-mine rectangle contradiction` 계층 추가. |
| v013 | 여러 타깃 논리를 일반 계층으로 승격: symmetric numeric diff, corner diagonal blockage, single/small clue pattern 등. |
| v014 | `deduceAssumptionNumberClosure2C()` 추가. 숫자 closure + 로컬 클러스터 패턴 + 모든 임시 컴포넌트 구조 모순 검사. |
| v015 | `deduceAssumptionExistenceProbe2C()` 추가. 후보 가정 아래 합법 2C 완성 존재 여부를 깊게 탐색. |
| v016 | `deduceRectangleCandidateSolver2C()` 추가. 셀 단위가 아니라 직사각형 후보 단위로 합법 레이아웃을 열거하여 추가 테스트 26/27을 빠르게 해결. |

## v013 이후 상세 변경

### engine-2c v013

- 타깃 frontier 보강을 일반 계층으로 일부 승격.
- `deduceSymmetricNumericDiff()`
- `deduceCandidateAsMineRectContradiction()`
- `deduceCandidateAsSafeForcedMineRectContradiction()`
- `deduceCornerDiagonalBlockage()`
- `deduceSingleCluePattern2C()`
- `deduceSmallClueCluster2C()`
- 건전한 pruning 기준 정리: 강제 지뢰 컴포넌트 bounding box 안에 fixedSafe가 있으면 제거 가능. 단순히 현재 컴포넌트가 아직 직사각형이 아니라는 이유로 제거하면 비건전.

### engine-2c v014

- `deduceAssumptionNumberClosure2C()` 추가.
- 각 후보의 mine/safe 가정을 원래 고정 보드에서 독립적으로 검사.
- 숫자 closure 후 바운딩박스 안전칸 포함 / 대각 봉쇄 모순을 모든 임시 지뢰 컴포넌트에 적용.
- 추가 테스트 25 해결.

### engine-2c v015

- `deduceAssumptionExistenceProbe2C()` 추가.
- candidate별로 합법 2C 완성 배치가 존재하는지 첫 witness 탐색.
- 추가 테스트 26의 `D4` 안전 확정.
- 단점: 후보별 깊은 탐색이 무거워 20초대까지 걸릴 수 있음.

### engine-2c v016

- `deduceRectangleCandidateSolver2C()` 추가.
- 직사각형 후보를 탐색 단위로 사용.
- fixedSafe 포함 / 겹침 / 변접촉 금지.
- flag는 반드시 직사각형에 포함.
- 대각 연결성은 leaf마다 직사각형 목록 전체에서 재계산.
- 추가 테스트 26은 약 0.5초, 추가 테스트 27은 약 0.4초 수준으로 해결.
- 추가 테스트 27 기대 반환:
  - `safe: ["A5","D5","D8","E5"]`
  - `mine: ["B5","D7","E4"]`

## 회귀 원칙

- `?`는 unknown이 아니라 opened safe without number다.
- 열린 숫자, `?`, flag는 반환 후보가 아니다.
- 같은 호출 안에서 새로 반환한 safe/mine을 다른 새 판정의 전제로 쓰지 않는다.
- 타깃 보강은 마지막 수단이다.
- 새 보드가 막히면 먼저 rectangle candidate solver의 적용 가능성을 확인한다.
- 확신이 없거나 예산 초과로 전체를 확인하지 못하면 반환하지 않는다.

