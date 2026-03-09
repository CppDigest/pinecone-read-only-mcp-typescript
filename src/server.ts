/**
 * Pinecone Read-Only MCP Server
 *
 * Keeps server composition slim by delegating validation, heuristics,
 * and tool registration into dedicated modules.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SERVER_INSTRUCTIONS, SERVER_NAME, SERVER_VERSION } from './constants.js';
import { registerCountTool } from './server/tools/count-tool.js';
import { registerGuidedQueryTool } from './server/tools/guided-query-tool.js';
import { registerGenerateUrlsTool } from './server/tools/generate-urls-tool.js';
import { registerKeywordSearchTool } from './server/tools/keyword-search-tool.js';
import { registerListNamespacesTool } from './server/tools/list-namespaces-tool.js';
import { registerNamespaceRouterTool } from './server/tools/namespace-router-tool.js';
import { registerQueryDocumentsTool } from './server/tools/query-documents-tool.js';
import { registerQueryTool } from './server/tools/query-tool.js';
import { registerSuggestQueryParamsTool } from './server/tools/suggest-query-params-tool.js';

export { setPineconeClient } from './server/client-context.js';
export { validateMetadataFilter } from './server/metadata-filter.js';
export { suggestQueryParams } from './server/query-suggestion.js';
export type { SuggestQueryParamsResult } from './server/query-suggestion.js';

/** Create and configure the MCP server with all tools; returns the server instance. */
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

  registerListNamespacesTool(server);
  registerNamespaceRouterTool(server);
  registerSuggestQueryParamsTool(server);
  registerCountTool(server);
  registerQueryTool(server);
  registerKeywordSearchTool(server);
  registerQueryDocumentsTool(server);
  registerGuidedQueryTool(server);
  registerGenerateUrlsTool(server);

  return server;
}
