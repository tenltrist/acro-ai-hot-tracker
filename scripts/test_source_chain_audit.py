"""Source output status must be scoped to the monitored company."""

import unittest

from audit_source_chain import scoped_source_row
from audit_ai_content import audit_item


class SourceChainAuditTests(unittest.TestCase):
    def test_shared_productive_source_is_quiet_without_company_hit(self):
        source = {"source_id": "shared", "status": "productive", "request_succeeded": True}
        result = scoped_source_row(source, "target", [])
        self.assertEqual(result["status"], "quiet")
        self.assertEqual(result["selected"], 0)
        self.assertEqual(result["mode"], "shared")

    def test_company_hit_and_admission_are_separate(self):
        source = {"source_id": "shared", "status": "productive", "request_succeeded": True}
        archive = {"source_ids": ["shared"], "tier": "archive"}
        selected = {"source_ids": ["shared"], "tier": "daily", "published_at": "2026-09-14"}
        self.assertEqual(scoped_source_row(source, "target", [archive])["status"], "archive_only")
        result = scoped_source_row(source, "target", [archive, selected])
        self.assertEqual((result["company_hits"], result["selected"], result["dated_selected"]), (2, 1, 1))

    def test_request_failure_stays_visible_without_output(self):
        source = {"source_id": "owned", "company_id": "target", "status": "error", "error": "timeout"}
        result = scoped_source_row(source, "target", [])
        self.assertEqual(result["status"], "error")
        self.assertEqual(result["error"], "timeout")

    def test_known_unmonitored_organizers_are_not_labeled_missing(self):
        row = audit_item({"id": "event", "title_zh": "活动", "ai_summary": "活动计划举行。",
                          "summary_review": {"unmonitored_organizers": ["GenScript Japan", "ProBio"],
                                             "source_verification_status": "verified_original",
                                             "evidence": [{"url": "https://example.org/event"}]},
                          "matched_company_ids": [], "evidence": {"primary_url": "https://example.org/event"}})
        self.assertIn("organizer_outside_company_pool", row["flags"])
        self.assertNotIn("company_unmatched", row["flags"])


if __name__ == "__main__":
    unittest.main()
