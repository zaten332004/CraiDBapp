/**
 * Bỏ hậu tố "(resolved: ...)" khỏi nội dung cảnh báo từ API; cột trạng thái đã phản ánh xử lý.
 */
export function stripAlertResolvedSuffix(raw: string): string {
  const full = String(raw ?? '').trim();
  const idx = full.search(/\s*\(resolved:/i);
  if (idx < 0) return full;
  return full.slice(0, idx).trim() || full;
}

/**
 * Hiển thị nội dung cảnh báo: giữ nguyên bản tiếng Anh từ server khi locale không phải vi,
 * và dịch các mẫu câu phổ biến sang tiếng Việt khi giao diện đang là vi.
 */
export function formatAlertMessageForDisplay(raw: string, locale: string): string {
  const core = stripAlertResolvedSuffix(raw).trim();
  if (locale !== 'vi') return core;

  const elevated = core.match(
    /^(.+?)\s+has\s+(?:an\s+)?elevated\s+predicted\s+risk\s+score\s*\(\s*([\d.]+)\s*\)\s*\.?$/i,
  );
  if (elevated) {
    const name = elevated[1].trim();
    const value = elevated[2];
    return `${name} có điểm rủi ro dự báo tăng cao (${value}).`;
  }

  const weakCredit = core.match(
    /^(.+?)\s+has\s+(?:a\s+)?weak\s+credit\s+score\s*\(\s*(\d+)\s*\)\s*\.?$/i,
  );
  if (weakCredit) {
    const name = weakCredit[1].trim();
    const value = weakCredit[2];
    return `${name} có điểm tín dụng thấp (${value}).`;
  }

  return core;
}
