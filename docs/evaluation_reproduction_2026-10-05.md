# Evaluation reproduction — 5 October 2026

## Scope and separation

- Training data: `data/sample_messages.csv` (22 labelled development examples).
- Final held-out data: `data/heldout_messages.csv` (12 examples: 7 legitimate, 5 phishing).
- Additional challenge data: `data/challenge_messages.csv` (24 examples: 12 legitimate, 12 phishing).
- Model/rules version: `contextual-baseline-v4`.
- Decision threshold: screening score `>= 0.35`.

The challenge set was written after the development examples and is not used by the training function. Its provenance column records that the examples are author-created. It is a robustness check, not a population sample. After its first recorded run, its two false alarms were retained and no rules were changed against those failures.

## Reproduction commands

Run the Python unit tests and the JavaScript conversation tests, then execute the evaluator against each fixed CSV. The evaluator trains only from `sample_messages.csv` and reports precision, recall, F1 and confusion-matrix counts.

## Measured results

| Dataset | n | Legitimate | Scam | Precision | Recall | F1 | TN | FP | FN | TP |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Held-out v1 | 12 | 7 | 5 | 1.000 | 1.000 | 1.000 | 7 | 0 | 0 | 5 |
| Challenge v1 | 24 | 12 | 12 | 0.857 | 1.000 | 0.923 | 10 | 2 | 0 | 12 |
| TF-IDF-only baseline on challenge v1 | 24 | 12 | 12 | 0.733 | 0.917 | 0.815 | 8 | 4 | 1 | 11 |

## Recorded failure examples

The challenge run incorrectly flagged a benign family-payment discussion containing an explicit denial and a security-awareness sentence that quoted a login-approval instruction. These are false alarms. They remain documented rather than being tuned away on the challenge set.

## Limitations

Both sets are small and hand-authored. They do not estimate real-world prevalence or production accuracy. The score is not a calibrated probability. Scenario groups are too small for stable per-scenario rates. The system performs no live URL reputation, domain-age or certificate check.
