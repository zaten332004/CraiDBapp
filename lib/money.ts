const THOUSANDS_RE = /\B(?=(\d{3})+(?!\d))/g;

/** Chỉ giữ chữ số, giới hạn độ dài (nhập tiền VND). */
export function sanitizeVndDigitString(raw: string, maxLen = 16): string {
  return raw.replace(/\D/g, '').slice(0, maxLen);
}

/** Chuỗi chỉ số → số (NaN nếu rỗng). */
export function parseVndDigitsToNumber(digits: string): number {
  const d = sanitizeVndDigitString(digits, 32);
  if (!d) return NaN;
  return Number(d);
}

/** Nhóm nghìn bằng dấu chấm (kiểu VN): 1.000.000 */
export function formatVndDigits(value: number): string {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return '0';
  const abs = Math.abs(n);
  const body = String(abs).replace(THOUSANDS_RE, '.');
  return n < 0 ? `-${body}` : body;
}

/** Số tiền VND đầy đủ: 1.000.000 đ | 1.000.000 VND */
export function formatVnd(value: number | null | undefined, locale: 'vi' | 'en' = 'vi'): string {
  if (value == null || !Number.isFinite(Number(value))) return '-';
  const suffix = locale === 'vi' ? ' đ' : ' VND';
  return `${formatVndDigits(Number(value))}${suffix}`;
}

/** Biểu đồ / số lớn: K/M/B + đ/VND; số nhỏ dùng format đầy đủ */
export function formatCompactVnd(value: number, locale: 'vi' | 'en'): string {
  if (!Number.isFinite(value)) return formatVnd(0, locale);
  const abs = Math.abs(value);
  const suffix = locale === 'vi' ? ' đ' : ' VND';
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B${suffix}`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M${suffix}`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K${suffix}`;
  return formatVnd(value, locale);
}
