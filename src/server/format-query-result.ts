/**
 * Shared formatting of Pinecone SearchResult into QueryResponse result rows.
 * Used by query tool and guided_query to avoid duplicated paper_number/title/author/url logic.
 */

import type { PineconeMetadataValue, SearchResult } from '../types.js';
import { generateUrlForNamespace } from './url-generation.js';

const DEFAULT_CONTENT_MAX_LENGTH = 2000;

export interface QueryResultRow {
  paper_number: string | null;
  title: string;
  author: string;
  url: string;
  content: string;
  score: number;
  reranked: boolean;
  metadata?: Record<string, PineconeMetadataValue>;
}

/**
 * Format a single search result into a QueryResponse result row.
 * Optionally enrich url using the namespace URL generator when metadata.url is missing (if supported).
 */
export function formatSearchResultAsRow(
  doc: SearchResult,
  options?: {
    namespace?: string;
    enrichUrls?: boolean;
    contentMaxLength?: number;
  }
): QueryResultRow {
  const contentMaxLength = options?.contentMaxLength ?? DEFAULT_CONTENT_MAX_LENGTH;
  const metadata = { ...doc.metadata } as Record<string, PineconeMetadataValue>;

  if (options?.enrichUrls && options?.namespace) {
    const generated = generateUrlForNamespace(options.namespace, metadata);
    const existingUrl = metadata['url'];
    const urlIsBlank = typeof existingUrl !== 'string' || existingUrl.trim() === '';
    if (generated.url && urlIsBlank) {
      metadata['url'] = generated.url;
    }
  }

  const docNum = metadata['document_number'];
  const filename = metadata['filename'];
  const paper_number =
    (typeof docNum === 'string' && docNum.length > 0 ? docNum : null) ??
    (typeof filename === 'string' && filename.length > 0
      ? filename.replace(/\.md$/i, '').toUpperCase()
      : null) ??
    null;

  return {
    paper_number,
    title: String(metadata['title'] ?? ''),
    author: String(metadata['author'] ?? ''),
    url: String(metadata['url'] ?? ''),
    content: doc.content.substring(0, contentMaxLength),
    score: Math.round(doc.score * 10000) / 10000,
    reranked: doc.reranked,
    metadata,
  };
}

/**
 * Format an array of search results into QueryResponse result rows.
 */
export function formatQueryResultRows(
  results: SearchResult[],
  options?: {
    namespace?: string;
    enrichUrls?: boolean;
    contentMaxLength?: number;
  }
): QueryResultRow[] {
  return results.map((doc) => formatSearchResultAsRow(doc, options));
}
