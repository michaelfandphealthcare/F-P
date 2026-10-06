# Privacy and capability audit — 5 October 2026

## Verified implementation behaviour

- Pasted message text is sent in the body of a same-origin `POST /api/analyse` request.
- The application does not write submitted message text or uploaded screenshot/recording bytes to files or a database.
- The Python server's default request log records request metadata, not the submitted request body.
- Uploaded screenshots are previewed with a browser data URL. Uploaded recordings are previewed with a temporary browser object URL. Neither media type is uploaded by the application.
- Screenshot OCR and sampled recording-frame OCR run in the browser through Tesseract.js. The library and language/worker assets can be fetched from a CDN, so the application must not claim that OCR is fully offline.
- A recording is limited to 60 seconds and sampled at four to seven frames. Duplicate OCR lines are combined; this is not continuous video understanding and can miss short-lived content.
- When the user selects “Analyse extracted conversation”, the reviewed extracted text—not the screenshot or recording—is sent to `/api/analyse` for the current result.
- Feedback counts are stored in browser `localStorage`; message contents are not stored there.
- “Check patterns” parses the address locally and does not navigate to or fetch it.
- “Check online” sends only the supplied public URL to `POST /api/link-inspect`. The server resolves public DNS and requests response metadata from the public site. It blocks local, private, reserved and non-standard-port targets, revalidates redirects and does not analyse the response body.

## Correct public wording

The interface now states that text is sent to the ScamShield server for the current request and that the application has no message database or inbox connection. It describes OCR as browser-local processing, while clarifying that analysed extracted text is sent to the service. The optional online URL check is described as public reachability and response metadata—not domain reputation, malware analysis or proof of safety.

## Remaining operational boundary

Hosting infrastructure may retain ordinary access logs according to the provider's settings. That is separate from application-level message storage and should be covered in a deployment privacy notice before processing real personal data.
