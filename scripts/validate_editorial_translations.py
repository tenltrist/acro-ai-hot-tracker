#!/usr/bin/env python3
"""Validate the edited Chinese release without changing collection or scoring."""

from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HAN = re.compile(r"[\u3400-\u9fff]")
KANA = re.compile(r"[\u3040-\u30ff]")
LONG_FOREIGN_RUN = re.compile(r"(?:\b[A-Za-z][A-Za-z0-9®™+./-]*\b[ ,:;()\-]*){9,}")
PROHIBITED_UI_LABELS = (
    "翻译校对",
    "Translation checked",
    "AI 精读",
    "ChatGPT Pro 人工复核摘要",
    "有限材料",
)


def read_json(relative: str):
    return json.loads((ROOT / relative).read_text(encoding="utf-8"))


def normalized(value) -> str:
    return unicodedata.normalize("NFKC", str(value or "")).strip()


def main() -> int:
    latest = read_json("data/latest_run.json")
    archive = read_json("data/event_archive.json")
    public_items = read_json("api/public/items.json")
    public_daily = read_json("api/public/daily.json")
    items = latest.get("items", [])
    archived_items = archive.get("items", [])
    errors: list[str] = []

    if latest.get("generated_at") != archive.get("updated_at"):
        errors.append("event archive changed the collection timestamp")
    if public_items != items:
        errors.append("public items are not synchronized with latest_run")
    selected = [item for item in items if item.get("tier") in {"daily", "immediate"}]
    if public_daily.get("selected") != selected:
        errors.append("public daily selection is not synchronized with latest_run")

    if latest.get("summary_pipeline", {}).get("manual_imported") != len(items):
        errors.append("latest_run editorial count does not cover every current record")
    if archive.get("summary_pipeline", {}).get("manual_imported") != len(archived_items):
        errors.append("event archive editorial count does not cover every retained record")

    def validate_item(item: dict, surface: str) -> None:
        item_id = item.get("id", "unknown")
        title = normalized(item.get("title"))
        title_zh = normalized(item.get("title_zh"))
        summary = normalized(item.get("ai_summary"))
        if not title_zh or not HAN.search(title_zh):
            errors.append(f"{surface}/{item_id}: Chinese title is missing")
        if not summary or not HAN.search(summary):
            errors.append(f"{surface}/{item_id}: Chinese summary is missing")
        if KANA.search(title_zh) or KANA.search(summary):
            errors.append(f"{surface}/{item_id}: Japanese text remains in Chinese display fields")
        if LONG_FOREIGN_RUN.search(title_zh) or LONG_FOREIGN_RUN.search(summary):
            errors.append(f"{surface}/{item_id}: untranslated foreign sentence remains in Chinese display fields")
        if title_zh == title and not HAN.search(title):
            errors.append(f"{surface}/{item_id}: Chinese title still equals the foreign source title")
        if summary in {title, title_zh}:
            errors.append(f"{surface}/{item_id}: summary only repeats the title")
        if item.get("summary_method") != "manual_ai" or item.get("summary_provider") not in {
            "codex_source_review",
            "chatgpt_pro_manual",
            "human_source_review",
        }:
            errors.append(f"{surface}/{item_id}: editorial result is not active")

    archive_by_id = {item.get("id"): item for item in archived_items}
    if len(archive_by_id) != len(archived_items):
        errors.append("event archive contains duplicate record ids")
    for item in archived_items:
        validate_item(item, "archive")
    for item in items:
        validate_item(item, "latest")
        item_id = item.get("id", "unknown")
        archived = archive_by_id.get(item_id)
        for field in ("title_zh", "ai_summary", "summary_method", "summary_provider", "summary_review"):
            if not archived or archived.get(field) != item.get(field):
                errors.append(f"{item_id}: event archive is out of sync for {field}")

    for relative in ("web/index.html", "web/app.js", "web/fusion.js"):
        content = (ROOT / relative).read_text(encoding="utf-8")
        for label in PROHIBITED_UI_LABELS:
            if label in content:
                errors.append(f"{relative}: prohibited processing label remains: {label}")

    if errors:
        print("Editorial translation validation failed:")
        for error in errors[:80]:
            print(f"- {error}")
        if len(errors) > 80:
            print(f"- ... and {len(errors) - 80} more")
        return 1

    print(
        "Editorial translation validation passed: "
        f"{len(archived_items)} archived records and {len(items)} current records, "
        f"{len(selected)} selected records; Chinese titles and summaries complete, "
        "archive/API synchronized."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
