#!/usr/bin/env python3
"""Validate local logo provenance, safety and self-contained dashboard output."""

import base64
import hashlib
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlsplit

from build_share_page import load_company_logo_audit, load_company_logos
from run_daily import load_runtime_configuration

ROOT = Path(__file__).resolve().parents[1]
UNRESOLVED_REASONS = {
    "official_domain_unavailable_current",
    "official_identity_conflict",
    "official_parent_page_only",
    "official_site_identity_not_confirmed",
    "official_site_no_usable_brand_asset",
    "official_site_not_found",
    "official_site_text_only_identity",
    "organization_inactive_no_current_official_site",
    "organization_merged_legacy_identity",
    "search_unavailable",
}


def main():
    config = json.loads((ROOT / "config/company_logos.json").read_text())
    accounts_config = json.loads((ROOT / "config/japan_accounts.json").read_text())
    companies, _, _ = load_runtime_configuration()
    ids = {row["id"] for row in companies["companies"]}
    account_ids = {row["id"] for row in accounts_config["accounts"]}
    assert set(config["companies"]) == ids, "Logo register must cover every monitored company"
    assert set(config.get("accounts", {})) <= account_ids, "Account logo register contains an unknown account"
    logos = load_company_logos()
    all_records = {**config["companies"], **config.get("accounts", {})}
    for company_id, record in all_records.items():
        if not record.get("asset"):
            assert record.get("status") in {"pending", "unresolved"} and record.get("note"), company_id
            if company_id in account_ids:
                assert record.get("reason") in UNRESOLVED_REASONS and record.get("checked_at"), company_id
            continue
        assert record.get("status") == "available", company_id
        assert record.get("source_kind") in {
            "official_website",
            "official_website_logo",
            "official_site_icon",
            "official_press_release",
        }, company_id
        path = ROOT / record["asset"]
        data = path.read_bytes()
        assert len(data) <= 500_000, company_id
        assert hashlib.sha256(data).hexdigest() == record["sha256"], company_id
        assert record.get("retrieved_at"), company_id
        for field in ("website", "source_url", "evidence_page"):
            url = urlsplit(record[field])
            assert url.scheme in {"http", "https"} and url.netloc, (company_id, field)
        if path.suffix == ".svg":
            svg = ET.fromstring(data)
            assert svg.tag.split("}")[-1] == "svg", company_id
            for element in svg.iter():
                assert element.tag.split("}")[-1].lower() not in {"script", "foreignobject"}, company_id
                for key, value in element.attrib.items():
                    assert not key.lower().startswith("on"), company_id
                    if key.split("}")[-1] == "href":
                        embedded_raster = re.match(r"^data:image/(?:png|jpe?g|webp);base64,", value, re.I)
                        assert value.startswith("#") or embedded_raster, company_id
            assert not re.search(rb"@import|(?:url\(\s*['\"]?)(?:https?:|//)", data, re.I), company_id
        assert base64.b64decode(logos[company_id]["src"].split(",", 1)[1]) == data
    verified_ids = set(logos)
    unchecked_accounts = [
        row["id"] for row in accounts_config["accounts"]
        if row.get("logo_id") not in verified_ids and row["id"] not in config.get("accounts", {})
    ]
    assert not unchecked_accounts, f"Accounts missing a completed logo check: {unchecked_accounts[:5]}"
    for account in accounts_config["accounts"]:
        logo_id = account.get("logo_id")
        if logo_id:
            assert logo_id in verified_ids, (account["id"], logo_id)
    for relative in ("web/embedded-data.js", "share/acro_ai_hot_tracker_dashboard.html"):
        text = (ROOT / relative).read_text()
        encoded = re.search(r"window\.AIHOT_COMPANY_LOGOS = (.*);", text)
        assert encoded and json.loads(encoded.group(1)) == logos, relative
        encoded_audit = re.search(r"window\.AIHOT_COMPANY_LOGO_AUDIT = (.*);", text)
        assert encoded_audit and json.loads(encoded_audit.group(1)) == load_company_logo_audit(), relative
    verified_accounts = sum(row.get("logo_id") in verified_ids for row in accounts_config["accounts"])
    unresolved_accounts = len(accounts_config["accounts"]) - verified_accounts
    print(
        f"Logo validation passed: {len(logos)} verified assets; "
        f"{verified_accounts} account identities available, {unresolved_accounts} explicitly unresolved"
    )


if __name__ == "__main__":
    main()
