#!/usr/bin/env python3
"""List every selected AI-edited record and its evidence/translation review needs."""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path
from urllib.parse import urlsplit

from audit_source_chain import visible_items


ROOT = Path(__file__).resolve().parents[1]
TASK_WORDING = re.compile(
    r"(?:市场部|销售部|技术支持团队|BD团队|产品市场部|市场团队).{0,18}"
    r"(?:应|需|可优先|优先|必须|跟进|联系|转化|准备|制作|同步|开展)"
    r"|(?:应|需|可优先|优先|必须).{0,18}(?:联系客户|跟进客户|销售团队|市场部|技术支持团队)",
    re.IGNORECASE,
)
ADVICE_WORDING = re.compile(
    r"(?:对ACRO|ACRO|市场部).{0,30}(?:应|可据此|值得|适合|优先)"
    r"|值得ACRO|适合用于.{0,12}(?:对标|话术|材料)|应持续(?:对比|跟踪)",
    re.IGNORECASE,
)


def audit_item(item: dict) -> dict:
    review = item.get("summary_review") or {}
    evidence = item.get("evidence") or {}
    review_verified = review.get("source_verification_status") == "verified_original"
    reviewed_original = next((row.get("url", "") for row in review.get("evidence", [])
                              if row.get("url", "") and urlsplit(row["url"]).hostname not in {"news.google.com", "www.google.com"}), "")
    original_url = reviewed_original if review_verified else evidence.get("primary_url") or item.get("url", "")
    source_excerpt = evidence.get("source_excerpt") or ""
    flags = []
    if not item.get("title_zh"):
        flags.append("missing_chinese_title")
    if not item.get("ai_summary"):
        flags.append("missing_chinese_summary")
    if not item.get("published_at"):
        flags.append("unknown_publication_date")
    if not item.get("matched_company_ids"):
        flags.append("organizer_outside_company_pool" if review.get("unmonitored_organizers") else "company_unmatched")
    if TASK_WORDING.search(item.get("ai_summary", "")):
        flags.append("auto_assignment_wording")
    if ADVICE_WORDING.search(item.get("ai_summary", "")):
        flags.append("business_advice_in_summary")
    if not review or not review.get("evidence"):
        flags.append("review_provenance_missing")
    if not source_excerpt and not review_verified:
        flags.append("source_excerpt_missing")
    if urlsplit(original_url).hostname in {"news.google.com", "www.google.com"}:
        flags.append("aggregator_original_not_resolved")
    if evidence.get("verification_status") in {"needs_original_check", "not_verified"} and not review_verified:
        flags.append("original_needs_check")
    return {
        "id": item.get("id", ""),
        "flags": flags,
        "company_ids": item.get("matched_company_ids", []),
        "unmonitored_organizers": review.get("unmonitored_organizers", []),
        "source_ids": item.get("source_ids", []),
        "source_title": item.get("title", ""),
        "chinese_title": item.get("title_zh", ""),
        "chinese_summary": item.get("ai_summary", ""),
        "publication_date": item.get("published_at", ""),
        "publication_date_evidence": item.get("publication_date_evidence", ""),
        "event_date": item.get("event_start_at", ""),
        "product_technology": item.get("intelligence", {}).get("modalities", []),
        "region": item.get("region", ""),
        "source_excerpt": source_excerpt,
        "original_url": original_url,
        "review_kind": review.get("kind", ""),
        "material_level": review.get("material_level", ""),
        "source_verification_status": review.get("source_verification_status", ""),
        "full_text_read": bool(review.get("full_text_read")),
        "review_evidence": review.get("evidence", []),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    payload = json.loads((ROOT / "data" / "latest_run.json").read_text(encoding="utf-8"))
    archive = json.loads((ROOT / "data" / "event_archive.json").read_text(encoding="utf-8"))
    selected = [
        item for item in payload.get("items", [])
        if item.get("tier") in {"daily", "immediate"}
        and item.get("summary_method") in {"manual_ai", "llm"}
    ]
    rows = [audit_item(item) for item in selected]
    visible = [item for item in visible_items(payload, archive)
               if item.get("summary_method") in {"manual_ai", "llm"}]
    visible_rows = [audit_item(item) for item in visible]
    report = {
        "snapshot_generated_at": payload.get("generated_at", ""),
        "selected_ai_content_count": len(rows),
        "selected_verified_original_count": sum(
            row["source_verification_status"] == "verified_original" for row in rows
        ),
        "selected_full_text_read_count": sum(row["full_text_read"] for row in rows),
        "visible_90_day_ai_content_count": len(visible_rows),
        "visible_90_day_flag_counts": dict(Counter(flag for row in visible_rows for flag in row["flags"])),
        "visible_90_day_items": visible_rows,
        "flag_counts": dict(Counter(flag for row in rows for flag in row["flags"])),
        "items": rows,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(rows)} selected AI items; {sum(bool(row['flags']) for row in rows)} need review")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
