# Solgic3 Project Instructions

새 채팅에서 작업을 이어갈 때는 먼저 `CURRENT_CONTEXT.md`를 읽고 현재 기준점을 복원한다. Pages 설정이나 과거 단계로 되돌아가지 않는다.

이 파일은 다음 채팅에서 프로젝트 구조를 빠르게 파악하기 위한 짧은 지침이다.  
세부 게임 규칙과 엔진 설계는 모드별 소스 문서를 기준으로 한다.  
Quad는 `solgic3_quad_solver_source.md`, Connected/2C는 `solgic3_2c_solver_source.md`를 참조한다.

## 파일 용도

- `index.html`  
  Solgic3 브라우저 UI. 보드 입력, 모드 선택, 상태 표시, 추론 버튼, 결과 표시를 담당한다.

- `engine-2g.js`  
  기존 2G 모드 추론 엔진. 새 엔진 작성 시 반환 형식과 연결 방식을 참고한다.

- `engine-q.js`  
  새로 만들 Quad(쿼드) 모드 전용 추론 엔진.  
  숫자 지뢰찾기 규칙 + Quad 2×2 제약 + 총 지뢰 수 제약으로 확정 안전/지뢰만 반환한다.

- `engine-2c.js`  
  새로 만들 Connected/2C 모드 전용 추론 엔진.  
  숫자 지뢰찾기 규칙 + 지뢰 그룹 직사각형성 + 그룹 간 대각 연결성 + 총 지뢰 수 제약으로 확정 안전/지뢰만 반환한다.

- `engine-2f.js`  
  2F/Flower 모드 전용 추론 엔진.  
  체스판 색칠 + 색칠된 지뢰의 상하좌우 지뢰 정확히 1개 규칙을 사용한다. 현재 v003은 brute-force 완성해 열거가 아니라 논리 전파·제약 차분·가정 세계 내부의 반복 failed-literal 전파로 확정칸을 찾는다.

- `source/solgic3_2f_solver_source.md`  
  2F 규칙, 현재 추론 범위, 회귀 케이스와 향후 일반화 원칙을 기록한다.

- `solgic3_quad_solver_source.md`  
  Quad 규칙, `?` 칸 정의, 좌표 규칙, 엔진 설계, 테스트 케이스를 담은 상세 소스 문서다.

- `solgic3_2c_solver_source.md`  
  Connected/2C 규칙, `?` 칸 정의, 좌표 규칙, 엔진 설계, 테스트 케이스를 담은 상세 소스 문서다.

## 작업 원칙

- 추측/확률이 아니라 논리적으로 확정된 칸만 표시한다.
- `?`는 unknown이 아니라 열린 안전칸이다.
- 사용자 표시 좌표는 `A1`, `C3` 형식을 사용한다.
- 새 모드는 가능하면 독립 엔진 파일로 분리한다.

## Handoff

- 에이전트/세션 간 작업 인계는 `handoff/` 폴더를 사용한다.
- 현재 진행 중인 작업이 있으면 `CURRENT_CONTEXT.md` 다음으로 `handoff/README.md`와 관련 `CURRENT_*.md` 문서를 읽는다.
- 작업을 마친 에이전트는 해당 handoff 문서의 작업 결과를 갱신한다.

## Model Experiments

Solgic 모델 실험 데이터의 정본은 저장소 내부 `_codex/`에 둔다.

- 구조화 registry: `_codex/references/planning/model_experiment_samples.json`
- compact 비교 로그: `_codex/references/planning/model_experiment_log.md`
- 날짜별 상세 history: `_codex/history/model_experiments/`

원칙:

- 1회 실제 실행 = 1 sample
- registry에는 모든 의미 있는 실행을 구조화해 기록한다.
- 상세 증거와 confound는 날짜별 history에 기록한다.
- compact log는 반복 표본이 실제 비교 가설을 바꿀 때만 갱신한다.
- UI quota의 `used` / `remaining` 의미를 임의 변환하지 않는다.
- 속도·quota뿐 아니라 test, regression, 독립 review, operational correctness, 재작업 비용을 함께 본다.
- 모델 전체 서열이 아니라 Solgic 작업 유형별 routing을 찾는다.
- 외부 `4sightt/docs`에는 자동 복제하지 않는다.
- 기존 `experiments/model/`은 legacy 안내 경로이며 정본이 아니다.
