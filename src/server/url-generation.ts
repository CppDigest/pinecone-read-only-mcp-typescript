export type UrlGenerationResult = {
  url: string | null;
  method:
    | 'metadata.url'
    | 'metadata.source'
    | 'generated.mailing'
    | 'generated.slack'
    | 'unavailable';
  reason?: string;
};

type UrlGenerator = (metadata: Record<string, unknown>) => UrlGenerationResult;

/** Registry of namespace -> URL generator. Built-ins are registered below; more can be added at runtime. */
const urlGenerators = new Map<string, UrlGenerator>();

/** Return a trimmed non-empty string or null for empty/missing values. */
function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/**
 * Build a mailing-list URL (e.g. Boost archives).
 * Two cases:
 * 1. If metadata has list_name and doc_id (or msg_id) and the message id does not contain list_name,
 *    URL is https://lists.boost.org/archives/list/{list_name}/message/{doc_id}/
 * 2. Otherwise use doc_id or thread_id as the list path: .../list/{doc_id_or_thread_id}/
 */
function generatorMailing(metadata: Record<string, unknown>): UrlGenerationResult {
  const listName = asString(metadata['list_name']);
  const docId = asString(metadata['doc_id']) ?? asString(metadata['msg_id']);
  const threadId = asString(metadata['thread_id']);

  if (listName && docId && !docId.includes(listName)) {
    return {
      url: `https://lists.boost.org/archives/list/${listName}/message/${docId}/`,
      method: 'generated.mailing',
    };
  }

  const docIdOrThread = docId ?? threadId;
  if (!docIdOrThread) {
    return {
      url: null,
      method: 'unavailable',
      reason: 'mailing requires doc_id, msg_id, or thread_id to generate URL',
    };
  }
  return {
    url: `https://lists.boost.org/archives/list/${docIdOrThread}/`,
    method: 'generated.mailing',
  };
}

/** Build a Slack message URL from source or team_id/channel_id/doc_id. */
function generatorSlackCpplang(metadata: Record<string, unknown>): UrlGenerationResult {
  const source = asString(metadata['source']);
  if (source) {
    return { url: source, method: 'metadata.source' };
  }
  const teamId = asString(metadata['team_id']);
  const channelId = asString(metadata['channel_id']);
  const docId = asString(metadata['doc_id']);
  if (!teamId || !channelId || !docId) {
    return {
      url: null,
      method: 'unavailable',
      reason: 'slack-Cpplang requires team_id, channel_id, and doc_id (or source)',
    };
  }
  const messageId = docId.replace(/\./g, '');
  return {
    url: `https://app.slack.com/client/${teamId}/${channelId}/p${messageId}`,
    method: 'generated.slack',
  };
}

urlGenerators.set('mailing', generatorMailing);
urlGenerators.set('slack-Cpplang', generatorSlackCpplang);

/**
 * Generate a URL for a record in the given namespace when metadata.url is missing.
 * Uses the registry of URL generators; returns unavailable for namespaces without a generator.
 */
export function generateUrlForNamespace(
  namespace: string,
  metadata: Record<string, unknown>
): UrlGenerationResult {
  const existingUrl = asString(metadata['url']);
  if (existingUrl) {
    return { url: existingUrl, method: 'metadata.url' };
  }

  const generator = urlGenerators.get(namespace);
  if (generator) {
    return generator(metadata);
  }

  return {
    url: null,
    method: 'unavailable',
    reason: `URL generation is not supported for namespace "${namespace}"`,
  };
}
