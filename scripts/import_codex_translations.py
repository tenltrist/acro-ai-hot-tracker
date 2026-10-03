#!/usr/bin/env python3
"""Import Codex-edited Chinese titles and summaries without changing collection."""

import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import shutil
from urllib.parse import urlsplit

from manual_reviews import apply_review_metadata
from run_daily import write_static_api

ROOT = Path(__file__).resolve().parents[1]


def editorial_scope(row, source):
    level = row.get("material_level", "stored_source_material")
    if level not in {"stored_source_material", "title_only", "title_and_excerpt"}:
        raise ValueError(f"Unsupported translation material level: {level!r}")
    availability = row.get("summary_availability", "available")
    if availability not in {"available", "unavailable"}:
        raise ValueError(f"Unsupported summary availability: {availability!r}")
    if level == "title_and_excerpt" and not str(source.get("summary", "")).strip():
        raise ValueError("Title-and-excerpt translation requires a stored excerpt")
    title_only = level == "title_only"
    material = json.dumps([source.get("title", ""), source.get("summary", "")], ensure_ascii=False)
    return {
        "scope_zh": "仅依据保存的原标题翻译；没有可用独立摘录，未读取全文。" if title_only else "依据当前保存的原标题与来源摘录翻译润色，未读取全文，未补写材料中没有披露的事实。",
        "scope_en": "Translated the stored title only; no usable independent excerpt or full text was read." if title_only else "Translated the stored source title and excerpt; no full text was read and no undisclosed facts were added.",
        "material_level": level,
        "summary_availability": availability,
        "source_material_sha256": hashlib.sha256(material.encode("utf-8")).hexdigest(),
        **({"reused_from_id": row["reused_from_id"]} if row.get("reused_from_id") else {}),
    }


def source_record_map(payload, archive, source_archive=None):
    # An older source snapshot can retain translations without restoring its news.
    records = {item["id"]: item for item in (source_archive or {}).get("items", [])}
    records.update({item["id"]: item for item in (archive or {}).get("items", [])})
    records.update({item["id"]: item for item in payload["items"]})
    return records


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
        "--source-archive", type=Path,
        help="Optional older evidence snapshot for registry-only translations; never restores news records.",
    )
    parser.add_argument(
        "--batch-only", action="store_true",
        help="Project only this imported batch, preserving all other editorial records unchanged.",
    )
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
    if args.batch_only and args.sync_only:
        parser.error("--batch-only cannot be combined with --sync-only")
    latest_path = ROOT / "data/latest_run.json"
    registry_path = ROOT / "data/manual_summaries.json"
    archive_path = ROOT / "data/event_archive.json"
    payload = json.loads(latest_path.read_text(encoding="utf-8"))
    registry = json.loads(registry_path.read_text(encoding="utf-8"))
    archive = json.loads(archive_path.read_text(encoding="utf-8")) if archive_path.exists() else None
    source_archive = json.loads(args.source_archive.read_text(encoding="utf-8")) if args.source_archive else None
    source_records = source_record_map(payload, archive, source_archive)
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
                "kind": "codex_editorial_translation",
                **editorial_scope(row, source),
                "evidence": [{"label": source.get("source_label") or source.get("source_id") or "原始来源", "url": url}],
            },
        }
        imported += 1

    registry["items"] = sorted(reviews.values(), key=lambda item: item["id"])
    registry["updated_at"] = stamp
    registry["source"] = "Codex-edited translations plus historical source-grounded reviews"
    projection_reviews = {item_id: reviews[item_id] for item_id in seen} if args.batch_only else reviews
    apply_review_metadata(payload, projection_reviews)
    if archive is not None:
        apply_review_metadata(archive, projection_reviews)

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
