#!/usr/bin/env python3
"""Export decision-grade signals for human batch summarization in ChatGPT Pro."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LATEST_RUN_PATH = ROOT / "data" / "latest_run.json"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    payload = json.loads(LATEST_RUN_PATH.read_text(encoding="utf-8"))
    items = sorted(
        (
            item
            for item in payload.get("items", [])
            if item.get("tier") in {"daily", "immediate"}
            and item.get("summary_method") != "manual_ai"
        ),
        key=lambda item: (item.get("tier") != "immediate", -int(item.get("score", 0))),
    )[: max(1, args.limit)]

    args.output.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "id",
        "company",
        "title",
        "published_at",
        "source",
        "url",
        "source_summary",
        "structured_signals",
        "acro_relevance",
        "recommended_action",
        "rule_summary",
        "manual_summary",
        "review_status",
        "reviewer_notes",
    ]
    with args.output.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for item in items:
            writer.writerow(
                {
                    "id": item.get("id", ""),
                    "company": item.get("company", ""),
                    "title": item.get("title", ""),
                    "published_at": item.get("published_at") or item.get("event_start_at", ""),
                    "source": " + ".join(item.get("source_labels") or [item.get("source_label", "")]),
                    "url": item.get("url", ""),
                    "source_summary": item.get("summary", ""),
                    "structured_signals": json.dumps(item.get("intelligence", {}), ensure_ascii=False),
                    "acro_relevance": json.dumps(item.get("acro_relevance", {}), ensure_ascii=False),
                    "recommended_action": json.dumps(item.get("recommended_action", {}), ensure_ascii=False),
                    "rule_summary": item.get("ai_summary", ""),
                    "manual_summary": "",
                    "review_status": "",
                    "reviewer_notes": "",
                }
            )
    print(f"Exported {len(items)} rows to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
