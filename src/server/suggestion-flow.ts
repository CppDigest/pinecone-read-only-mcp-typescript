import { FLOW_CACHE_TTL_MS } from '../constants.js';

type FlowState = {
  updatedAt: number;
  recommended_tool: 'count' | 'query_fast' | 'query_detailed';
  suggested_fields: string[];
  user_query: string;
};

const stateByNamespace = new Map<string, FlowState>();

export function markSuggested(
  namespace: string,
  state: Omit<FlowState, 'updatedAt'>
): void {
  stateByNamespace.set(namespace, {
    ...state,
    updatedAt: Date.now(),
  });
}

export function requireSuggested(namespace: string): {
  ok: true;
  flow: FlowState;
} | {
  ok: false;
  message: string;
} {
  const state = stateByNamespace.get(namespace);
  if (!state) {
    return {
      ok: false,
      message:
        'Flow requires suggest_query_params first. Call suggest_query_params with namespace and user_query before query/count tools.',
    };
  }

  const now = Date.now();
  if (now - state.updatedAt > FLOW_CACHE_TTL_MS) {
    stateByNamespace.delete(namespace);
    return {
      ok: false,
      message:
        'Previous suggest_query_params context expired (30 minutes). Call suggest_query_params again before query/count tools.',
    };
  }

  return { ok: true, flow: state };
}
