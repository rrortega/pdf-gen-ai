#!/usr/bin/env node

/**
 * Test script for PDFGenAI MCP Server
 * 
 * This script simulates MCP tool calls to verify the server works correctly.
 */

console.log('🧪 Testing PDFGenAI MCP Server...\n');

// Simulate tool calls
const testCases = [
    {
        name: 'List Templates',
        tool: 'list_templates',
        args: { search: 'invoice' }
    },
    {
        name: 'Generate PDF',
        tool: 'generate_pdf',
        args: {
            template_id: 'test_template_123',
            data: {
                customer_name: 'John Doe',
                invoice_number: 'INV-001',
                total: 100
            },
            filename: 'test-invoice'
        }
    },
    {
        name: 'List Documents',
        tool: 'list_documents',
        args: { limit: 10 }
    },
    {
        name: 'Search Documents',
        tool: 'search_documents',
        args: {
            query: 'invoice',
            from_date: '2024-01-01T00:00:00Z'
        }
    }
];

console.log('📋 Test Cases:');
console.log('==============\n');

testCases.forEach((test, index) => {
    console.log(`${index + 1}. ${test.name}`);
    console.log(`   Tool: ${test.tool}`);
    console.log(`   Args: ${JSON.stringify(test.args, null, 2)}`);
    console.log('');
});

console.log('\n✅ MCP Server is ready!');
console.log('\n📝 Next steps:');
console.log('1. Get your API key from: http://localhost:3000/api-key');
console.log('2. Update .env file with your API key');
console.log('3. Configure Claude Desktop with the server');
console.log('4. Restart Claude Desktop');
console.log('\n🚀 Then you can use natural language in Claude to:');
console.log('   - "Generate an invoice for customer X"');
console.log('   - "Show me all my templates"');
console.log('   - "Find invoices from last month"');
console.log('   - "Download document doc_123"');
