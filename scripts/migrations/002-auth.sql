-- Self-hosted authentication schema (users, sessions, API keys, password
-- resets, OAuth codes and tokens).
--
-- Idempotent: safe to run repeatedly (every statement uses IF NOT EXISTS and
-- nothing is dropped). Passwords, session secrets, API keys, reset tokens and
-- OAuth codes are stored ONLY as strong one-way hashes; every token row is
-- bound to an owning user and carries an expiry.

CREATE TABLE IF NOT EXISTS auth_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL,
    name text,
    password_hash text NOT NULL,
    email_verification boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Case-insensitive unique email without requiring the citext extension.
CREATE UNIQUE INDEX IF NOT EXISTS auth_users_email_unique_idx ON auth_users (lower(email));

CREATE TABLE IF NOT EXISTS auth_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth_users (id) ON DELETE CASCADE,
    secret_hash text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx ON auth_sessions (user_id);
CREATE INDEX IF NOT EXISTS auth_sessions_expires_at_idx ON auth_sessions (expires_at);

CREATE TABLE IF NOT EXISTS auth_password_reset_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth_users (id) ON DELETE CASCADE,
    secret_hash text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_password_reset_tokens_user_id_idx ON auth_password_reset_tokens (user_id);

CREATE TABLE IF NOT EXISTS auth_api_keys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth_users (id) ON DELETE CASCADE,
    name text,
    key_hash text NOT NULL UNIQUE,
    key_prefix text NOT NULL DEFAULT '',
    -- NULL means the key does not expire, matching legacy preference keys;
    -- verification still honours any configured expiry.
    expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz,
    last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS auth_api_keys_user_id_idx ON auth_api_keys (user_id);

CREATE TABLE IF NOT EXISTS auth_oauth_codes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id text NOT NULL,
    user_id uuid NOT NULL REFERENCES auth_users (id) ON DELETE CASCADE,
    code_hash text NOT NULL UNIQUE,
    redirect_uri text NOT NULL,
    scopes text[] NOT NULL DEFAULT '{}',
    code_challenge text NOT NULL DEFAULT '',
    code_challenge_method text NOT NULL DEFAULT '',
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    consumed_at timestamptz
);

CREATE INDEX IF NOT EXISTS auth_oauth_codes_user_id_idx ON auth_oauth_codes (user_id);
CREATE INDEX IF NOT EXISTS auth_oauth_codes_client_id_idx ON auth_oauth_codes (client_id);
CREATE INDEX IF NOT EXISTS auth_oauth_codes_expires_at_idx ON auth_oauth_codes (expires_at);

CREATE TABLE IF NOT EXISTS auth_oauth_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id text NOT NULL,
    user_id uuid NOT NULL REFERENCES auth_users (id) ON DELETE CASCADE,
    access_token_hash text NOT NULL UNIQUE,
    refresh_token_hash text UNIQUE,
    token_type text NOT NULL DEFAULT 'Bearer',
    scopes text[] NOT NULL DEFAULT '{}',
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_oauth_tokens_user_id_idx ON auth_oauth_tokens (user_id);
CREATE INDEX IF NOT EXISTS auth_oauth_tokens_client_id_idx ON auth_oauth_tokens (client_id);
CREATE INDEX IF NOT EXISTS auth_oauth_tokens_expires_at_idx ON auth_oauth_tokens (expires_at);
