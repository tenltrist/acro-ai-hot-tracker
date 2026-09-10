#!/usr/bin/env python3
"""Import Codex-edited Chinese titles and summaries without changing collection."""

import argparse
import datetime as dt
import json
from pathlib import Path
import shutil
from urllib.parse import urlsplit

from manual_reviews import apply_review_metadata
from run_daily import write_static_api

ROOT = Path(__file__).resolve().parents[1]


def read_jsonl(paths):
    rows = []
    for path in paths:
        with path.open(encoding="utf-8") as handle:
            for line_number, line in enumerate(handle, 1):
                if line.strip():
                    row = json.loads(line)
                    row["_origin"] = f"{path.name}:{line_number}"
                    rows.append(row)
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="*", type=Path)
    parser.add_argument(
        "--sync-only",
        action="store_true",
        help="Reproject existing verified editorial records into every data surface.",
    )
    parser.add_argument(
        "--replace-existing-editorial",
        action="store_true",
        help="Replace only an existing Codex editorial translation with the same stable item id.",
    )
    args = parser.parse_args()
    if not args.paths and not args.sync_only:
        parser.error("provide at least one JSONL batch, or use --sync-only")
    latest_path = ROOT / "data/latest_run.json"
    registry_path = ROOT / "data/manual_summaries.json"
    archive_path = ROOT / "data/event_archive.json"
    payload = json.loads(latest_path.read_text(encoding="utf-8"))
    registry = json.loads(registry_path.read_text(encoding="utf-8"))
    archive = json.loads(archive_path.read_text(encoding="utf-8")) if archive_path.exists() else None
    current = {item["id"]: item for item in payload["items"]}
    source_records = {item["id"]: item for item in (archive or {}).get("items", [])}
    source_records.update(current)
    reviews = {item["id"]: item for item in registry["items"]}
    imported = 0
    seen = set()
    stamp = dt.date.today().isoformat()

    for row in read_jsonl(args.paths):
        item_id = str(row.get("id", "")).strip()
        if item_id in seen or item_id not in source_records:
            raise ValueError(f"{row['_origin']}: duplicate or unknown id {item_id!r}")
        seen.add(item_id)
        source = source_records[item_id]
        if row.get("source_title") and row.get("source_title") != source.get("title"):
            raise ValueError(f"{row['_origin']}: source title changed for {item_id}")
        title_zh = str(row.get("title_zh", "")).strip()
        summary_zh = str(row.get("summary_zh", "")).strip()
        if not title_zh or not summary_zh:
            raise ValueError(f"{row['_origin']}: Chinese title and summary are required")
        if not any("\u4e00" <= char <= "\u9fff" for char in title_zh + summary_zh):
            raise ValueError(f"{row['_origin']}: translation has no Chinese text")
        if len(title_zh) > 220 or len(summary_zh) > 800:
            raise ValueError(f"{row['_origin']}: translation is unexpectedly long")
        url = str(source.get("url", ""))
        parsed = urlsplit(url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError(f"{row['_origin']}: source URL is not HTTP(S)")
        existing = reviews.get(item_id)
        if existing:
            existing_kind = (existing.get("review") or {}).get("kind")
            if not args.replace_existing_editorial or existing_kind != "codex_editorial_translation":
                raise ValueError(f"{row['_origin']}: refusing to overwrite existing review {item_id}")
        reviews[item_id] = {
            "id": item_id,
            "title_zh": title_zh,
            "summary": summary_zh,
            "summary_en": str(row.get("summary_en", "")).strip(),
            "model": "Codex editorial translation",
            "review_status": "verified",
            "reviewed": True,
            "reviewer_notes": "Codex translated and polished the available title and source excerpt; no new facts were added.",
            "source_title": source["title"],
            "source_url": url,
            "imported_at": stamp,
            "review": {
                "reviewed_at": stamp,
                "reviewer": "Codex",
                "event_key": f"translation:{item_id}",
                "scope_zh": "依据当前保存的原标题与来源摘录翻译润色，未补写材料中没有披露的事实。",
                "scope_en": "Translated and edited from the stored source title and excerpt without adding undisclosed facts.",
                "kind": "codex_editorial_translation",
                "material_level": "stored_source_material",
                "evidence": [{"label": source.get("source_label") or source.get("source_id") or "原始来源", "url": url}],
            },
        }
        imported += 1

    registry["items"] = sorted(reviews.values(), key=lambda item: item["id"])
    registry["updated_at"] = stamp
    registry["source"] = "Codex-edited translations plus historical source-grounded reviews"
    apply_review_metadata(payload, reviews)
    if archive is not None:
        apply_review_metadata(archive, reviews)

    backup = ROOT / "preview-checks" / f"translation-backup-{dt.datetime.now():%Y%m%dT%H%M%S}"
    for relative in (
        "data/latest_run.json",
        "data/manual_summaries.json",
        "data/event_archive.json",
        "api/public/items.json",
        "api/public/daily.json",
    ):
        source_path = ROOT / relative
        if source_path.exists():
            target = backup / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source_path, target)
    latest_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    registry_path.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if archive is not None:
        archive_path.write_text(json.dumps(archive, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_static_api(payload)
    print(json.dumps({
        "imported": imported,
        "latest_reviewed_total": payload["summary_pipeline"]["manual_imported"],
        "archive_reviewed_total": (archive or {}).get("summary_pipeline", {}).get("manual_imported", 0),
        "collection_time_unchanged": payload["generated_at"],
        "archive_time_unchanged": (archive or {}).get("updated_at"),
        "backup": str(backup),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
