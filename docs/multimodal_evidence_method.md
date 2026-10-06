# Multimodal evidence method

The premium interface is designed as an evidence-analysis workflow, not as a tool for naming or locating private offenders.

## Real public evidence

The evidence lab links to official material from the FCA, NCSC, UEFA and the University of Reading. A researcher can open a source, capture a redacted screenshot where reuse is permitted, upload it locally and record visible warning features.

The current prototype provides:

- local screenshot and screen-recording preview;
- PNG, JPG and WebP screenshots up to 8 MB;
- MP4, WebM and MOV recordings up to 50 MB and 60 seconds, subject to browser codec support;
- image dimensions, recording dimensions, duration and file size;
- browser-side OCR for screenshots;
- browser-side extraction of four to seven representative recording frames, OCR of each frame and exact-line deduplication;
- an editable extracted-text step before any analysis request;
- a clearly labelled demonstration library with 20 synthetic screenshots and 12 synthetic recordings (six scam and six legitimate), where recording examples still use sampled-frame OCR;
- explicit human annotation of urgency, credentials, payment, links/QR codes, copied branding and unusual senders;
- an explainable weighted visual-risk summary;
- source links and provenance labels.

The annotation is deliberately transparent. It is not presented as a trained computer-vision model. Recording analysis does not inspect every video frame or recognise faces: it samples a small number of frames and extracts visible text. OCR errors, missed transient messages and repeated lines remain possible, so the editable review step is mandatory. The dissertation should evaluate screenshot OCR and recording-frame OCR independently before making performance claims.

## Location analysis

The project should use police-force-area or regional aggregates from official statistics. It must not infer a person's home address, identify a suspected criminal from an image or treat a spoofed phone number or domain as proof of physical location.

## Media handling rules

- Redact names, account numbers, addresses, passwords and private student details.
- Keep a source URL, publication date and permission/licence note for every external image.
- Store hashes or filenames for the research dataset rather than private message content where possible.
- Keep public case evidence separate from synthetic messages created for model testing.
- Do not claim full recording coverage: the current implementation samples four to seven frames rather than analysing every frame.
- Do not treat OCR text as authoritative. Preserve the reviewed text and record whether it came from a screenshot, recording or synthetic example.
- Keep the random demonstrations visibly labelled as synthetic and separate from independent evaluation evidence.

## Suggested final evaluation

Create a blinded set of redacted screenshots containing legitimate and fraudulent examples across banking, university, sport, delivery and government contexts. Ask two reviewers to annotate warning features independently. Compare agreement using Cohen's kappa, then compare annotations with the model's output using precision, recall, false-positive rate and explanation completeness.
