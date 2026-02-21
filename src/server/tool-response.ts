export type TextPayload = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

/** Build an MCP tool success payload with JSON-stringified content. */
export function jsonResponse(payload: unknown): TextPayload {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

/** Build an MCP tool error payload with JSON-stringified content and isError: true. */
export function jsonErrorResponse(payload: unknown): TextPayload {
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}
