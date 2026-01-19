#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';

// Configuration
const API_BASE_URL = process.env.PDFGENAI_API_URL || 'http://localhost:3000';
const API_KEY = process.env.PDFGENAI_API_KEY || '';

class PDFGenAIServer {
    constructor() {
        this.server = new Server(
            {
                name: 'pdfgenai-mcp-server',
                version: '1.0.0',
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        this.setupToolHandlers();

        // Error handling
        this.server.onerror = (error) => console.error('[MCP Error]', error);
        process.on('SIGINT', async () => {
            await this.server.close();
            process.exit(0);
        });
    }

    setupToolHandlers() {
        // List available tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: 'generate_pdf',
                    description: 'Generate a PDF document from a template with dynamic data',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            template_id: {
                                type: 'string',
                                description: 'The ID of the template to use for PDF generation',
                            },
                            data: {
                                type: 'object',
                                description: 'Dynamic data to inject into the template (JSON object)',
                            },
                            filename: {
                                type: 'string',
                                description: 'Optional filename for the generated PDF (without extension)',
                            },
                        },
                        required: ['template_id', 'data'],
                    },
                },
                {
                    name: 'list_templates',
                    description: 'List all available PDF templates',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            search: {
                                type: 'string',
                                description: 'Optional search term to filter templates',
                            },
                            tags: {
                                type: 'array',
                                items: { type: 'string' },
                                description: 'Optional tags to filter templates',
                            },
                        },
                    },
                },
                {
                    name: 'list_documents',
                    description: 'List generated PDF documents',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            limit: {
                                type: 'number',
                                description: 'Maximum number of documents to return (default: 20)',
                            },
                            search: {
                                type: 'string',
                                description: 'Optional search term to filter documents',
                            },
                        },
                    },
                },
                {
                    name: 'get_document',
                    description: 'Get details and download URL for a specific document',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            document_id: {
                                type: 'string',
                                description: 'The ID of the document to retrieve',
                            },
                        },
                        required: ['document_id'],
                    },
                },
                {
                    name: 'search_documents',
                    description: 'Search for documents by filename or metadata',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            query: {
                                type: 'string',
                                description: 'Search query for document filename',
                            },
                            from_date: {
                                type: 'string',
                                description: 'Filter documents created after this date (ISO format)',
                            },
                            to_date: {
                                type: 'string',
                                description: 'Filter documents created before this date (ISO format)',
                            },
                        },
                        required: ['query'],
                    },
                },
            ],
        }));

        // Handle tool calls
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;

            try {
                switch (name) {
                    case 'generate_pdf':
                        return await this.generatePDF(args);
                    case 'list_templates':
                        return await this.listTemplates(args);
                    case 'list_documents':
                        return await this.listDocuments(args);
                    case 'get_document':
                        return await this.getDocument(args);
                    case 'search_documents':
                        return await this.searchDocuments(args);
                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error: ${error.message}`,
                        },
                    ],
                    isError: true,
                };
            }
        });
    }

    async generatePDF(args) {
        const { template_id, data, filename } = args;

        const response = await fetch(`${API_BASE_URL}/api/v1/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`,
            },
            body: JSON.stringify({
                template_id,
                data,
                filename,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to generate PDF');
        }

        const result = await response.json();

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        message: 'PDF generated successfully',
                        document_id: result.document_id,
                        filename: result.filename,
                        download_url: result.download_url,
                        created_at: result.created_at,
                    }, null, 2),
                },
            ],
        };
    }

    async listTemplates(args) {
        const { search, tags } = args || {};

        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (tags && tags.length > 0) params.append('tags', tags.join(','));

        const response = await fetch(`${API_BASE_URL}/api/v1/templates?${params}`, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch templates');
        }

        const result = await response.json();

        const templates = result.templates.map(t => ({
            id: t.$id,
            title: t.title,
            tags: t.tags,
            created_at: t.$createdAt,
        }));

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        count: templates.length,
                        templates,
                    }, null, 2),
                },
            ],
        };
    }

    async listDocuments(args) {
        const { limit = 20, search } = args || {};

        const params = new URLSearchParams();
        params.append('limit', limit.toString());
        if (search) params.append('search', search);

        const response = await fetch(`${API_BASE_URL}/api/v1/documents?${params}`, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch documents');
        }

        const result = await response.json();

        const documents = result.documents.map(d => ({
            id: d.$id,
            filename: d.filename,
            template_id: d.template_id,
            created_at: d.$createdAt,
            size: d.size,
        }));

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        count: documents.length,
                        documents,
                    }, null, 2),
                },
            ],
        };
    }

    async getDocument(args) {
        const { document_id } = args;

        const response = await fetch(`${API_BASE_URL}/api/v1/documents/${document_id}`, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
            },
        });

        if (!response.ok) {
            throw new Error('Document not found');
        }

        const result = await response.json();

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        document: {
                            id: result.document.$id,
                            filename: result.document.filename,
                            template_id: result.document.template_id,
                            download_url: `${API_BASE_URL}/api/v1/documents/${document_id}/download`,
                            created_at: result.document.$createdAt,
                            size: result.document.size,
                        },
                    }, null, 2),
                },
            ],
        };
    }

    async searchDocuments(args) {
        const { query, from_date, to_date } = args;

        const params = new URLSearchParams();
        params.append('search', query);
        if (from_date) params.append('from', from_date);
        if (to_date) params.append('to', to_date);

        const response = await fetch(`${API_BASE_URL}/api/v1/documents/search?${params}`, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
            },
        });

        if (!response.ok) {
            throw new Error('Search failed');
        }

        const result = await response.json();

        const documents = result.documents.map(d => ({
            id: d.$id,
            filename: d.filename,
            template_id: d.template_id,
            created_at: d.$createdAt,
            size: d.size,
        }));

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        query,
                        count: documents.length,
                        documents,
                    }, null, 2),
                },
            ],
        };
    }

    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('PDFGenAI MCP server running on stdio');
    }
}

const server = new PDFGenAIServer();
server.run().catch(console.error);
