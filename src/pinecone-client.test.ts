import { describe, it, expect, beforeEach } from 'vitest';
import { PineconeClient } from './pinecone-client.js';
import type { SearchableIndex, PineconeHit } from './types.js';

/** Test double: client with stubbable ensureIndexes and searchIndex for hybrid tests */
type PineconeClientTestDouble = PineconeClient & {
  ensureIndexes: () => Promise<{ denseIndex: SearchableIndex; sparseIndex: SearchableIndex }>;
  searchIndex: (
    index: SearchableIndex,
    query: string,
    topK: number,
    namespace?: string,
    metadataFilter?: Record<string, unknown>,
    options?: { fields?: string[] }
  ) => Promise<PineconeHit[]>;
};

describe('PineconeClient', () => {
  let client: PineconeClient;

  beforeEach(() => {
    client = new PineconeClient({
      apiKey: 'test-api-key',
      indexName: 'test-index',
      rerankModel: 'test-model',
    });
  });

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      expect(client).toBeDefined();
    });

    it('should use environment variables as fallbacks', () => {
      process.env['PINECONE_INDEX_NAME'] = 'env-index';
      process.env['PINECONE_RERANK_MODEL'] = 'env-model';

      const envClient = new PineconeClient({
        apiKey: 'test-api-key',
      });

      expect(envClient).toBeDefined();
    });
  });

  describe('query', () => {
    it('should throw error for empty query', async () => {
      await expect(
        client.query({
          query: '',
          namespace: 'test',
        })
      ).rejects.toThrow('Query cannot be empty');
    });

    it('should throw error for topK less than 1', async () => {
      await expect(
        client.query({
          query: 'test query',
          namespace: 'test',
          topK: 0,
        })
      ).rejects.toThrow('topK must be at least 1');
    });

    it('should continue hybrid search when one index fails', async () => {
      const testClient = client as PineconeClientTestDouble;

      testClient.ensureIndexes = async () => ({ denseIndex: {} as SearchableIndex, sparseIndex: {} as SearchableIndex });

      let searchCall = 0;
      testClient.searchIndex = async () => {
        searchCall += 1;
        if (searchCall === 1) {
          throw new Error('dense failure');
        }
        return [
          {
            _id: 'doc-1',
            _score: 0.9,
            fields: { chunk_text: 'hybrid content', author: 'tester' },
          },
        ];
      };

      const results = await client.query({
        query: 'hybrid search',
        namespace: 'test',
        topK: 5,
        useReranking: false,
      });

      expect(results).toHaveLength(1);
      expect(results[0].content).toBe('hybrid content');
      expect(results[0].metadata.author).toBe('tester');
    });

    it('should throw when both dense and sparse searches fail', async () => {
      const testClient = client as PineconeClientTestDouble;

      testClient.ensureIndexes = async () => ({ denseIndex: {} as SearchableIndex, sparseIndex: {} as SearchableIndex });
      testClient.searchIndex = async () => {
        throw new Error('index failure');
      };

      await expect(
        client.query({
          query: 'hybrid search',
          namespace: 'test',
          topK: 5,
          useReranking: false,
        })
      ).rejects.toThrow('Hybrid search failed: both dense and sparse index searches failed.');
    });
  });

  describe('count', () => {
    it('should return unique document count using semantic search only with minimal fields', async () => {
      const testClient = client as PineconeClientTestDouble;
      testClient.ensureIndexes = async () => ({ denseIndex: {} as SearchableIndex, sparseIndex: {} as SearchableIndex });

      // Two chunks from doc A, one from doc B -> unique count 2
      testClient.searchIndex = async (_index, _query, _topK, _ns, _filter, options) => {
        expect(options?.fields).toEqual(['document_number', 'url', 'doc_id']);
        return [
          { _id: 'c1', _score: 1, fields: { document_number: 'p1234r0', url: 'https://example.com/1' } },
          { _id: 'c2', _score: 0.9, fields: { document_number: 'p1234r0', url: 'https://example.com/1' } },
          { _id: 'c3', _score: 0.8, fields: { document_number: 'p5678r0', url: 'https://example.com/2' } },
        ];
      };

      const result = await client.count({
        query: 'paper',
        namespace: 'wg21-papers',
        metadataFilter: { author: { $in: ['John Doe'] } },
      });

      expect(result.count).toBe(2);
      expect(result.truncated).toBe(false);
    });

    it('should set truncated when hit limit is reached', async () => {
      const testClient = client as PineconeClientTestDouble;
      testClient.ensureIndexes = async () => ({ denseIndex: {} as SearchableIndex, sparseIndex: {} as SearchableIndex });
      const manyHits: PineconeHit[] = Array.from({ length: 10000 }, (_, i) => ({
        _id: `id-${i}`,
        _score: 1,
        fields: { doc_id: `doc-${i}` },
      }));
      testClient.searchIndex = async () => manyHits;

      const result = await client.count({ query: 'paper', namespace: 'ns' });

      expect(result.count).toBe(10000);
      expect(result.truncated).toBe(true);
    });
  });
});
