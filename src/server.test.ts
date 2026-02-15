import { describe, expect, it } from 'vitest';
import { validateMetadataFilter, suggestQueryParams } from './server.js';

describe('suggestQueryParams', () => {
  const wg21Fields = {
    author: 'string[]',
    chunk_text: 'string',
    document_number: 'string',
    title: 'string',
    type: 'string',
    url: 'string',
  };

  it('suggests count tool and minimal fields for count-style queries', () => {
    const r = suggestQueryParams(wg21Fields, 'How many papers by Lakos?');
    expect(r.use_count_tool).toBe(true);
    expect(r.suggested_fields).toContain('document_number');
    expect(r.suggested_fields).toContain('url');
    expect(r.namespace_found).toBe(true);
  });

  it('suggests chunk_text for content-style queries', () => {
    const r = suggestQueryParams(wg21Fields, 'What does the paper say about contracts?');
    expect(r.use_count_tool).toBe(false);
    expect(r.suggested_fields).toContain('chunk_text');
    expect(r.namespace_found).toBe(true);
  });

  it('suggests minimal fields for list-style queries', () => {
    const r = suggestQueryParams(wg21Fields, 'List papers by Michael Wong with titles and links');
    expect(r.use_count_tool).toBe(false);
    expect(r.suggested_fields).not.toContain('chunk_text');
    expect(r.suggested_fields).toContain('title');
    expect(r.suggested_fields).toContain('url');
    expect(r.namespace_found).toBe(true);
  });

  it('returns namespace_found false when metadata is null', () => {
    const r = suggestQueryParams(null, 'list papers');
    expect(r.namespace_found).toBe(false);
    expect(r.suggested_fields).toEqual([]);
  });
});

describe('validateMetadataFilter', () => {
  it('accepts direct scalar equality filters', () => {
    const result = validateMetadataFilter({
      status: 'published',
      year: 2024,
      featured: true,
    });

    expect(result).toBeNull();
  });

  it('accepts supported comparison operators and array operators', () => {
    const result = validateMetadataFilter({
      year: { $gte: 2020, $lte: 2026 },
      tags: { $in: ['cpp', 'contracts'] },
    });

    expect(result).toBeNull();
  });

  it('rejects unsupported operators', () => {
    const result = validateMetadataFilter({
      year: { $regex: '^202' },
    });

    expect(result).toContain('Unsupported filter operator');
  });

  it('rejects non-array values for $in/$nin', () => {
    const result = validateMetadataFilter({
      tags: { $in: 'cpp' },
    });

    expect(result).toContain('must use an array of primitive values');
  });
});
