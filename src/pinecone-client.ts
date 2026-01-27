/**
 * Pinecone client for hybrid search retrieval.
 *
 * Optimized Pinecone query class that performs hybrid search (dense + sparse)
 * with reranking. Designed for high performance with connection pooling and
 * lazy initialization.
 */

import { Pinecone } from '@pinecone-database/pinecone';
import type { PineconeClientConfig, SearchResult, PineconeHit, QueryParams } from './types.js';
import { DEFAULT_INDEX_NAME, DEFAULT_RERANK_MODEL, DEFAULT_TOP_K, MAX_TOP_K } from './constants.js';

export class PineconeClient {
  private apiKey: string;
  private indexName: string;
  private rerankModel: string;
  private defaultTopK: number;

  // Lazy initialization
  private pc: Pinecone | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private denseIndex: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sparseIndex: any = null;
  private initialized = false;

  constructor(config: PineconeClientConfig) {
    this.apiKey = config.apiKey;
    this.indexName = config.indexName || process.env['PINECONE_INDEX_NAME'] || DEFAULT_INDEX_NAME;
    this.rerankModel =
      config.rerankModel || process.env['PINECONE_RERANK_MODEL'] || DEFAULT_RERANK_MODEL;
    this.defaultTopK =
      config.defaultTopK || parseInt(process.env['PINECONE_TOP_K'] || String(DEFAULT_TOP_K));
  }

  /**
   * Ensure Pinecone client is initialized
   */
  private ensureClient(): Pinecone {
    if (!this.pc) {
      if (!this.apiKey) {
        throw new Error(
          'Pinecone API key is required. Set PINECONE_API_KEY environment variable or pass apiKey parameter.'
        );
      }
      this.pc = new Pinecone({ apiKey: this.apiKey });
      console.error('Pinecone client initialized');
    }
    return this.pc;
  }

  /**
   * Ensure Pinecone indexes are initialized and return them
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async ensureIndexes(): Promise<{ denseIndex: any; sparseIndex: any }> {
    if (this.initialized) {
      return { denseIndex: this.denseIndex, sparseIndex: this.sparseIndex };
    }

    const pc = this.ensureClient();
    const denseName = this.indexName;
    const sparseName = `${this.indexName}-sparse`;

    this.denseIndex = pc.index(denseName);
    this.sparseIndex = pc.index(sparseName);
    this.initialized = true;

    console.error(`Connected to indexes: ${denseName} and ${sparseName}`);
    return { denseIndex: this.denseIndex, sparseIndex: this.sparseIndex };
  }

  /**
   * List all available namespaces with their metadata information
   *
   * Fetches namespaces from the index stats and samples records to discover
   * available metadata fields and their types.
   */
  async listNamespacesWithMetadata(): Promise<
    Array<{
      namespace: string;
      recordCount: number;
      metadata: Record<string, string>;
    }>
  > {
    try {
      const { denseIndex } = await this.ensureIndexes();

      // Get index stats to find namespaces
      const stats = await denseIndex.describeIndexStats();
      const namespaces = stats?.namespaces ? Object.keys(stats.namespaces) : [];

      console.error(`Found ${namespaces.length} namespace(s)`);

      // Get metadata info for each namespace by sampling records
      const namespacesInfo = await Promise.all(
        namespaces.map(async (ns: string) => {
          try {
            const recordCount = stats.namespaces?.[ns]?.recordCount || 0;
            const metadataFields: Record<string, string> = {};

            // Sample a few records to discover metadata fields
            if (recordCount > 0) {
              try {
                const nsObj = denseIndex.namespace(ns);
                // Query with a dummy vector to get some sample records
                const sampleQuery = await nsObj.query({
                  topK: 5,
                  vector: Array(stats.dimension || 1536).fill(0),
                  includeMetadata: true,
                });

                // Collect unique metadata fields and infer types
                if (sampleQuery?.matches) {
                  sampleQuery.matches.forEach((match: any) => {
                    if (match.metadata) {
                      Object.entries(match.metadata).forEach(([key, value]) => {
                        if (!(key in metadataFields)) {
                          metadataFields[key] = typeof value;
                        }
                      });
                    }
                  });
                }
              } catch (queryError) {
                console.error(`Error sampling records for namespace ${ns}:`, queryError);
              }
            }

            return {
              namespace: ns,
              recordCount,
              metadata: metadataFields,
            };
          } catch (error) {
            console.error(`Error processing namespace ${ns}:`, error);
            return {
              namespace: ns,
              recordCount: 0,
              metadata: {},
            };
          }
        })
      );

      return namespacesInfo;
    } catch (error) {
      console.error('Error listing namespaces:', error);
      return [];
    }
  }

