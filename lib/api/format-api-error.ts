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

/** Exact-match rows: English API / client messages ↔ Vietnamese. */
const KNOWN_MESSAGE_ROWS: Array<{ en: string; vi: string }> = [
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
  {
    en: "Invalid amount",
    vi: "Số tiền không hợp lệ.",
  },
  { en: "Invalid term", vi: "Thời hạn vay không hợp lệ." },
  { en: "Purpose required", vi: "Vui lòng nhập mục đích vay." },
  { en: "Missing facility_id", vi: "Thiếu thông tin khoản vay (facility_id)." },
  { en: "No image selected", vi: "Chưa chọn ảnh." },
  { en: "Cannot initialize canvas", vi: "Không khởi tạo được khung vẽ (canvas)." },
  { en: "Cannot read image file", vi: "Không đọc được tệp ảnh." },
  { en: "Cannot load image", vi: "Không tải được ảnh." },
  {
    en: "Could not create cropped image.",
    vi: "Không thể tạo ảnh sau khi cắt.",
  },
  {
    en: "Cropped image is still larger than 5MB.",
    vi: "Ảnh sau khi cắt vẫn vượt quá 5MB.",
  },
  {
    en: "Input should be a valid dictionary or object to extract fields from",
    vi: "Body JSON cần là object {...}, không phải chuỗi bọc hoặc stringify hai lần.",
  },
  { en: "Not authenticated", vi: "Chưa đăng nhập hoặc phiên không hợp lệ." },
  { en: "Could not validate credentials", vi: "Không xác thực được thông tin đăng nhập." },
  { en: "Something went wrong.", vi: "Đã có lỗi xảy ra." },
  {
    en: "No export file URL returned.",
    vi: "Không nhận được đường dẫn tải file export.",
  },
  {
    en: "Failed to download export file.",
    vi: "Tải file export thất bại.",
  },
  {
    en: "This asset is already registered as collateral for another loan application.",
    vi: "Tài sản này đã được đăng ký đảm bảo cho hồ sơ khác.",
  },
  {
    en: "Power BI workspace/dataset not configured for this user.",
    vi: "Tài khoản chưa cấu hình Workspace/Dataset Power BI.",
  },
  {
    en: "Power BI workspace/dataset not configured for this user",
    vi: "Tài khoản chưa cấu hình Workspace/Dataset Power BI.",
  },
  {
    en: "Power BI account not configured for this user.",
    vi: "Tài khoản chưa cấu hình Power BI.",
  },
  {
    en: "Power BI account not configured for this user",
    vi: "Tài khoản chưa cấu hình Power BI.",
  },
  {
    en: "Power BI table hints are required before using table data.",
    vi: "Cần cấu hình danh sách bảng Power BI trước khi sử dụng dữ liệu bảng.",
  },
  {
    en: "Power BI table hints are required before using table data",
    vi: "Cần cấu hình danh sách bảng Power BI trước khi sử dụng dữ liệu bảng.",
  },
  {
    en: "Upload not found (expired job, API restarted, or set UPLOAD_JOBS_STORAGE_DIR).",
    vi: "Không tìm thấy dữ liệu upload (job đã hết hạn, API khởi động lại, hoặc chưa cấu hình UPLOAD_JOBS_STORAGE_DIR).",
  },
  {
    en: "Upload not found (expired job, API restarted, or set UPLOAD_JOBS_STORAGE_DIR)",
    vi: "Không tìm thấy dữ liệu upload (job đã hết hạn, API khởi động lại, hoặc chưa cấu hình UPLOAD_JOBS_STORAGE_DIR).",
  },
  {
    en: "Upload content not found for job.",
    vi: "Không tìm thấy nội dung upload cho job.",
  },
  {
    en: "Upload content not found for job",
    vi: "Không tìm thấy nội dung upload cho job.",
  },
  {
    en: "Upload not found.",
    vi: "Không tìm thấy dữ liệu upload.",
  },
  {
    en: "Upload not found",
    vi: "Không tìm thấy dữ liệu upload.",
  },
];

