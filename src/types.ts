/**
 * Types for Pinecone Read-Only MCP
 */

/** Pinecone metadata value types: string, number, boolean, or list of strings */
export type PineconeMetadataValue = string | number | boolean | string[];

export interface PineconeClientConfig {
  apiKey: string;
  indexName?: string;
  rerankModel?: string;
  defaultTopK?: number;
}

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata: Record<string, PineconeMetadataValue>;
  reranked: boolean;
}

export interface PineconeHit {
  _id: string;
  _score: number;
  fields: Record<string, PineconeMetadataValue>;
}

export interface PineconeSearchResponse {
  result?: {
    hits?: PineconeHit[];
  };
}

export interface NamespaceStats {
  namespaces?: Record<string, unknown>;
}

export interface QueryParams {
  query: string;
  topK?: number;
  namespace: string;
  metadataFilter?: Record<string, unknown>;
  useReranking?: boolean;
  /** If set, only these fields are requested from Pinecone (e.g. ["document_number", "title", "url"]). Omit for all fields. Include "chunk_text" for content. */
  fields?: string[];
}

/** Parameters for count-only requests (high top_k, no reranking). */
export interface CountParams {
  query: string;
  namespace: string;
  metadataFilter?: Record<string, unknown>;
}

/** Result of a count request: unique document count (deduped by doc id/url); truncated when at least COUNT_TOP_K. */
export interface CountResult {
  count: number;
  truncated: boolean;
}

export interface ListNamespacesResponse {
  status: 'success' | 'error';
  namespaces?: string[];
  count?: number;
  message?: string;
}

export interface QueryResponse {
  status: 'success' | 'error';
  mode?: 'query' | 'query_fast' | 'query_detailed';
  query?: string;
  namespace?: string;
  metadata_filter?: Record<string, unknown>;
  result_count?: number;
  /** Present when the query requested specific fields. */
  fields?: string[];
  results?: Array<{
    paper_number: string | null;
    title: string;
    author: string;
    url: string;
    content: string;
    score: number;
    reranked: boolean;
    metadata?: Record<string, PineconeMetadataValue>;
  }>;
  message?: string;
}

/** Internal merged hit shape before rerank (dense + sparse deduped). */
export interface MergedHit {
  _id: string;
  _score: number;
  chunk_text: string;
  metadata: Record<string, PineconeMetadataValue>;
}

/** Minimal index interface used for hybrid search (dense/sparse) and namespace discovery. */
export interface SearchableIndex {
  describeIndexStats?(): Promise<{
    dimension?: number;
    namespaces?: Record<string, { recordCount?: number }>;
  }>;
  search?(opts: {
    namespace?: string;
    query: Record<string, unknown>;
    fields?: string[];
  }): Promise<{ result?: { hits?: PineconeHit[] } }>;
  namespace?(name: string): SearchableIndex & {
    query?(opts: { topK: number; vector: number[]; includeMetadata: boolean }): Promise<{
      matches?: Array<{ metadata?: Record<string, unknown> }>;
    }>;
  };
  searchRecords?(params: {
    query: Record<string, unknown>;
  }): Promise<{ result?: { hits?: PineconeHit[] } }>;
}
