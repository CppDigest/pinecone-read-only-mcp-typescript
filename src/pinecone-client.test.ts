import { describe, it, expect, beforeEach } from 'vitest';
import { PineconeClient } from './pinecone-client.js';

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
      process.env.PINECONE_INDEX_NAME = 'env-index';
      process.env.PINECONE_RERANK_MODEL = 'env-model';

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
  });
});
