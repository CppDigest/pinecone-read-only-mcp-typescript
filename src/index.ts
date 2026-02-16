#!/usr/bin/env node

/**
 * Pinecone Read-Only MCP CLI
 *
 * Entry point for the Pinecone Read-Only MCP server.
 * Provides semantic search over Pinecone vector indexes using hybrid
 * search with automatic namespace discovery.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { PineconeClient } from './pinecone-client.js';
import { setupServer, setPineconeClient } from './server.js';
import { DEFAULT_INDEX_NAME, DEFAULT_RERANK_MODEL } from './constants.js';
import type { LogLevel } from './config.js';
import { setLogLevel } from './logger.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface CLIOptions {
  apiKey?: string;
  indexName?: string;
  rerankModel?: string;
  logLevel?: string;
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--api-key':
        options.apiKey = nextArg;
        i++;
        break;
      case '--index-name':
        options.indexName = nextArg;
        i++;
        break;
      case '--rerank-model':
        options.rerankModel = nextArg;
        i++;
        break;
      case '--log-level':
        options.logLevel = nextArg;
        i++;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
Pinecone Read-Only MCP Server

Usage: pinecone-read-only-mcp [options]

Options:
  --api-key TEXT        Pinecone API key (or set PINECONE_API_KEY env var)
  --index-name TEXT     Pinecone index name [default: ${DEFAULT_INDEX_NAME}]
  --rerank-model TEXT   Reranking model [default: ${DEFAULT_RERANK_MODEL}]
  --log-level TEXT      Logging level [default: INFO]
  --help, -h            Show this help message

Environment Variables:
  PINECONE_API_KEY              Pinecone API key
  PINECONE_INDEX_NAME           Pinecone index name
  PINECONE_RERANK_MODEL         Reranking model name
  PINECONE_READ_ONLY_MCP_LOG_LEVEL  Logging level

Examples:
  # Using command line options
  pinecone-read-only-mcp --api-key YOUR_API_KEY

  # Using environment variables
  export PINECONE_API_KEY=YOUR_API_KEY
  pinecone-read-only-mcp

  # With custom index
  pinecone-read-only-mcp --api-key YOUR_API_KEY --index-name my-index
`);
}

async function main(): Promise<void> {
  try {
    const options = parseArgs();

    // Set log level (env + logger singleton so tools get correct level)
    const rawLevel =
      options.logLevel ||
      process.env['PINECONE_READ_ONLY_MCP_LOG_LEVEL'] ||
      process.env['LOG_LEVEL'] ||
      'INFO';
    const logLevel = (['DEBUG', 'INFO', 'WARN', 'ERROR'].includes(rawLevel)
      ? rawLevel
      : 'INFO') as LogLevel;
    process.env['LOG_LEVEL'] = logLevel;
    setLogLevel(logLevel);

    // Get API key
    const apiKey = options.apiKey || process.env['PINECONE_API_KEY'];
    if (!apiKey) {
      console.error(
        'Error: Pinecone API key is required. Set PINECONE_API_KEY environment variable or use --api-key option.'
      );
      process.exit(1);
    }

    // Get configuration
    const indexName = options.indexName || process.env['PINECONE_INDEX_NAME'] || DEFAULT_INDEX_NAME;
    const rerankModel =
      options.rerankModel || process.env['PINECONE_RERANK_MODEL'] || DEFAULT_RERANK_MODEL;

    // Initialize Pinecone client
    const client = new PineconeClient({
      apiKey,
      indexName,
      rerankModel,
    });
    setPineconeClient(client);

    console.error(`Starting Pinecone Read-Only MCP server with stdio transport`);
    console.error(`Using Pinecone index: ${indexName}`);
    console.error(`Log level: ${logLevel}`);

    // Setup server
    const server = await setupServer();

    // Create transport
    const transport = new StdioServerTransport();

    // Connect server to transport
    await server.connect(transport);

    console.error('Pinecone Read-Only MCP Server running on stdio');

    // Handle shutdown gracefully
    process.on('SIGINT', () => {
      console.error('Server stopped by user');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.error('Server stopped by signal');
      process.exit(0);
    });
  } catch (error) {
    console.error('Fatal error in main():', error);
    process.exit(1);
  }
}

main();
