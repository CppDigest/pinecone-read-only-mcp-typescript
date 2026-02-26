/**
 * Pinecone client for hybrid search retrieval.
 *
 * Optimized Pinecone query class that performs hybrid search (dense + sparse)
 * with reranking. Designed for high performance with connection pooling and
 * lazy initialization.
 */

import { Pinecone } from '@pinecone-database/pinecone';
import {
  debug as logDebug,
  error as logError,
  info as logInfo,
  warn as logWarn,
} from './logger.js';
import type {
  PineconeClientConfig,
  SearchResult,
  PineconeHit,
  QueryParams,
  CountParams,
  CountResult,
  KeywordSearchParams,
  MergedHit,
  NamespaceHandle,
  SearchableIndex,
  PineconeMetadataValue,
} from './types.js';
import {
  DEFAULT_INDEX_NAME,
  DEFAULT_RERANK_MODEL,
  DEFAULT_SPARSE_INDEX_NAME,
  DEFAULT_TOP_K,
  MAX_TOP_K,
  COUNT_TOP_K,
  COUNT_FIELDS,
} from './constants.js';

/**
 * Infers a human-readable metadata field type for namespace discovery.
 * Distinguishes Pinecone-supported list type (string[]) from other arrays.
 */
function inferMetadataFieldType(value: unknown): string {
  if (value === null || value === undefined) {
    return 'unknown';
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return 'array';
    if (value.every((item) => typeof item === 'string')) return 'string[]';
    return 'array';
  }
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return t;
  return 'object';
}

export class PineconeClient {
  private apiKey: string;
  private indexName: string;
  private sparseIndexName: string;
  private rerankModel: string;
  private defaultTopK: number;

  // Lazy initialization
  private pc: Pinecone | null = null;
  private denseIndex: SearchableIndex | null = null;
  private sparseIndex: SearchableIndex | null = null;
  private keywordIndex: SearchableIndex | null = null;
  private initialized = false;

  /** Create a client with the given config; env vars override index name, rerank model, and top-k. */
  constructor(config: PineconeClientConfig) {
    this.apiKey = config.apiKey;
    this.indexName = config.indexName || process.env['PINECONE_INDEX_NAME'] || DEFAULT_INDEX_NAME;
    this.sparseIndexName =
      config.sparseIndexName ||
      process.env['PINECONE_SPARSE_INDEX_NAME'] ||
      DEFAULT_SPARSE_INDEX_NAME;
    this.rerankModel =
      config.rerankModel || process.env['PINECONE_RERANK_MODEL'] || DEFAULT_RERANK_MODEL;
    this.defaultTopK =
      config.defaultTopK || parseInt(process.env['PINECONE_TOP_K'] || String(DEFAULT_TOP_K));
  }

  /** Returns the configured sparse index name used for keyword search (runtime value). */
  getSparseIndexName(): string {
    return this.sparseIndexName;
  }

