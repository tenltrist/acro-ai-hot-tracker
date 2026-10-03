#!/usr/bin/env python3
"""Validate display identity bindings without changing news or company roles."""
import csv
import hashlib
import json
from collections import Counter
from pathlib import Path

import run_daily

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def main():
    registry = read(ROOT / "config/company_profiles.json")
    records, bindings = registry["records"], registry["bindings"]
    accounts = read(ROOT / "config/japan_accounts.json")["accounts"]
    config, _, _ = run_daily.load_runtime_configuration()
    companies = config["companies"]
    logos = read(ROOT / "config/company_logos.json")
    assert len(records) == 254 and len(accounts) == 232 and len(companies) == 72
    assert Counter(row["role"] for row in records.values()) == {"customer": 232, "competitor": 21, "self": 1}
    assert set(bindings) == {row["id"] for row in companies}
    assert len(set(bindings.values())) == 72
    for company in companies:
        assert records[bindings[company["id"]]]["role"] == company["business_role"]
    for account in accounts:
        assert records[account["id"]]["name_en"] == account["name"]
    for identity, row in records.items():
        assert row["name_en"] and row["name_zh"] and row["summary_zh"] and row["evidence_url"]
        assert row["checked_at"], identity
        for field in ("official_website", "evidence_url", "logo_source_url"):
            assert not row[field] or row[field].startswith(("https://", "http://")), (identity, field)
        if row["logo_status"] == "available":
            logo = logos.get("accounts", {}).get(row["logo_id"]) or logos["companies"][row["logo_id"]]
            assert "/wp-includes/images/w-logo" not in logo.get("resolved_url", ""), identity
            path = (ROOT / logo["asset"]).resolve()
            assert path.is_relative_to((ROOT / "web/assets/company-logos").resolve()) and path.is_file()
            assert hashlib.sha256(path.read_bytes()).hexdigest() == logo["sha256"], identity
        else:
            assert row["missing_fields"], identity
        if row["identity_status"] in {"historical", "merged", "identity_conflict"}:
            assert not row["logo_id"], identity
    result = {
        "passed": True, **registry["summary"],
        "identity_states": dict(Counter(row["identity_status"] for row in records.values())),
        "image_kinds": dict(Counter(row["logo_kind"] for row in records.values() if row["logo_status"] == "available")),
        "missing_image": [row["name_en"] for row in records.values() if row["logo_status"] != "available"],
        "missing_japanese_name": [row["name_en"] for row in records.values() if not row["name_ja"]],
    }
    (ROOT / "reports/company-profile-validation.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    with (ROOT / "reports/company-profile-review.csv").open("w", encoding="utf-8-sig", newline="") as stream:
        fields = ["类型", "英文名", "中文名称或说明", "日文正式名", "业务简介", "官网", "资料状态", "图片类型", "图片状态", "资料依据", "未确认项"]
        writer = csv.writer(stream, lineterminator="\n")
        writer.writerow(fields)
        role_labels = {"self": "本公司", "competitor": "竞品", "customer": "客户 / 日本账户"}
        for row in sorted(records.values(), key=lambda row: ({"self": 0, "competitor": 1, "customer": 2}[row["role"]], row["name_en"])):
            writer.writerow([role_labels[row["role"]], row["name_en"], row["name_zh"], row["name_ja"], row["summary_zh"], row["official_website"], row["identity_status"], row["logo_kind"], row["logo_status"], row["evidence_url"], "；".join(row["missing_fields"])])
    print(json.dumps({key: value for key, value in result.items() if not isinstance(value, list)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