function translateSingleDetailLine(d: string, locale: UserFacingLocale): string {
  const line = d.trim();
  if (!line) return line;

  const uploadFail = line.match(/^Upload failed \((\d+)\)$/i);
  if (uploadFail) {
    const code = uploadFail[1];
    return locale === "vi" ? `Tải lên thất bại (mã HTTP ${code}).` : `Upload failed (HTTP ${code}).`;
  }

  if (/upload content not found for job/i.test(line) || /upload not found \(expired job, api restarted, or set upload_jobs_storage_dir\)/i.test(line)) {
    return locale === "vi"
      ? "Không tìm thấy dữ liệu upload (job đã hết hạn, API khởi động lại, hoặc chưa cấu hình UPLOAD_JOBS_STORAGE_DIR)."
      : "Upload data not found (expired job, API restarted, or UPLOAD_JOBS_STORAGE_DIR is not configured).";
  }

  if (locale === "vi") {
    if (line.startsWith("Input should be a valid integer")) {
      return "Giá trị phải là số nguyên hợp lệ.";
    }
    if (line.startsWith("Input should be a valid number")) {
      return "Giá trị phải là số hợp lệ.";
    }
    if (line.startsWith("Input should be a valid float")) {
      return "Giá trị phải là số thập phân hợp lệ.";
    }
    if (line.startsWith("Field required") || line === "field required") {
      return "Thiếu trường bắt buộc.";
    }
    if (line.startsWith("Value error,")) {
      return line.replace(/^Value error,\s*/i, "Lỗi giá trị: ");
    }
  }

  for (const row of KNOWN_MESSAGE_ROWS) {
    if (line === row.en) return locale === "vi" ? row.vi : row.en;
    if (line === row.vi) return locale === "en" ? row.en : row.vi;
  }
  return line;
}

function formatValidationDetailEntry(x: unknown, locale: UserFacingLocale): string {
  if (typeof x === "string") return translateSingleDetailLine(x.trim(), locale);
  if (!x || typeof x !== "object") return "";
  const rec = x as Record<string, unknown>;
  const msg = typeof rec.msg === "string" ? rec.msg.trim() : "";
  if (!msg) return "";
  const translated = translateSingleDetailLine(msg, locale);
  const loc = rec.loc;
  if (!Array.isArray(loc) || loc.length === 0) return translated;
  const locStr = loc.map((p) => String(p)).join(".");
  const lowerMsg = msg.toLowerCase();
  if (
    locStr === "body" &&
    (lowerMsg.includes("dictionary") || lowerMsg.includes("object to extract") || lowerMsg.includes("valid json"))
  ) {
    return locale === "vi"
      ? "Body phải là JSON object {...}; tránh stringify hai lần hoặc sai Content-Type."
      : "Body must be a JSON object; avoid double JSON.stringify or wrong Content-Type.";
  }
  const shortLoc = locStr.length > 56 ? `${locStr.slice(0, 53)}…` : locStr;
  return locale === "vi" ? `[${shortLoc}] ${translated}` : `[${shortLoc}] ${translated}`;
}

function parseDetail(bodyText: string | undefined, locale: UserFacingLocale): string {
  if (!bodyText?.trim()) return "";
  try {
    const j = JSON.parse(bodyText) as Record<string, unknown>;
    const detail = j.detail;
    if (typeof detail === "string" && detail.trim()) return translateSingleDetailLine(detail.trim(), locale);
    if (Array.isArray(detail)) {
      const parts = detail.map((x) => formatValidationDetailEntry(x, locale)).filter(Boolean);
      if (parts.length) {
        const sep = " · ";
        const maxShow = 2;
        if (parts.length <= maxShow) return parts.join(sep);
        const head = parts.slice(0, maxShow).join(sep);
        return locale === "vi"
          ? `${head} (+${parts.length - maxShow} lỗi khác)`
          : `${head} (+${parts.length - maxShow} more)`;
      }
    }
    if (typeof j.message === "string" && j.message.trim()) return translateSingleDetailLine(j.message.trim(), locale);
    if (typeof j.error === "string" && j.error.trim()) return translateSingleDetailLine(j.error.trim(), locale);
    return "";
  } catch {
    return translateSingleDetailLine(bodyText.trim(), locale);
  }
}

