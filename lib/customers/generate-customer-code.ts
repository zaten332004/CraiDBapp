/** Tiền tố mã khách hàng (không dùng ký tự gạch ngang). */
const CUSTOMER_CODE_PREFIX = 'KH';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

/**
 * Sinh mã khách hàng hiển thị/lưu `external_customer_ref`: chỉ chữ số sau tiền tố, không có dấu "-".
 * Dạng: KH + yyyyMMddHHmmss + 3 số ngẫu nhiên (tránh trùng trong cùng giây).
 */
export function generateCustomerCode(): string {
  const now = new Date();
  const stamp = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
  const rnd = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `${CUSTOMER_CODE_PREFIX}${stamp}${rnd}`;
}
