"""Reproducible held-out evaluation for the transparent ScamShield baseline."""

from __future__ import annotations

import csv
import json
from collections import Counter
from datetime import date
from pathlib import Path

from .core import explain, train_from_csv

MODEL_VERSION = "contextual-baseline-v4"


def evaluate(train_path: Path, test_path: Path) -> dict:
    model = train_from_csv(train_path)
    with test_path.open(encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    y_true = [int(row["label"] == "phishing") for row in rows]
    y_pred = []
    baseline_pred = []
    records = []
    for row in rows:
        result = explain(row["text"], model.predict_probability(row["text"]), model)
        prediction = int(result["risk_score"] >= 0.35)
        y_pred.append(prediction)
        baseline_pred.append(int(model.predict_probability(row["text"]) >= 0.5))
        records.append({"scenario": row["scenario"], "label": row["label"], "prediction": prediction, "risk_score": result["risk_score"]})
    tp = sum(a == b == 1 for a, b in zip(y_true, y_pred))
    tn = sum(a == b == 0 for a, b in zip(y_true, y_pred))
    fp = sum(a == 0 and b == 1 for a, b in zip(y_true, y_pred))
    fn = sum(a == 1 and b == 0 for a, b in zip(y_true, y_pred))
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    btp = sum(a == b == 1 for a, b in zip(y_true, baseline_pred))
    btn = sum(a == b == 0 for a, b in zip(y_true, baseline_pred))
    bfp = sum(a == 0 and b == 1 for a, b in zip(y_true, baseline_pred))
    bfn = sum(a == 1 and b == 0 for a, b in zip(y_true, baseline_pred))
    bprecision = btp / (btp + bfp) if btp + bfp else 0.0
    brecall = btp / (btp + bfn) if btp + bfn else 0.0
    bf1 = 2 * bprecision * brecall / (bprecision + brecall) if bprecision + brecall else 0.0
    return {
        "dataset": {"train": str(train_path), "test": str(test_path), "test_rows": len(rows), "class_distribution": dict(Counter(row["label"] for row in rows))},
        "evaluation_date": date.today().isoformat(),
        "model_version": MODEL_VERSION,
        "metrics": {"precision": round(precision, 3), "recall": round(recall, 3), "f1": round(f1, 3), "false_positives": fp, "missed_scams": fn, "confusion_matrix": {"true_negative": tn, "false_positive": fp, "false_negative": fn, "true_positive": tp}},
        "records": records,
        "baseline_metrics": {"precision": round(bprecision, 3), "recall": round(brecall, 3), "f1": round(bf1, 3), "confusion_matrix": {"true_negative": btn, "false_positive": bfp, "false_negative": bfn, "true_positive": btp}, "method": "TF-IDF-only score at threshold 0.5"},
        "limitations": ["Small, hand-curated development and held-out sets are not representative of real-world prevalence.", "The screening score is not calibrated probability.", "No domain reputation or live URL verification is performed."],
    }


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    result = evaluate(root / "data" / "sample_messages.csv", root / "data" / "heldout_messages.csv")
    print(json.dumps(result, indent=2))
