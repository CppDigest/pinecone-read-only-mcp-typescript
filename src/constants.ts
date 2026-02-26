/**
 * Constants for Pinecone Read-Only MCP
 */

export const DEFAULT_INDEX_NAME = 'rag-hybrid';
/** Default index name for keyword (sparse-only) search. Used by the keyword_search tool. */
export const DEFAULT_SPARSE_INDEX_NAME = 'pinecone-rag-sparse';
export const DEFAULT_RERANK_MODEL = 'bge-reranker-v2-m3';
export const DEFAULT_TOP_K = 10;
export const MAX_TOP_K = 100;
export const MIN_TOP_K = 1;
/** Namespace and suggestion caches stay valid for 30 minutes. */
export const FLOW_CACHE_TTL_MS = 30 * 60 * 1000;
/**
 * Maximum hits fetched by the count tool to deduplicate into a document count.
 * When the matching set exceeds this limit the count is capped; callers should
 * check the `truncated: true` flag in the response to detect this condition.
 */
export const COUNT_TOP_K = 10_000;
/**
 * Minimal fields fetched for count queries (no `chunk_text`) to reduce payload and cost.
 * All three fields are tried as deduplication keys in priority order:
 *   1. `document_number` — canonical document identifier used by most namespaces
 *   2. `url`            — used as a fallback document key when document_number is absent
 *   3. `doc_id`         — secondary fallback for namespaces that use a doc_id scheme
 */
export const COUNT_FIELDS = ['document_number', 'url', 'doc_id'] as const;
/** Default lightweight field set for fast queries. */
export const FAST_QUERY_FIELDS = ['document_number', 'title', 'url', 'author', 'doc_id'] as const;
/** query_documents: default and max number of documents to return (reassembled from chunks). */
export const DEFAULT_QUERY_DOCUMENTS_TOP_K = 5;
export const MAX_QUERY_DOCUMENTS_TOP_K = 20;
/** Max chunk hits to fetch when reassembling documents (then group by document). */
export const QUERY_DOCUMENTS_MAX_CHUNKS = 500;

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
- URL Generation: Use generate_urls to synthesize URLs for namespaces that support it when metadata lacks url.
- Document reassembly: Use query_documents to get whole documents (chunks grouped and merged by document_number/doc_id/url) for content analysis or summarization.
- Keyword search: Use keyword_search to query the sparse index (e.g. pinecone-rag-sparse) for lexical/keyword-only retrieval without reranking.

Usage:
1. Use list_namespaces (cached for 30 minutes) to discover available namespaces in the index
2. Optionally use namespace_router to choose candidate namespace(s) from user intent
3. Call suggest_query_params before query/count/query_documents tools (mandatory flow gate) to get suggested_fields and recommended tool
4. Use count for count questions, query_fast/query_detailed for chunk-level retrieval, or query_documents for full-document content`;
