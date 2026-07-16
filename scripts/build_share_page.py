#!/usr/bin/env python3
"""Build a self-contained dashboard HTML file for sharing."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WEB_DIR = ROOT / "web"
DATA_PATH = ROOT / "data" / "latest_run.json"
HISTORY_DIR = ROOT / "data" / "history"
SHARE_DIR = ROOT / "share"
OUT_PATH = SHARE_DIR / "acro_ai_hot_tracker_dashboard.html"
EMBEDDED_DATA_PATH = WEB_DIR / "embedded-data.js"


def main() -> int:
    html = (WEB_DIR / "index.html").read_text(encoding="utf-8")
    css = (WEB_DIR / "styles.css").read_text(encoding="utf-8")
    js = (WEB_DIR / "app.js").read_text(encoding="utf-8")
    data = DATA_PATH.read_text(encoding="utf-8")

    payload = json.dumps(json.loads(data), ensure_ascii=False, indent=2)
    history_files = sorted(HISTORY_DIR.glob("*.json")) if HISTORY_DIR.exists() else []
    history_payload = "null"
    if history_files:
        history_payload = json.dumps(json.loads(history_files[-1].read_text(encoding="utf-8")), ensure_ascii=False, indent=2)

    embedded = f"window.AIHOT_EMBEDDED_PAYLOAD = {payload};\nwindow.AIHOT_EMBEDDED_HISTORY = {history_payload};\n"
    EMBEDDED_DATA_PATH.write_text(embedded, encoding="utf-8")

    html = html.replace('    <link rel="stylesheet" href="./styles.css?v=20260716f" />', f"    <style>\n{css}\n    </style>")
    html = html.replace('    <script src="./embedded-data.js?v=20260716f"></script>', f"    <script>\n{embedded}    </script>")
    html = html.replace('    <script src="./app.js?v=20260716f"></script>', f"    <script>\n{js}\n    </script>")

    SHARE_DIR.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(html, encoding="utf-8")
    print(EMBEDDED_DATA_PATH)
    print(OUT_PATH)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
