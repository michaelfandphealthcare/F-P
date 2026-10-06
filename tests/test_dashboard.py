import unittest
from pathlib import Path
from unittest.mock import patch

from src.server import PublicUrlError, _normalise_public_url, dashboard_payload


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

    def test_measured_evaluations_are_versioned_and_separate(self):
        payload = dashboard_payload()
        self.assertEqual(payload["evaluation"]["model_version"], "contextual-baseline-v5")
        self.assertEqual(payload["challenge_evaluation"]["dataset"]["version"], "challenge_messages-v1")
        self.assertEqual(payload["challenge_evaluation"]["metrics"]["false_positives"], 0)
        self.assertIn("regression", payload["challenge_evaluation"]["dataset_role"].lower())

    def test_chat_media_upload_is_exposed_before_the_demo(self):
        root = Path(__file__).resolve().parents[1]
        html = (root / "web" / "index.html").read_text(encoding="utf-8")
        upload = html.index("Choose screenshot or recording")
        demonstration = html.index("Or use fictional demonstrations")
        self.assertLess(upload, demonstration)
        self.assertIn("video/mp4", html)
        self.assertIn("video/webm", html)
        self.assertIn("video/quicktime", html)

    def test_recording_ocr_has_limits_and_frame_sampling(self):
        root = Path(__file__).resolve().parents[1]
        app = (root / "web" / "static" / "app.js").read_text(encoding="utf-8")
        self.assertIn("video.duration > 60", app)
        self.assertIn("extractRecordingText", app)
        self.assertIn("Duplicates combined", app)

    def test_random_recording_library_has_scam_and_legitimate_examples(self):
        root = Path(__file__).resolve().parents[1]
        recordings = sorted((root / "web" / "static" / "assets" / "demo-recordings").glob("*.mp4"))
        self.assertEqual(len(recordings), 12)
        names = {item.stem for item in recordings}
        self.assertEqual(len([name for name in names if name.endswith("-scam")]), 6)
        self.assertEqual(len([name for name in names if name.endswith("-safe")]), 6)
        html = (root / "web" / "index.html").read_text(encoding="utf-8")
        self.assertIn("Random recording", html)
        self.assertIn("12 recording examples", html)

    def test_online_link_check_is_exposed_and_truthfully_limited(self):
        root = Path(__file__).resolve().parents[1]
        html = (root / "web" / "index.html").read_text(encoding="utf-8")
        self.assertIn('id="inspectOnlineBtn"', html)
        self.assertIn("public reachability and response metadata", html)
        self.assertIn("does not prove that a site is safe", html)
        self.assertIn("no application database or message history", html)

    def test_public_url_checker_rejects_private_and_internal_destinations(self):
        with self.assertRaises(PublicUrlError):
            _normalise_public_url("http://127.0.0.1/admin")
        with self.assertRaises(PublicUrlError):
            _normalise_public_url("http://service.internal/")
        with patch("src.server.socket.getaddrinfo", return_value=[(2, 1, 6, "", ("10.0.0.4", 443))]):
            with self.assertRaises(PublicUrlError):
                _normalise_public_url("https://apparently-public.invalid-domain.org/")

    def test_public_url_checker_accepts_only_public_standard_web_targets(self):
        public_answer = [(2, 1, 6, "", ("93.184.216.34", 443))]
        with patch("src.server.socket.getaddrinfo", return_value=public_answer):
            url, host, addresses = _normalise_public_url("example.org/path#fragment")
        self.assertEqual(url, "https://example.org/path")
        self.assertEqual(host, "example.org")
        self.assertEqual(addresses, ["93.184.216.34"])


if __name__ == "__main__":
    unittest.main()
