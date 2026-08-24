#!/usr/bin/env python3
"""Fail fast when generated dashboard data is internally inconsistent."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "latest_run.json"


def load_payload() -> dict[str, Any]:
    with DATA_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def main() -> int:
    payload = load_payload()
    items = payload.get("items", [])
    companies = payload.get("companies", [])
    health_rows = payload.get("source_health", [])
    company_ids = {company.get("id") for company in companies}
    source_ids = {row.get("source_id") for row in health_rows}
    errors: list[str] = []

    item_ids = [item.get("id") for item in items]
    urls = [item.get("url") for item in items]
    if len(set(item_ids)) != len(item_ids):
        errors.append("items contain duplicate ids")
    if len(set(urls)) != len(urls):
        errors.append("items contain duplicate URLs")
    if len(source_ids) != len(health_rows):
        errors.append("source_health contains duplicate source ids")

    allowed_events = {
        "product_platform",
        "target_therapy",
        "clinical_regulatory",
        "partnership_deal",
        "customer_demand",
        "market_activity",
        "regional_expansion",
        "quality_supply",
        "corporate_strategy",
    }
    for item in items:
        item_id = item.get("id", "unknown")
        orphan_companies = set(item.get("matched_company_ids", [])) - company_ids
        orphan_sources = set(item.get("source_ids", [item.get("source_id")])) - source_ids
        if orphan_companies:
            errors.append(f"{item_id}: unknown company ids {sorted(orphan_companies)}")
        if orphan_sources:
            errors.append(f"{item_id}: unknown source ids {sorted(orphan_sources)}")
        if item.get("business_event_type") not in allowed_events:
            errors.append(f"{item_id}: missing or invalid business_event_type")
        if item.get("summary_method") not in {"rule", "llm"}:
            errors.append(f"{item_id}: invalid summary_method")
        if item.get("summary_method") == "llm" and not item.get("summary_provider"):
            errors.append(f"{item_id}: LLM summary is missing provider provenance")
        if item.get("tier") in {"daily", "immediate"} and item.get("acro_relevance", {}).get("level") == "low":
            errors.append(f"{item_id}: low-relevance item entered the daily feed")
        if item.get("event_start_at") and item.get("published_at"):
            errors.append(f"{item_id}: event date is also marked as publication date")
        evidence = item.get("evidence", {})
        if evidence.get("kind") not in {"primary", "secondary", "index"}:
            errors.append(f"{item_id}: missing or invalid evidence kind")
        if evidence.get("verification_status") not in {
            "source_backed",
            "needs_original_check",
        }:
            errors.append(f"{item_id}: missing or invalid evidence verification status")
        if evidence.get("primary_url") != item.get("url"):
            errors.append(f"{item_id}: evidence primary URL is disconnected from item URL")
        if item.get("workflow_status") != "new":
            errors.append(f"{item_id}: invalid default workflow status")

    for row in health_rows:
        source_id = row.get("source_id")
        if row.get("operational_status") not in {"reachable", "error", "not_running"}:
            errors.append(f"{source_id}: invalid operational_status")
        if row.get("status") == "error" and row.get("operational_status") != "error":
            errors.append(f"{source_id}: error status is not reflected operationally")
        source_items = [item for item in items if source_id in item.get("source_ids", [item.get("source_id")])]
        counts = {
            tier: sum(item.get("tier") == tier for item in source_items)
            for tier in ("immediate", "daily", "archive")
        }
        if row.get("total") != len(source_items):
            errors.append(f"{source_id}: health total does not match items")
        for tier, count in counts.items():
            if row.get(tier) != count:
                errors.append(f"{source_id}: health {tier} count does not match items")

    summary_pipeline = payload.get("summary_pipeline", {})
    if summary_pipeline.get("status") not in {
        "rules_only",
        "configuration_error",
        "request_error",
        "limit_reached",
        "complete",
    }:
        errors.append("summary_pipeline has invalid status")

    coverage = payload.get("company_source_coverage", {})
    for profile in coverage.get("profiles", []):
        if profile.get("company_id") not in company_ids:
            errors.append(f"coverage profile has unknown company {profile.get('company_id')}")
        for slot in profile.get("slots", {}).values():
            unknown = set(slot.get("source_ids", [])) - source_ids
            if unknown:
                errors.append(f"coverage profile {profile.get('company_id')} has unknown sources {sorted(unknown)}")

    timelines = payload.get("company_timelines", [])
    timeline_company_ids = {timeline.get("company_id") for timeline in timelines}
    if timeline_company_ids != company_ids:
        errors.append("company_timelines do not cover the complete company pool")
    valid_item_ids = set(item_ids)
    for timeline in timelines:
        unknown_items = set(timeline.get("item_ids", [])) - valid_item_ids
        if unknown_items:
            errors.append(
                f"timeline {timeline.get('company_id')} contains unknown item ids {sorted(unknown_items)[:5]}"
            )

    source_experiments = payload.get("source_experiments", {})
    allowed_experiment_statuses = {
        "blocked_public_demo",
        "replaced_by_direct",
        "active_alternative",
        "deferred_server",
    }
    for experiment in source_experiments.get("experiments", []):
        if experiment.get("status") not in allowed_experiment_statuses:
            errors.append(f"source experiment {experiment.get('id')} has invalid status")

    daily_count = sum(item.get("tier") in {"daily", "immediate"} for item in items)
    status_counts = {
        status: sum(row.get("status") == status for row in health_rows)
        for status in ("productive", "archive_only", "quiet", "pending", "error")
    }
    if errors:
        print("Dashboard validation failed:")
        for error in errors[:50]:
            print(f"- {error}")
        if len(errors) > 50:
            print(f"- ... and {len(errors) - 50} more")
        return 1

    print(
        "Dashboard validation passed: "
        f"{len(items)} items, {daily_count} selected, {len(companies)} companies, "
        f"{len(health_rows)} sources, health={status_counts}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
