import type {
  Queryer,
  WebhookDeliveryRepository,
  WebhookDeliveryRow,
  WebhookDeliveryCreateInput,
  WebhookDeliveryUpdateInput,
} from "../data-contracts";

interface WebhookSqlRow {
  id: string;
  document_id: string;
  url: string;
  retry: number;
  response: string | null;
  payload: string | null;
  execution_time: number;
  created_at: Date | string;
  updated_at: Date | string;
}

const COLUMNS = `id, document_id, url, retry, response, payload, execution_time, created_at, updated_at`;

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toRow(sql: WebhookSqlRow): WebhookDeliveryRow {
  return {
    $id: sql.id,
    document_id: sql.document_id,
    url: sql.url,
    retry: sql.retry,
    response: sql.response,
    payload: sql.payload,
    execution_time: sql.execution_time,
    $createdAt: toIso(sql.created_at),
    $updatedAt: toIso(sql.updated_at),
  };
}

export function createPostgresWebhookDeliveryRepository(queryer?: Queryer): WebhookDeliveryRepository {
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
    async create(input: WebhookDeliveryCreateInput) {
      const result = await (await getDb()).query(
        `INSERT INTO webhook_deliveries (document_id, url, retry, response, payload, execution_time)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${COLUMNS}`,
        [
          input.document_id,
          input.url,
          input.retry ?? 0,
          input.response ?? null,
          input.payload ?? null,
          input.execution_time ?? 0,
        ],
      );
      if (!result.rows[0]) {
        throw new Error(`webhook delivery insert returned no row for document ${input.document_id}`);
      }
      return toRow(result.rows[0] as unknown as WebhookSqlRow);
    },

    async update(id: string, patch: WebhookDeliveryUpdateInput) {
      const values: unknown[] = [];
      const sets: string[] = [];

      const assign = (column: string, value: unknown) => {
        values.push(value);
        sets.push(`${column} = $${values.length}`);
      };

      if (patch.retry !== undefined) assign("retry", patch.retry);
      if (patch.response !== undefined) assign("response", patch.response);
      if (patch.payload !== undefined) assign("payload", patch.payload);
      if (patch.execution_time !== undefined) assign("execution_time", patch.execution_time);

      if (sets.length === 0) {
        const existing = await (await getDb()).query(
          `SELECT ${COLUMNS} FROM webhook_deliveries WHERE id = $1`,
          [id],
        );
        return existing.rows[0] ? toRow(existing.rows[0] as unknown as WebhookSqlRow) : null;
      }

      values.push(id);
      const idIndex = values.length;

      const result = await (await getDb()).query(
        `UPDATE webhook_deliveries SET ${sets.join(", ")}, updated_at = now()
         WHERE id = $${idIndex}
         RETURNING ${COLUMNS}`,
        values,
      );
      return result.rows[0] ? toRow(result.rows[0] as unknown as WebhookSqlRow) : null;
    },
  };
}
