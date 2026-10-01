# ScamShield

ScamShield is a final-year computer science project exploring whether an explainable text-classification system can help non-technical users recognise phishing and scam messages, including messages rewritten to sound more convincing.

## Project boundary

This is a controlled academic prototype. It analyses pasted fictional or public message text only. It does not connect to email accounts, send messages, visit links, make financial decisions or replace human judgement.

## Current prototype

The first vertical slice uses a transparent TF-IDF-style classifier implemented with Python and NumPy, together with a rule-based explanation layer. This keeps the baseline reproducible and makes the system's reasoning inspectable. The next research iterations should add a stronger embedding-based comparison, a documented dataset, adversarial/AI-rewritten test variants and the full evaluation report.

The interface also includes a research dashboard and a multimodal evidence lab. The evidence lab previews redacted screenshots locally and records transparent human annotations for visible warning signs. Its evidence cards link to public UK sources, while its charts are explicitly labelled synthetic demonstration data or official context. This prevents the project from presenting fictional test scenarios as claims about real banks, universities, football clubs or other named organisations. See `docs/data_provenance.md` and `docs/multimodal_evidence_method.md`.

## Run locally

```bash
python3 src/server.py
```

Open `http://127.0.0.1:8000` in a browser.

## Publish with GitHub and Render

1. Upload this project to the `michaelfandphealthcare/F-P` repository.
2. In Render, choose **New Web Service** and connect that repository.
3. Render will use `render.yaml`, install `requirements.txt` and start the Python server.
4. Set the service's port handling if required by the hosting provider before publishing.

The public version should use fictional/public evidence only. Do not enable permanent storage of uploaded private images without a privacy notice, consent and deletion controls.

## Research evidence to collect

- Dataset provenance and cleaning decisions
- Fixed train/test split
- Baseline and improved-model metrics
- Original versus AI-rewritten robustness results
- Explanation-quality rubric
- Usability or expert-review evidence
- Threat model, ethics record and risk updates

See `docs/evaluation_plan.md`, `docs/ethics_and_scope.md` and `docs/model_card.md`.
