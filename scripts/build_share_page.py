#!/usr/bin/env python3
"""Build a self-contained dashboard HTML file for sharing."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WEB_DIR = ROOT / "web"
DATA_PATH = ROOT / "data" / "latest_run.json"
SHARE_DIR = ROOT / "share"
OUT_PATH = SHARE_DIR / "acro_ai_hot_tracker_dashboard.html"


def main() -> int:
    html = (WEB_DIR / "index.html").read_text(encoding="utf-8")
    css = (WEB_DIR / "styles.css").read_text(encoding="utf-8")
    js = (WEB_DIR / "app.js").read_text(encoding="utf-8")
    data = DATA_PATH.read_text(encoding="utf-8")

    payload = json.dumps(json.loads(data), ensure_ascii=False, indent=2)
    js = js.replace("const fallbackPayload = {", "const fallbackPayload = {")
    js = js.replace(
        "async function loadData() {\n  try {\n    const response = await fetch(\"../data/latest_run.json\", { cache: \"no-store\" });\n    if (!response.ok) throw new Error(`HTTP ${response.status}`);\n    state.payload = await response.json();\n  } catch (error) {\n    state.payload = fallbackPayload;\n  }\n  hydrateFilters();\n  render();\n}",
        f"async function loadData() {{\n  state.payload = embeddedPayload;\n  hydrateFilters();\n  render();\n}}\n\nconst embeddedPayload = {payload};",
    )

    html = html.replace('    <link rel="stylesheet" href="./styles.css" />', f"    <style>\n{css}\n    </style>")
    html = html.replace('    <script src="./app.js"></script>', f"    <script>\n{js}\n    </script>")

    SHARE_DIR.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(html, encoding="utf-8")
    print(OUT_PATH)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
