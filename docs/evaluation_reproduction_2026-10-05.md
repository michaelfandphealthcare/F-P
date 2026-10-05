# Evaluation reproduction — 5 October 2026

## Scope and separation

- Training data: `data/sample_messages.csv` (22 labelled development examples).
- Final held-out data: `data/heldout_messages.csv` (12 examples: 7 legitimate, 5 phishing).
- Additional challenge data: `data/challenge_messages.csv` (24 examples: 12 legitimate, 12 phishing).
- Model/rules version: `contextual-baseline-v5`.
- Decision threshold: screening score `>= 0.36` (displayed as 36/100).

The challenge set was written after the original development examples and is not used by the training function. Its provenance column records that the examples are author-created. Two known failures were subsequently used to improve the contextual rules, so the set is now classified as a development regression set rather than an independent final test set.

## Reproduction commands

Run the Python unit tests and the JavaScript conversation tests, then execute the evaluator against each fixed CSV. The evaluator trains only from `sample_messages.csv` and reports precision, recall, F1 and confusion-matrix counts.

## Measured results

| Dataset | n | Legitimate | Scam | Precision | Recall | F1 | TN | FP | FN | TP |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Held-out v1 | 12 | 7 | 5 | 1.000 | 1.000 | 1.000 | 7 | 0 | 0 | 5 |
| Development challenge v1 | 24 | 12 | 12 | 1.000 | 1.000 | 1.000 | 12 | 0 | 0 | 12 |
| TF-IDF-only baseline on challenge v1 | 24 | 12 | 12 | 0.733 | 0.917 | 0.815 | 8 | 4 | 1 | 11 |

## Resolved regression examples

The v5 rules correct two reproduced live failures: a changed-number family transfer request that was previously missed, and a preventative security reminder that was incorrectly made high risk by the words “IT team.” The generated challenge JSON records the expected behaviour, previous output and current regression coverage. A future final evaluation must use newly sourced, frozen examples that were not used to make these corrections.

## Limitations

Both sets are small and hand-authored. They do not estimate real-world prevalence or production accuracy. The score is not a calibrated probability. Scenario groups are too small for stable per-scenario rates. The system performs no live URL reputation, domain-age or certificate check.