  /**
   * Normalize and clamp topK from request (validates >= 1, caps at MAX_TOP_K).
   */
  private clampTopK(requested: number | undefined): number {
    let topK = requested !== undefined ? requested : this.defaultTopK;
    if (topK < 1) {
      throw new Error('topK must be at least 1');
    }
    if (topK > MAX_TOP_K) {
      topK = MAX_TOP_K;
    }
    return topK;
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
      logInfo('Pinecone client initialized');
    }
    return this.pc;
  }

  /**
   * Ensure Pinecone indexes are initialized and return them
   */
  private async ensureIndexes(): Promise<{
    denseIndex: SearchableIndex;
    sparseIndex: SearchableIndex;
  }> {
    if (this.initialized && this.denseIndex !== null && this.sparseIndex !== null) {
      return { denseIndex: this.denseIndex, sparseIndex: this.sparseIndex };
    }

    const pc = this.ensureClient();
    const denseName = this.indexName;
    const sparseName = `${this.indexName}-sparse`;

    const dense = pc.index(denseName) as unknown as SearchableIndex;
    const sparse = pc.index(sparseName) as unknown as SearchableIndex;
    this.denseIndex = dense;
    this.sparseIndex = sparse;
    this.initialized = true;

    logInfo(`Connected to indexes: ${denseName} and ${sparseName}`);
    return { denseIndex: dense, sparseIndex: sparse };
  }

  /**
   * Ensure the dedicated keyword (sparse-only) index is initialized.
   * Used by the keyword_search tool to query pinecone-rag-sparse (or configured name).
   */
  private async ensureKeywordIndex(): Promise<SearchableIndex> {
    if (this.keywordIndex !== null) {
      return this.keywordIndex;
    }
    const pc = this.ensureClient();
    const index = pc.index(this.sparseIndexName) as unknown as SearchableIndex;
    this.keywordIndex = index;
    logInfo(`Keyword search index: ${this.sparseIndexName}`);
    return index;
  }

  /**
   * List namespaces present on the keyword (sparse) index used for keyword_search.
   * Use this to choose a namespace for sparse-only queries instead of the dense index list.
   */
  async listNamespacesFromKeywordIndex(): Promise<
    Array<{ namespace: string; recordCount: number }>
  > {
    try {
      const keywordIndex = await this.ensureKeywordIndex();
      const stats = keywordIndex.describeIndexStats
        ? await keywordIndex.describeIndexStats()
        : undefined;
      const namespaces = stats?.namespaces ?? {};
      return Object.entries(namespaces).map(([namespace, info]) => ({
        namespace,
        recordCount: info?.recordCount ?? 0,
      }));
    } catch (error) {
      logError('Error listing namespaces from keyword index', error);
      return [];
    }
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
      const stats = denseIndex.describeIndexStats
        ? await denseIndex.describeIndexStats()
        : undefined;
      const namespaces = stats?.namespaces ? Object.keys(stats.namespaces) : [];

      logInfo(`Found ${namespaces.length} namespace(s)`);

      // Get metadata info for each namespace by sampling records
      const namespacesInfo = await Promise.all(
        namespaces.map(async (ns: string) => {
          try {
            const recordCount = stats?.namespaces?.[ns]?.recordCount || 0;
            const metadataFields: Record<string, string> = {};

            // Sample a few records to discover metadata fields
            if (recordCount > 0 && denseIndex.namespace) {
              try {
                const nsObj: NamespaceHandle = denseIndex.namespace(ns);
                const sampleQuery =
                  typeof nsObj.query === 'function'
                    ? await nsObj.query({
                        topK: 5,
                        vector: Array(stats?.dimension ?? 1536).fill(0),
                        includeMetadata: true,
                      })
                    : { matches: undefined };

                // Collect unique metadata fields and infer types (including string[])
                if (sampleQuery?.matches) {
                  sampleQuery.matches.forEach((match: { metadata?: Record<string, unknown> }) => {
                    if (match.metadata) {
                      Object.entries(match.metadata).forEach(([key, value]) => {
                        const inferredType = inferMetadataFieldType(value);
                        if (!(key in metadataFields)) {
                          metadataFields[key] = inferredType;
                        } else if (
                          (metadataFields[key] === 'object' || metadataFields[key] === 'array') &&
                          inferredType === 'string[]'
                        ) {
                          // Prefer array type over generic object when we see it in another sample
                          metadataFields[key] = inferredType;
                        }
                      });
                    }
                  });
                }
              } catch (queryError) {
                logError(`Error sampling records for namespace ${ns}`, queryError);
              }
            }

            return {
              namespace: ns,
              recordCount,
              metadata: metadataFields,
            };
          } catch (error) {
            logError(`Error processing namespace ${ns}`, error);
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
      logError('Error listing namespaces', error);
      return [];
    }
  }

  /**
   * Search a Pinecone index using text query with optional metadata filtering.
   * When options.fields is set, only those fields are requested (e.g. for count: no chunk_text).
   */
  private async searchIndex(
    index: SearchableIndex,
    query: string,
    topK: number,
    namespace?: string,
    metadataFilter?: Record<string, unknown>,
    options?: { fields?: string[] }
  ): Promise<PineconeHit[]> {
    // Build query payload in the same shape as Python implementation.
    const queryPayload: Record<string, unknown> = {
      top_k: topK,
      inputs: { text: query },
    };

    // Include filter when explicitly provided (matches Python behavior).
    if (metadataFilter !== undefined) {
      queryPayload['filter'] = metadataFilter;
      logDebug('Applying metadata filter', metadataFilter);
    }

    try {
      // Preferred path: Pinecone search API.
      if (typeof index.search === 'function') {
        const searchOpts: {
          namespace?: string;
          query: Record<string, unknown>;
          fields?: string[];
        } = {
          namespace,
          query: queryPayload,
        };
        if (options?.fields?.length) {
          searchOpts.fields = options.fields;
        }
        const result = await index.search(searchOpts);
        return result?.result?.hits || [];
      }

      // Backward-compatible fallback for older API shapes.
      const target = namespace && index.namespace ? index.namespace(namespace) : index;
      const queryParams: { query: Record<string, unknown>; fields?: string[] } = {
        query: {
          topK,
          inputs: { text: query },
        },
      };
      if (metadataFilter !== undefined) {
        queryParams.query['filter'] = metadataFilter;
      }
      if (options?.fields?.length) {
        queryParams.fields = options.fields;
      }
      const result = target.searchRecords
        ? await target.searchRecords(queryParams)
        : { result: { hits: [] as PineconeHit[] } };
      return result?.result?.hits || [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Pinecone search failed for namespace "${namespace ?? 'default'}": ${errorMessage}`
      );
    }
  }

  /**
   * Merge and deduplicate results from dense and sparse searches
   *
   * Uses the higher score when duplicates are found.
   */
  private mergeResults(denseHits: PineconeHit[], sparseHits: PineconeHit[]): MergedHit[] {
    const deduped: Record<string, MergedHit> = {};

    for (const hit of [...denseHits, ...sparseHits]) {
      const hitId = hit._id || '';
      const hitScore = hit._score || 0;

      const existing = deduped[hitId];
      if (existing !== undefined && (existing._score || 0) >= hitScore) {
        continue;
      }

      const hitMetadata: Record<string, PineconeMetadataValue> = {};
      let content = '';

      for (const [key, value] of Object.entries(hit.fields || {})) {
        if (key === 'chunk_text') {
          content = typeof value === 'string' ? value : '';
        } else {
          hitMetadata[key] = value as PineconeMetadataValue;
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
    results: MergedHit[],
    topN: number
  ): Promise<SearchResult[]> {
    if (!results || results.length === 0) {
      return [];
    }

    const pc = this.ensureClient();

    try {
      const rerankResult = await pc.inference.rerank({
        model: this.rerankModel,
        query,
        // The Pinecone SDK types constrain document values to `Record<string, string>`,
        // but the underlying HTTP API accepts any JSON value. We pass MergedHit objects
        // (metadata may contain number/boolean/string[]) and only `chunk_text` — which is
        // always a string — is accessed via rankFields. The double cast via `as unknown`
        // is intentional: it bypasses the SDK's over-narrow type without stringifying
        // metadata values that we need to read back from the returned documents.
        documents: results as unknown as (string | Record<string, string>)[],
        topN,
        rankFields: ['chunk_text'],
        returnDocuments: true,
        parameters: { truncate: 'END' },
      });

      const reranked: SearchResult[] = [];
      for (const item of rerankResult.data || []) {
        const document = (item.document || {}) as MergedHit;
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
      logError('Error reranking results', error);
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
    const {
      query,
      topK: requestedTopK,
      namespace,
      metadataFilter,
      useReranking = true,
      fields: requestedFields,
    } = params;

    // Validate inputs
    if (!query || !query.trim()) {
      throw new Error('Query cannot be empty');
    }

    const topK = this.clampTopK(requestedTopK);

    // When reranking, Pinecone requires chunk_text in returned fields; add it if user specified fields without it
    const searchFields =
      requestedFields?.length && useReranking && !requestedFields.includes('chunk_text')
        ? [...requestedFields, 'chunk_text']
        : requestedFields;

    // Ensure indexes are ready
    const { denseIndex, sparseIndex } = await this.ensureIndexes();

    const searchOptions = searchFields?.length ? { fields: searchFields } : undefined;

    // Perform hybrid search
    const [denseResult, sparseResult] = await Promise.allSettled([
      this.searchIndex(denseIndex, query, topK, namespace, metadataFilter, searchOptions),
      this.searchIndex(sparseIndex, query, topK, namespace, metadataFilter, searchOptions),
    ]);

    const denseHits = denseResult.status === 'fulfilled' ? denseResult.value : [];
    const sparseHits = sparseResult.status === 'fulfilled' ? sparseResult.value : [];

    if (denseResult.status === 'rejected') {
      logError('Dense index search failed', denseResult.reason);
    }
    if (sparseResult.status === 'rejected') {
      logError('Sparse index search failed', sparseResult.reason);
    }
    if (denseResult.status === 'rejected' && sparseResult.status === 'rejected') {
      throw new Error('Hybrid search failed: both dense and sparse index searches failed.');
    }

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

    logInfo(
      `Retrieved ${documents.length} documents from hybrid search (dense: ${denseHits.length}, sparse: ${sparseHits.length})`
    );

    return documents;
  }

  /**
   * Keyword (sparse-only) search against the dedicated sparse index.
   * Performs lexical/keyword retrieval only—no dense index, no reranking.
   * Use for exact or keyword-style queries on the pinecone-rag-sparse index.
   */
  async keywordSearch(params: KeywordSearchParams): Promise<SearchResult[]> {
    const {
      query,
      namespace,
      topK: requestedTopK,
      metadataFilter,
      fields: requestedFields,
    } = params;

    if (!query || !query.trim()) {
      throw new Error('Query cannot be empty');
    }

    const topK = this.clampTopK(requestedTopK);

    const keywordIndex = await this.ensureKeywordIndex();
    const searchOptions = requestedFields?.length ? { fields: requestedFields } : undefined;

    const hits = await this.searchIndex(
      keywordIndex,
      query.trim(),
      topK,
      namespace,
      metadataFilter,
      searchOptions
    );

    const documents: SearchResult[] = hits.map((hit) => {
      const fields = hit.fields || {};
      let content = '';
      const metadata: Record<string, PineconeMetadataValue> = {};
      for (const [key, value] of Object.entries(fields)) {
        if (key === 'chunk_text') {
          content = typeof value === 'string' ? value : '';
        } else {
          metadata[key] = value as PineconeMetadataValue;
        }
      }
      return {
        id: hit._id || '',
        content,
        score: hit._score || 0,
        metadata,
        reranked: false,
      };
    });

    logInfo(`Keyword search returned ${documents.length} results from ${this.sparseIndexName}`);
    return documents;
  }

  /**
   * Return the number of unique documents matching the query and optional metadata filter.
   * Uses semantic search only (dense index), requests minimal fields (document_number, url, doc_id)
   * to avoid transferring chunk content, and deduplicates by document for a document-level count.
   */
  async count(params: CountParams): Promise<CountResult> {
    if (!params.query || !params.query.trim()) {
      throw new Error('Query cannot be empty');
    }
    const { denseIndex } = await this.ensureIndexes();

    const hits = await this.searchIndex(
      denseIndex,
      params.query,
      COUNT_TOP_K,
      params.namespace,
      params.metadataFilter,
      { fields: [...COUNT_FIELDS] }
    );

    const docKeys = new Set<string>();
    let idFallbackCount = 0;
    for (const hit of hits) {
      const fields = hit.fields || {};
      const docNumber = fields['document_number'];
      const url = fields['url'];
      const docId = fields['doc_id'];
      const docKey =
        (typeof docNumber === 'string' ? docNumber : undefined) ??
        (typeof url === 'string' ? url : undefined) ??
        (typeof docId === 'string' ? docId : undefined);
      if (docKey !== undefined) {
        docKeys.add(docKey);
      } else {
        // Fall back to chunk ID — this yields a chunk count, not a document count
        idFallbackCount++;
        docKeys.add(hit._id ?? '');
      }
    }
    if (idFallbackCount > 0) {
      logWarn(
        `count(): ${idFallbackCount} hit(s) in namespace "${params.namespace}" had none of the ` +
          `identifier fields (${COUNT_FIELDS.join(', ')}); fell back to chunk ID — result may overcount documents`
      );
    }

    const count = docKeys.size;
    return {
      count,
      truncated: hits.length >= COUNT_TOP_K,
    };
  }
}
