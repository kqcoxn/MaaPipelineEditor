export function collectSearchableFieldValues(value: unknown): string[] {
  const values = new Set<string>();

  const collect = (current: unknown): void => {
    if (typeof current === "string") {
      if (current.length > 0) values.add(current);
      return;
    }

    if (typeof current === "number" || typeof current === "boolean") {
      values.add(String(current));
      return;
    }

    if (Array.isArray(current)) {
      current.forEach(collect);
      return;
    }

    if (current && typeof current === "object") {
      Object.values(current).forEach(collect);
    }
  };

  collect(value);
  return [...values];
}

export function findMatchingFieldValue(
  fieldValues: string[],
  lowerKeyword: string,
): string | undefined {
  return fieldValues.find((value) =>
    value.toLowerCase().includes(lowerKeyword),
  );
}
