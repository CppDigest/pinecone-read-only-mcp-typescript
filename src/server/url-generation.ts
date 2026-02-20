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

/** Build a mailing-list URL from doc_id or thread_id (e.g. Boost archives). */
function generatorMailing(metadata: Record<string, unknown>): UrlGenerationResult {
  const docIdOrThread = asString(metadata['doc_id']) ?? asString(metadata['thread_id']);
  if (!docIdOrThread) {
    return {
      url: null,
      method: 'unavailable',
      reason: 'mailing requires doc_id or thread_id to generate URL',
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

/** Register a URL generator for a namespace (e.g. for custom indexes). */
export function registerUrlGenerator(namespace: string, fn: UrlGenerator): void {
  urlGenerators.set(namespace, fn);
}
