import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = path.join(__dirname, 'index.js');

/**
 * PDFGenAI MCP Server Test Suite
 * 
 * This test spawns the MCP server and communicates via JSON-RPC over stdio.
 */

async function runTest() {
    console.log('🧪 Starting MCP Server Tests...\n');

    const server = spawn('node', [SERVER_PATH], {
        env: {
            ...process.env,
            PDFGENAI_API_KEY: 'test_key',
            PDFGENAI_API_URL: 'http://localhost:3010' // Mock API URL
        }
    });

    let requestId = 1;

    const sendRequest = (method, params = {}) => {
        const request = {
            jsonrpc: '2.0',
            id: requestId++,
            method,
            params
        };
        server.stdin.write(JSON.stringify(request) + '\n');
        return request.id;
    };

    const waitForResponse = (targetId, timeout = 5000) => {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Timeout waiting for response to request ${targetId}`));
            }, timeout);

            const onData = (data) => {
                const lines = data.toString().split('\n');
                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const response = JSON.parse(line);
                        if (response.id === targetId) {
                            server.stdout.removeListener('data', onData);
                            clearTimeout(timer);
                            resolve(response);
                        }
                    } catch (e) {
                        // Not a JSON response or partial data
                    }
                }
            };

            server.stdout.on('data', onData);
        });
    };

    try {
        // 1. Test List Tools
        console.log('1. Testing list_tools...');
        const listToolsId = sendRequest('notifications/initialized'); // MCP init sequence
        // Actually, for simple testing we can just send the request
        const toolsRequestId = sendRequest('tools/list');
        const toolsResponse = await waitForResponse(toolsRequestId);

        if (toolsResponse.result && toolsResponse.result.tools) {
            console.log(`✅ Found ${toolsResponse.result.tools.length} tools`);
            const toolNames = toolsResponse.result.tools.map(t => t.name);
            console.log(`   Tools: ${toolNames.join(', ')}`);
        } else {
            throw new Error('Failed to list tools');
        }

        // 2. Test List Templates
        console.log('\n2. Testing list_templates...');
        const listTemplatesId = sendRequest('tools/call', {
            name: 'list_templates',
            arguments: { search: 'invoice' }
        });
        const templatesResponse = await waitForResponse(listTemplatesId);

        if (templatesResponse.result) {
            console.log('✅ list_templates response received');
            // It will fail because the mock API is not running, but we verified the MCP routing
            if (templatesResponse.isError) {
                console.log(`   Expected Error (API unreachable): ${templatesResponse.content[0].text}`);
            }
        }

        // 3. Test Generate PDF
        console.log('\n3. Testing generate_pdf...');
        const genPdfId = sendRequest('tools/call', {
            name: 'generate_pdf',
            arguments: {
                template_id: 'test_id',
                data: { name: 'Test' }
            }
        });
        const genPdfResponse = await waitForResponse(genPdfId);
        console.log('✅ generate_pdf response received');

        console.log('\n🎉 MCP Tests completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error(`\n❌ Test failed: ${error.message}`);
        process.exit(1);
    } finally {
        server.kill();
    }
}

runTest();
