import { Client, Databases } from 'node-appwrite';

/**
 * Appwrite Function: Webhook Handler
 * 
 * This function triggers on a database document create event in the 'webhooks' collection.
 * It delivers the payload to the specified URL via HTTP POST.
 */
// eslint-disable-next-line import/no-anonymous-default-export
export default async ({ req, res, log, error }) => {
    // 0. Environment Check
    const API_KEY = process.env.APPWRITE_API_KEY;
    const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
    const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
    const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
    const WEBHOOKS_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_WEBHOOK_COLLECTION_ID || "webhooks";
    const DOCUMENTS_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_DOCUMENTS_COLLECTION_ID || "documents";

    if (!API_KEY || !PROJECT_ID || !DATABASE_ID) {
        error("Missing required environment variables.");
        return res.json({ success: false, error: "Configuration error" }, 500);
    }

    // 1. Initialize Client
    const client = new Client()
        .setEndpoint(ENDPOINT)
        .setProject(PROJECT_ID)
        .setKey(API_KEY);

    const db = new Databases(client);

    try {
        // 2. Parse Payload from Event
        // This function is intended to be triggered by: 
        // databases.[DATABASE_ID].collections.[WEBHOOKS_COLLECTION_ID].documents.[DOCUMENT_ID].create
        let document = req.body;
        if (typeof document === 'string') {
            try { document = JSON.parse(document); } catch { }
        }

        if (!document || !document.url) {
            log("Invalid trigger or missing URL. Expected a webhook record.");
            return res.json({ success: true, message: "Ignored: No URL" });
        }

        const webhookId = document.$id;
        const targetUrl = document.url;
        const payloadData = document.payload; // Should be a JSON string as per pdf-generator

        log(`Delivering webhook ${webhookId} to: ${targetUrl}`);

        const startTime = Date.now();
        let responseData = null;
        let statusCode = 0;
        let success = false;

        try {
            // 3. Send HTTP POST Request
            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'PDFGenAI-Webhook-Handler/1.0',
                    'X-PDFGenAI-Webhook-Id': webhookId
                },
                body: payloadData,
                // Timeout after 30 seconds
                signal: AbortSignal.timeout(30000)
            });

            statusCode = response.status;
            success = response.ok;

            try {
                // Try to parse as JSON, otherwise get text
                const text = await response.text();
                try {
                    responseData = JSON.parse(text);
                } catch {
                    responseData = text.slice(0, 1000); // Truncate long non-JSON responses
                }
            } catch {
                responseData = "No response body";
            }

            log(`Webhook delivered. Status: ${statusCode}`);
        } catch (fetchErr) {
            error(`Fetch error: ${fetchErr.message}`);
            responseData = `Error: ${fetchErr.message}`;
            statusCode = 0;
            success = false;
        }

        const executionTime = Date.now() - startTime;
        const responseString = typeof responseData === 'object' ? JSON.stringify(responseData) : String(responseData);

        // 4. Update Webhook Record with Result
        await db.updateDocument(
            DATABASE_ID,
            WEBHOOKS_COLLECTION_ID,
            webhookId,
            {
                response: responseString,
                execution_time: executionTime,
                status: success ? 'delivered' : 'failed'
            }
        );

        // 5. Update Original Document Record
        if (document.document_id) {
            try {
                await db.updateDocument(
                    DATABASE_ID,
                    DOCUMENTS_COLLECTION_ID,
                    document.document_id,
                    {
                        webhook_response: responseString,
                        webhook_retry: (document.retry || 0) + 1
                    }
                );
                log(`Document ${document.document_id} updated with webhook result.`);
            } catch (docErr) {
                error(`Failed to update document ${document.document_id}: ${docErr.message}`);
            }
        }

        log(`Webhook record updated. Execution time: ${executionTime}ms`);

        return res.json({
            success: success,
            status: statusCode,
            execution_time: executionTime
        });

    } catch (err) {
        error(`Global error in webhook handler: ${err.message}`);
        return res.json({ success: false, error: err.message }, 500);
    }
};
