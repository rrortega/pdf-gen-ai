/**
 * Data-layer contracts for the self-hosted (postgres) provider.
 *
 * These are module-scoped for the data/storage/queue work unit. The shared
 * src/backend/contracts.ts keeps the provider-wide ports (Principal, Page,
 * ObjectStore, JobQueue); this file adds the row shapes and repositories the
 * template/document routes need. Legacy Appwrite code does not import these.
 */

import type { ObjectStore, PutPdfInput, PresignDownloadInput } from "./contracts";

export type DataDocumentStatus =
  | "queued"
  | "pending"
  | "completed"
  | "failed"
  | "trashed";

/** Minimal SQL executor shared by repositories and the migration runner. */
export interface Queryer {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

/**
 * Row shape mirroring the Appwrite template columns so the route response
 * shaping stays identical between providers. `test_data` is base64-encoded
 * JSON, exactly as the legacy path stores it.
 */
export interface TemplateRow {
  $id: string;
  user_id: string | null;
  title: string;
  description: string | null;
  tags: string[];
  html: string;
  css: string;
  test_data: string;
  orientation: string;
  paper_size: string;
  margin_top: string;
  margin_right: string;
  margin_bottom: string;
  margin_left: string;
  $createdAt: string;
  $updatedAt: string;
}

/**
 * Row shape mirroring the Appwrite document columns. `data` is base64-encoded
 * JSON, as written by the legacy generate route.
 */
export interface DocumentRow {
  $id: string;
  user_id: string;
  template_id: string;
  name: string;
  pdf_file: string | null;
  data: string;
  status: DataDocumentStatus;
  size: number;
  downloads: number;
  signature: string | null;
  error_message: string | null;
  webhook_callback: string | null;
  webhook_response: string | null;
  webhook_retry: number;
  $createdAt: string;
  $updatedAt: string;
}

export interface WebhookDeliveryRow {
  $id: string;
  document_id: string;
  url: string;
  retry: number;
  response: string | null;
  payload: string | null;
  execution_time: number;
  $createdAt: string;
  $updatedAt: string;
}

export interface TemplateListOptions {
  ownerId: string;
  /** Legacy `?base=` lists shared templates owned by nobody. */
  base?: boolean;
  search?: string;
  tags?: string[];
  ids?: string[];
  limit?: number;
  offset?: number;
}

export interface TemplateCreateInput {
  title: string;
  description?: string | null;
  tags?: string[];
  html: string;
  css: string;
  test_data: string;
  orientation: string;
  paper_size: string;
  margin_top: string;
  margin_right: string;
  margin_bottom: string;
  margin_left: string;
}

export interface TemplateUpdateInput {
  title: string;
  tags?: string[];
  css?: string;
  html?: string;
  test_data?: string;
  orientation?: string;
  paper_size?: string;
  margin_top?: string;
  margin_right?: string;
  margin_bottom?: string;
  margin_left?: string;
}

/**
 * Every owner-scoped query filters by `user_id` so one owner can never read,
 * update or delete another owner's row. `get` returns null for missing AND
 * unowned rows; `exists` is the unscoped existence probe routes use to pick
 * between 403 and the legacy not-found behaviour.
 */
export interface TemplateRepository {
  list(options: TemplateListOptions): Promise<{ total: number; rows: TemplateRow[] }>;
  get(ownerId: string, id: string): Promise<TemplateRow | null>;
  exists(id: string): Promise<boolean>;
  getById(id: string): Promise<TemplateRow | null>;
  create(ownerId: string, input: TemplateCreateInput): Promise<TemplateRow>;
  update(ownerId: string, id: string, input: TemplateUpdateInput): Promise<TemplateRow | null>;
  delete(ownerId: string, id: string): Promise<boolean>;
}

export interface DocumentListOptions {
  page: number;
  limit: number;
}

export interface DocumentCreateInput {
  template_id: string;
  name: string;
  data: string;
  status?: DataDocumentStatus;
  size?: number;
  downloads?: number;
  pdf_file?: string | null;
  signature?: string | null;
  error_message?: string | null;
  webhook_callback?: string | null;
  webhook_response?: string | null;
  webhook_retry?: number;
}

export interface DocumentUpdatePatch {
  status?: DataDocumentStatus;
  pdf_file?: string | null;
  size?: number;
  signature?: string | null;
  error_message?: string | null;
  webhook_response?: string | null;
  webhook_retry?: number;
}

export interface DocumentRepository {
  list(ownerId: string, options: DocumentListOptions): Promise<{ total: number; rows: DocumentRow[] }>;
  /** Dashboard-stats scan: includes trashed rows, newest first. */
  listForStats(ownerId: string, limit: number): Promise<DocumentRow[]>;
  get(ownerId: string, id: string): Promise<DocumentRow | null>;
  exists(id: string): Promise<boolean>;
  create(ownerId: string, input: DocumentCreateInput): Promise<DocumentRow>;
  update(ownerId: string, id: string, patch: DocumentUpdatePatch): Promise<DocumentRow | null>;
  trash(ownerId: string, id: string): Promise<boolean>;
  incrementDownloads(ownerId: string, id: string): Promise<void>;
  /** Download-counter increment for signature-authenticated downloads. */
  incrementDownloadsById(id: string): Promise<void>;
  /**
   * System-principal access for the background worker. NEVER exposed through
   * an HTTP route: the worker runs server-side without an end-user principal.
   */
  getById(id: string): Promise<DocumentRow | null>;
  /** System-principal update for the background worker. */
  updateById(id: string, patch: DocumentUpdatePatch): Promise<void>;
}

export interface WebhookDeliveryCreateInput {
  document_id: string;
  url: string;
  retry?: number;
  response?: string | null;
  payload?: string | null;
  execution_time?: number;
}

export interface WebhookDeliveryUpdateInput {
  retry?: number;
  response?: string | null;
  payload?: string | null;
  execution_time?: number;
}

export interface WebhookDeliveryRepository {
  create(input: WebhookDeliveryCreateInput): Promise<WebhookDeliveryRow>;
  update(id: string, patch: WebhookDeliveryUpdateInput): Promise<WebhookDeliveryRow | null>;
}

export interface DataRepositories {
  templates: TemplateRepository;
  documents: DocumentRepository;
  webhooks: WebhookDeliveryRepository;
}

/** BullMQ generation payload handed from the route to the worker. */
export interface GenerationJobPayload {
  documentId: string;
}

/** BullMQ webhook payload handed from the worker to itself. */
export interface WebhookDeliveryJobPayload {
  documentId: string;
  /** The webhook_deliveries row recording this delivery. */
  deliveryId: string;
  url: string;
  payload: Record<string, unknown>;
}

/**
 * Queue port for the data work unit. The shared contracts.JobQueue port stays
 * untouched; this extends it with the payload the generation worker needs.
 */
export interface DataJobQueue {
  enqueueGeneration(input: GenerationJobPayload): Promise<{ id: string }>;
  enqueueWebhookDelivery(input: WebhookDeliveryJobPayload): Promise<{ id: string }>;
  close(): Promise<void>;
}

export type { ObjectStore, PutPdfInput, PresignDownloadInput };
