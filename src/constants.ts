/**
 * Constants for Pinecone Read-Only MCP
 */

export const DEFAULT_INDEX_NAME = 'rag-hybrid';
export const DEFAULT_RERANK_MODEL = 'bge-reranker-v2-m3';
export const DEFAULT_TOP_K = 10;
export const MAX_TOP_K = 100;
export const MIN_TOP_K = 1;
export const DEFAULT_NAMESPACE = 'mailing';

export const SERVER_NAME = 'Pinecone Read-Only MCP';
export const SERVER_VERSION = '0.1.0';

export const SERVER_INSTRUCTIONS = `A semantic search server that provides hybrid search capabilities over Pinecone vector indexes with automatic namespace discovery.

Features:
- Hybrid Search: Combines dense and sparse embeddings for superior recall
- Semantic Reranking: Uses BGE reranker model for improved precision
- Dynamic Namespace Discovery: Automatically discovers available namespaces
- Metadata Filtering: Supports optional metadata filters for refined searches

Usage:
1. Use list_namespaces to discover available namespaces in the index
2. Use query to perform semantic search with hybrid retrieval and reranking`;
