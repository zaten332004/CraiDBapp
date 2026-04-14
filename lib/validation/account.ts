export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidVietnamPhone(value: string): boolean {
  return /^0\d{9}$/.test(value.trim());
}

/** Chuẩn hóa số điện thoại VN từ ô nhập (cho phép +84…) về dạng 0xxxxxxxxx. */
export function normalizeVietnamPhone(value: string): string {
  const t = String(value ?? '')
    .trim()
    .replace(/\s/g, '');
  let out: string;
  if (t.startsWith('+84')) {
    const rest = t.slice(3).replace(/\D/g, '');
    out = rest.length ? `0${rest}` : '';
  } else {
    out = t.replace(/\D/g, '');
  }
  if (out.startsWith('0') && out.length > 10) out = out.slice(0, 10);
  return out;
}

export function isValidCustomerContactPhone(value: string): boolean {
  return isValidVietnamPhone(normalizeVietnamPhone(value));
}

export function isNumericPin(value: string, length = 6): boolean {
  return new RegExp(`^\\d{${length}}$`).test(value.trim());
}

export function isStrongPassword(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 6) return false;
  if (!/[A-Z]/.test(trimmed)) return false;
  if (!/[a-z]/.test(trimmed)) return false;
  if (!/\d/.test(trimmed)) return false;
  if (!/[^A-Za-z0-9]/.test(trimmed)) return false;
  return true;
}

export function sanitizeVietnamNationalId(value: string): string {
  return value.replace(/\D/g, '').slice(0, 12);
}

export function isValidVietnamNationalId(value: string): boolean {
  return /^\d{12}$/.test(sanitizeVietnamNationalId(value));
}

export function passwordRuleMessage(isVi: boolean): string {
  return isVi
    ? 'Mật khẩu phải có ít nhất 6 ký tự, gồm chữ hoa, chữ thường, số và ít nhất 1 ký tự đặc biệt.'
    : 'Password must be at least 6 characters and include uppercase, lowercase, number, and at least 1 special character.';
}
