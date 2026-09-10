import json
import tempfile
import unittest
from pathlib import Path

from event_archive import update_archive


class ArchiveTests(unittest.TestCase):
    def test_retention_and_allowlist(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "events.json"
            first = {"generated_at": "2026-09-08T00:00:00", "items": [
                {"id": "a", "title": "Original", "summary_method": "rule", "ai_summary": "Invented action", "internal_acro": 1, "tier": "daily", "score": 62, "acro_relevance": {"level": "high", "score": 50}},
                {"id": "b", "title": "Keep me", "summary_method": "manual_ai", "ai_summary": "Reviewed summary", "tier": "daily", "score": 55, "acro_relevance": {"level": "medium", "score": 30}},
            ]}
            archive = update_archive(path, first)
            self.assertNotIn("ai_summary", archive["items"][0])
            self.assertNotIn("internal_acro", archive["items"][0])
            second = {"generated_at": "2026-09-09T00:00:00", "items": [{"id": "a", "title": "Updated", "tier": "archive", "score": 42, "acro_relevance": {"level": "medium", "score": 30}}]}
            archive = update_archive(path, second)
            self.assertEqual(len(archive["items"]), 2)
            self.assertEqual(archive["items"][0]["archive_first_seen"], first["generated_at"])
            self.assertEqual(archive["items"][0]["archive_last_seen"], second["generated_at"])
            self.assertEqual(archive["items"][0]["tier"], "archive")
            self.assertEqual(archive["items"][0]["score"], 42)
            self.assertEqual(archive["items"][1]["ai_summary"], "Reviewed summary")
            self.assertEqual(archive["items"][1]["tier"], "daily")
            self.assertEqual(archive["items"][1]["score"], 55)
            self.assertEqual(archive["items"][1]["acro_relevance"]["level"], "medium")
            self.assertEqual(archive["retention_started_at"], first["generated_at"])
            before = path.read_bytes()
            update_archive(path, second)
            self.assertEqual(before, path.read_bytes())
            path.write_text(json.dumps({"schema_version": 99}))
            with self.assertRaises(ValueError):
                update_archive(path, second)


if __name__ == "__main__":
    unittest.main()
