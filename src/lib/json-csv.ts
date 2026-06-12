export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = Record<string, JsonValue>;

/**
 * Flattens a nested object into a single-level object with dot-notated keys.
 * Arrays are kept as a single cell, serialized as JSON.
 */
export function flattenObject(obj: JsonObject, prefix = ""): Record<string, JsonPrimitive> {
  return Object.keys(obj).reduce((acc: Record<string, JsonPrimitive>, k) => {
    const pre = prefix.length ? prefix + "." : "";
    const val = obj[k];
    if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      Object.assign(acc, flattenObject(val, pre + k));
    } else if (Array.isArray(val)) {
      acc[pre + k] = JSON.stringify(val);
    } else {
      acc[pre + k] = val;
    }
    return acc;
  }, {});
}

/**
 * Converts an array of objects (potentially nested) into a CSV string.
 */
export function jsonToCsv(json: JsonObject[]): string {
  if (!json || !json.length) return "";

  const flattenedData = json.map((item) => flattenObject(item));

  // Get all unique keys for headers
  const headers = Array.from(
    new Set(flattenedData.flatMap((item) => Object.keys(item)))
  );

  const csvRows = [];

  // Header row
  csvRows.push(headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(","));

  // Data rows
  for (const row of flattenedData) {
    const values = headers.map((header) => {
      const val = row[header];
      const escaped = String(val === null || val === undefined ? "" : val).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(","));
  }

  return csvRows.join("\n");
}
