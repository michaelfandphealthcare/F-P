# Multimodal evidence method

The premium interface is designed as an evidence-analysis workflow, not as a tool for naming or locating private offenders.

## Real public evidence

The evidence lab links to official material from the FCA, NCSC, UEFA and the University of Reading. A researcher can open a source, capture a redacted screenshot where reuse is permitted, upload it locally and record visible warning features.

The current prototype provides:

- local image preview;
- image dimensions, file size and aspect ratio;
- explicit human annotation of urgency, credentials, payment, links/QR codes, copied branding and unusual senders;
- an explainable weighted visual-risk summary;
- source links and provenance labels.

The annotation is deliberately transparent. It is not presented as a trained computer-vision model. The dissertation should compare human annotations with the text model, then implement OCR or a vision model only if a suitable, ethical dataset and evaluation method are available.

## Location analysis

The project should use police-force-area or regional aggregates from official statistics. It must not infer a person's home address, identify a suspected criminal from an image or treat a spoofed phone number or domain as proof of physical location.

## Image handling rules

- Redact names, account numbers, addresses, passwords and private student details.
- Keep a source URL, publication date and permission/licence note for every external image.
- Store hashes or filenames for the research dataset rather than private message content where possible.
- Keep public case evidence separate from synthetic messages created for model testing.

## Suggested final evaluation

Create a blinded set of redacted screenshots containing legitimate and fraudulent examples across banking, university, sport, delivery and government contexts. Ask two reviewers to annotate warning features independently. Compare agreement using Cohen's kappa, then compare annotations with the model's output using precision, recall, false-positive rate and explanation completeness.
