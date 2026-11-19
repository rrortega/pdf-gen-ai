/** A caller identity shared by legacy and self-hosted backend adapters. */
export interface Principal {
  id: string;
  email: string;
  name?: string;
  isApiKey?: boolean;
}

/** A paginated provider result. */
export interface Page<T> {
  total: number;
  items: T[];
}

export interface RegistrationInput {
  email: string;
  password: string;
  name?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RecoveryRequestInput {
  email: string;
  redirectUrl: string;
}

export interface RecoveryConfirmationInput {
  userId: string;
  secret: string;
  password: string;
}

export interface ApiKey {
  id: string;
  name?: string;
  createdAt: string;
}

export interface CreatedApiKey extends ApiKey {
  /** The plaintext value is returned only when the key is created. */
  secret: string;
}

/**
 * Authentication port for both provider adapters. Route code owns cookie and
 * response formatting; adapters only perform the backend authentication work.
 */
export interface AuthProvider {
  register(input: RegistrationInput): Promise<Principal>;
  login(input: LoginInput): Promise<Principal>;
  current(): Promise<Principal | null>;
  logout(): Promise<void>;
  requestRecovery(input: RecoveryRequestInput): Promise<void>;
  confirmRecovery(input: RecoveryConfirmationInput): Promise<void>;
  createApiKey(input?: { name?: string }): Promise<CreatedApiKey>;
  listApiKeys(): Promise<Page<ApiKey>>;
  revokeApiKey(id: string): Promise<void>;
}

export interface PutPdfInput {
  key: string;
  body: Uint8Array;
  contentType?: string;
}

export interface PresignDownloadInput {
  key: string;
  expiresInSeconds?: number;
}

/** Object storage port for generated PDFs. */
export interface ObjectStore {
  putPdf(input: PutPdfInput): Promise<{ key: string }>;
  delete(key: string): Promise<void>;
  presignDownload(input: PresignDownloadInput): Promise<string>;
}

export interface GenerationJob {
  documentId: string;
  templateId: string;
  requestedBy: Principal;
}

export interface WebhookJob {
  url: string;
  payload: Record<string, unknown>;
}

export interface EnqueuedJob {
  id: string;
}

/** Queue port for background generation and webhook delivery. */
export interface JobQueue {
  enqueueGeneration(input: GenerationJob): Promise<EnqueuedJob>;
  enqueueWebhook(input: WebhookJob): Promise<EnqueuedJob>;
}
