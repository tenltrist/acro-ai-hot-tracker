#!/usr/bin/env python3
"""Export company/source coverage and AI-review queues from one dashboard snapshot."""

from __future__ import annotations

import argparse
import json
from collections import Counter
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def publication_date(item: dict) -> str:
    verified = (item.get("date_provenance") or {}).get("published") or (
        item.get("publication_date_status") == "known"
        and bool(item.get("publication_date_evidence"))
    )
    if item.get("signal_type") == "event" and not verified:
        return ""
    if set((item.get("evidence") or {}).get("source_types") or []) & {"sitemap_urls", "clinical_trials"} and not verified:
        return ""
    value = str(item.get("published_at") or item.get("published") or "")[:10]
    try:
        published = date.fromisoformat(value).isoformat()
        return "" if published == "1970-01-01" else published
    except ValueError:
        return ""


def visible_items(payload: dict, archive: dict, days: int = 90) -> list[dict]:
    merged = {item["id"]: item for item in archive.get("items", []) if item.get("id")}
    merged.update({item["id"]: item for item in payload.get("items", []) if item.get("id")})
    end = date.fromisoformat(payload["generated_at"][:10])
    start = end - timedelta(days=days - 1)
    return [item for item in merged.values()
            if item.get("tier") in {"daily", "immediate"}
            and (published := publication_date(item))
            and start <= date.fromisoformat(published) <= end]


def scoped_source_row(row: dict, company_id: str, records: list[dict]) -> dict:
    matched = [item for item in records if row.get("source_id") in item.get("source_ids", [])]
    selected = [item for item in matched if item.get("tier") in {"daily", "immediate"}]
    status = row.get("status", "pending")
    if status not in {"error", "pending"}:
        status = "productive" if selected else "archive_only" if matched else "quiet"
    return {
        "id": row.get("source_id", ""),
        "mode": "dedicated" if row.get("company_id") == company_id else "shared",
        "type": row.get("source_type", ""),
        "url": row.get("source_url", ""),
        "status": status,
        "last_checked": row.get("last_checked", ""),
        "request_succeeded": bool(row.get("request_succeeded")),
        "raw_links": row.get("raw_link_count", 0),
        "raw_links_scope": "company_dedicated" if row.get("company_id") == company_id else "whole_shared_source",
        "company_hits": len(matched),
        "selected": len(selected),
        "dated_selected": sum(bool(item.get("published_at")) for item in selected),
        "error": row.get("error", ""),
        "alternative_source_ids": row.get("alternative_source_ids", []),
    }