  /**
   * Search a Pinecone index using text query with optional metadata filtering
   */
  private async searchIndex(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    index: any,
    query: string,
    topK: number,
    namespace?: string,
    metadataFilter?: Record<string, any>
  ): Promise<PineconeHit[]> {
    try {
      // Get namespace object
      const ns = namespace ? index.namespace(namespace) : index;

      // Use searchRecords API (Pinecone v5+)
      const queryParams: any = {
        query: {
          topK,
          inputs: { text: query },
        },
      };

      // Add metadata filter if provided
      if (metadataFilter && Object.keys(metadataFilter).length > 0) {
        queryParams.query.filter = metadataFilter;
        console.error('Applying metadata filter:', JSON.stringify(metadataFilter));
      }

      const result = await ns.searchRecords(queryParams);

      return result?.result?.hits || [];
    } catch (error) {
      console.error('Error searching index:', error);
      return [];
    }
  }

  /**
   * Merge and deduplicate results from dense and sparse searches
   *
   * Uses the higher score when duplicates are found.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mergeResults(denseHits: PineconeHit[], sparseHits: PineconeHit[]): any[] {
    const deduped: Record<string, any> = {};

    for (const hit of [...denseHits, ...sparseHits]) {
      const hitId = hit._id || '';
      const hitScore = hit._score || 0;

      if (hitId in deduped && (deduped[hitId]._score || 0) >= hitScore) {
        continue;
      }

      const hitMetadata: Record<string, any> = {};
      let content = '';

      for (const [key, value] of Object.entries(hit.fields || {})) {
        if (key === 'chunk_text') {
          content = value;
        } else {
          hitMetadata[key] = value;
        }
      }

      deduped[hitId] = {
        _id: hitId,
        _score: hitScore,
        chunk_text: content,
        metadata: hitMetadata,
      };
    }

    return Object.values(deduped).sort((a, b) => (b._score || 0) - (a._score || 0));
  }

  /**
   * Rerank results using Pinecone's reranking model
   */
  private async rerankResults(
    query: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    results: any[],
    topN: number
  ): Promise<SearchResult[]> {
    if (!results || results.length === 0) {
      return [];
    }

    const pc = this.ensureClient();

    try {
      const rerankResult = await pc.inference.rerank(this.rerankModel, query, results, {
        topN,
        rankFields: ['chunk_text'],
        returnDocuments: true,
        parameters: { truncate: 'END' },
      });

      const reranked: SearchResult[] = [];
      for (const item of rerankResult.data || []) {
        const document = item.document || {};
        reranked.push({
          id: document['_id'] || '',
          content: document['chunk_text'] || '',
          score: parseFloat(String(item.score || 0)),
          metadata: document['metadata'] || {},
          reranked: true,
        });
      }
      return reranked;
    } catch (error) {
      console.error('Error reranking results:', error);
      // Fall back to returning unreranked results
      return results.slice(0, topN).map((result) => ({
        id: result._id || '',
        content: result.chunk_text || '',
        score: result._score || 0,
        metadata: result.metadata || {},
        reranked: false,
      }));
    }
  }

  /**
   * Query Pinecone indexes using hybrid search with optional reranking
   *
   * Performs parallel searches on dense and sparse indexes, merges results,
   * and optionally reranks using the configured reranking model.
   */
  async query(params: QueryParams): Promise<SearchResult[]> {
    const { query, topK: requestedTopK, namespace, metadataFilter, useReranking = true } = params;

    // Validate inputs
    if (!query || !query.trim()) {
      throw new Error('Query cannot be empty');
    }

    let topK = requestedTopK !== undefined ? requestedTopK : this.defaultTopK;
    if (topK < 1) {
      throw new Error('topK must be at least 1');
    }
    if (topK > MAX_TOP_K) {
      topK = MAX_TOP_K; // Cap at 100 for performance
    }

    // Ensure indexes are ready
    const { denseIndex, sparseIndex } = await this.ensureIndexes();

    // Perform hybrid search
    const [denseHits, sparseHits] = await Promise.all([
      this.searchIndex(denseIndex, query, topK, namespace, metadataFilter),
      this.searchIndex(sparseIndex, query, topK, namespace, metadataFilter),
    ]);

    // Merge results
    const mergedResults = this.mergeResults(denseHits, sparseHits);

    // Optionally rerank
    let documents: SearchResult[];
    if (useReranking) {
      documents = await this.rerankResults(query, mergedResults, topK);
    } else {
      documents = mergedResults.slice(0, topK).map((result) => ({
        id: result._id || '',
        content: result.chunk_text || '',
        score: result._score || 0,
        metadata: result.metadata || {},
        reranked: false,
      }));
    }

    console.error(
      `Retrieved ${documents.length} documents from hybrid search (dense: ${denseHits.length}, sparse: ${sparseHits.length})`
    );

    return documents;
  }
}
