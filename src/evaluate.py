"""Reproducible held-out evaluation for the transparent ScamShield baseline."""

from __future__ import annotations

import csv
import json
from collections import Counter
from datetime import date
from pathlib import Path

from .core import DECISION_THRESHOLD, MODEL_VERSION, explain, train_from_csv

DATASET_VERSION = "heldout_messages-v1"


def evaluate(train_path: Path, test_path: Path) -> dict:
    model = train_from_csv(train_path)
    with test_path.open(encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    y_true = [int(row["label"] == "phishing") for row in rows]
    y_pred = []
    baseline_pred = []
    records = []
    for row in rows:
        expected_label = row["label"].strip().lower()
        result = explain(row["text"], model.predict_probability(row["text"]), model)
        prediction = int(result["risk_score"] >= DECISION_THRESHOLD)
        y_pred.append(prediction)
        baseline_pred.append(int(model.predict_probability(row["text"]) >= 0.5))
        records.append({
            "scenario": row["scenario"],
            "label": row["label"],
            "prediction": prediction,
            "expected": expected_label,
            "actual": "phishing" if prediction else "legitimate",
            "risk_score": result["risk_score"],
            "score_0_100": round(result["risk_score"] * 100),
        })
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
        "dataset": {"version": DATASET_VERSION if test_path.name == "heldout_messages.csv" else "challenge_messages-v1", "train": f"data/{train_path.name}", "test": f"data/{test_path.name}", "test_rows": len(rows), "class_distribution": dict(Counter(row["label"] for row in rows))},
        "evaluation_date": date.today().isoformat(),
        "model_version": MODEL_VERSION,
        "decision_threshold": DECISION_THRESHOLD,
        "score_scale": "0–100 screening score; not a calibrated probability",
        "metrics": {"precision": round(precision, 3), "recall": round(recall, 3), "f1": round(f1, 3), "false_positives": fp, "missed_scams": fn, "confusion_matrix": {"true_negative": tn, "false_positive": fp, "false_negative": fn, "true_positive": tp}},
        "records": records,
        "baseline_metrics": {"precision": round(bprecision, 3), "recall": round(brecall, 3), "f1": round(bf1, 3), "confusion_matrix": {"true_negative": btn, "false_positive": bfp, "false_negative": bfn, "true_positive": btp}, "method": "TF-IDF-only score at threshold 0.5"},
        "failure_examples": [record for record in records if record["expected"] != record["actual"]],
        "limitations": ["Small, hand-curated development and held-out sets are not representative of real-world prevalence.", "The screening score is not a calibrated probability.", "The challenge set is a development regression set and is not independent evidence after known failures have been corrected.", "No domain reputation or live URL verification is performed."],
    }


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    heldout = evaluate(root / "data" / "sample_messages.csv", root / "data" / "heldout_messages.csv")
    challenge = evaluate(root / "data" / "sample_messages.csv", root / "data" / "challenge_messages.csv")
    challenge["dataset_role"] = "Development regression/challenge set; not an independent final test set."
    challenge["resolved_regressions"] = [
        {
            "case": "Family changed-number transfer request",
            "expected": "High caution with family identity, changed contact, payment, urgency and discouraged-verification evidence.",
            "previous": "Lower caution; no contextual signals.",
            "current": "Covered by contextual-baseline-v5 regression tests.",
        },
        {
            "case": "Preventative security-awareness reminder",
            "expected": "Lower caution; preventative guidance is not a support impersonation request.",
            "previous": "High caution triggered by the words ‘IT team’.",
            "current": "Covered by contextual-baseline-v5 regression tests.",
        },
    ]
    (root / "data" / "evaluation_results.json").write_text(json.dumps(heldout, indent=2) + "\n", encoding="utf-8")
    (root / "data" / "challenge_evaluation.json").write_text(json.dumps(challenge, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"heldout": heldout["metrics"], "challenge": challenge["metrics"]}, indent=2))
