type TextPayload = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

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
