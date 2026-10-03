#!/usr/bin/env python3
"""Build a display-only identity registry from reviewed facts and probe evidence."""
import argparse
import csv
import json
import re
from datetime import datetime, timezone
from pathlib import Path

import run_daily

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def compact(value):
    return re.sub(r"\s+", "", value or "").lower()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("probes", nargs="+")
    args = parser.parse_args()
    probe_map = {}
    for path in args.probes:
        snapshot = read(path)
        for row in snapshot.values() if isinstance(snapshot, dict) else snapshot:
            prior = probe_map.get(row["id"], {})
            row["current_pages"] = row.get("current_pages", row.get("pages", []))
            row["pages"] = prior.get("pages", []) + row.get("pages", [])
            probe_map[row["id"]] = row
    accounts = read(ROOT / "config/japan_accounts.json")["accounts"]
    configuration, _, _ = run_daily.load_runtime_configuration()
    companies = configuration["companies"]
    logos = read(ROOT / "config/company_logos.json")
    exceptions = read(ROOT / "config/company_profile_exceptions.json")
    japanese_names = read(ROOT / "config/company_profile_japanese_names.json")
    with (ROOT / "config/company_profile_reviews.tsv").open(encoding="utf-8") as stream:
        reviews = {row["name"]: row for row in csv.DictReader(stream, delimiter="|")}
    assert set(reviews) == {row["name"] for row in accounts}, "Review must cover the full directory"
    bindings = {row["id"]: row["id"] for row in companies if row["business_role"] != "customer"}
    bindings.update({row["company"]["id"]: row["account_id"] for row in read(ROOT / "config/priority_account_monitoring.json")["accounts"]})
    bindings.update({"takeda_pharma": "jp-account-e40d855a05", "astellas_pharma": "jp-account-efba2a5ff0", "daiichi_sankyo": "jp-account-fafdc85610", "eisai": "jp-account-3f15ddb6b5"})
    company_by_identity = {bindings[row["id"]]: row for row in companies}
    records = {}
    for entity in accounts + [row for row in companies if row["business_role"] != "customer"]:
        identity = entity["id"]
        company = company_by_identity.get(identity, entity)
        name = entity.get("name") or entity.get("display_name_en") or entity["display_name"]
        review = reviews.get(name, {})
        probe = probe_map.get(identity, {})
        exception = exceptions.get(identity, {})
        pages = probe.get("pages", [])
        current_pages = probe.get("current_pages", pages)
        source = next((page for page in reversed(current_pages) if page.get("status") == 200), None)
        website = exception.get("website", probe.get("website") or "")
        website_label = exception.get("website_label", "官网" if source else "官网入口（本轮未验证）")
        all_text = compact(" ".join(str(page.get(field, "")) for page in pages for field in ("title", "description", "visible_text", "japanese_names", "profile_snippets")))
        japanese_name = japanese_names.get(identity) or review.get("name_ja") or company.get("display_name_ja", "")
        japanese_verified = bool(japanese_name and (compact(japanese_name) in all_text or company.get("identity_evidence_url")))
        logo_id = entity.get("logo_id") or identity
        # Monitoring aliases share the canonical account asset, not a second brand.
        if identity in logos.get("accounts", {}) and logos["accounts"][identity].get("asset"):
            logo_id = identity
        logo = logos.get("accounts", {}).get(logo_id) or logos.get("companies", {}).get(logo_id) or {}
        if exception.get("suppress_logo"):
            logo_id = ""
        status = exception.get("status") or ("site_checked" if source else "access_blocked" if any(page.get("status") == 403 for page in current_pages) else "unreachable")
        summary = review.get("summary_zh") or company.get("company_descriptor_zh") or "业务简介待补官方依据。"
        name_zh = entity.get("name_zh") or review.get("name_zh") or company.get("display_name_zh") or company.get("company_descriptor_zh") or "中文名称待补"
        if identity == "rd_systems": name_zh = "R&D Systems（蛋白、抗体与免疫分析）"
        if identity == "stemcell_technologies": name_zh = "STEMCELL（细胞研究试剂）"
        if identity == "nacalai_tesque": name_zh = "Nacalai Tesque（研究试剂与色谱产品）"
        if identity == "cellgenix": name_zh = "CellGenix（GMP细胞培养原料）"
        if identity == "biolegend": name_zh = "BioLegend（抗体与免疫分析）"
        if identity == "peprotech": name_zh = "PeproTech（重组细胞因子）"
        if not re.search(r"[\u4e00-\u9fff]", name_zh):
            name_zh += "（中文名称未确认）"
        checks = [{"url": page["url"], "http_status": page.get("status"), "title": page.get("title", ""), "description": page.get("description", ""), "excerpt": " / ".join(page.get("profile_snippets", []))[:2000], "sha256": page.get("sha256", "")} for page in pages]
        evidence_url = exception.get("evidence_url") or (source or {}).get("url") or logo.get("evidence_page") or website
        missing = []
        if not japanese_verified: missing.append("日文正式名称未取得可靠依据")
        if not source and not exception.get("evidence_url"): missing.append("本轮官网未成功读取")
        if not logo_id or not logo.get("asset"): missing.append(exception.get("note") or logo.get("note") or "独立品牌图片未取得可靠依据")
        if re.search(r"待|保留|以.*为准|不足以|暂不补猜", summary): missing.append("业务细节仍有限，未补猜")
        records[identity] = {
            "id": identity, "monitor_ids": [key for key, value in bindings.items() if value == identity],
            "role": "customer" if identity.startswith("jp-account-") else company["business_role"],
            "name_en": name, "name_zh": name_zh, "name_zh_kind": "reading_reference",
            "name_ja": japanese_name if japanese_verified else "", "name_ja_status": "source_supported" if japanese_verified else "not_confirmed",
            "display_aliases": list(dict.fromkeys([name, name_zh, *([japanese_name] if japanese_verified else []), *company.get("aliases", [])])),
            "summary_zh": summary, "official_website": website, "website_label": website_label,
            "identity_status": status, "identity_note": exception.get("note", ""),
            "logo_id": logo_id, "logo_status": "available" if logo_id and logo.get("asset") else "not_confirmed",
            "logo_kind": logo.get("source_kind", "") if logo_id else "", "logo_label": exception.get("logo_label", ""),
            "logo_background": exception.get("logo_background", logo.get("background", "light")),
            "logo_source_url": logo.get("source_url", "") if logo_id else "",
            "evidence_url": evidence_url, "checked_at": probe.get("checked_at", ""),
            "request_success": bool(source), "page_checks": checks, "request_error": probe.get("error", ""),
            "missing_fields": missing,
        }
    assert len(records) == 254 and len(bindings) == 72
    summary = {"total": len(records), "customer_directory": len(accounts), "competitors": 21, "self": 1, "monitored_customers": 50,
               "with_image": sum(row["logo_status"] == "available" for row in records.values()),
               "with_japanese_name": sum(bool(row["name_ja"]) for row in records.values()),
               "request_success": sum(row["request_success"] for row in records.values()),
               "with_brand_image": sum(row["logo_status"] == "available" and row["logo_kind"] != "official_site_icon" for row in records.values()),
               "with_site_icon": sum(row["logo_status"] == "available" and row["logo_kind"] == "official_site_icon" for row in records.values())}
    result = {"schema_version": 1, "updated_at": datetime.now(timezone.utc).isoformat(), "semantics": "仅展示身份与品牌资料，不改变新闻匹配别名、公司业务身份、评分或采购关系。中文名称与说明用于阅读参考；品牌素材来源及未确认项可追溯。", "records": records, "bindings": bindings, "summary": summary}
    (ROOT / "config/company_profiles.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (ROOT / "reports/company-profile-probes.json").write_text(json.dumps(probe_map, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()
