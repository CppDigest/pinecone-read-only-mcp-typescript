/**
 * Pinecone Read-Only MCP Server
 *
 * This module implements a Model Context Protocol (MCP) server that provides
 * semantic search capabilities over Pinecone vector databases using hybrid
 * search (dense + sparse) with reranking.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { PineconeClient } from './pinecone-client.js';
import {
  SERVER_NAME,
  SERVER_VERSION,
  SERVER_INSTRUCTIONS,
  MIN_TOP_K,
  MAX_TOP_K,
} from './constants.js';
import type { QueryResponse } from './types.js';

// Recursive Zod schema for Pinecone metadata filters
// Supports nested objects with operators like {"timestamp": {"$gte": 123}}
// Using z.any() for the value type to support all Pinecone filter formats
const metadataFilterValueSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.string()),
    z.array(z.number()),
    z.record(z.string(), metadataFilterValueSchema), // Recursive for nested operators
  ])
);

const metadataFilterSchema = z.record(z.string(), metadataFilterValueSchema);

// Global Pinecone client (initialized lazily)
let pineconeClient: PineconeClient | null = null;

function getPineconeClient(): PineconeClient {
  if (!pineconeClient) {
    throw new Error('Pinecone client not initialized. Call setPineconeClient first.');
  }
  return pineconeClient;
}

export function setPineconeClient(client: PineconeClient): void {
  pineconeClient = client;
}

export async function setupServer(): Promise<McpServer> {
  const server = new McpServer(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      instructions: SERVER_INSTRUCTIONS,
    }
  );

  // Tool: list_namespaces
  server.registerTool(
    'list_namespaces',
    {
      description:
        'List all available namespaces in the Pinecone index with their metadata fields and record counts. ' +
        'Returns detailed information about each namespace including available metadata fields that can be used for filtering in queries. ' +
        'Use this tool first to discover which namespaces exist and what metadata fields are available for filtering.',
      inputSchema: {},
    },
    async () => {
      try {
        const client = getPineconeClient();
        const namespacesInfo = await client.listNamespacesWithMetadata();

        const response = {
          status: 'success',
          count: namespacesInfo.length,
          namespaces: namespacesInfo.map((ns) => ({
            name: ns.namespace,
            record_count: ns.recordCount,
            metadata_fields: ns.metadata,
          })),
        };

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error listing namespaces:', error);

        const response = {
          status: 'error',
          message:
            process.env['LOG_LEVEL'] === 'DEBUG' ? errorMessage : 'Failed to list namespaces',
        };

        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      }
    }
  );

  // Tool: query
  server.registerTool(
    'query',
    {
      description:
        'Search the Pinecone vector database using hybrid semantic search with optional metadata filtering. ' +
        'Performs a hybrid search combining dense and sparse embeddings for better recall, with optional reranking for improved precision. ' +
        'Supports natural language queries and returns the most relevant documents based on semantic similarity. ' +
        'IMPORTANT: Use metadata_filter to narrow results. First call list_namespaces to discover available metadata fields. ' +
        'Metadata filters support 10 operators: $eq/==, $ne/!=, $gt/>, $gte/>=, $lt/<, $lte/<=, $in (array fields only), $nin (array fields only). ' +
        'NOTE: String fields require exact match - no wildcards. For comma-separated strings, you cannot filter by individual values. ' +
        'Use comparison operators for numeric/timestamp fields. Multiple top-level conditions use AND logic.',
      inputSchema: {
        query_text: z.string().describe('Search query text. Be specific for better results.'),
        namespace: z
          .string()
          .describe(
            'Namespace to search within. Use list_namespaces tool to discover available namespaces in the index.'
          ),
        top_k: z
          .number()
          .int()
          .min(MIN_TOP_K)
          .max(MAX_TOP_K)
          .default(10)
          .describe('Number of results to return (1-100). Default: 10'),
        use_reranking: z
          .boolean()
          .default(true)
          .describe(
            'Whether to use semantic reranking for better relevance. Slower but more accurate. Default: true'
          ),
        metadata_filter: z
          .record(z.string(), metadataFilterSchema)
          .optional()
          .describe(
            'Optional metadata filter to narrow down search results. Use exact field names from list_namespaces. ' +
              'Supports 10 operators: ' +
              '$eq (==), $ne (!=), $gt (>), $gte (>=), $lt (<), $lte (<=), $in (array field contains value), $nin (array field not contains). ' +
              'IMPORTANT: String fields require EXACT match - no wildcards/partial matches. For comma-separated values (like authors), use exact full string. ' +
              'Examples: ' +
              '{"author": "John Lakos"} - exact author match (single author only), ' +
              '{"year": {"$gte": 2023}} - year >= 2023, ' +
              '{"timestamp": {"$gt": 1704067200, "$lt": 1735689600}} - timestamp range, ' +
              '{"status": "published"} - exact match (implicit $eq), ' +
              '{"tags": {"$in": ["cpp", "contracts"]}} - tags array contains value (only works if tags is array field). ' +
              'Multiple conditions at top level are combined with AND logic.'
          ),
      },
    },
    async (params) => {
      try {
        const { query_text, namespace, top_k = 10, use_reranking = true, metadata_filter } = params;

        // Validate query
        if (!query_text || !query_text.trim()) {
          const response: QueryResponse = {
            status: 'error',
            message: 'Query text cannot be empty',
          };

          return {
            isError: true,
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(response, null, 2),
              },
            ],
          };
        }

        // Log filter for debugging
        if (metadata_filter) {
          console.error('Received metadata filter:', JSON.stringify(metadata_filter, null, 2));
        }

        const client = getPineconeClient();
        const results = await client.query({
          query: query_text.trim(),
          topK: top_k,
          namespace,
          useReranking: use_reranking,
          metadataFilter: metadata_filter,
        });

        // Format results for output
        const formattedResults = results.map((doc) => ({
          paper_number:
            doc.metadata['document_number'] ||
            (doc.metadata['filename'] as string)?.replace('.md', '').toUpperCase() ||
            null,
          title: doc.metadata['title'] || '',
          author: doc.metadata['author'] || '',
          url: doc.metadata['url'] || '',
          content: doc.content.substring(0, 2000), // Truncate for readability
          score: Math.round(doc.score * 10000) / 10000,
          reranked: doc.reranked,
          metadata: doc.metadata, // Include all metadata fields (including timestamp)
        }));

        const response: QueryResponse = {
          status: 'success',
          query: query_text,
          namespace,
          metadata_filter: metadata_filter,
          result_count: formattedResults.length,
          results: formattedResults,
        };

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error executing query:', error);

        const response: QueryResponse = {
          status: 'error',
          message:
            process.env['LOG_LEVEL'] === 'DEBUG'
              ? errorMessage
              : 'An error occurred while processing your query',
        };

        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      }
    }
  );

  return server;
}
