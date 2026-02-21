import { describe, expect, it } from 'vitest';
import { generateUrlForNamespace } from './url-generation.js';

describe('generateUrlForNamespace', () => {
  it('uses existing metadata.url when present', () => {
    const r = generateUrlForNamespace('mailing', {
      url: 'https://example.com/custom',
      doc_id: 'ignored',
    });
    expect(r.url).toBe('https://example.com/custom');
    expect(r.method).toBe('metadata.url');
  });

  it('generates mailing URL from doc_id', () => {
    const r = generateUrlForNamespace('mailing', {
      doc_id: 'boost-announce@lists.boost.org/message/O5VYCDZADVDHK5Z5LAYJBHMDOAFQL7P6',
    });
    expect(r.url).toBe(
      'https://lists.boost.org/archives/list/boost-announce@lists.boost.org/message/O5VYCDZADVDHK5Z5LAYJBHMDOAFQL7P6/'
    );
    expect(r.method).toBe('generated.mailing');
  });

  it('generates mailing URL from thread_id when doc_id missing', () => {
    const r = generateUrlForNamespace('mailing', {
      thread_id: 'boost@lists.boost.org/thread/ABC123',
    });
    expect(r.url).toBe(
      'https://lists.boost.org/archives/list/boost@lists.boost.org/thread/ABC123/'
    );
    expect(r.method).toBe('generated.mailing');
  });

  it('uses slack source when available', () => {
    const r = generateUrlForNamespace('slack-Cpplang', {
      source: 'https://app.slack.com/client/T123/C123/p123',
      team_id: 'T999',
      channel_id: 'C999',
      doc_id: '1.2',
    });
    expect(r.url).toBe('https://app.slack.com/client/T123/C123/p123');
    expect(r.method).toBe('metadata.source');
  });

  it('generates slack URL from team/channel/doc_id', () => {
    const r = generateUrlForNamespace('slack-Cpplang', {
      team_id: 'T123456789',
      channel_id: 'C123456',
      doc_id: '1234567.890',
    });
    expect(r.url).toBe('https://app.slack.com/client/T123456789/C123456/p1234567890');
    expect(r.method).toBe('generated.slack');
  });

  it('returns unavailable for unsupported namespace', () => {
    const r = generateUrlForNamespace('wg21-papers', { doc_id: 'x' });
    expect(r.url).toBeNull();
    expect(r.method).toBe('unavailable');
  });
  it('returns unavailable for mailing when no doc_id or thread_id', () => {
    const r = generateUrlForNamespace('mailing', { author: 'someone' });
    expect(r.url).toBeNull();
    expect(r.method).toBe('unavailable');
  });

  it('returns unavailable for slack-Cpplang when required fields are missing', () => {
    const r = generateUrlForNamespace('slack-Cpplang', {
      team_id: 'T123',
      // channel_id missing, doc_id missing, no source
    });
    expect(r.url).toBeNull();
    expect(r.method).toBe('unavailable');
  });
});
