import { describe, it, expect } from 'vitest';
import { reassembleByDocument } from './reassemble-documents.js';
import type { SearchResult } from '../types.js';

describe('reassembleByDocument', () => {
  it('groups chunks by document_number', () => {
    const results: SearchResult[] = [
      {
        id: 'c1',
        content: 'First chunk.',
        score: 0.9,
        metadata: { document_number: 'P1234', chunk_index: 0 },
        reranked: false,
      },
      {
        id: 'c2',
        content: 'Second chunk.',
        score: 0.8,
        metadata: { document_number: 'P1234', chunk_index: 1 },
        reranked: false,
      },
      {
        id: 'c3',
        content: 'Other doc.',
        score: 0.7,
        metadata: { document_number: 'P5678' },
        reranked: false,
      },
    ];
    const docs = reassembleByDocument(results);
    expect(docs).toHaveLength(2);
    const p1234 = docs.find((d) => d.document_id === 'P1234');
    const p5678 = docs.find((d) => d.document_id === 'P5678');
    expect(p1234?.merged_content).toBe('First chunk.\n\nSecond chunk.');
    expect(p1234?.chunk_count).toBe(2);
    expect(p5678?.merged_content).toBe('Other doc.');
    expect(p5678?.chunk_count).toBe(1);
  });

  it('sorts chunks by chunk_index when present', () => {
    const results: SearchResult[] = [
      {
        id: 'b',
        content: 'Second',
        score: 0.5,
        metadata: { document_number: 'D1', chunk_index: 1 },
        reranked: false,
      },
      {
        id: 'a',
        content: 'First',
        score: 0.9,
        metadata: { document_number: 'D1', chunk_index: 0 },
        reranked: false,
      },
    ];
    const docs = reassembleByDocument(results);
    expect(docs[0].merged_content).toBe('First\n\nSecond');
  });

  it('uses doc_id when document_number is missing', () => {
    const results: SearchResult[] = [
      {
        id: 'x',
        content: 'Content',
        score: 0.8,
        metadata: { doc_id: 'my-doc-1' },
        reranked: false,
      },
    ];
    const docs = reassembleByDocument(results);
    expect(docs[0].document_id).toBe('my-doc-1');
  });

  it('respects maxChunksPerDocument', () => {
    const results: SearchResult[] = Array.from({ length: 10 }, (_, i) => ({
      id: `c${i}`,
      content: `Chunk ${i}`,
      score: 0.9 - i * 0.01,
      metadata: { document_number: 'P1', chunk_index: i },
      reranked: false,
    }));
    const docs = reassembleByDocument(results, { maxChunksPerDocument: 3 });
    expect(docs).toHaveLength(1);
    expect(docs[0].chunk_count).toBe(3);
    expect(docs[0].merged_content).toBe('Chunk 0\n\nChunk 1\n\nChunk 2');
  });
});
