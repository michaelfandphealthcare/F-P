import unittest

from src.server import dashboard_payload


class DashboardDataTests(unittest.TestCase):
    def test_public_and_synthetic_data_are_separate(self):
        payload = dashboard_payload()
        self.assertGreaterEqual(len(payload["evidence"]), 3)
        self.assertEqual(len(payload["scenarios"]["sector_mix"]), 5)
        self.assertIn("demonstration", payload["scenarios"]["status"])

    def test_public_evidence_has_source_metadata(self):
        for item in dashboard_payload()["evidence"]:
            self.assertIn("value", item)
            self.assertIn("label", item)
            self.assertIn("source", item)


if __name__ == "__main__":
    unittest.main()
