/** Save a value as a pretty-printed JSON file in the browser. */
export function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Save text as a file through a Blob and an object URL. The URL is revoked on the next tick,
 * after the browser has started the download.
 */
export function downloadText(filename: string, text: string, type: string): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

/** Save CSV text; a byte-order mark makes Excel read it as UTF-8 (₹, em dashes). */
export function downloadCsv(filename: string, csv: string): void {
  downloadText(filename, `${BYTE_ORDER_MARK}${csv}`, 'text/csv;charset=utf-8');
}
