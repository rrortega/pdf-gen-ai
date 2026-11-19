# PDF Generator Appwrite Function

This Appwrite Function generates queued PDF documents from Handlebars templates.
It inlines approved assets, renders with Puppeteer, uploads the result, and
updates the document status.

## Runtime and browser

Use Node.js 22.12 or newer. The function pins Puppeteer 25.18.1, whose supported
Chrome for Testing revision is `157.0.8103.78`; it does **not** combine
`puppeteer-core` with a separately-versioned Chromium binary.

- **Entrypoint:** `src/main.js`
- **Build command:** `npm install`
- **Browser cache:** `.cache/puppeteer` in the function build artifact
- **Optional override:** `PUPPETEER_EXECUTABLE_PATH` only for a verified
  compatible executable

Do not set a Puppeteer skip-download variable unless an executable override is
provided. Normal installation downloads the managed browser into the function
cache.

## Required configuration

| Variable | Description |
| --- | --- |
| `APPWRITE_API_KEY` | API key with required scopes. |
| `NEXT_PUBLIC_APPWRITE_PROJECT_ID` | Appwrite project ID. |
| `NEXT_PUBLIC_APPWRITE_DATABASE_ID` | Database ID. |
| `JWT_SECRET` | Secret for PDF signatures. |

`NEXT_PUBLIC_APPWRITE_ENDPOINT`, `ASSETS_BASE_URL`, and `ASSETS_ALLOW_HOSTS`
remain optional as described by the function source defaults.

## Security boundaries

Template HTML must be a string no larger than 1 MiB before Handlebars compiles
it. The function permits only `data:` and `about:blank` page requests after
asset inlining.

## Payload

```json
{
  "template_id": "unique_template_id",
  "status": "queued",
  "data": "base64_encoded_json_data",
  "user_id": "user_unique_id",
  "name": "My Document Name"
}
```
