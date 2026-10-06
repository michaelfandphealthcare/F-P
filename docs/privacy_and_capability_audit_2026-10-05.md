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
- The link inspector parses text locally and does not navigate to or fetch the supplied address.

## Correct public wording

The interface now states that text is sent only for the current analysis and is not stored by the app. It describes OCR as browser-local processing, while clarifying that analysed extracted text is sent to the service. It does not claim an inbox connection, live URL reputation or guaranteed privacy outside the documented implementation boundary.

## Remaining operational boundary

Hosting infrastructure may retain ordinary access logs according to the provider's settings. That is separate from application-level message storage and should be covered in a deployment privacy notice before processing real personal data.
