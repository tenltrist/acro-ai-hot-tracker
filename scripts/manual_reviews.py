"""Project verified editorial summaries without changing collection or scoring."""


def _legacy_review(manual):
    """Give historical verified edits an explicit, truthful provenance record."""
    if manual.get("review") or manual.get("review_status") != "verified":
        return manual.get("review")
    if not manual.get("title_zh") or not manual.get("summary") or not manual.get("source_url"):
        return None
    reviewed_at = manual.get("imported_at") or "date-unavailable"
    review = {
        "reviewed_at": reviewed_at,
        "reviewer": "Historical editorial review",
        "event_key": f"legacy-editorial:{manual['id']}",
        "scope_zh": "保留此前依据公开来源整理并核验的中文标题与摘要；未新增来源材料未披露的事实。",
        "scope_en": "Preserved a previously verified Chinese title and summary grounded in the public source.",
        "kind": "legacy_source_review",
        "material_level": "stored_source_material",
        "evidence": [{"label": "原始来源", "url": manual["source_url"]}],
    }
    manual["review"] = review
    return review


def apply_review_metadata(payload, manual_map):
    for item in payload.get("items", []):
        manual = manual_map.get(item["id"], {})
        review = _legacy_review(manual)
        if not review or manual.get("review_status") != "verified":
            continue
        editorial_translation = review.get("kind") in {
            "codex_editorial_translation",
            "legacy_source_review",
        }
        if not manual.get("title_zh") or not manual.get("summary") or not review.get("evidence"):
            raise ValueError(f"Incomplete editorial review: {item['id']}")
        if not editorial_translation and not manual.get("summary_en"):
            raise ValueError(f"Incomplete bilingual review: {item['id']}")
        provider = (
            "codex_source_review"
            if review.get("kind") == "codex_editorial_translation"
            or str(manual.get("model", "")).lower().startswith("codex")
            else "human_source_review"
        )
        update = {
            "title_zh": manual["title_zh"], "ai_summary": manual["summary"],
            "summary_method": "manual_ai",
            "summary_provider": provider, "summary_model": manual["model"],
            "summary_quality": "source_backed", "summary_review": review,
        }
        if manual.get("summary_en"):
            update["ai_summary_en"] = manual["summary_en"]
        item.update(update)
    reviewed = [item for item in payload.get("items", []) if item.get("summary_method") == "manual_ai"]
    pipeline = payload.setdefault("summary_pipeline", {})
    pipeline["manual_imported"] = len(reviewed)
    pipeline["manual_tool"] = " / ".join(sorted({item.get("summary_model") or "Unspecified" for item in reviewed}))
    stamps = [item["summary_review"]["reviewed_at"] for item in reviewed if item.get("summary_review")]
    if stamps:
        payload["summaries_updated_at"] = max(stamps)
    return payload
