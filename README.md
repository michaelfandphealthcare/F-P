# ScamShield

ScamShield is a final-year computer science project exploring whether an explainable text-classification system can help non-technical users recognise phishing and scam messages, including messages rewritten to sound more convincing.

For a clean first explanation of the project, see [`docs/project_overview.md`](docs/project_overview.md) and the assessor-facing [Project Overview document](outputs/ScamShield_Project_Overview_Updated.docx).

## Project boundary

This is a controlled academic prototype. It analyses pasted fictional or public message text only. It does not connect to email accounts, send messages, visit links, make financial decisions or replace human judgement.

## Current prototype

The current vertical slice uses a transparent TF-IDF-style classifier implemented with Python and NumPy, together with a contextual rule layer. The rules look for phrases that combine an action with a credential, payment, link, urgency or trusted-service reference. Negated advice such as “never share your password” and quoted scam examples are treated as awareness content rather than requests. Explanations quote the observed phrase and state what it means; the score is a screening signal, not calibrated probability.

The interface also includes a research dashboard and a multimodal evidence lab. The evidence lab accepts redacted chat screenshots and short screen recordings. Screenshots are read with browser-side OCR; recordings are previewed locally, sampled at four to seven frames and passed through the same browser-side OCR before duplicate lines are combined. The user must review or correct the resulting text before sending that text—not the media file—for analysis. A demonstration library contains 20 random screenshot examples and 12 short recording examples, balanced across synthetic scam and legitimate cases; recording demonstrations use the real sampled-frame OCR path rather than inserting pre-supplied text. The lab also records transparent human annotations for visible warning signs. Its evidence cards link to public UK sources, while its charts are explicitly labelled synthetic demonstration data or official context. This prevents the project from presenting fictional test scenarios as claims about real banks, universities, football clubs or other named organisations. See `docs/data_provenance.md` and `docs/multimodal_evidence_method.md`.

The current interface is published at https://scamshield-dahk.onrender.com/.
Deployed verification endpoints are `/health` and `/api/meta`; they expose the non-secret build identifier and model version so a release can be checked without exposing credentials.

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

The checked-in result is `data/evaluation_results.json`. It contains a small, hand-curated held-out set and must not be presented as real-world accuracy. After correcting the unexplained false-alarm path, the current reproducible run reports precision 1.000, recall 1.000 and F1 1.000 on 12 messages, with 0 false alarms and 0 missed scams. This perfect result is not evidence of real-world reliability; the dashboard explains the small sample and validation limitations.

The current rules build is `contextual-baseline-v5`, using a 36/100 screening-score threshold. The regression suite covers clause-level negation, mixed protective and malicious instructions, helpdesk authentication-code requests, changed-number family impersonation, discouraged verification, protective security advice, complete monetary amounts and exact supporting excerpts. A separate 24-message development challenge set is retained for regression checks. Because known failures have now been corrected against it, it is not described as an independent final test set.
