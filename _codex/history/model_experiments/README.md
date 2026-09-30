# Solgic Model Experiment History

이 폴더는 Solgic 모델 실험의 날짜별 상세 기록층이다.

## 역할

- `_codex/references/planning/model_experiment_samples.json` — 모든 실제 실행의 구조화 index
- 이 폴더 — 실행 당시의 상세 조건, 결과, 품질 관찰, confound, 해석 보존
- `_codex/references/planning/model_experiment_log.md` — 현재 비교 가설의 compact 요약

## 기록 원칙

- 1회 실제 실행 = 1 sample
- 결과와 해석을 분리한다.
- quota는 UI의 `used` / `remaining` 의미를 그대로 보존한다.
- quota reset이나 불확실한 값은 `invalid / unknown`으로 둔다.
- 속도와 quota만으로 효율을 판정하지 않는다.
- 재작업, regression, 독립 review, architectural boundary, commit/push 정확성까지 함께 본다.
- 서로 다른 task profile은 직접 비교하지 않고 confound를 명시한다.
- 모든 작은 수정이 sample일 필요는 없다. 모델 선택 비교에 의미가 있는 실제 실행 단위만 남긴다.

## 새 실행 기록 절차

1. 실제 실행 조건과 결과 확인
2. 중복되지 않는 `sample_id` 발급
3. registry에 sample 추가
4. 같은 날짜 history에 상세 관찰 추가
5. `detail_history` 링크 확인
6. sample_count / 날짜별 count 갱신
7. compact log의 비교 가설이 실제로 바뀌었는지 판단
8. 바뀐 경우에만 compact log 갱신
9. JSON parse, 중복 ID, 날짜, 모델/mode, quota 의미, history 링크 검증
10. diff 확인 후 Solgic 저장소에 commit/push
