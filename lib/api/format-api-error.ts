import { ApiError } from "@/lib/api/shared";
import { isSessionIdleTooLong } from "@/lib/auth/session-activity";

/** Locale for generic HTTP hints when the API body has no usable `detail`. */
export type UserFacingLocale = "vi" | "en";

function unauthorizedMessageByActivity(locale: UserFacingLocale) {
  if (isSessionIdleTooLong()) {
    return locale === "en"
      ? "Your session expired due to inactivity. Please sign in again."
      : "Phiên đăng nhập hết hạn do không hoạt động quá lâu. Vui lòng đăng nhập lại.";
  }
  return locale === "en"
    ? "We could not verify your session. Please try again."
    : "Xác thực phiên đăng nhập không thành công. Vui lòng thử lại.";
}

export function viHttpStatusHint(status: number): string {
  switch (status) {
    case 400:
      return "Dữ liệu gửi lên không hợp lệ hoặc thiếu trường bắt buộc.";
    case 401:
      return unauthorizedMessageByActivity("vi");
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

export function enHttpStatusHint(status: number): string {
  switch (status) {
    case 400:
      return "The request was invalid or missing required fields.";
    case 401:
      return unauthorizedMessageByActivity("en");
    case 403:
      return "You do not have permission to perform this action.";
    case 404:
      return "The requested resource was not found.";
    case 409:
      return "Data conflict (the record may already exist).";
    case 422:
      return "Validation failed for the submitted data.";
    case 429:
      return "Too many requests. Please try again later.";
    default:
      return status >= 500
        ? "Server error. Please try again later."
        : `Request failed (HTTP ${status}).`;
  }
}

export function httpStatusHint(status: number, locale: UserFacingLocale = "vi"): string {
  return locale === "en" ? enHttpStatusHint(status) : viHttpStatusHint(status);
}

function parseDetail(bodyText?: string): string {
  if (!bodyText?.trim()) return "";
  try {
    const j = JSON.parse(bodyText) as Record<string, unknown>;
    const detail = j.detail;
    if (typeof detail === "string" && detail.trim()) return detail.trim();
    if (Array.isArray(detail)) {
      const parts = detail
        .map((x) => {
          if (typeof x === "string") return x.trim();
          if (x && typeof x === "object" && "msg" in x) return String((x as { msg?: unknown }).msg ?? "").trim();
          return "";
        })
        .filter(Boolean);
      if (parts.length) return parts.join("\n");
    }
    if (typeof j.message === "string" && j.message.trim()) return j.message.trim();
    if (typeof j.error === "string" && j.error.trim()) return j.error.trim();
    return "";
  } catch {
    return bodyText.trim();
  }
}

/** Map common English API `detail` strings to clearer Vi/En copy (especially “must be different from current”). */
export function translateKnownApiDetail(detail: string, locale: UserFacingLocale): string {
  const d = detail.trim();
  const rows: Array<{ en: string; vi: string }> = [
    {
      en: "New password must be different from the current password",
      vi: "Mật khẩu mới không được trùng với mật khẩu hiện tại.",
    },
    {
      en: "New email must be different from the current email",
      vi: "Email mới không được trùng với email hiện tại.",
    },
    {
      en: "New PIN must be different from old PIN",
      vi: "Mã PIN mới không được trùng với mã PIN hiện tại.",
    },
  ];
  for (const row of rows) {
    if (d === row.en) return locale === "vi" ? row.vi : row.en;
  }
  return d;
}

export function formatUserFacingFetchError(
  status: number,
  bodyText?: string,
  locale: UserFacingLocale = "vi",
): string {
  const detail = parseDetail(bodyText);
  if (detail) return translateKnownApiDetail(detail, locale);
  return httpStatusHint(status, locale);
}

export function formatUserFacingApiError(err: unknown, locale: UserFacingLocale = "vi"): string {
  if (err instanceof ApiError) {
    return formatUserFacingFetchError(err.status, err.bodyText, locale);
  }
  if (err instanceof Error) {
    const m = (err.message || "").trim();
    if (m) return m;
    return locale === "en" ? "Something went wrong." : "Đã có lỗi xảy ra.";
  }
  const s = String(err ?? "").trim();
  if (s) return s;
  return locale === "en" ? "Something went wrong." : "Đã có lỗi xảy ra.";
}

/** @deprecated Prefer formatUserFacingApiError(..., locale) */
export const formatApiError = formatUserFacingApiError;