/**
 * Map common English API `detail` / client `Error.message` to clearer Vi copy (and reverse for a few rows).
 * Multi-line strings (e.g. joined Pydantic errors) are translated line by line when possible.
 */
export function translateKnownApiDetail(detail: string, locale: UserFacingLocale): string {
  const d = detail.trim();
  if (!d) return d;
  if (d.includes("\n")) {
    const lines = d
      .split(/\n+/)
      .map((line) => translateSingleDetailLine(line, locale))
      .filter(Boolean);
    const sep = " · ";
    const maxShow = 2;
    if (lines.length <= maxShow) return lines.join(sep);
    const head = lines.slice(0, maxShow).join(sep);
    return locale === "vi" ? `${head} (+${lines.length - maxShow} lỗi)` : `${head} (+${lines.length - maxShow} more)`;
  }
  return translateSingleDetailLine(d, locale);
}

export function formatUserFacingFetchError(
  status: number,
  bodyText?: string,
  locale: UserFacingLocale = "vi",
): string {
  const detail = parseDetail(bodyText, locale);
  if (detail) return translateKnownApiDetail(detail, locale);
  return httpStatusHint(status, locale);
}

export function formatUserFacingApiError(err: unknown, locale: UserFacingLocale = "vi"): string {
  if (err instanceof ApiError) {
    return formatUserFacingFetchError(err.status, err.bodyText, locale);
  }
  if (err instanceof Error) {
    const m = (err.message || "").trim();
    if (m) return translateKnownApiDetail(m, locale);
    return locale === "en" ? "Something went wrong." : "Đã có lỗi xảy ra.";
  }
  const s = String(err ?? "").trim();
  if (s) return translateKnownApiDetail(s, locale);
  return locale === "en" ? "Something went wrong." : "Đã có lỗi xảy ra.";
}

/** Title + body for error toasts (replaces generic "Action failed"). */
export function getApiErrorToastParts(
  err: unknown,
  locale: UserFacingLocale,
): { title: string; description: string } {
  const description = formatUserFacingApiError(err, locale);
  if (err instanceof ApiError) {
    const { status } = err;
    if (status === 422) {
      return {
        title: locale === "vi" ? "Dữ liệu không đạt yêu cầu" : "Validation failed",
        description,
      };
    }
    if (status === 400) {
      const d = description.toLowerCase();
      const shapeIssue =
        d.includes("dictionary") ||
        d.includes("object ") ||
        d.includes("json") ||
        d.includes("body") ||
        d.includes("chuỗi bọc");
      return {
        title:
          locale === "vi"
            ? shapeIssue
              ? "Sai định dạng dữ liệu gửi lên"
              : "Yêu cầu không hợp lệ"
            : shapeIssue
              ? "Invalid request payload"
              : "Bad request",
        description,
      };
    }
    if (status === 401) {
      return {
        title: locale === "vi" ? "Đăng nhập / phiên làm việc" : "Sign-in / session",
        description: description || httpStatusHint(401, locale),
      };
    }
    if (status === 403) {
      return {
        title: locale === "vi" ? "Không có quyền thực hiện" : "Permission denied",
        description: description || httpStatusHint(403, locale),
      };
    }
    if (status === 404) {
      return {
        title: locale === "vi" ? "Không tìm thấy" : "Not found",
        description: description || httpStatusHint(404, locale),
      };
    }
    if (status === 409) {
      return {
        title: locale === "vi" ? "Xung đột dữ liệu" : "Data conflict",
        description,
      };
    }
    if (status === 429) {
      return {
        title: locale === "vi" ? "Quá nhiều yêu cầu" : "Too many requests",
        description: description || httpStatusHint(429, locale),
      };
    }
    if (status >= 500) {
      return {
        title: locale === "vi" ? "Lỗi máy chủ" : "Server error",
        description: description || httpStatusHint(status, locale),
      };
    }
    return {
      title: locale === "vi" ? `Lỗi giao tiếp API (${status})` : `API error (${status})`,
      description,
    };
  }
  return {
    title: locale === "vi" ? "Đã có lỗi" : "Something went wrong",
    description,
  };
}

/** @deprecated Prefer formatUserFacingApiError(..., locale) */
export const formatApiError = formatUserFacingApiError;
