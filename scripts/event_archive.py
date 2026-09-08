"""Retain public event evidence across refreshes without changing collection cadence."""
import json

FIELDS = (
    "id", "company_id", "company", "matched_company_ids", "matched_companies",
    "title", "title_zh", "url", "published", "published_at", "event_start_at",
    "date_provenance", "summary", "summary_method", "summary_quality", "source_id",
    "source_label", "source_ids", "source_labels", "source_trust", "related_urls",
    "signal_type", "category", "business_event_type", "intelligence", "evidence",
)


def update_archive(path, payload):
    previous = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    if previous and previous.get("schema_version") != 1:
        raise ValueError("Unsupported event archive schema; refusing to overwrite")
    records = {item["id"]: item for item in previous.get("items", [])}
    stamp = payload["generated_at"]
    for item in payload.get("items", []):
        if not item.get("id"):
            raise ValueError("Cannot archive an item without an id")
        record = {key: item[key] for key in FIELDS if key in item}
        # Never preserve template-generated advice as factual event summaries.
        if item.get("summary_method") == "manual_ai":
            for key in ("ai_summary", "ai_summary_en"):
                if item.get(key):
                    record[key] = item[key]
        old = records.get(item["id"], {})
        for key in ("related_urls", "source_ids", "source_labels"):
            if old.get(key):
                record[key] = list(dict.fromkeys(old[key] + record.get(key, [])))
        record["archive_first_seen"] = old.get("archive_first_seen", stamp)
        record["archive_last_seen"] = stamp
        records[item["id"]] = record
    archive = {
        "schema_version": 1,
        "retention_started_at": previous.get("retention_started_at", stamp),
        "updated_at": stamp,
        "coverage_note": "从保留功能上线起逐轮积累。此前文章仅为来源返回的回溯样本；旧 history 文件只有统计，不代表完整历史事件。",
        "items": sorted(records.values(), key=lambda item: item["id"]),
    }
    path.write_text(json.dumps(archive, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    return archive
