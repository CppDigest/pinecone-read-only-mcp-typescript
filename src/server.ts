/**
 * @packageDocumentation
 * **@will-cppa/pinecone-read-only-mcp** — programmatic entrypoint for the
 * Pinecone read-only MCP server.
 *
 * Import from the package root:
 *
 * - {@link setupServer} — build an `McpServer` with all tools registered.
 * - {@link PineconeClient} — hybrid search, count, namespace listing, etc.
 * - {@link resolveConfig} — merge CLI-style overrides with `process.env`.
 * - {@link setPineconeClient} — inject a client instance before `setupServer()`.
 * - {@link registerUrlGenerator} / {@link unregisterUrlGenerator} — extend URL synthesis.
 * - {@link withRetry} / {@link withTimeout} — resilience helpers (re-exported for apps).
 *
 * The CLI binary (`pinecone-read-only-mcp`) lives in `dist/index.js` and is not
 * exported from this module.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SERVER_INSTRUCTIONS, SERVER_NAME, SERVER_VERSION } from './constants.js';
import type { ServerConfig } from './config.js';
import { setServerConfig } from './server/config-context.js';
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
/** Validate user-supplied Pinecone metadata filter objects before querying. */
export { validateMetadataFilter } from './server/metadata-filter.js';
/** Heuristic field + tool suggestions from a namespace schema + user query. */
export { suggestQueryParams } from './server/query-suggestion.js';
export type { SuggestQueryParamsResult } from './server/query-suggestion.js';
/** Register custom per-namespace URL synthesis used by `generate_urls` / row enrichment. */
export {
  registerUrlGenerator,
  unregisterUrlGenerator,
  generateUrlForNamespace,
  hasUrlGenerator,
} from './server/url-generation.js';
export type { UrlGenerationResult, UrlGenerator } from './server/url-generation.js';
/** Bounded retry + Promise.race timeout helpers used by `PineconeClient`. */
export { withRetry, withTimeout } from './server/retry.js';
export type { RetryOptions, TimeoutOptions } from './server/retry.js';
/** Build {@link ServerConfig} from CLI overrides + environment variables. */
export { resolveConfig } from './config.js';
export type { ServerConfig, LogLevel, LogFormat, ConfigOverrides } from './config.js';
/** Pinecone SDK wrapper: hybrid query, keyword search, count, namespace metadata. */
export { PineconeClient } from './pinecone-client.js';
export type {
  PineconeClientConfig,
  QueryParams,
  CountParams,
  CountResult,
  KeywordSearchParams,
  SearchResult,
  PineconeMetadataValue,
  QueryResponse,
  QueryResultRowShape,
} from './types.js';

/**
 * Create and configure the MCP server with all tools.
 *
 * The optional `config` argument lets library consumers thread runtime
 * settings (cache TTL, log format, suggest-flow gate) through the server
 * without touching environment variables. When omitted, defaults from
 * `getServerConfig()` are used so existing CLI callers keep working.
 *
 * @returns the configured `McpServer` instance, ready to connect to a transport.
 */
export async function setupServer(config?: ServerConfig): Promise<McpServer> {
  if (config) {
    setServerConfig(config);
  }

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
