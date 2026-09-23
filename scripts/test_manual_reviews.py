import copy
import json
from pathlib import Path
import unittest

from import_review_batch import prepare
from manual_reviews import apply_review_metadata

ROOT = Path(__file__).resolve().parents[1]


class ManualReviewTests(unittest.TestCase):
    batch_file = "2026-09-09.json"
    expected_counts = (25, 17)

    def setUp(self):
        self.batch = json.loads((ROOT / "data/manual_review_batches" / self.batch_file).read_text())
        # Historical review batches may no longer be inside the latest 90-day
        # snapshot, but they must remain replayable against the retained archive.
        self.payload = json.loads((ROOT / "data/event_archive.json").read_text())
        self.ids = {item_id for group in self.batch["groups"] for item_id in group["ids"]}
        self.registry = {"items": []}

    def test_projection_preserves_source_scoring_and_collection(self):
        before = copy.deepcopy(self.payload)
        self.assertEqual(prepare(self.batch, self.registry, self.payload), self.expected_counts)
        allowed = {"title_zh", "ai_summary", "ai_summary_en", "summary_method", "summary_provider",
                   "summary_model", "summary_quality", "summary_review"}
        for old, new in zip(before["items"], self.payload["items"]):
            changed = {key for key in old.keys() | new.keys() if old.get(key) != new.get(key)}
            self.assertLessEqual(changed, allowed if old["id"] in self.ids else set())
        for key in before.keys() - {"items", "summary_pipeline", "summaries_updated_at"}:
            self.assertEqual(before[key], self.payload[key], key)
        for item in self.payload["items"]:
            if item["id"] in self.ids:
                self.assertEqual(item["summary_method"], "manual_ai")
                self.assertTrue(item["ai_summary_en"])
                self.assertTrue(item["summary_review"]["evidence"])

    def test_idempotent_import(self):
        prepare(self.batch, self.registry, self.payload)
        before = copy.deepcopy((self.registry, self.payload))
        self.assertEqual(prepare(self.batch, self.registry, self.payload), (0, self.expected_counts[1]))
        self.assertEqual(before, (self.registry, self.payload))

    def test_missing_duplicate_and_invalid_evidence_rejected(self):
        for mutation in ("unknown", "duplicate", "url", "english", "overwrite"):
            with self.subTest(mutation=mutation):
                batch = copy.deepcopy(self.batch)
                registry = {"items": []}
                first = batch["groups"][0]
                if mutation == "unknown":
                    first["ids"][0] = "missing"
                elif mutation == "duplicate":
                    first["ids"].append(first["ids"][0])
                elif mutation == "url":
                    first.setdefault("evidence", [{"label": "Invalid test source", "url": ""}])[0]["url"] = "javascript:alert(1)"
                elif mutation == "english":
                    first["summary_en"] = ""
                else:
                    registry["items"] = [{"id": first["ids"][0], "summary": "Existing reviewed text"}]
                with self.assertRaises(ValueError):
                    prepare(batch, registry, copy.deepcopy(self.payload))

    def test_future_refresh_preserves_bilingual_review(self):
        prepare(self.batch, self.registry, self.payload)
        manual_map = {item["id"]: item for item in self.registry["items"]}
        expected = copy.deepcopy(self.payload)
        for item in self.payload["items"]:
            if item["id"] in self.ids:
                for field in ("summary_review", "ai_summary_en"):
                    item.pop(field, None)
                item["summary_provider"] = "chatgpt_pro_manual"
        apply_review_metadata(self.payload, manual_map)
        self.assertEqual(expected, self.payload)

    def test_no_review_metadata_for_unverified_record(self):
        prepare(self.batch, self.registry, self.payload)
        record = self.registry["items"][0]
        record["review_status"] = "draft"
        item = {"id": record["id"], "summary_method": "rule"}
        apply_review_metadata({"items": [item]}, {record["id"]: record})
        self.assertEqual(item, {"id": record["id"], "summary_method": "rule"})

    def test_editorial_review_does_not_claim_full_text_or_verified_source(self):
        manual = {"id": "limited", "review_status": "verified", "title_zh": "中文标题",
                  "summary": "依据摘录写成的具体摘要", "model": "Codex",
                  "review": {"kind": "codex_editorial_translation", "material_level": "title_or_excerpt",
                             "reviewed_at": "2026-09-15", "evidence": [{"url": "https://example.org/article"}]}}
        item = {"id": "limited", "evidence": {"verification_status": "needs_original_check"}}
        apply_review_metadata({"items": [item]}, {"limited": manual})
        self.assertEqual(item["summary_quality"], "source_limited")
        self.assertEqual(item["summary_review"]["source_verification_status"], "needs_original_check")
        self.assertFalse(item["summary_review"]["full_text_read"])

    def test_primary_corroboration_is_not_exact_article_verification(self):
        manual = {"id": "media", "review_status": "verified", "title_zh": "具体标题",
                  "summary": "以官网旁证核对媒体事件。", "model": "Codex",
                  "review": {"kind": "codex_editorial_translation", "material_level": "public_original_excerpt",
                             "reviewed_at": "2026-09-15",
                             "source_verification_status": "verified_primary_corroboration",
                             "evidence": [{"url": "https://example.org/official"}]}}
        item = {"id": "media", "evidence": {"verification_status": "needs_original_check"}}
        apply_review_metadata({"items": [item]}, {"media": manual})
        self.assertEqual(item["summary_quality"], "source_limited")
        self.assertEqual(item["summary_review"]["source_verification_status"], "verified_primary_corroboration")
        self.assertFalse(item["summary_review"]["full_text_read"])

    def test_verified_event_date_does_not_replace_publication_date(self):
        manual = {"id": "official-event", "review_status": "verified", "title_zh": "会议公告",
                  "summary": "官方公告发布会议场次安排。", "model": "Codex",
                  "source_url": "https://example.org/news/session", "event_start_at": "2026-07-03",
                  "review": {"kind": "codex_editorial_translation",
                             "material_level": "source_official_announcement",
                             "source_verification_status": "verified_original",
                             "reviewed_at": "2026-09-15",
                             "evidence": [{"url": "https://example.org/news/session"}]}}
        item = {"id": "official-event", "published_at": "2026-06-17", "event_start_at": ""}
        apply_review_metadata({"items": [item]}, {"official-event": manual})
        self.assertEqual(item["published_at"], "2026-06-17")
        self.assertEqual(item["event_start_at"], "2026-07-03")
        self.assertTrue(item["date_provenance"]["event_verified"])


