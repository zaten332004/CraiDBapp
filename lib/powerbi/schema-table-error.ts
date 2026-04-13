/**
 * Power BI / AS returns verbose JSON for ExecuteQueries failures.
 * Detect "table not in model" so the UI can show one short line instead of raw payload.
 */
export function isPowerBiTableNotInDatasetError(raw: string | undefined | null): boolean {
  if (!raw) return false;
  const s = String(raw);
  if (/cannot find table/i.test(s)) return true;
  if (/không tìm thấy bảng/i.test(s)) return true;
  return false;
}
