#!/usr/bin/env python3
"""Probe candidate feeds without changing the production source list or seen state."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import run_daily as tracker


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CANDIDATES = ROOT / "config" / "source_probe_candidates.json"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=DEFAULT_CANDIDATES)
    parser.add_argument("--days", type=int, default=90)
    parser.add_argument(
        "--only",
        action="append",
        default=[],
        help="Probe only source IDs containing this text; may be repeated.",
    )
    args = parser.parse_args()

    probe_config = tracker.load_json(args.config)
    if "accounts" in probe_config:
        runtime_company_config, runtime_coverage, _ = tracker.load_runtime_configuration()
        _, candidate_sources, _ = tracker.build_priority_account_extension(
            probe_config,
            runtime_coverage.get("slot_definitions", []),
        )
    else:
        candidate_sources = probe_config["sources"]
    if args.only:
        candidate_sources = [
            source
            for source in candidate_sources
            if any(term.lower() in source["id"].lower() for term in args.only)
        ]
    if not candidate_sources:
        parser.error("no candidate sources matched --only")
    company_config, _, _ = tracker.load_runtime_configuration()
    company_lookup = {company["id"]: company for company in company_config["companies"]}
    profiles = {
        profile["id"]: profile
        for profile in company_config.get("source_profiles", [])
    }
    existing_payload = tracker.load_json(tracker.LATEST_RUN_PATH)
    existing_urls = {
        tracker.normalize_url(item["url"])
        for item in existing_payload.get("items", [])
    }
    existing_titles = {
        tracker.normalize_title(item["title"])
        for item in existing_payload.get("items", [])
    }

    items, errors, _, _ = tracker.collect_candidates(candidate_sources, {})
    source_lookup = {source["id"]: source for source in candidate_sources}
    scored: list[tracker.Candidate] = []
    for item in tracker.dedupe(items):
        tracker.match_candidate_companies(item, company_lookup)
        matched_companies = [
            company_lookup[company_id]
            for company_id in item.matched_company_ids
            if company_id in company_lookup
        ]
        scoring_profiles = list(matched_companies)
        profile_id = source_lookup[item.source_id].get("profile_id", "")
        if profile_id in profiles:
            scoring_profiles.append(profiles[profile_id])
        scored.append(
            tracker.score_candidate(
                item,
                tracker.merge_scoring_profiles(scoring_profiles),
                matched_companies,
                args.days,
            )
        )

    print("source\ttotal\tfresh\tdaily\tcompany_hits\tnew_urls\tselected_rate")
    for source in candidate_sources:
        source_items = [item for item in scored if item.source_id == source["id"]]
        fresh = [
            item for item in source_items
            if tracker.age_days(item.published) is None
            or tracker.age_days(item.published) <= args.days
        ]
        selected = [item for item in source_items if item.tier in {"daily", "immediate"}]
        company_hits = [item for item in source_items if item.matched_company_ids]
        new_items = [
            item for item in source_items
            if tracker.normalize_url(item.url) not in existing_urls
            and tracker.normalize_title(item.title) not in existing_titles
        ]
        rate = round(len(selected) / len(source_items) * 100) if source_items else 0
        print(
            f"{source['id']}\t{len(source_items)}\t{len(fresh)}\t{len(selected)}\t"
            f"{len(company_hits)}\t{len(new_items)}\t{rate}%"
        )
        for item in sorted(source_items, key=lambda value: value.score, reverse=True)[:3]:
            print(
                f"  [{item.tier}:{item.score}] {item.published or 'no-date'} "
                f"{item.title[:120]}"
            )

    if errors:
        print("\nerrors")
        for error in errors:
            print(f"- {error}")
    return 1 if len(errors) == len(candidate_sources) else 0


if __name__ == "__main__":
    raise SystemExit(main())
