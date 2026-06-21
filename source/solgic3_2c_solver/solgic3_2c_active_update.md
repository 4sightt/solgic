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

