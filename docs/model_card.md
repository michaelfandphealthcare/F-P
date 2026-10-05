# ScamShield Baseline Model Card

## Intended use

Educational research into explainable phishing-message classification and robustness to AI-assisted rewriting.

## Not intended for

Production filtering, financial decisions, legal decisions, emergency response or automated blocking.

## Data

The initial repository dataset is a small demonstration dataset containing public-style or fictional messages. It is not sufficient for a production claim and must be replaced or expanded for the final evaluation.

## Limitations

The model may overfit the demonstration data, confuse legitimate urgent messages with scams, miss new scam styles and perform differently across languages or communities.

## Human oversight

Users should verify important requests through an independent trusted route. The system is a second opinion, not an authority.

## Current implementation

`contextual-baseline-v5` combines the original TF-IDF-style NumPy baseline with clause-aware conservative phrase rules. It detects authentication-code disclosure, changed-contact family impersonation, payment pressure and attempts to discourage independent verification. A support term such as “IT team” is evidence only when it is paired with a sensitive action request. Negations, preventative advice and quoted educational examples are separated from actionable requests, while a malicious instruction in another clause remains detectable. Each warning includes an exact excerpt from the submitted input. The 0–100 output is a screening score, not a calibrated probability. No domain reputation, logo authentication, face recognition or live URL fetch is performed.

## Reproducible evaluation

The held-out set is `data/heldout_messages.csv`, with the measured summary in `data/evaluation_results.json`. Run `python3 -m src.evaluate` to reproduce both checked-in JSON exports. The held-out set covers legitimate banking, university, healthcare, ticketing, conversation and awareness messages plus credential theft, family impersonation, healthcare payment, university impersonation and ticket deadline scams. It contains only 12 hand-curated messages, so its 12/12 result is evidence of this test run—not evidence of generalisation. The 24-message challenge set is a development regression set after known failures were corrected against it; its result must not be presented as independent confirmation.

## Additional limitations

- No calibrated probability, domain-age lookup or malicious-site verification.
- English-only, short-message evaluation.
- OCR quality depends on the browser OCR library and image quality.
- No permanent storage of submitted messages or images is implemented by the prototype.
