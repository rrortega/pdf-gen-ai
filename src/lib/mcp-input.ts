const MAX_MCP_REQUEST_BYTES = 1_048_576;
const MAX_MCP_BATCH_SIZE = 10;
const MAX_GENERATE_PDF_DATA_DEPTH = 8;
const MAX_GENERATE_PDF_DATA_ELEMENTS = 1_000;

export class McpInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpInputError";
  }
}

function validateGeneratePdfData(value: unknown, depth = 0, counter = { value: 0 }): void {
  if (depth > MAX_GENERATE_PDF_DATA_DEPTH) {
    throw new McpInputError("generate_pdf.data is too deeply nested");
  }

  if (value === null || typeof value !== "object") return;

  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    counter.value += 1;
    if (counter.value > MAX_GENERATE_PDF_DATA_ELEMENTS) {
      throw new McpInputError("generate_pdf.data has too many elements");
    }
    validateGeneratePdfData(child, depth + 1, counter);
  }
}

function validateMessage(message: unknown): void {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    throw new McpInputError("MCP request must be a JSON-RPC object");
  }

  const request = message as {
    method?: unknown;
    params?: { name?: unknown; arguments?: { data?: unknown } };
  };
  if (request.method === "tools/call" && request.params?.name === "generate_pdf") {
    validateGeneratePdfData(request.params.arguments?.data);
  }
}

export function parseMcpRequest(raw: string, byteLength = Buffer.byteLength(raw)): unknown {
  if (byteLength > MAX_MCP_REQUEST_BYTES) {
    throw new McpInputError("MCP request exceeds 1 MiB");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new McpInputError("Malformed JSON-RPC request");
  }

  if (Array.isArray(parsed)) {
    if (parsed.length === 0 || parsed.length > MAX_MCP_BATCH_SIZE) {
      throw new McpInputError("MCP batch must contain between 1 and 10 messages");
    }
    parsed.forEach(validateMessage);
  } else {
    validateMessage(parsed);
  }

  return parsed;
}

export async function readMcpRequest(request: Request): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_MCP_REQUEST_BYTES) {
    throw new McpInputError("MCP request exceeds 1 MiB");
  }

  const raw = await request.text();
  return parseMcpRequest(raw);
}
