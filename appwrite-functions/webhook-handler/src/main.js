import { Client, TablesDB } from 'node-appwrite';

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
    const db = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
    const WEBHOOKS_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_WEBHOOK_COLLECTION_ID || "webhooks";
    const DOCUMENTS_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_DOCUMENTS_COLLECTION_ID || "documents";
    const MAX_RETRIES = parseInt(process.env.WEBHOOK_MAXIMUM_RETRY || "3", 10);

    if (!API_KEY || !PROJECT_ID || !db) {
        error("Missing required environment variables.");
        return res.json({ success: false, error: "Configuration error" }, 500);
    }

    // 1. Initialize Client
    const client = new Client()
        .setEndpoint(ENDPOINT)
        .setProject(PROJECT_ID)
        .setKey(API_KEY);

    const tables = new TablesDB(client);

    try {
        // 2. Parse Payload from Event
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
        const payloadData = document.payload;
        const currentRetry = document.retry || 0;
        const currentStatus = document.status || 'pending';

        // GUARD: Check if we should process
        if (currentStatus === 'delivered' || currentStatus === 'failed') {
            log(`Webhook ${webhookId} already in final state: ${currentStatus}. Skipping.`);
            return res.json({ success: true, message: `Skipped: Status is ${currentStatus}` });
        }

        if (currentRetry >= MAX_RETRIES) {
            log(`Webhook ${webhookId} has reached max retries (${currentRetry}/${MAX_RETRIES}). Marking as failed.`);
            await tables.updateRow({
                databaseId: db,
                tableId: WEBHOOKS_COLLECTION_ID,
                rowId: webhookId,
                data: { status: 'failed' }
            });
            return res.json({ success: false, error: "Max retries reached" });
        }

        // New Requirement: Delay for retries
        if (currentRetry > 0) {
            log(`Retry attempt #${currentRetry}. Waiting 30 seconds before delivery...`);
            await new Promise(resolve => setTimeout(resolve, 30000));
        }

        log(`Delivering webhook ${webhookId} to: ${targetUrl} (Attempt ${currentRetry + 1}/${MAX_RETRIES})`);

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
                signal: AbortSignal.timeout(30000)
            });

            statusCode = response.status;
            success = response.ok;

            try {
                const text = await response.text();
                try {
                    responseData = JSON.parse(text);
                } catch {
                    responseData = text.slice(0, 1000);
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

        // 4. Update Webhook Record
        const nextRetry = currentRetry + 1;
        let finalStatus = currentStatus;

        if (success) {
            finalStatus = 'delivered';
        } else if (nextRetry >= MAX_RETRIES) {
            finalStatus = 'failed';
        } else {
            finalStatus = 'pending'; // Keep as pending for next trigger
        }

        await tables.updateRow({
            databaseId: db,
            tableId: WEBHOOKS_COLLECTION_ID,
            rowId: webhookId,
            data: {
                response: responseString,
                execution_time: executionTime,
                status: finalStatus,
                retry: nextRetry
            }
        });

        // 5. Update Original Document Record
        if (document.document_id) {
            try {
                await tables.updateRow({
                    databaseId: db,
                    tableId: DOCUMENTS_COLLECTION_ID,
                    rowId: document.document_id,
                    data: {
                        webhook_response: responseString,
                        webhook_retry: nextRetry
                    }
                });
                log(`Document ${document.document_id} updated with webhook result.`);
            } catch (docErr) {
                error(`Failed to update document ${document.document_id}: ${docErr.message}`);
            }
        }

        log(`Webhook record updated to ${finalStatus}. Execution time: ${executionTime}ms`);

        return res.json({
            success: success,
            status: statusCode,
            execution_time: executionTime,
            final_status: finalStatus
        });

    } catch (err) {
        error(`Global error in webhook handler: ${err.message}`);
        return res.json({ success: false, error: err.message }, 500);
    }
};
