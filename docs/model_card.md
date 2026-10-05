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

`contextual-baseline-v4` combines the original TF-IDF-style NumPy baseline with clause-aware conservative phrase rules. It explicitly tests authentication-code disclosure and support/helpdesk impersonation, separates negations and protective advice from actionable requests, and can still detect a malicious instruction in a different clause. Each displayed reason includes the matched phrase and a contextual interpretation. Ordinary words are not reasons. No domain reputation, logo authentication, face recognition or live URL fetch is performed.

## Reproducible evaluation

The held-out set is `data/heldout_messages.csv`, with the measured summary in `data/evaluation_results.json`. Run `python3 -m src.evaluate` to reproduce it. The set covers legitimate banking, university, healthcare, ticketing, conversation and awareness messages plus credential theft, family impersonation, healthcare payment, university impersonation and ticket deadline scams. It is small and hand-curated, so the result is evidence of a test run—not evidence of generalisation.

## Additional limitations

- No calibrated probability, domain-age lookup or malicious-site verification.
- English-only, short-message evaluation.
- OCR quality depends on the browser OCR library and image quality.
- No permanent storage of submitted messages or images is implemented by the prototype.
