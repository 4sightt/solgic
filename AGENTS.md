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
