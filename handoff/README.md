# Solgic Handoff

이 폴더는 ChatGPT, Codex, Cowork 등 서로 다른 작업 세션/에이전트가 Solgic 작업을 이어받기 위한 공용 인계 지점이다.

## 사용 원칙

1. 저장소 전체 기준점은 먼저 `AGENTS.md`와 `CURRENT_CONTEXT.md`를 읽는다.
2. 현재 진행 중인 작업이 있으면 이 폴더의 `CURRENT_*.md` 문서를 추가로 읽는다.
3. handoff 문서는 코드 정본이 아니다.
   - 실제 구현 상태는 GitHub 최신 코드가 우선이다.
   - 규칙/설계의 안정적인 정본은 `source/*.md`를 우선한다.
4. 작업을 마친 에이전트는 해당 handoff 문서의 **작업 결과** 섹션을 갱신한다.
   - 변경 파일
   - 핵심 결정
   - 검증/테스트 결과
   - 남은 문제
5. handoff에는 코드 전체를 복제하지 않는다. 다른 에이전트가 즉시 작업을 재개하는 데 필요한 맥락만 기록한다.

## 현재 handoff

- `CURRENT_UI_CLEANUP.md` — 기존 UI를 최대한 보존하면서 State 패널과 UI/solver 경계를 정돈하는 작업
