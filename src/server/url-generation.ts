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

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function generateUrlForNamespace(
  namespace: string,
  metadata: Record<string, unknown>
): UrlGenerationResult {
  const existingUrl = asString(metadata['url']);
  if (existingUrl) {
    return { url: existingUrl, method: 'metadata.url' };
  }

  if (namespace === 'mailing') {
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

  if (namespace === 'slack-Cpplang') {
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
      url: `https://app.slack.com/${teamId}/${channelId}/p${messageId}`,
      method: 'generated.slack',
    };
  }

  return {
    url: null,
    method: 'unavailable',
    reason: `URL generation is not supported for namespace "${namespace}"`,
  };
}
