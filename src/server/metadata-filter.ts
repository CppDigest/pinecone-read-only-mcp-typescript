import { z } from 'zod';

// Recursive Zod schema for Pinecone metadata filters
// Supports nested objects with operators like {"timestamp": {"$gte": 123}}
const metadataFilterValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.string()),
    z.array(z.number()),
    z.record(z.string(), metadataFilterValueSchema), // Recursive for nested operators
  ])
);

export const metadataFilterSchema = z.record(z.string(), metadataFilterValueSchema);
const ALLOWED_FILTER_OPERATORS = new Set(['$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin']);

function isPrimitiveFilterValue(value: unknown): boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function isPrimitiveArray(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => isPrimitiveFilterValue(item));
}

function validateMetadataFilterValue(value: unknown, path: string[]): string | null {
  if (value === null || value === undefined) {
    return `Invalid null/undefined at "${path.join('.')}".`;
  }

  if (isPrimitiveFilterValue(value) || isPrimitiveArray(value)) {
    return null;
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    return `Unsupported filter value at "${path.join('.')}".`;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (key.startsWith('$')) {
      if (!ALLOWED_FILTER_OPERATORS.has(key)) {
        return `Unsupported filter operator "${key}" at "${path.join('.')}".`;
      }
      if ((key === '$in' || key === '$nin') && !isPrimitiveArray(nestedValue)) {
        return `Operator "${key}" at "${path.join('.')}" must use an array of primitive values.`;
      }
    }

    const nestedError = validateMetadataFilterValue(nestedValue, [...path, key]);
    if (nestedError) {
      return nestedError;
    }
  }

  return null;
}

export function validateMetadataFilter(filter: Record<string, unknown>): string | null {
  for (const [field, value] of Object.entries(filter)) {
    const error = validateMetadataFilterValue(value, [field]);
    if (error) return error;
  }
  return null;
}
