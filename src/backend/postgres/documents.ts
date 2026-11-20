import type {
  Queryer,
  DocumentRepository,
  DocumentRow,
} from "../data-contracts";

interface DocumentSqlRow {
  id: string;
  user_id: string;
  template_id: string;
  name: string;
  pdf_file: string | null;
  data: string | null;
  status: DocumentRow["status"];
  size: number;
  downloads: number;
  signature: string | null;
  error_message: string | null;
  webhook_callback: string | null;
  webhook_response: string | null;
  webhook_retry: number;
  created_at: Date | string;
  updated_at: Date | string;
}

const COLUMNS = `id, user_id, template_id, name, pdf_file, data, status, size, downloads,
  signature, error_message, webhook_callback, webhook_response, webhook_retry,
  created_at, updated_at`;

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toRow(sql: DocumentSqlRow): DocumentRow {
  return {
    $id: sql.id,
    user_id: sql.user_id,
    template_id: sql.template_id,
    name: sql.name,
    pdf_file: sql.pdf_file,
    data: sql.data ?? "",
    status: sql.status,
    size: sql.size,
    downloads: sql.downloads,
    signature: sql.signature,
    error_message: sql.error_message,
    webhook_callback: sql.webhook_callback,
    webhook_response: sql.webhook_response,
    webhook_retry: sql.webhook_retry,
    $createdAt: toIso(sql.created_at),
    $updatedAt: toIso(sql.updated_at),
  };
}

/**
 * Creates the PostgreSQL document repository. Owner-scoped methods always
 * filter by `user_id`; `getById`/`updateById`/`incrementDownloadsById` are the
 * system-principal methods used only by the background worker.
 */
export function createPostgresDocumentRepository(queryer?: Queryer): DocumentRepository {
  let db: Queryer | undefined = queryer;

  async function getDb(): Promise<Queryer> {
    if (!db) {
      // Lazy so importing this module never requires DATABASE_URL.
      const { getPool } = await import("../db");
      db = getPool();
    }
    return db;
  }

  return {
    async list(ownerId, options) {
      const limit = options.limit;
      const offset = (options.page - 1) * options.limit;

      const listResult = await (await getDb()).query(
        `SELECT ${COLUMNS}, COUNT(*) OVER()::int AS total_count
         FROM documents
         WHERE user_id = $1 AND status <> 'trashed'
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [ownerId, limit, offset],
      );

      return {
        total: Number(listResult.rows[0]?.total_count ?? 0),
        rows: listResult.rows.map((row) => toRow(row as unknown as DocumentSqlRow)),
      };
    },

    async get(ownerId, id) {
      const result = await (await getDb()).query(
        `SELECT ${COLUMNS} FROM documents WHERE id = $1 AND user_id = $2 LIMIT 1`,
        [id, ownerId],
      );
      const row = result.rows[0];
      return row ? toRow(row as unknown as DocumentSqlRow) : null;
    },

    async exists(id) {
      const result = await (await getDb()).query(`SELECT 1 FROM documents WHERE id = $1 LIMIT 1`, [id]);
      return result.rows.length > 0;
    },

    async listForStats(ownerId, limit) {
      const result = await (await getDb()).query(
        `SELECT ${COLUMNS} FROM documents
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT ${limit}`,
        [ownerId],
      );
      return result.rows.map((row) => toRow(row as unknown as DocumentSqlRow));
    },

    async create(ownerId, input) {
      const result = await (await getDb()).query(
        `INSERT INTO documents
          (user_id, template_id, name, pdf_file, data, status, size, downloads,
           signature, error_message, webhook_callback, webhook_response, webhook_retry)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING ${COLUMNS}`,
        [
          ownerId,
          input.template_id,
          input.name,
          input.pdf_file ?? null,
          input.data,
          input.status ?? "queued",
          input.size ?? 0,
          input.downloads ?? 0,
          input.signature ?? null,
          input.error_message ?? null,
          input.webhook_callback ?? null,
          input.webhook_response ?? null,
          input.webhook_retry ?? 0,
        ],
      );
      if (!result.rows[0]) {
        throw new Error(`document insert returned no row for owner ${ownerId}`);
      }
      return toRow(result.rows[0] as unknown as DocumentSqlRow);
    },

    async update(ownerId, id, patch) {
      const values: unknown[] = [];
      const sets: string[] = [];

      const assign = (column: string, value: unknown) => {
        values.push(value);
        sets.push(`${column} = $${values.length}`);
      };

      if (patch.status !== undefined) assign("status", patch.status);
      if (patch.pdf_file !== undefined) assign("pdf_file", patch.pdf_file);
      if (patch.size !== undefined) assign("size", patch.size);
      if (patch.signature !== undefined) assign("signature", patch.signature);
      if (patch.error_message !== undefined) assign("error_message", patch.error_message);
      if (patch.webhook_response !== undefined) assign("webhook_response", patch.webhook_response);
      if (patch.webhook_retry !== undefined) assign("webhook_retry", patch.webhook_retry);

      if (sets.length === 0) {
        return this.get(ownerId, id);
      }

      values.push(id);
      const idIndex = values.length;
      values.push(ownerId);
      const ownerIndex = values.length;

      const result = await (await getDb()).query(
        `UPDATE documents SET ${sets.join(", ")}, updated_at = now()
         WHERE id = $${idIndex} AND user_id = $${ownerIndex}
         RETURNING ${COLUMNS}`,
        values,
      );
      const row = result.rows[0];
      return row ? toRow(row as unknown as DocumentSqlRow) : null;
    },

    async trash(ownerId, id) {
      const result = await (await getDb()).query(
        `UPDATE documents SET status = 'trashed', pdf_file = null, updated_at = now()
         WHERE id = $1 AND user_id = $2
         RETURNING id`,
        [id, ownerId],
      );
      return result.rows.length > 0;
    },

    async incrementDownloads(ownerId, id) {
      await (await getDb()).query(
        `UPDATE documents SET downloads = downloads + 1, updated_at = now()
         WHERE id = $1 AND user_id = $2`,
        [id, ownerId],
      );
    },

    async incrementDownloadsById(id) {
      await (await getDb()).query(
        `UPDATE documents SET downloads = downloads + 1, updated_at = now() WHERE id = $1`,
        [id],
      );
    },

    async getById(id) {
      const result = await (await getDb()).query(
        `SELECT ${COLUMNS} FROM documents WHERE id = $1 LIMIT 1`,
        [id],
      );
      const row = result.rows[0];
      return row ? toRow(row as unknown as DocumentSqlRow) : null;
    },

    async updateById(id, patch) {
      const values: unknown[] = [];
      const sets: string[] = [];

      const assign = (column: string, value: unknown) => {
        values.push(value);
        sets.push(`${column} = $${values.length}`);
      };

      if (patch.status !== undefined) assign("status", patch.status);
      if (patch.pdf_file !== undefined) assign("pdf_file", patch.pdf_file);
      if (patch.size !== undefined) assign("size", patch.size);
      if (patch.signature !== undefined) assign("signature", patch.signature);
      if (patch.error_message !== undefined) assign("error_message", patch.error_message);
      if (patch.webhook_response !== undefined) assign("webhook_response", patch.webhook_response);
      if (patch.webhook_retry !== undefined) assign("webhook_retry", patch.webhook_retry);

      if (sets.length === 0) return;

      values.push(id);
      const idIndex = values.length;

      await (await getDb()).query(
        `UPDATE documents SET ${sets.join(", ")}, updated_at = now() WHERE id = $${idIndex}`,
        values,
      );
    },
  };
}