def build_audit(payload: dict, archive: dict, base: dict, extension: dict) -> dict:
    configured = {row["id"]: row for row in base.get("companies", [])}
    configured.update({row["company"]["id"]: row["company"] for row in extension.get("accounts", [])})
    health = payload.get("source_health", [])
    items = payload.get("items", [])
    visible = visible_items(payload, archive)
    health_by_id = {row.get("source_id"): row for row in health}
    coverage_by_company = {
        row.get("company_id"): row for row in payload.get("company_source_coverage", {}).get("profiles", [])
    }
    companies = []
    for runtime_company in payload.get("companies", []):
        company_id = runtime_company["id"]
        config = configured.get(company_id, {})
        coverage = coverage_by_company.get(company_id, {})
        source_ids = {
            source_id
            for slot in coverage.get("slots", {}).values()
            for source_id in slot.get("source_ids", [])
        }
        source_ids.update(row.get("source_id") for row in health if row.get("company_id") == company_id)
        rows = [health_by_id[source_id] for source_id in sorted(source_ids) if source_id in health_by_id]
        records = [item for item in items if company_id in item.get("matched_company_ids", [])]
        selected = [item for item in records if item.get("tier") in {"daily", "immediate"}]
        visible_company = [item for item in visible if company_id in item.get("matched_company_ids", [])]
        owned = [row for row in rows if row.get("source_url", "") and
                 (urlsplit(row["source_url"]).hostname or "") not in {"news.google.com", "www.google.com"}]
        direct_source_urls = [
            row.get("source_url", "") for row in owned
            if row.get("source_url", "") and "news.google.com" not in row.get("source_url", "")
        ]
        jp_aliases = runtime_company.get("japanese_aliases", [])
        companies.append({
            "id": company_id,
            "role": runtime_company.get("business_role", ""),
            "english_name": runtime_company.get("display_name_en", ""),
            "chinese_display": runtime_company.get("display_name_zh", ""),
            "japanese_formal_name": config.get("display_name_ja", ""),
            "japanese_aliases": jp_aliases,
            "japanese_formal_name_status": (
                "official_profile_verified" if config.get("identity_evidence_url") else "not_independently_verified"
            ),
            "identity_evidence_url": config.get("identity_evidence_url", ""),
            "configured_direct_source_domains": sorted({urlsplit(url).hostname or "" for url in direct_source_urls}),
            "source_count": len(rows),
            "request_success_count": sum(bool(row.get("request_succeeded")) for row in rows),
            "actual_hit_source_count": sum(any(row.get("source_id") in item.get("source_ids", []) for item in records)
                                           for row in rows),
            "effective_output_source_count": sum(any(row.get("source_id") in item.get("source_ids", []) for item in selected)
                                                 for row in rows),
            "dedicated_raw_links": sum(
                row.get("raw_link_count", 0) for row in rows if row.get("company_id") == company_id
            ),
            "source_company_hits": sum(
                len([item for item in records if row.get("source_id") in item.get("source_ids", [])])
                for row in rows
            ),
            "unique_company_records": len(records),
            "unique_selected": len(selected),
            "visible_90_day_selected": len(visible_company),
            "selected_with_publication_date": sum(bool(item.get("published_at")) for item in selected),
            "selected_unknown_publication_date": sum(not item.get("published_at") for item in selected),
            "dedicated_source_alias_rejections": sum(
                row.get("rejected_alias_count", 0)
                for row in rows if row.get("company_id") == company_id
            ),
            "shared_source_alias_rejections_not_company_attributable": sum(
                row.get("rejected_alias_count", 0)
                for row in rows if row.get("company_id") != company_id
            ),
            "source_errors": [
                {"id": row.get("source_id"), "error": row.get("error")}
                for row in rows if row.get("error")
            ],
            "sources": [scoped_source_row(row, company_id, records) for row in rows],
        })
    selected_all = [item for item in items if item.get("tier") in {"daily", "immediate"}]
    current_ids = {item.get("id") for item in items}
    ai_queue = [{
        "id": item.get("id", ""),
        "company_ids": item.get("matched_company_ids", []),
        "title": item.get("title", ""),
        "title_zh": item.get("title_zh", ""),
        "summary_zh": item.get("ai_summary", ""),
        "publication_date": item.get("published_at", ""),
        "publication_date_status": item.get("publication_date_status", "unknown"),
        "source_ids": item.get("source_ids", []),
        "url": item.get("url", ""),
        "summary_provider": item.get("summary_provider", ""),
        "review_evidence": item.get("summary_review", {}).get("evidence", ""),
    } for item in selected_all if item.get("summary_method") in {"manual_ai", "llm"}]
    return {
        "generated_at": payload.get("generated_at", ""),
        "company_roles": dict(Counter(row.get("role", "") for row in companies)),
        "source_statuses": dict(Counter(row.get("status", "") for row in health)),
        "source_count": len(health),
        "request_success_count": sum(bool(row.get("request_succeeded")) for row in health),
        "actual_hit_source_count": sum(row.get("actual_match_count", 0) > 0 for row in health),
        "effective_output_source_count": sum(row.get("valid_output_count", 0) > 0 for row in health),
        "no_record_company_count": sum(row.get("unique_company_records", 0) == 0 for row in companies),
        "raw_links": sum(row.get("raw_link_count", 0) for row in health),
        "source_company_hits": sum(row.get("actual_match_count", 0) for row in health),
        "unique_items": len(items),
        "unique_selected": len(selected_all),
        "visible_90_day_selected": len(visible),
        "visible_90_day_range": {
            "start": (date.fromisoformat(payload["generated_at"][:10]) - timedelta(days=89)).isoformat(),
            "end": payload["generated_at"][:10],
        },
        "visible_90_day_archive_only": sum(item.get("id") not in current_ids for item in visible),
        "selected_unknown_publication_date": sum(not item.get("published_at") for item in selected_all),
        "ai_queue_count": len(ai_queue),
        "companies": companies,
        "ai_review_queue": ai_queue,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    audit = build_audit(
        load(ROOT / "data" / "latest_run.json"),
        load(ROOT / "data" / "event_archive.json"),
        load(ROOT / "config" / "companies.json"),
        load(ROOT / "config" / "priority_account_monitoring.json"),
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(audit['companies'])} companies, {audit['source_count']} sources, {audit['ai_queue_count']} AI reviews")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
