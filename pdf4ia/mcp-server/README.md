# PDFGenAI MCP Server

Model Context Protocol (MCP) server for PDFGenAI - Generate and manage PDF documents programmatically.

## Features

- 🚀 **Generate PDFs**: Create PDF documents from templates with dynamic data
- 📋 **List Templates**: Browse available PDF templates
- 📄 **Manage Documents**: List, search, and download generated PDFs
- 🔍 **Search**: Find documents by filename, date range, or metadata
- 🔐 **Secure**: API key authentication for all operations

## Architecture

```
┌─────────────────┐
│  Claude Desktop │
│   (User Input)  │
└────────┬────────┘
         │
         │ Natural Language
         │ "Generate invoice for John Doe"
         │
         ▼
┌─────────────────┐
│   MCP Server    │
│  (This Server)  │
└────────┬────────┘
         │
         │ HTTP API Calls
         │ POST /api/v1/generate
         │
         ▼
┌─────────────────┐
│  PDFGenAI API   │
│  (Next.js App)  │
└────────┬────────┘
         │
         │ Puppeteer + Handlebars
         │
         ▼
┌─────────────────┐
│   PDF Output    │
│  (Appwrite)     │
└─────────────────┘
```

## Installation

```bash
cd mcp-server
npm install
```

## Configuration

Set the following environment variables:

```bash
# API base URL (default: http://localhost:3000)
export PDFGENAI_API_URL="https://your-api-url.com"

# Your API key from PDFGenAI dashboard
export PDFGENAI_API_KEY="your-api-key-here"
```

## Usage

### Running the Server

```bash
npm start
```

### Available Tools

#### 1. `generate_pdf`
Generate a PDF document from a template.

**Parameters:**
- `template_id` (required): Template ID to use
- `data` (required): JSON object with dynamic data
- `filename` (optional): Custom filename for the PDF

**Example:**
```json
{
  "template_id": "invoice_template_123",
  "data": {
    "invoice_number": "INV-001",
    "customer_name": "John Doe",
    "items": [
      { "name": "Product A", "price": 100 }
    ],
    "total": 100
  },
  "filename": "invoice-001"
}
```

#### 2. `list_templates`
List all available PDF templates.

**Parameters:**
- `search` (optional): Search term to filter templates
- `tags` (optional): Array of tags to filter by

**Example:**
```json
{
  "search": "invoice",
  "tags": ["billing", "sales"]
}
```

#### 3. `list_documents`
List generated PDF documents.

**Parameters:**
- `limit` (optional): Maximum number of documents (default: 20)
- `search` (optional): Search term to filter documents

**Example:**
```json
{
  "limit": 50,
  "search": "invoice"
}
```

#### 4. `get_document`
Get details and download URL for a specific document.

**Parameters:**
- `document_id` (required): Document ID

**Example:**
```json
{
  "document_id": "doc_abc123"
}
```

#### 5. `search_documents`
Search for documents by filename or date range.

**Parameters:**
- `query` (required): Search query
- `from_date` (optional): Start date (ISO format)
- `to_date` (optional): End date (ISO format)

**Example:**
```json
{
  "query": "invoice",
  "from_date": "2024-01-01T00:00:00Z",
  "to_date": "2024-12-31T23:59:59Z"
}
```

## Integration with Claude Desktop

Add this configuration to your Claude Desktop config file:

### macOS
`~/Library/Application Support/Claude/claude_desktop_config.json`

### Windows
`%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "pdfgenai": {
      "command": "node",
      "args": ["/path/to/pdf4ia/mcp-server/index.js"],
      "env": {
        "PDFGENAI_API_URL": "http://localhost:3000",
        "PDFGENAI_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Example Workflows

### Generate an Invoice
```
User: "Generate an invoice PDF for customer John Doe with invoice number INV-001"

Claude will:
1. Use list_templates to find invoice templates
2. Use generate_pdf with the appropriate data
3. Return the download URL
```

### Find Recent Documents
```
User: "Show me all invoices generated this month"

Claude will:
1. Use search_documents with date filters
2. Return a list of matching documents
```

### Download a Specific Document
```
User: "Get me the download link for document doc_abc123"

Claude will:
1. Use get_document to retrieve details
2. Return the download URL
```

## API Endpoints Required

The MCP server expects the following API endpoints to be available:

- `POST /api/v1/generate` - Generate PDF
- `GET /api/v1/templates` - List templates
- `GET /api/v1/documents` - List documents
- `GET /api/v1/documents/:id` - Get document details
- `GET /api/v1/documents/:id/download` - Download document
- `GET /api/v1/documents/search` - Search documents

## Development

To modify the server:

1. Edit `index.js`
2. Restart the MCP server
3. Restart Claude Desktop to reload the configuration

## Troubleshooting

### Server not connecting
- Check that the API URL is correct
- Verify your API key is valid
- Ensure the PDFGenAI API is running

### Tools not appearing in Claude
- Restart Claude Desktop
- Check the config file syntax
- View Claude Desktop logs for errors

## License

MIT © ChambaPRO SAPI de CV
