#!/usr/bin/env python3
"""Refresh editorial metadata in an existing crawl without requesting sources."""

from __future__ import annotations

import run_daily as tracker
from manual_reviews import apply_review_metadata


def main() -> int:
    payload = tracker.load_json(tracker.LATEST_RUN_PATH)
    manual_map = tracker.load_manual_summary_map()
    before_ids = [item["id"] for item in payload.get("items", [])]
    before_admission = [(item.get("tier"), item.get("score")) for item in payload.get("items", [])]
    apply_review_metadata(payload, manual_map)
    if [item["id"] for item in payload.get("items", [])] != before_ids or [
        (item.get("tier"), item.get("score")) for item in payload.get("items", [])
    ] != before_admission:
        raise ValueError("Editorial projection changed collection or admission")
    tracker.save_json(tracker.LATEST_RUN_PATH, payload)
    tracker.write_static_api(payload)
    archive_path = tracker.DATA_DIR / "event_archive.json"
    if archive_path.exists():
        archive = tracker.load_json(archive_path)
        archive_ids = [item["id"] for item in archive.get("items", [])]
        archive_admission = [(item.get("tier"), item.get("score")) for item in archive.get("items", [])]
        apply_review_metadata(archive, manual_map)
        if [item["id"] for item in archive.get("items", [])] != archive_ids or [
            (item.get("tier"), item.get("score")) for item in archive.get("items", [])
        ] != archive_admission:
            raise ValueError("Editorial projection changed retained archive admission")
        tracker.save_json(archive_path, archive)
    print(f"Projected editorial metadata for {payload['summary_pipeline']['manual_imported']} records")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
