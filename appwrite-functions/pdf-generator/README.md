# PDF Generator Appwrite Function

This Appwrite Function generates PDF documents automatically when a new document is added to the `documents` collection. It uses **Puppeteer** (via a system-installed Chromium) to render HTML templates populated with data using **Handlebars**.

## 🚀 Key Features
- **Partial Prerendering Safe**: Designed to work within Appwrite's serverless environment (Alpine Linux).
- **Template Engine**: Uses Handlebars for flexible logic-based PDF layouts.
- **Secure**: Implements SSRF protection and uses Signed JWTs for document verification.
- **Automated Workflow**:
  1. Triggered on `databases.[id].collections.[id].documents.create`.
  2. Fetches the associated Template.
  3. Merges data and renders PDF.
  4. Uploads PDF to Appwrite Storage.
  5. Updates the original Document with the `fileId` and `signature`.

## 🛠️ Installation & Configuration

### 1. Build Settings (CRITICAL)
Because Appwrite Functions run on **Alpine Linux**, standard npm packages for Chromium do not work. You **MUST** install Chromium via the OS package manager during the build.

**In your Appwrite Console > Function > Settings > Build Settings:**

- **Entrypoint:** `src/main.js`
- **Build Commands:**
  ```bash
  apk add --no-cache chromium chromium-chromedriver && npm install
  ```

### 2. Environment Variables
Add the following variables to your Function Settings:

| Variable | Description |
| :--- | :--- |
| `APPWRITE_API_KEY` | API Key with scopes: `documents.read`, `documents.write`, `files.write`. |
| `NEXT_PUBLIC_APPWRITE_ENDPOINT` | Your Appwrite Endpoint (e.g., `https://cloud.appwrite.io/v1`). |
| `NEXT_PUBLIC_APPWRITE_PROJECT_ID` | Your Project ID. |
| `NEXT_PUBLIC_APPWRITE_DATABASE_ID` | Database ID containing Templates/Documents. |
| `JWT_SECRET` | Secret key used to sign the generated PDF signature. |
| `CHROMIUM_PATH` | *(Optional)* Default is `/usr/bin/chromium-browser`. Only set if you need to override the binary path. |

### 3. Events
Configure the function to trigger on the following event:
- `databases.[DATABASE_ID].collections.[DOCUMENTS_COLLECTION_ID].documents.create`

## 📦 Dependencies
- `node-appwrite`: ^21.1.0 (Using subpath import `node-appwrite/file` for file uploads)
- `puppeteer-core`: Headless browser control.
- `handlebars`: HTML templating.
- `jose`: JWT signing.

## 🐛 Troubleshooting

### "Failed to launch the browser process" / "__res_init: symbol not found"
This indicates a binary mismatch. Ensure you are using the **Build Command** specified above (`apk add ...`) and that you are **NOT** importing `@sparticuz/chromium` in your code (the code is already patched to use the system chromium).

### "InputFile is not a constructor"
Ensure you are using `node-appwrite` v21+ and importing it correctly:
```javascript
import { InputFile } from 'node-appwrite/file';
```

## 📝 Usage Data Payload
When creating a document in the `documents` collection, structure your payload like this:

```json
{
  "template_id": "unique_template_id",
  "status": "queued",
  "data": "base64_encoded_json_data",
  "user_id": "user_unique_id",
  "name": "My Document Name"
}
```
The function will pick this up, generate the PDF, and update the status to `completed` (or `failed`).
