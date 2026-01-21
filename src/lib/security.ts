import { z } from "zod";

/**
 * Checks if a URL is safe to be used as a webhook callback.
 * Blocks localhost, private IP ranges, and non-http/https protocols.
 * 
 * Note: This is a basic check. For full SSRF protection, DNS resolution
 * should be performed to ensure a domain doesn't resolve to a private IP,
 * but that requires more complex async logic or external libraries.
 */
export function validateWebhookUrl(url: string): boolean {
    try {
        const parsed = new URL(url);

        // 1. Protocol check
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return false;
        }

        const hostname = parsed.hostname;

        // 2. Block localhost/loopback
        if (hostname === 'localhost' || hostname === '::1' || hostname === '0.0.0.0') {
            return false;
        }

        // 3. Block Private IP Ranges (IPv4)
        // 127.0.0.0/8
        if (hostname.startsWith('127.')) return false;
        // 10.0.0.0/8
        if (hostname.startsWith('10.')) return false;
        // 192.168.0.0/16
        if (hostname.startsWith('192.168.')) return false;
        // 172.16.0.0/12 (172.16.x.x - 172.31.x.x)
        if (hostname.startsWith('172.')) {
            const parts = hostname.split('.');
            if (parts.length === 4) {
                const second = parseInt(parts[1], 10);
                if (second >= 16 && second <= 31) return false;
            }
        }
        // 169.254.0.0/16 (Link-local)
        if (hostname.startsWith('169.254.')) return false;

        return true;
    } catch {
        return false;
    }
}

export const webhookSchema = z.string().url().refine(validateWebhookUrl, {
    message: "Invalid webhook URL: Must be a public HTTP/HTTPS URL and not a private network address."
});