class FollowupReviewTests(ManualReviewTests):
    batch_file = "2026-09-09-followup.json"
    expected_counts = (22, 21)

    def test_limited_reviews_retain_explicit_boundaries(self):
        prepare(self.batch, self.registry, self.payload)
        records = {record["id"]: record for record in self.registry["items"]}
        for item_id in ("6c91469a64ec7c2c", "239abd95c265a3f1"):
            self.assertIn("有限核对", records[item_id]["review"]["scope_zh"])
            self.assertIn("Limited", records[item_id]["review"]["scope_en"])
        self.assertIn("未取得", records["7f6d1f7200289674"]["summary"])
        self.assertIn("not available", records["7f6d1f7200289674"]["summary_en"])


class TranslationRepairTests(ManualReviewTests):
    batch_file = "2026-09-10-translation-repair.json"
    expected_counts = (62, 62)

    def test_translation_reviews_are_limited_and_distinct_from_titles(self):
        prepare(self.batch, self.registry, self.payload)
        records = {record["id"]: record for record in self.registry["items"]}
        self.assertEqual(len(records), 62)
        for record in records.values():
            self.assertEqual(record["review"]["kind"], "translation_review")
            self.assertEqual(record["review"]["material_level"], "title_or_excerpt")
            self.assertIn("有限核对", record["review"]["scope_zh"])
            self.assertNotEqual(record["title_zh"], record["summary"])
            self.assertNotRegex(record["title_zh"], r"[\u3040-\u30ff]")


if __name__ == "__main__":
    unittest.main()
