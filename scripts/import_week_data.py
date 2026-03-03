#!/usr/bin/env python3
"""
Convert tab-separated week vocabulary text into project JSON format.

Usage:
  python3 scripts/import_week_data.py --week 7 --input "/path/to/week7.txt"
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


EXPECTED_COLUMNS = 7
EXPECTED_KEYS = (
    "word",
    "yomi",
    "meaning",
    "word_pron",
    "sentence",
    "s_meaning",
    "s_pron",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import week vocabulary data.")
    parser.add_argument("--week", type=int, required=True, help="Week number, e.g. 7")
    parser.add_argument("--input", type=str, required=True, help="Input TXT path")
    parser.add_argument(
        "--output-dir",
        type=str,
        default="data",
        help="Output directory for week JSON files (default: data)",
    )
    return parser.parse_args()


def build_rows(input_path: Path) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for line_no, raw in enumerate(input_path.read_text(encoding="utf-8").splitlines(), start=1):
        line = raw.strip("\ufeff").strip()
        if not line:
            continue
        parts = [p.strip() for p in line.split("\t")]
        if len(parts) != EXPECTED_COLUMNS:
            raise ValueError(
                f"Line {line_no}: expected {EXPECTED_COLUMNS} tab columns, got {len(parts)}\n"
                f"line={raw!r}"
            )
        rows.append(dict(zip(EXPECTED_KEYS, parts)))
    return rows


def main() -> None:
    args = parse_args()
    input_path = Path(args.input).expanduser().resolve()
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"week{args.week}.json"

    rows = build_rows(input_path)
    output_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"✅ created: {output_path}")
    print(f"   rows: {len(rows)}")
    if rows:
        print(f"   first: {rows[0]['word']} / {rows[0]['yomi']}")
        print(f"   last : {rows[-1]['word']} / {rows[-1]['yomi']}")


if __name__ == "__main__":
    main()
