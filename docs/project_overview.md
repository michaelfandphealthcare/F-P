# ScamShield project overview

ScamShield is a Level 6 Computer Science project by Osita Michael. It is a controlled academic prototype that helps a non-technical user inspect a suspicious email or SMS before acting on it.

The project focuses on explainable phishing and scam-message detection. It identifies warning signals such as urgency, impersonation, requests for credentials, payment requests and suspicious links. It then explains the result in plain English and recommends a safer next step. The result is a screening signal, not proof of fraud or a calibrated probability.

## The problem

Phishing messages are designed to look trustworthy and create pressure. They may imitate a bank, university, healthcare provider, delivery service or ticketing organisation. Generative AI can make these messages fluent and convincing, so spelling mistakes alone are not a dependable detection method.

ScamShield addresses the narrower and measurable problem of helping a user pause, inspect the message and verify an important request independently.

## The research question

How effectively can an explainable machine-learning system detect phishing messages that have been rewritten to sound more convincing, while providing explanations that non-technical users can understand?

## The working prototype

The application has three connected areas:

- **Scanner:** paste a message, analyse it, review the warning signals and choose a safer next step.
- **Evidence lab:** preview a redacted screenshot locally, extract visible text with browser OCR, edit the extracted text and record transparent human annotations.
- **Research dashboard:** distinguish official public context, synthetic demonstration scenarios and measured model evaluation.

The current implementation uses a contextual baseline combining TF-IDF-style features with conservative phrase rules. The explanation layer is designed to avoid treating ordinary words as evidence and to distinguish safety advice or quoted examples from direct requests for credentials or payment.

## Evidence and evaluation

The current held-out result uses 12 messages: 7 legitimate and 5 phishing. It reports precision 1.000, recall 1.000, F1 1.000, zero false alarms and zero missed scams. A separate 24-message development regression set currently has 12 correct legitimate decisions and 12 detected scams. This second set is not independent evidence because two known live failures were used to improve the contextual rules. Both sets are hand-authored and are not evidence of real-world accuracy. The final study should add independently sourced examples, freeze larger validation and final test splits before tuning, include rewritten variants, record failure cases and assess explanation quality. The current rules build is `contextual-baseline-v5`; its regression tests include changed-number family impersonation, discouraged verification, legitimate security guidance, quoted examples, mixed protective and malicious instructions, authentication-code disclosure, login approval and exact evidence excerpts.

Public figures in the dashboard are source-linked context. Synthetic scenario bars are clearly labelled and are not national crime statistics or claims that a named organisation was breached.

## Privacy and ethical scope

ScamShield does not connect to live email, banking or inbox accounts, visit links, verify domains, identify faces or infer an offender’s location. It uses fictional, public or redacted examples. It does not create or distribute live phishing campaigns. Any future participant study requires the university ethics process before recruitment.

## Supporting documentation

- `docs/model_card.md` — intended use, data, implementation and limitations.
- `docs/evaluation_plan.md` — research question, metrics, controls and success criteria.
- `docs/data_provenance.md` — separation of official context from synthetic research data.
- `docs/multimodal_evidence_method.md` — screenshot, OCR and annotation method.
- `docs/ethics_and_scope.md` — privacy, safety and participant boundaries.
- `outputs/ScamShield_Project_Overview_Updated.docx` — assessor-facing introduction to the project.
