#!/usr/bin/env python3
"""Verify that the public rule center matches executable tracker behavior."""

from __future__ import annotations

import json
import re
from pathlib import Path

import run_daily as tracker


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "config" / "rule_catalog.json"
INDEX_PATH = ROOT / "web" / "index.html"
APP_PATH = ROOT / "web" / "app.js"

EXPECTED_MODULES = {
    "deduplication",
    "entity-matching",
    "structured-extraction",
    "news-score",
    "acro-relevance",
    "daily-admission",
    "event-classification",
    "action-routing",
    "summary-provenance",
    "priority-index",
    "relevance-density",
    "competitor-matrix",
    "trend-counts",
    "dashboard-counts",
    "source-health",
    "source-coverage",
    "data-storage",
    "rule-governance",
}


def candidate(**overrides: object) -> tracker.Candidate:
    values: dict[str, object] = {
        "company_id": "example",
        "source_id": "source-a",
        "source_label": "Source A",
        "source_trust": "owned",
        "title": "ACME launches ADC partnership",
        "url": "https://example.com/news/1",
        "summary": "ACME launches an ADC partnership for development.",
    }
    values.update(overrides)
    return tracker.Candidate(**values)


def check_contract_shape(errors: list[str]) -> dict:
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    module_ids = [module.get("id") for module in catalog.get("rule_modules", [])]
    if len(module_ids) != len(set(module_ids)):
        errors.append("rule_catalog contains duplicate module ids")
    if set(module_ids) != EXPECTED_MODULES:
        errors.append(
            "rule_catalog module ids differ from the expected 18 modules: "
            f"missing={sorted(EXPECTED_MODULES - set(module_ids))}, "
            f"extra={sorted(set(module_ids) - EXPECTED_MODULES)}"
        )
    if catalog.get("rule_governance", {}).get("detail_page_count") != len(EXPECTED_MODULES):
        errors.append("rule_governance.detail_page_count is stale")
    strategy = catalog.get("strategy", {})
    if strategy.get("automatic_llm_api") is not False:
        errors.append("automatic LLM API must remain disabled for the current strategy")
    if strategy.get("manual_summary_tool") != "ChatGPT Pro":
        errors.append("manual summary tool must be ChatGPT Pro")
    return catalog


def check_public_rule_center(catalog: dict, errors: list[str]) -> None:
    html = INDEX_PATH.read_text(encoding="utf-8")
    app = APP_PATH.read_text(encoding="utf-8")
    detail_ids = set(re.findall(r'data-methodology-detail="([a-z-]+)"', html))
    if detail_ids != EXPECTED_MODULES:
        errors.append(
            "rule-center detail pages differ from the contract: "
            f"missing={sorted(EXPECTED_MODULES - detail_ids)}, "
            f"extra={sorted(detail_ids - EXPECTED_MODULES)}"
        )
    target_ids = set(re.findall(r'data-methodology-target="([a-z-]+)"', html))
    if not EXPECTED_MODULES.issubset(target_ids):
        errors.append(f"rule-center index is missing cards for {sorted(EXPECTED_MODULES - target_ids)}")
    stale_phrases = ["本公司 29", "先决定是否入库", "两道门槛", 'data-page="structured-rules"']
    for phrase in stale_phrases:
        if phrase in html:
            errors.append(f"rule-center still contains stale wording: {phrase}")
    version_id = 'id="methodologyVersion"'
    if version_id not in html or "window.AIHOT_RULE_CATALOG" not in app:
        errors.append("rule-center version is not driven by the embedded rule catalog")
    score = catalog["information_score"]
    relevance = catalog["acro_relevance"]
    admission = catalog["daily_admission"]["base_thresholds"]
    priority = catalog["account_priority"]
    density = catalog["relevance_density"]["weights"]
    public_fragments = [
        f"外部来源 +{score['company_alias']['external']}；官方自有来源 +{score['company_alias']['owned']}",
        f"每命中 1 个 +{score['strategic_topic']['per_hit']}，最多 +{score['strategic_topic']['maximum']}",
        f"每命中 1 个 +{score['business_action']['per_hit']}，最多 +{score['business_action']['maximum']}",
        f"本公司 +{relevance['role_weights']['self']}；客户/账户 +{relevance['role_weights']['customer']}；竞品 +{relevance['role_weights']['competitor']}",
        f"≥{admission['immediate']} 即时；≥{admission['daily']} 日报；官方/生态/媒体来源 ≥{admission['owned_ecosystem_media']} 可日报；明确动作 ≥{admission['business_action']} 可日报。",
        f"log2(1 + 日报/即时数) × {priority['selected_log_weight']}",
        f"log2(1 + 高相关数) × {priority['high_relevance_log_weight']}",
        f"密度 × {priority['density_weight']}",
        f"中相关</span><strong>{density['medium']:.2f}</strong>",
    ]
    for fragment in public_fragments:
        if fragment not in html:
            errors.append(f"public rule wording is out of sync with the contract: {fragment}")
    required_frontend_contract_reads = [
        "AIHOT_RULE_CATALOG?.account_priority",
        "AIHOT_RULE_CATALOG?.relevance_density",
        "AIHOT_RULE_CATALOG?.competitor_matrix",
    ]
    for fragment in required_frontend_contract_reads:
        if fragment not in app:
            errors.append(f"frontend rule calculation is not contract-driven: {fragment}")
    evidence_helper = re.search(
        r"function getVerifiedPublicRelationshipEvidence\(account\) \{(?P<body>.*?)\n\}",
        app,
        flags=re.S,
    )
    if not evidence_helper or not all(
        fragment in evidence_helper.group("body") for fragment in ("source_url", "summary")
    ):
        errors.append("public-relationship bonus is not backed by source_url + summary evidence")
    if catalog.get("strategy", {}).get("automatic_llm_api") is False and "ChatGPT Pro" not in html:
        errors.append("manual ChatGPT Pro strategy is missing from the public rule center")


