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


BASE_COLUMNS = 7
BASE_KEYS = (
    "word",
    "yomi",
    "meaning",
    "word_pron",
    "sentence",
    "s_meaning",
    "s_pron",
)

FORM_KEYS = (
    "plain_present_affirmative",
    "plain_present_negative",
    "plain_past_affirmative",
    "plain_past_negative",
    "polite_present_affirmative",
    "polite_present_negative",
    "polite_past_affirmative",
    "polite_past_negative",
)

FORM_COLUMNS_PER_ITEM = 3  # jp, pron_ko, meaning_ko
EXTENDED_COLUMNS = BASE_COLUMNS + len(FORM_KEYS) * FORM_COLUMNS_PER_ITEM


def make_empty_forms() -> dict[str, dict[str, str]]:
    return {
        form_key: {
            "jp": "",
            "pron_ko": "",
            "meaning_ko": "",
        }
        for form_key in FORM_KEYS
    }


def parse_extended_forms(parts: list[str]) -> dict[str, dict[str, str]]:
    forms = make_empty_forms()
    start = BASE_COLUMNS
    for idx, form_key in enumerate(FORM_KEYS):
        offset = start + idx * FORM_COLUMNS_PER_ITEM
        forms[form_key] = {
            "jp": parts[offset],
            "pron_ko": parts[offset + 1],
            "meaning_ko": parts[offset + 2],
        }
    return forms


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


def build_rows(input_path: Path) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for line_no, raw in enumerate(input_path.read_text(encoding="utf-8").splitlines(), start=1):
        line = raw.strip("\ufeff").strip()
        if not line:
            continue
        parts = [p.strip() for p in line.split("\t")]
        if len(parts) not in (BASE_COLUMNS, EXTENDED_COLUMNS):
            raise ValueError(
                f"Line {line_no}: expected {BASE_COLUMNS} or {EXTENDED_COLUMNS} tab columns, got {len(parts)}\n"
                f"line={raw!r}"
            )
        row = dict(zip(BASE_KEYS, parts[:BASE_COLUMNS]))
        if len(parts) == EXTENDED_COLUMNS:
            row["sentence_forms"] = parse_extended_forms(parts)
        else:
            # Keep schema consistent for legacy 7-column files.
            row["sentence_forms"] = make_empty_forms()
        rows.append(row)
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
