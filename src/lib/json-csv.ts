/**
 * Flattens a nested object into a single-level object with dot-notated keys.
 */
export function flattenObject(obj: any, prefix = ""): Record<string, any> {
  return Object.keys(obj).reduce((acc: Record<string, any>, k) => {
    const pre = prefix.length ? prefix + "." : "";
    if (typeof obj[k] === "object" && obj[k] !== null && !Array.isArray(obj[k])) {
      Object.assign(acc, flattenObject(obj[k], pre + k));
    } else {
      acc[pre + k] = obj[k];
    }
    return acc;
  }, {});
}

/**
 * Converts an array of objects (potentially nested) into a CSV string.
 */
export function jsonToCsv(json: any[]): string {
  if (!json || !json.length) return "";

  const flattenedData = json.map((item) => flattenObject(item));
  
  // Get all unique keys for headers
  const headers = Array.from(
    new Set(flattenedData.flatMap((item) => Object.keys(item)))
  );

  const csvRows = [];
  
  // Header row
  csvRows.push(headers.join(","));

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
