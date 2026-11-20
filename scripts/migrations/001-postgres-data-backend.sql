-- Self-hosted PostgreSQL backend for templates, documents and webhook deliveries.
-- Idempotent: safe to run repeatedly (every statement uses IF NOT EXISTS).
--
-- Field names mirror the legacy Appwrite columns so the API responses stay
-- identical between BACKEND_PROVIDER=appwrite and BACKEND_PROVIDER=postgres.

CREATE TABLE IF NOT EXISTS templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text,
    title text NOT NULL,
    description text,
    tags text[] NOT NULL DEFAULT '{}',
    html text NOT NULL DEFAULT '',
    css text NOT NULL DEFAULT '',
    test_data text NOT NULL DEFAULT '',
    orientation text NOT NULL DEFAULT 'portrait',
    paper_size text NOT NULL DEFAULT 'A4',
    margin_top text NOT NULL DEFAULT '20mm',
    margin_right text NOT NULL DEFAULT '20mm',
    margin_bottom text NOT NULL DEFAULT '20mm',
    margin_left text NOT NULL DEFAULT '20mm',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS templates_user_id_idx ON templates (user_id);
CREATE INDEX IF NOT EXISTS templates_created_at_idx ON templates (created_at DESC);

CREATE TABLE IF NOT EXISTS documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text NOT NULL,
    template_id text NOT NULL,
    name text NOT NULL,
    pdf_file text,
    data text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'pending', 'completed', 'failed', 'trashed')),
    size integer NOT NULL DEFAULT 0,
    downloads integer NOT NULL DEFAULT 0,
    signature text,
    error_message text,
    webhook_callback text,
    webhook_response text,
    webhook_retry integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documents_user_created_idx ON documents (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS documents_status_idx ON documents (status);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id uuid NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
    url text NOT NULL,
    retry integer NOT NULL DEFAULT 0,
    response text,
    payload text,
    execution_time integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhook_deliveries_document_idx ON webhook_deliveries (document_id, created_at DESC);
