/** Minimal CSV parsing for bulk WhatsApp mode: `number[,message]` per line. */

export interface BulkRow {
  raw: string;
  phone: string;
  message?: string;
}

export function parseBulkCsv(input: string): BulkRow[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const commaIndex = line.indexOf(",");
      if (commaIndex === -1) return { raw: line, phone: line.trim() };
      const phone = line.slice(0, commaIndex).trim();
      // Strip optional quotes around the message column.
      const message = line
        .slice(commaIndex + 1)
        .trim()
        .replace(/^"(.*)"$/, "$1")
        .replace(/""/g, '"');
      return { raw: line, phone, message: message || undefined };
    });
}
