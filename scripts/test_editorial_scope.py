"""Translation provenance must not imply that an original article was read."""

import unittest

from import_codex_translations import editorial_scope, source_record_map
from manual_reviews import apply_review_metadata


class EditorialScopeTest(unittest.TestCase):
    def test_older_evidence_does_not_restore_news_or_override_new_source(self):
        current = {"items": [{"id": "same", "title": "Newest"}]}
        archive = {"items": [{"id": "same", "title": "Retained"}]}
        older = {"items": [{"id": "same", "title": "Old"}, {"id": "old-only", "title": "History"}]}
        sources = source_record_map(current, archive, older)
        self.assertEqual(sources["same"]["title"], "Newest")
        self.assertEqual(sources["old-only"]["title"], "History")
        self.assertEqual(len(current["items"]), 1)
        self.assertEqual(len(archive["items"]), 1)

    def test_title_only(self):
        scope = editorial_scope({"material_level": "title_only", "summary_availability": "unavailable"}, {"title": "New product"})
        self.assertEqual(scope["material_level"], "title_only")
        self.assertEqual(scope["summary_availability"], "unavailable")
        self.assertIn("未读取全文", scope["scope_zh"])

    def test_excerpt_required(self):
        with self.assertRaises(ValueError):
            editorial_scope({"material_level": "title_and_excerpt"}, {"title": "New product"})

    def test_no_full_text_upgrade(self):
        source = {"id": "test", "title": "New product", "summary": "Product details", "evidence": {"verification_status": "source_backed"}}
        scope = editorial_scope({"material_level": "title_and_excerpt"}, source)
        review = {"id": "test", "title_zh": "新产品", "summary": "产品具体信息。", "review_status": "verified", "model": "Codex editorial translation", "review": {**scope, "kind": "codex_editorial_translation", "reviewed_at": "2026-10-03", "evidence": [{"url": "https://example.com"}]}}
        payload = apply_review_metadata({"items": [source]}, {"test": review})
        self.assertFalse(payload["items"][0]["summary_review"]["full_text_read"])

    def test_hash_bound_to_material_and_reuse(self):
        first = editorial_scope({"reused_from_id": "old"}, {"title": "A", "summary": "B"})
        changed = editorial_scope({}, {"title": "A", "summary": "C"})
        self.assertNotEqual(first["source_material_sha256"], changed["source_material_sha256"])
        self.assertEqual(first["reused_from_id"], "old")

    def test_cannot_claim_full_text(self):
        with self.assertRaises(ValueError):
            editorial_scope({"material_level": "full_text"}, {})


if __name__ == "__main__":
    unittest.main()
