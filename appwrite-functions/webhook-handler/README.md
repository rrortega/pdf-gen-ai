# Webhook Handler Function

This Appwrite Function is responsible for delivering asynchronous webhooks to third-party endpoints. It decouples the notification process from the core PDF generation logic.

## 🚀 Features

- **Asynchronous Delivery**: Processed independently from PDF generation.
- **Detailed Logging**: Records response status, body, and execution time in the `webhooks` collection.
- **Robustness**: Includes built-in timeouts and error handling.

## ⚙️ Trigger Configuration

This function should be configured to trigger on the following event:

- `databases.*.collections.webhooks.documents.*.create`

## 🛠️ Environment Variables

The following variables must be configured in the Appwrite Console:

| Variable | Description |
|----------|-------------|
| `APPWRITE_API_KEY` | Appwrite API Key with Read/Write permissions for Databases. |
| `NEXT_PUBLIC_APPWRITE_ENDPOINT` | Your Appwrite endpoint (e.g., `https://cloud.appwrite.io/v1`). |
| `NEXT_PUBLIC_APPWRITE_PROJECT_ID` | Your Appwrite Project ID. |
| `NEXT_PUBLIC_APPWRITE_DATABASE_ID` | The ID of the database containing the `webhooks` collection. |
| `NEXT_PUBLIC_APPWRITE_WEBHOOK_COLLECTION_ID` | The ID of the `webhooks` collection (defaults to `webhooks`). |

## 📦 Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set up environment variables in a `.env` file (see `.env.sample`).
3. Deploy using Appwrite CLI:
   ```bash
   appwrite deploy function
   ```