def check_executable_rules(catalog: dict, errors: list[str]) -> None:
    tracker._RULE_CATALOG_CACHE = catalog
    company = {
        "id": "example",
        "aliases": ["ACME"],
        "business_role": "competitor",
    }
    profile = {
        "strategic_topics": ["ADC"],
        "business_actions": ["launches"],
        "noise_terms": [],
    }
    scored = tracker.score_candidate(candidate(), profile, [company], max_age_days=14)
    scoring = catalog["information_score"]
    expected_score = (
        scoring["company_alias"]["owned"]
        + scoring["source_trust"]["owned"]
        + scoring["strategic_topic"]["per_hit"]
        + scoring["business_action"]["per_hit"]
        + scoring["category_bonus"]["partnership"]
    )
    if scored.score != expected_score:
        errors.append(f"information score contract expected {expected_score}, executable code returned {scored.score}")
    if scored.tier != "daily":
        errors.append(f"information score fixture should be daily, got {scored.tier}")

    dedicated = tracker.score_candidate(
        candidate(title="A corporate update", summary="General information.", url="https://example.com/news/2"),
        {"strategic_topics": [], "business_actions": [], "noise_terms": []},
        [company],
        max_age_days=14,
    )
    dedicated_expected = scoring["company_alias"]["dedicated_source"] + scoring["source_trust"]["owned"]
    if dedicated.score != dedicated_expected:
        errors.append("dedicated-source company attribution differs from the rule contract")

    url_only = candidate(
        company_id="",
        title="A corporate update",
        summary="General information.",
        url="https://example.com/acme/news/3",
    )
    tracker.match_candidate_companies(url_only, {"example": company})
    if url_only.matched_company_ids:
        errors.append("entity matching unexpectedly uses URL aliases; contract says title + summary only")

    relevance_item = candidate()
    relevance_item.intelligence = {
        "targets": ["Target"],
        "modalities": ["Modality"],
        "product_needs": ["Need"],
        "development_stages": ["Stage"],
        "business_actions": ["Action"],
        "event_signals": ["Event"],
    }
    relevance_item.category = "regulatory"
    roles = [
        {"business_role": "self"},
        {"business_role": "customer"},
        {"business_role": "competitor"},
    ]
    relevance = tracker.build_acro_relevance(relevance_item, roles)
    if relevance["score"] != catalog["acro_relevance"]["maximum"] or relevance["level"] != "high":
        errors.append("ACRO relevance cap or threshold differs from the rule contract")

    low = candidate(tier="daily")
    low.acro_relevance = {"level": "low"}
    low.recommended_action = {"type": "archive"}
    if tracker.apply_daily_admission_policy(low).tier != "archive":
        errors.append("low relevance is no longer forced to archive")
    medium = candidate(tier="immediate")
    medium.matched_company_ids = ["example"]
    medium.acro_relevance = {"level": "medium"}
    medium.recommended_action = {"type": "competitor"}
    if tracker.apply_daily_admission_policy(medium).tier != "daily":
        errors.append("medium relevance immediate signal is no longer downgraded to daily")

    duplicate_a = candidate(summary="Short.")
    duplicate_b = candidate(
        source_id="source-b",
        source_label="Source B",
        summary="This is the longer duplicate summary retained for evidence.",
    )
    merged = tracker.dedupe([duplicate_a, duplicate_b])
    if len(merged) != 1 or set(merged[0].source_ids) != {"source-a", "source-b"}:
        errors.append("duplicate records are not merged with all source ids")
    if merged[0].summary != duplicate_b.summary:
        errors.append("duplicate merge no longer retains the longer summary")


def main() -> int:
    errors: list[str] = []
    catalog = check_contract_shape(errors)
    check_public_rule_center(catalog, errors)
    check_executable_rules(catalog, errors)
    if errors:
        print("Rule contract validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1
    print(f"Rule contract valid: {catalog['version']} / {len(EXPECTED_MODULES)} modules")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
