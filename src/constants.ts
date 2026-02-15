/**
 * Constants for Pinecone Read-Only MCP
 */

export const DEFAULT_INDEX_NAME = 'rag-hybrid';
export const DEFAULT_RERANK_MODEL = 'bge-reranker-v2-m3';
export const DEFAULT_TOP_K = 10;
export const MAX_TOP_K = 100;
export const MIN_TOP_K = 1;
/** Namespace and suggestion caches stay valid for 30 minutes. */
export const FLOW_CACHE_TTL_MS = 30 * 60 * 1000;
/** Top-k used by the count tool to get total matching documents (Pinecone allows high values). */
export const COUNT_TOP_K = 10_000;
/** Minimal fields requested for count (no chunk_text) to reduce payload and cost. */
export const COUNT_FIELDS = ['document_number', 'url', 'doc_id'] as const;
/** Default lightweight field set for fast queries. */
export const FAST_QUERY_FIELDS = ['document_number', 'title', 'url', 'author', 'doc_id'] as const;
export const DEFAULT_NAMESPACE = 'mailing';

export const SERVER_NAME = 'Pinecone Read-Only MCP';
export const SERVER_VERSION = '0.1.0';

export const SERVER_INSTRUCTIONS = `A semantic search server that provides hybrid search capabilities over Pinecone vector indexes with automatic namespace discovery.

Features:
- Hybrid Search: Combines dense and sparse embeddings for superior recall
- Semantic Reranking: Uses BGE reranker model for improved precision
- Dynamic Namespace Discovery: Automatically discovers available namespaces
- Metadata Filtering: Supports optional metadata filters for refined searches
- Namespace Router: Suggests likely namespace(s) from natural-language intent
- Count: Use the count tool for "how many X?" questions; it uses semantic search only and minimal fields (no content) for performance, returning unique document count.
- URL Generation: Use generate_urls to synthesize URLs for mailing/slack records when metadata lacks url.

Usage:
1. Use list_namespaces (cached for 30 minutes) to discover available namespaces in the index
2. Optionally use namespace_router to choose candidate namespace(s) from user intent
3. Call suggest_query_params before query/count tools (mandatory flow gate) to get suggested_fields and recommended tool
4. Use count for count questions, query_fast for lightweight retrieval, or query_detailed/query for content-heavy retrieval`;
