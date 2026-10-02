import unittest
from pathlib import Path

from src.evaluate import evaluate


class EvaluationTests(unittest.TestCase):
    def test_heldout_evaluation_reports_required_metrics(self):
        root = Path(__file__).resolve().parents[1]
        result = evaluate(root / "data/sample_messages.csv", root / "data/heldout_messages.csv")
        self.assertEqual(result["dataset"]["test_rows"], 12)
        self.assertIn("precision", result["metrics"])
        self.assertIn("confusion_matrix", result["metrics"])


if __name__ == "__main__":
    unittest.main()
