# ScamShield Evaluation Plan

## Research question

How effectively can an explainable machine-learning system detect phishing messages that have been rewritten by generative AI, while providing explanations that non-technical users can understand?

## Planned comparison

1. Transparent TF-IDF-style linear baseline.
2. Stronger embedding or transformer-based classifier, subject to available resources.
3. ScamShield pipeline with explanation and safe-action guidance.

## Measures

- Precision, recall and F1 score.
- False-positive rate on legitimate messages.
- Robustness drop between original and AI-rewritten test messages.
- Explanation quality: relevance, factual support, clarity and completeness.
- Response time and resource cost.

## Experimental controls

- Freeze a test set before final model tuning.
- Record dataset provenance and label decisions.
- Use fixed random seeds and configuration files.
- Report confidence intervals or repeated-split variation where feasible.
- Include failure cases and negative findings.

## Definition of success

The product provides a complete user workflow, produces repeatable results, gives explanations tied to the input text, and supports a defensible conclusion about the trade-off between detection performance and user-understandability.
