#!/usr/bin/env python3
"""Import a source-checked bilingual batch locally, without a crawl or API call."""
import argparse
import datetime as dt
import json
from pathlib import Path
import shutil
from urllib.parse import urlsplit

from manual_reviews import apply_review_metadata
from run_daily import write_static_api

ROOT = Path(__file__).resolve().parents[1]


def prepare(batch, registry, payload):
    current = {item["id"]: item for item in payload["items"]}
    manual = {item["id"]: item for item in registry["items"]}
    defaults = batch.get("defaults", {})
    added = []
    seen = set()
    keys = set()
    for group in batch["groups"]:
        key = group["event_key"]
        if key in keys:
            raise ValueError(f"Duplicate review group: {key}")
        keys.add(key)
        if set(group.get("overrides", {})) - set(group["ids"]):
            raise ValueError(f"Unknown override in {key}")
        for item_id in group["ids"]:
            if item_id not in current or item_id in seen:
                raise ValueError(f"Missing or duplicate article: {item_id}")
            seen.add(item_id)
            item = current[item_id]
            values = {**defaults, **group, **group.get("overrides", {}).get(item_id, {})}
            for field in ("title_zh", "summary", "summary_en", "scope_zh", "scope_en"):
                if not str(values.get(field, "")).strip():
                    raise ValueError(f"{item_id}: missing {field}")
            evidence = values.get("evidence")
            if not evidence and values.get("use_item_source"):
                labels = item.get("evidence", {}).get("source_labels", [])
                label = item.get("source_label") or (labels[0] if labels else item.get("source_id"))
                evidence = [{"label": label, "url": item.get("url", "")}]
            if not evidence:
                raise ValueError(f"{item_id}: no checked evidence")
            for source in evidence:
                url = urlsplit(source["url"])
                if url.scheme != "https" or not url.netloc or not source.get("label"):
                    raise ValueError(f"{item_id}: invalid evidence URL or label")
            record = {
                "id": item_id, "title_zh": values["title_zh"],
                "summary": values["summary"], "summary_en": values["summary_en"],
                "model": batch["reviewer"], "review_status": "verified", "reviewed": True,
                "reviewer_notes": values["scope_zh"],
                "source_title": item["title"], "source_url": item["url"],
                "imported_at": batch["reviewed_at"],
                "review": {
                    "reviewed_at": batch["reviewed_at"], "reviewer": batch["reviewer"],
                    "event_key": key, "scope_zh": values["scope_zh"], "scope_en": values["scope_en"],
                    "kind": values.get("review_kind", "editorial_review"),
                    "material_level": values.get("material_level", "source_checked"),
                    "evidence": evidence,
                },
            }
            if item_id in manual and manual[item_id] != record:
                raise ValueError(f"Refusing to overwrite an existing review: {item_id}")
            if item_id not in manual:
                added.append(record)
            manual[item_id] = record
    registry["items"].extend(added)
    registry["updated_at"] = batch["reviewed_at"]
    registry["source"] = "Historical editorial reviews plus source-grounded Codex batches"
    apply_review_metadata(payload, manual)
    return len(added), len(keys)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("batch", type=Path)
    args = parser.parse_args()
    latest = ROOT / "data/latest_run.json"
    registry_path = ROOT / "data/manual_summaries.json"
    payload = json.loads(latest.read_text(encoding="utf-8"))
    registry = json.loads(registry_path.read_text(encoding="utf-8"))
    batch = json.loads(args.batch.read_text(encoding="utf-8"))
    before_count = sum(item.get("summary_method") == "manual_ai" for item in payload["items"])
    added, groups = prepare(batch, registry, payload)
    backup = ROOT / "preview-checks" / f"review-backup-{dt.datetime.now():%Y%m%dT%H%M%S}"
    for relative in ("data/latest_run.json", "data/manual_summaries.json", "data/event_archive.json", "api/public/items.json", "api/public/daily.json"):
        source = ROOT / relative
        if source.exists():
            target = backup / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)
    for path, value in ((latest, payload), (registry_path, registry)):
        path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_static_api(payload)
    print(json.dumps({"added_records": added, "review_groups": groups, "before": before_count,
                      "after": payload["summary_pipeline"]["manual_imported"],
                      "collection_time_unchanged": payload["generated_at"], "backup": str(backup)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
