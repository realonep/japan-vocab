# Data Workflow

주차 단어 데이터(`weekN.json`)는 `data/` 폴더에서만 관리합니다.

## 1) 새 주차 데이터 생성

```bash
python3 scripts/import_week_data.py --week 7 --input "/Users/realone/Downloads/Japanese_60Day_Week7_With_KRPron_Spaced.txt"
```

생성 결과:

- `data/week7.json`

## 2) 빠른 검증

```bash
python3 - <<'PY'
import json
from pathlib import Path
p = Path("data/week7.json")
d = json.loads(p.read_text(encoding="utf-8"))
print("items:", len(d))
print("keys :", sorted(d[0].keys()))
PY
```

## 3) 커밋 전략 (권장)

- 코드 변경과 데이터 변경을 분리:
  - 코드: `feat(ui): ...`
  - 데이터: `data: add week7 vocabulary dataset`

큰 JSON은 빈번히 바뀌지 않으므로 데이터 변경 시점에만 동기화하는 방식이 효율적입니다.
