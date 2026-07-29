#!/usr/bin/env python3
"""Build a self-contained dashboard HTML file for sharing."""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WEB_DIR = ROOT / "web"
DATA_PATH = ROOT / "data" / "latest_run.json"
COMPANY_CONFIG_PATH = ROOT / "config" / "companies.json"
INTELLIGENCE_RULES_PATH = ROOT / "config" / "intelligence_rules.json"
HISTORY_DIR = ROOT / "data" / "history"
SHARE_DIR = ROOT / "share"
OUT_PATH = SHARE_DIR / "acro_ai_hot_tracker_dashboard.html"
EMBEDDED_DATA_PATH = WEB_DIR / "embedded-data.js"


def main() -> int:
    html = (WEB_DIR / "index.html").read_text(encoding="utf-8")
    css = (WEB_DIR / "styles.css").read_text(encoding="utf-8")
    js = (WEB_DIR / "app.js").read_text(encoding="utf-8")
    payload_data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    company_config = json.loads(COMPANY_CONFIG_PATH.read_text(encoding="utf-8"))
    intelligence_rules = json.loads(INTELLIGENCE_RULES_PATH.read_text(encoding="utf-8"))
    company_metadata = {company["id"]: company for company in company_config["companies"]}
    for company in payload_data.get("companies", []):
        configured = company_metadata.get(company["id"], {})
        for field in ("business_role", "role_label", "role_reason", "monitoring_focus"):
            if field in configured:
                company[field] = configured[field]

    payload = json.dumps(payload_data, ensure_ascii=False, indent=2)
    history_files = sorted(HISTORY_DIR.glob("*.json")) if HISTORY_DIR.exists() else []
    history_payload = "null"
    if history_files:
        history_payload = json.dumps(json.loads(history_files[-1].read_text(encoding="utf-8")), ensure_ascii=False, indent=2)

    rules_payload = json.dumps(intelligence_rules, ensure_ascii=False, indent=2)
    embedded = (
        f"window.AIHOT_EMBEDDED_PAYLOAD = {payload};\n"
        f"window.AIHOT_EMBEDDED_HISTORY = {history_payload};\n"
        f"window.AIHOT_INTELLIGENCE_RULES = {rules_payload};\n"
    )
    EMBEDDED_DATA_PATH.write_text(embedded, encoding="utf-8")

    html = re.sub(
        r'    <link rel="stylesheet" href="\./styles\.css(?:\?v=[^"]+)?" />',
        f"    <style>\n{css}\n    </style>",
        html,
        count=1,
    )
    html = re.sub(
        r'    <script src="\./embedded-data\.js(?:\?v=[^"]+)?"></script>',
        lambda _: f"    <script>\n{embedded}    </script>",
        html,
        count=1,
    )
    html = re.sub(
        r'    <script src="\./app\.js(?:\?v=[^"]+)?"></script>',
        lambda _: f"    <script>\n{js}\n    </script>",
        html,
        count=1,
    )

    SHARE_DIR.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(html, encoding="utf-8")
    print(EMBEDDED_DATA_PATH)
    print(OUT_PATH)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
