import { FLOW_CACHE_TTL_MS } from '../constants.js';
import { getPineconeClient } from './client-context.js';

export type NamespaceInfo = {
  namespace: string;
  recordCount: number;
  metadata: Record<string, string>;
};

type CacheEntry = {
  data: NamespaceInfo[];
  expiresAt: number;
};

let namespacesCache: CacheEntry | null = null;

export async function getNamespacesWithCache(): Promise<{
  data: NamespaceInfo[];
  cache_hit: boolean;
  expires_at: number;
}> {
  const now = Date.now();
  if (namespacesCache && now < namespacesCache.expiresAt) {
    return {
      data: namespacesCache.data,
      cache_hit: true,
      expires_at: namespacesCache.expiresAt,
    };
  }

  const client = getPineconeClient();
  const data = await client.listNamespacesWithMetadata();
  const expiresAt = now + FLOW_CACHE_TTL_MS;
  namespacesCache = { data, expiresAt };
  return { data, cache_hit: false, expires_at: expiresAt };
}

export function invalidateNamespacesCache(): void {
  namespacesCache = null;
}
