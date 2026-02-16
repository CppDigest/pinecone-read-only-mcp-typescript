import type { NamespaceInfo } from './namespaces-cache.js';

type RankedNamespace = {
  namespace: string;
  score: number;
  record_count: number;
  reasons: string[];
};

function scoreNamespace(
  query: string,
  namespace: string,
  fields: string[]
): { score: number; reasons: string[] } {
  const q = query.toLowerCase();
  const name = namespace.toLowerCase();
  const reasons: string[] = [];
  let score = 0;

  const keywordHints: Record<string, string[]> = {
    'wg21-papers': ['wg21', 'paper', 'proposal', 'document_number', 'p0', 'standard'],
    'github-compiler': ['github', 'issue', 'pr', 'repository', 'compiler', 'bug'],
    'youtube-scripts': ['youtube', 'video', 'script', 'transcript', 'channel'],
    mailing: ['mailing', 'email', 'thread', 'subject', 'list'],
    'slack-cpplang': ['slack', 'chat', 'message', 'channel', 'thread'],
    'blog-posts': ['blog', 'post', 'article'],
    'cpp-documentation': ['documentation', 'docs', 'reference', 'library'],
  };

  if (q.includes(name.replace(/[^a-z0-9]/g, ' '))) {
    score += 3;
    reasons.push('query mentions namespace name');
  }

  const hints = keywordHints[name] ?? [];
  for (const hint of hints) {
    if (q.includes(hint)) {
      score += 2;
      reasons.push(`keyword match: ${hint}`);
    }
  }

  for (const field of fields) {
    if (q.includes(field.toLowerCase())) {
      score += 1;
      reasons.push(`field hint: ${field}`);
    }
  }

  return { score, reasons: Array.from(new Set(reasons)) };
}

export function rankNamespacesByQuery(
  query: string,
  namespaces: NamespaceInfo[],
  topN: number
): RankedNamespace[] {
  return namespaces
    .map((ns) => {
      const fields = Object.keys(ns.metadata ?? {});
      const { score, reasons } = scoreNamespace(query.trim(), ns.namespace, fields);
      return {
        namespace: ns.namespace,
        score,
        record_count: ns.recordCount,
        reasons,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.record_count - b.record_count;
    })
    .slice(0, topN);
}
