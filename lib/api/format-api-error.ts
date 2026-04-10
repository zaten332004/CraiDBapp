import { ApiError } from "@/lib/api/shared";
import { isSessionIdleTooLong } from "@/lib/auth/session-activity";

function unauthorizedMessageByActivity() {
  if (isSessionIdleTooLong()) {
    return "Phiên đăng nhập hết hạn do không hoạt động quá lâu. Vui lòng đăng nhập lại.";
  }
  return "Xác thực phiên đăng nhập không thành công. Vui lòng thử lại.";
}

export function viHttpStatusHint(status: number): string {
  switch (status) {
    case 400:
      return "Dữ liệu gửi lên không hợp lệ hoặc thiếu trường bắt buộc.";
    case 401:
      return unauthorizedMessageByActivity();
    case 403:
      return "Bạn không có quyền thực hiện thao tác này.";
    case 404:
      return "Không tìm thấy tài nguyên yêu cầu trên máy chủ.";
    case 409:
      return "Dữ liệu xung đột (có thể bản ghi đã tồn tại).";
    case 422:
      return "Dữ liệu không đạt yêu cầu kiểm tra (validation).";
    case 429:
      return "Quá nhiều yêu cầu. Vui lòng thử lại sau.";
    default:
      return status >= 500 ? "Máy chủ xử lý lỗi. Vui lòng thử lại sau." : `Yêu cầu thất bại (mã ${status}).`;
  }
}

function parseDetail(bodyText?: string): string {
  if (!bodyText?.trim()) return "";
  try {
    const j = JSON.parse(bodyText) as Record<string, unknown>;
    const detail = j.detail;
    if (typeof detail === "string" && detail.trim()) return detail.trim();
    if (typeof j.message === "string" && j.message.trim()) return j.message.trim();
    if (typeof j.error === "string" && j.error.trim()) return j.error.trim();
    return "";
  } catch {
    return bodyText.trim();
  }
}

export function formatUserFacingFetchError(status: number, bodyText?: string): string {
  const detail = parseDetail(bodyText);
  if (detail) return detail;
  return viHttpStatusHint(status);
}

export function formatUserFacingApiError(err: unknown): string {
  if (err instanceof ApiError) {
    return formatUserFacingFetchError(err.status, err.bodyText);
  }
  if (err instanceof Error) return err.message || "Đã có lỗi xảy ra.";
  return String(err);
}

export const formatApiError = formatUserFacingApiError;
