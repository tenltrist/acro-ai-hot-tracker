#!/usr/bin/env python3
"""Validate local logo provenance, safety and self-contained dashboard output."""

import base64
import hashlib
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlsplit

from build_share_page import load_company_logos
from run_daily import load_runtime_configuration

ROOT = Path(__file__).resolve().parents[1]


def main():
    config = json.loads((ROOT / "config/company_logos.json").read_text())
    companies, _, _ = load_runtime_configuration()
    ids = {row["id"] for row in companies["companies"]}
    assert set(config["companies"]) == ids, "Logo register must cover every monitored company"
    logos = load_company_logos()
    for company_id, record in config["companies"].items():
        if not record.get("asset"):
            assert record.get("status") == "pending" and record.get("note"), company_id
            continue
        path = ROOT / record["asset"]
        data = path.read_bytes()
        assert len(data) <= 500_000, company_id
        assert hashlib.sha256(data).hexdigest() == record["sha256"], company_id
        assert record.get("retrieved_at"), company_id
        for field in ("website", "source_url", "evidence_page"):
            url = urlsplit(record[field])
            assert url.scheme == "https" and url.netloc, (company_id, field)
        if path.suffix == ".svg":
            svg = ET.fromstring(data)
            assert svg.tag.split("}")[-1] == "svg", company_id
            for element in svg.iter():
                assert element.tag.split("}")[-1].lower() not in {"script", "foreignobject"}, company_id
                for key, value in element.attrib.items():
                    assert not key.lower().startswith("on"), company_id
                    if key.split("}")[-1] == "href":
                        assert value.startswith("#"), company_id
            assert not re.search(rb"@import|(?:url\(\s*['\"]?)(?:https?:|//)", data, re.I), company_id
        assert base64.b64decode(logos[company_id]["src"].split(",", 1)[1]) == data
    for relative in ("web/embedded-data.js", "share/acro_ai_hot_tracker_dashboard.html"):
        text = (ROOT / relative).read_text()
        encoded = re.search(r"window\.AIHOT_COMPANY_LOGOS = (.*);", text)
        assert encoded and json.loads(encoded.group(1)) == logos, relative
    print(f"Logo validation passed: {len(logos)} verified assets, {len(ids) - len(logos)} explicit fallbacks")


if __name__ == "__main__":
    main()
