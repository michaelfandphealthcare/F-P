# ScamShield

ScamShield is a final-year computer science project exploring whether an explainable text-classification system can help non-technical users recognise phishing and scam messages, including messages rewritten to sound more convincing.

For a clean first explanation of the project, see [`docs/project_overview.md`](docs/project_overview.md) and the assessor-facing [Project Overview document](outputs/ScamShield_Project_Overview_Updated.docx).

## Project boundary

This is a controlled academic prototype. It analyses pasted fictional or public message text only. It does not connect to email accounts, send messages, visit links, make financial decisions or replace human judgement.

## Current prototype

The current vertical slice uses a transparent TF-IDF-style classifier implemented with Python and NumPy, together with a contextual rule layer. The rules look for phrases that combine an action with a credential, payment, link, urgency or trusted-service reference. Negated advice such as “never share your password” and quoted scam examples are treated as awareness content rather than requests. Explanations quote the observed phrase and state what it means; the score is a screening signal, not calibrated probability.

The interface also includes a research dashboard and a multimodal evidence lab. The evidence lab previews redacted screenshots locally and records transparent human annotations for visible warning signs. Its evidence cards link to public UK sources, while its charts are explicitly labelled synthetic demonstration data or official context. This prevents the project from presenting fictional test scenarios as claims about real banks, universities, football clubs or other named organisations. See `docs/data_provenance.md` and `docs/multimodal_evidence_method.md`.

The current interface is published at https://scamshield-dahk.onrender.com/.

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

## Reproduce the held-out evaluation

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m src.evaluate
.venv/bin/python -m unittest -v tests.test_core tests.test_dashboard tests.test_evaluation
```

The checked-in result is `data/evaluation_results.json`. It contains a small, hand-curated held-out set and must not be presented as real-world accuracy. The current test run reports precision 1.000, recall 0.800 and F1 0.889, with 1 missed scam; the limitations are shown in the Research dashboard.
