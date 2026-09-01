#!/usr/bin/env python3
"""Validate and import summaries produced through a human ChatGPT Pro batch."""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LATEST_RUN_PATH = ROOT / "data" / "latest_run.json"
MANUAL_SUMMARIES_PATH = ROOT / "data" / "manual_summaries.json"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    args = parser.parse_args()

    payload = json.loads(LATEST_RUN_PATH.read_text(encoding="utf-8"))
    valid_items = {str(item.get("id")): item for item in payload.get("items", []) if item.get("id")}
    current = (
        json.loads(MANUAL_SUMMARIES_PATH.read_text(encoding="utf-8"))
        if MANUAL_SUMMARIES_PATH.exists()
        else {"version": 1, "items": []}
    )
    merged = {str(item.get("id")): item for item in current.get("items", []) if item.get("id")}

    imported = 0
    with args.input.open("r", encoding="utf-8-sig", newline="") as handle:
        for row_number, row in enumerate(csv.DictReader(handle), start=2):
            item_id = str(row.get("id", "")).strip()
            summary = str(row.get("manual_summary") or row.get("summary") or "").strip()
            if not summary:
                continue
            review_status = str(row.get("review_status") or "").strip().lower()
            if review_status not in {"verified", "approved", "已核验", "已确认"}:
                raise ValueError(
                    f"row {row_number}: review_status must be verified/approved/已核验/已确认"
                )
            if item_id not in valid_items:
                raise ValueError(f"row {row_number}: unknown item id {item_id!r}")
            if len(summary) < 30 or len(summary) > 800:
                raise ValueError(f"row {row_number}: summary must contain 30-800 characters")
            source_item = valid_items[item_id]
            merged[item_id] = {
                "id": item_id,
                "summary": summary,
                "model": str(row.get("model") or "ChatGPT Pro").strip(),
                "reviewer_notes": str(row.get("reviewer_notes") or "").strip(),
                "review_status": review_status,
                "source_title": source_item.get("title", ""),
                "source_url": source_item.get("url", ""),
                "reviewed": True,
                "imported_at": dt.datetime.now().isoformat(timespec="seconds"),
            }
            imported += 1

    result = {
        "version": 1,
        "updated_at": dt.datetime.now().isoformat(timespec="seconds"),
        "source": "ChatGPT Pro human batch review",
        "items": sorted(merged.values(), key=lambda item: item["id"]),
    }
    MANUAL_SUMMARIES_PATH.write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Imported {imported} reviewed summaries into {MANUAL_SUMMARIES_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
