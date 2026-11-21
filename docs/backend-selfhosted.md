
## Importing existing Appwrite templates

`scripts/import-appwrite-templates.mts` copies Appwrite templates into
PostgreSQL as **shared base templates** (`user_id` NULL). That is deliberate:
Appwrite rows belong to Appwrite user ids that do not exist in `auth_users`, so
an owner-bound copy would be invisible to every account.

Shared templates show up through the existing `?base=true` listing and can be
cloned with `baseTemplateId`. The import is idempotent: a shared template with
the same title is skipped, so re-running is safe.

```sh
APPWRITE_ENDPOINT=... APPWRITE_PROJECT_ID=... APPWRITE_DATABASE_ID=... \
APPWRITE_API_KEY=... APPWRITE_TEMPLATES_TABLE_ID=templates \
DATABASE_URL=... node --import tsx scripts/import-appwrite-templates.mts --dry-run
```

Drop `--dry-run` to write. Credentials are read from the environment only.
