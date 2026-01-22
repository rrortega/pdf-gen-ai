# PDF Generator Appwrite Function

This Appwrite Function generates PDF documents automatically when a new document is added to the `documents` collection. It uses **Puppeteer** (via a system-installed Chromium) to render HTML templates populated with data using **Handlebars**.

## 🚀 Key Features
- **Asset Inlining**: Automatically inlines CSS, images, and fonts to ensure HTML is self-contained before rendering.
- **Fast Startup**: Uses `@sparticuz/chromium` for optimized browser launch in serverless environments.
- **Template Engine**: Uses Handlebars for flexible logic-based PDF layouts.
- **Secure**: Implements SSRF protection, asset validation, and Signed JWTs.
- **Automated Workflow**:
  1. Triggered on `databases.[id].collections.[id].documents.create`.
  2. Fetches the associated Template.
  3. Merges data and **inlines all external assets**.
  4. Renders PDF via Puppeteer (Sparticuz).
  5. Uploads PDF to Appwrite Storage.
  6. Updates the original Document and creates a Webhook record.

## 🛠️ Installation & Configuration

### 1. Build Settings
The function uses `@sparticuz/chromium` which handles the binary requirements. Standard npm installation is sufficient.

- **Entrypoint:** `src/main.js`
- **Build Commands:** `npm install`

### 2. Environment Variables
Add the following variables to your Function Settings:

| Variable | Description |
| :--- | :--- |
| `APPWRITE_API_KEY` | API Key with required scopes. |
| `NEXT_PUBLIC_APPWRITE_ENDPOINT` | Your Appwrite Endpoint. |
| `NEXT_PUBLIC_APPWRITE_PROJECT_ID` | Your Project ID. |
| `NEXT_PUBLIC_APPWRITE_DATABASE_ID` | Database ID. |
| `JWT_SECRET` | Secret key for PDF signatures. |
| `ASSETS_BASE_URL` | *(Optional)* Base URL to resolve relative assets (Default: `https://cloud.appwrite.io`). |
| `ASSETS_ALLOW_HOSTS` | *(Optional)* Comma-separated whitelist of allowed asset domains. |

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
