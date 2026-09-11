export { cn } from "cn"

export type Relation<T> = T | T[] | null | undefined;

export function unwrapRelation<T>(value: Relation<T>): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

