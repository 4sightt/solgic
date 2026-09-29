# Solgic Current Context

이 파일은 새 채팅에서 Solgic 작업 맥락을 정확히 이어가기 위한 현재 기준점이다.
과거 대화 기억보다 이 파일과 실제 GitHub 최신 파일을 우선한다.

## 현재 저장소 상태

- Repository: `4sightt/solgic`
- Branch: `main`
- Visibility: public
- GitHub Pages: 이미 활성화되어 실제 배포까지 완료된 상태다.
- **Pages 설정을 다시 안내하거나 "배포 확인이 남아 있다"고 간주하지 않는다.**

## 현재 2F 상태

- UI에 `2F` 모드가 추가되어 있다.
- 현재 엔진: `engine-2f v003`
- 상세 정본: `source/solgic3_2f_solver_source.md`
- 회귀 테스트: `tests/engine-2f.test.js`

2F 규칙:
- 체스판 색칠이며 `A1`은 비색칠, `B1`은 색칠이다.
- 색칠된 칸에 지뢰가 있으면 그 칸의 상하좌우 지뢰 수는 정확히 1이다.
- `?`는 미지 칸이 아니라 이미 열린 안전칸이다.

v003의 추론:
- 숫자 직접 추론
- 총 지뢰 수
- 2F 직접 제약
- exact-sum subset / difference
- 후보 가정
- 가정 세계 내부 iterative failed-literal propagation
- proof를 통해 확정된 칸만 반환
- brute-force 완성 보드 열거를 사용하지 않는다.
- 특정 좌표/특정 퍼즐 하드코딩을 사용하지 않는다.

실제 진행 기록:
- 사용자는 2F 5x5/6x6을 클리어했다고 보고했다.
- 7x7에서 v001/v002의 한계를 찾아 v003까지 발전시켰고, 7x7 클리어를 확인했다.
- 8x8 5번째 퍼즐에서 v002가 막혔고, v003으로 확장한 뒤 해당 퍼즐 클리어를 확인했다.
- 8x8 심화 회귀에서 v003은 `D3,G1,G3 = mine`, `G2 = safe`를 독립 증명한다.

## 현재 관심사: 2B / Bridge

사용자가 다음 변형으로 **2B**를 제시했다.
아직 2B 엔진 구현은 시작하지 않았다.

게임 화면의 규칙 문구:

> 모든 지뢰는 보드의 왼쪽과 오른쪽 끝을 잇는 '체인'을 2개(7x7 이상 크기의 보드에서는 3개) 형성합니다. 여기서 '체인'이란 가로 또는 대각선으로 이어져 보드를 횡단하는 지뢰들의 그룹을 의미합니다.

현재 해석:
- 5x5, 6x6: 정확히 2개의 left-to-right mine chain
- 7x7, 8x8: 정확히 3개의 left-to-right mine chain
- chain adjacency는 **가로 또는 대각선**이다.
- 순수 상하 인접은 chain 연결로 보지 않는 것으로 읽는다.
- 이 규칙은 2F보다 전역적이며, component/reachability/merge 가능성을 다루는 그래프 제약이 필요하다.

두 번째 예시 화면은 중앙 지뢰 하나가 기존 체인들을 잘못 합쳐 invalid가 되는 사례를 보여준다.

## 현재 설계 논의

사용자와 합의된 방향은 다음과 같다.

기존 구조:
```text
engine-q.js
engine-2g.js
engine-2c.js
engine-2f.js
```

장기적으로 검토 중인 구조:
```text
Common Proof Engine
├─ board / clue constraints
├─ total mines
├─ exact-sum algebra
├─ assumption
├─ failed-literal propagation
├─ proof tracking
└─ result formatting

Variant Rule Modules
├─ 2F: colored-mine orthogonal=1
├─ Q: 2x2 constraint
├─ 2B: chain/connectivity constraint
└─ 2C: rectangle/connectivity constraint
```

핵심 원칙:
- 모드마다 완전히 독립된 추론 엔진을 계속 복제하기보다,
  **공통 proof engine + 모드별 규칙/전용 propagator** 구조를 검토한다.
- 2B는 이 공통화 리팩터링을 시작하기 좋은 후보로 보고 있다.
- 다만 2B처럼 전역 구조 규칙은 단순한 rule expression만으로 끝나지 않고,
  별도 connectivity/graph propagator가 필요할 가능성이 높다.

## 다음 작업 기준점

새 채팅에서 Solgic을 이어갈 때 **Pages 설정이나 2F 초기 구현으로 돌아가지 않는다.**

현재 이어갈 지점은:

1. 2B 규칙을 정확히 formalize한다.
2. 공통 proof engine을 먼저 분리할지, 2B 독립 프로토타입으로 규칙을 검증한 뒤 분리할지 판단한다.
3. 2B의 graph constraint가 무엇을 "즉시 모순" 또는 "증명 가능한 다음 수"로 판정해야 하는지 정의한다.
4. 실제 2B 5x5 퍼즐 상태를 받아 첫 추론/엔진 검증을 시작한다.

