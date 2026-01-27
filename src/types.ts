/**
 * Types for Pinecone Read-Only MCP
 */

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
  metadata: Record<string, any>;
  reranked: boolean;
}

export interface PineconeHit {
  _id: string;
  _score: number;
  fields: Record<string, any>;
}

export interface PineconeSearchResponse {
  result?: {
    hits?: PineconeHit[];
  };
}

export interface NamespaceStats {
  namespaces?: Record<string, any>;
}

export interface QueryParams {
  query: string;
  topK?: number;
  namespace: string;
  metadataFilter?: Record<string, any>;
  useReranking?: boolean;
}

export interface ListNamespacesResponse {
  status: 'success' | 'error';
  namespaces?: string[];
  count?: number;
  message?: string;
}

export interface QueryResponse {
  status: 'success' | 'error';
  query?: string;
  namespace?: string;
  metadata_filter?: Record<string, any>;
  result_count?: number;
  results?: Array<{
    paper_number: string | null;
    title: string;
    author: string;
    url: string;
    content: string;
    score: number;
    reranked: boolean;
    metadata?: Record<string, any>; // Include all metadata fields
  }>;
  message?: string;
}
