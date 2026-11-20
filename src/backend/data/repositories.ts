import type { DataRepositories } from "../data-contracts";
import { createPostgresTemplateRepository } from "../postgres/templates";
import { createPostgresDocumentRepository } from "../postgres/documents";
import { createPostgresWebhookDeliveryRepository } from "../postgres/webhooks";

/**
 * Lazily wires the postgres repositories. Callers must only invoke this when
 * BACKEND_PROVIDER=postgres; construction itself never opens a connection.
 */
export function getDataRepositories(): DataRepositories {
  return {
    templates: createPostgresTemplateRepository(),
    documents: createPostgresDocumentRepository(),
    webhooks: createPostgresWebhookDeliveryRepository(),
  };
}
