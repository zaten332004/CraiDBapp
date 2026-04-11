'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { browserApiFetchAuth } from '@/lib/api/browser';
import { ApiError } from '@/lib/api/shared';
import { useI18n } from '@/components/i18n-provider';
import { AlertCircle, Clock3, Download, Hash, Loader2, RefreshCw, ShieldCheck, User } from 'lucide-react';
import { ListPagination } from '@/components/list-pagination';
import { downloadCsvFile } from '@/lib/export/csv';
import { formatDateTimeVietnam, formatDateVietnam } from '@/lib/datetime';

type AuditLogRow = {
  id: string;
  ts: string;
  actor: string;
  actorRaw: string;
  action: string;
  target: string;
  raw: unknown;
};

function formatApiError(err: unknown) {
  if (err instanceof ApiError) {
    return `${err.message} — ${err.url}${err.bodyText ? `\n${err.bodyText}` : ''}`;
  }
  return err instanceof Error ? err.message : String(err);
}

function normalizeAuditLog(item: any, idx: number): AuditLogRow {
  const id = String(item?.id ?? item?.log_id ?? item?.logId ?? idx);
  const ts =
    String(
      item?.performed_at ??
      item?.performedAt ??
      item?.timestamp ??
      item?.ts ??
      item?.created_at ??
      item?.createdAt ??
      item?.time ??
      '',
    ).trim() ||
    '—';
  const rawActor = item?.actor ?? item?.user ?? item?.user_id ?? item?.userId ?? item?.email ?? '—';
  const actorText = String(rawActor ?? '').trim();
  const actor = !actorText || actorText === '—'
    ? 'System Admin'
    : /^\d+$/.test(actorText)
      ? `User #${actorText}`
      : actorText;
  const action = String(item?.action ?? item?.event ?? item?.type ?? '—');
  const target = String(item?.target ?? item?.resource ?? item?.entity ?? item?.path ?? '—');
  return { id, ts, actor, actorRaw: actorText, action, target, raw: item };
}

function formatAuditTs(ts: string, locale: string) {
  const dateOnly = formatAuditDateOnly(ts, locale);
  const timeOnly = formatAuditTimeOnly(ts, locale);
  if (dateOnly === (locale === 'vi' ? 'Không có' : 'N/A')) return dateOnly;
  return `${dateOnly} ${timeOnly}`;
}

function parseAuditDate(ts: string): Date | null {
  if (!ts || ts === '—') return null;
  const raw = ts.trim();
  if (!raw) return null;

  if (/^\d+$/.test(raw)) {
    const numeric = Number(raw);
    const ms = raw.length <= 10 ? numeric * 1000 : numeric;
    const fromEpoch = new Date(ms);
    return Number.isNaN(fromEpoch.getTime()) ? null : fromEpoch;
  }

  // Backend frequently sends naive timestamps; treat them as UTC.
  const hasTimezone = /(?:z|[+-]\d{2}:\d{2})$/i.test(raw);
  const normalized = hasTimezone ? raw : `${raw.replace(' ', 'T')}Z`;
  const value = new Date(normalized);
  return Number.isNaN(value.getTime()) ? null : value;
}

function formatAuditDateOnly(ts: string, locale: string) {
  const parsed = parseAuditDate(ts);
  if (!parsed) return locale === 'vi' ? 'Không có' : 'N/A';
  return formatDateVietnam(parsed, locale);
}

function formatAuditTimeOnly(ts: string, locale: string) {
  const parsed = parseAuditDate(ts);
  if (!parsed) return '--:--:--';
  const language = locale === 'vi' ? 'vi-VN' : 'en-GB';
  return parsed.toLocaleTimeString(language, {
    hour12: false,
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

function getActionLabel(action: string, locale: string) {
  const raw = String(action || '').trim();
  const normalized = raw.toLowerCase().replace(/_/g, ' ');
  if (normalized.includes('approve customer')) return locale === 'vi' ? 'Duyệt hồ sơ khách hàng' : 'Approve customer dossier';
  if (normalized.includes('reject customer')) return locale === 'vi' ? 'Từ chối hồ sơ khách hàng' : 'Reject customer dossier';
  if (normalized.includes('approve registration') || normalized.includes('approve user')) {
    return locale === 'vi' ? 'Duyệt người dùng' : 'Approve user';
  }
  if (normalized.includes('reject registration') || normalized.includes('reject user')) {
    return locale === 'vi' ? 'Từ chối người dùng' : 'Reject user';
  }
  if (normalized.includes('request password reset')) {
    return locale === 'vi' ? 'Yêu cầu đặt lại mật khẩu' : 'Request password reset';
  }
  if (normalized.includes('request email change')) {
    return locale === 'vi' ? 'Yêu cầu đổi email' : 'Request email change';
  }
  if (normalized.includes('reset password')) {
    return locale === 'vi' ? 'Đặt lại mật khẩu' : 'Reset password';
  }
  if (normalized.includes('change email')) {
    return locale === 'vi' ? 'Đổi email' : 'Change email';
  }
  if (normalized.includes('verify email')) {
    return locale === 'vi' ? 'Xác minh email' : 'Verify email';
  }
  if (normalized.includes('resend verification email')) {
    return locale === 'vi' ? 'Gửi lại email xác minh' : 'Resend verification email';
  }
  if (normalized.includes('register user')) {
    return locale === 'vi' ? 'Đăng ký người dùng' : 'Register user';
  }
  if (normalized.includes('import customers')) {
    return locale === 'vi' ? 'Nhập danh sách khách hàng' : 'Import customers';
  }
  if (normalized.includes('import customers failed') || normalized.includes('upload failed')) {
    return locale === 'vi' ? 'Nhập dữ liệu thất bại' : 'Import failed';
  }
  if (normalized.includes('resolve alert')) return locale === 'vi' ? 'Xử lý cảnh báo' : 'Resolve alert';
  if (normalized.includes('update avatar')) return locale === 'vi' ? 'Cập nhật ảnh đại diện' : 'Update avatar';
  if (normalized.includes('update profile')) return locale === 'vi' ? 'Cập nhật hồ sơ người dùng' : 'Update user profile';
  if (normalized.includes('change password')) return locale === 'vi' ? 'Đổi mật khẩu' : 'Change password';
  if (normalized.includes('admin') && normalized.includes('status')) {
    return locale === 'vi' ? 'Cập nhật trạng thái người dùng' : 'Update user status';
  }
  if (normalized.includes('update user') || normalized.includes('user status')) {
    return locale === 'vi' ? 'Cập nhật trạng thái người dùng' : 'Update user status';
  }
  if (normalized.includes('delete')) return locale === 'vi' ? 'Xóa' : 'Delete';
  if (normalized.includes('update')) return locale === 'vi' ? 'Cập nhật' : 'Update';
  if (normalized.includes('create')) return locale === 'vi' ? 'Tạo mới' : 'Create';
  return raw.replace(/_/g, ' ');
}

function getActionShortDescription(action: string, locale: string) {
  const normalized = String(action || '').toLowerCase().replace(/_/g, ' ');
  if (normalized.includes('approve customer')) return locale === 'vi' ? 'Duyệt hồ sơ khách hàng.' : 'Approved customer dossier.';
  if (normalized.includes('reject customer')) return locale === 'vi' ? 'Từ chối hồ sơ khách hàng.' : 'Rejected customer dossier.';
  if (normalized.includes('approve registration') || normalized.includes('approve user')) {
    return locale === 'vi' ? 'Phê duyệt đăng ký người dùng.' : 'Approved user registration.';
  }
  if (normalized.includes('reject registration') || normalized.includes('reject user')) {
    return locale === 'vi' ? 'Từ chối đăng ký người dùng.' : 'Rejected user registration.';
  }
  if (normalized.includes('request password reset')) return locale === 'vi' ? 'Người dùng yêu cầu đặt lại mật khẩu.' : 'User requested password reset.';
  if (normalized.includes('reset password')) return locale === 'vi' ? 'Mật khẩu đã được đặt lại.' : 'Password has been reset.';
  if (normalized.includes('request email change')) return locale === 'vi' ? 'Người dùng yêu cầu thay đổi email.' : 'User requested email change.';
  if (normalized.includes('change email')) return locale === 'vi' ? 'Email tài khoản đã được cập nhật.' : 'Account email has been updated.';
  if (normalized.includes('update avatar')) return locale === 'vi' ? 'Cập nhật ảnh đại diện tài khoản.' : 'Updated account avatar.';
  if (normalized.includes('update profile')) return locale === 'vi' ? 'Cập nhật thông tin hồ sơ người dùng.' : 'Updated user profile information.';
  if (normalized.includes('change password')) return locale === 'vi' ? 'Đổi mật khẩu tài khoản.' : 'Changed account password.';
  if (normalized.includes('update user') || normalized.includes('user status')) {
    return locale === 'vi' ? 'Cập nhật trạng thái kích hoạt người dùng.' : 'Updated user activation status.';
  }
  if (normalized.includes('verify email')) return locale === 'vi' ? 'Email đã được xác minh.' : 'Email has been verified.';
  if (normalized.includes('resend verification email')) return locale === 'vi' ? 'Đã gửi lại email xác minh.' : 'Verification email resent.';
  if (normalized.includes('register user')) return locale === 'vi' ? 'Tạo mới yêu cầu đăng ký người dùng.' : 'Created a new user registration request.';
  if (normalized.includes('import customers')) return locale === 'vi' ? 'Nhập dữ liệu khách hàng từ tệp.' : 'Imported customers from file.';
  if (normalized.includes('resolve alert')) return locale === 'vi' ? 'Cảnh báo đã được xử lý.' : 'Alert has been resolved.';
  if (normalized.includes('update')) return locale === 'vi' ? 'Cập nhật dữ liệu hệ thống.' : 'Updated system data.';
  if (normalized.includes('delete')) return locale === 'vi' ? 'Xóa dữ liệu hệ thống.' : 'Deleted system data.';
  if (normalized.includes('create') || normalized.includes('insert')) return locale === 'vi' ? 'Tạo mới bản ghi dữ liệu.' : 'Created new data record.';
  return locale === 'vi' ? 'Thao tác hệ thống.' : 'System action.';
}

function getActionBadgeClass(action: string) {
  const normalized = String(action || '').toLowerCase().replace(/_/g, ' ');
  if (normalized.includes('duyệt hồ sơ') || normalized.includes('approve customer')) {
    return '!border-emerald-300 !bg-emerald-50 !text-emerald-700';
  }
  if (normalized.includes('duyệt đăng ký') || normalized.includes('duyệt người dùng') || normalized.includes('approve registration') || normalized.includes('approve user')) {
    return '!border-emerald-300 !bg-emerald-50 !text-emerald-700';
  }
  if (normalized.includes('từ chối người dùng') || normalized.includes('reject registration') || normalized.includes('reject user')) {
    return '!border-rose-300 !bg-rose-50 !text-rose-700';
  }
  if (normalized.includes('request password reset') || normalized.includes('reset password')) {
    return '!border-amber-300 !bg-amber-50 !text-amber-800';
  }
  if (normalized.includes('request email change') || normalized.includes('change email')) {
    return '!border-cyan-300 !bg-cyan-50 !text-cyan-800';
  }
  if (normalized.includes('verify email') || normalized.includes('resend verification email')) {
    return '!border-violet-300 !bg-violet-50 !text-violet-800';
  }
  if (normalized.includes('register user')) {
    return '!border-cyan-300 !bg-cyan-50 !text-cyan-800';
  }
  if (normalized.includes('import customers failed') || normalized.includes('upload failed')) {
    return '!border-rose-300 !bg-rose-50 !text-rose-700';
  }
  if (normalized.includes('import customers')) {
    return '!border-blue-300 !bg-blue-50 !text-blue-700';
  }
  if (normalized.includes('xử lý cảnh báo') || normalized.includes('resolve alert')) {
    return '!border-sky-300 !bg-sky-50 !text-sky-800';
  }
  if (normalized.includes('từ chối') || normalized.includes('reject')) {
    return '!border-rose-300 !bg-rose-50 !text-rose-700';
  }
  if (normalized.includes('xóa') || normalized.includes('delete')) {
    return '!border-red-300 !bg-red-50 !text-red-700';
  }
  if (normalized.includes('cập nhật') || normalized.includes('update')) {
    return '!border-indigo-300 !bg-indigo-50 !text-indigo-700';
  }
  if (normalized.includes('insert') || normalized.includes('create')) {
    return '!border-emerald-300 !bg-emerald-50 !text-emerald-700';
  }
  return '!border-slate-200 !bg-slate-50 !text-slate-700';
}

function parseAuditPayload(value: unknown): Record<string, any> {
  if (value && typeof value === 'object') return value as Record<string, any>;
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object') return parsed as Record<string, any>;
      return { value: parsed };
    } catch {
      return { value };
    }
  }
  return {};
}

function fieldLabel(key: string, locale: string) {
  const map: Record<string, string> = {
    customer_id: locale === 'vi' ? 'Mã khách hàng' : 'Customer ID',
    full_name: locale === 'vi' ? 'Họ và tên' : 'Full name',
    age: locale === 'vi' ? 'Tuổi' : 'Age',
    monthly_income: locale === 'vi' ? 'Thu nhập tháng' : 'Monthly income',
    external_customer_ref: locale === 'vi' ? 'Mã tham chiếu' : 'External customer ref',
    date_of_birth: locale === 'vi' ? 'Ngày sinh' : 'Date of birth',
    gender: locale === 'vi' ? 'Giới tính' : 'Gender',
    national_id: locale === 'vi' ? 'Số định danh' : 'National ID',
    id_issue_date: locale === 'vi' ? 'Ngày cấp' : 'ID issue date',
    id_issue_place: locale === 'vi' ? 'Nơi cấp' : 'ID issue place',
    nationality: locale === 'vi' ? 'Quốc tịch' : 'Nationality',
    marital_status: locale === 'vi' ? 'Tình trạng hôn nhân' : 'Marital status',
    status: locale === 'vi' ? 'Trạng thái' : 'Status',
    role_id: locale === 'vi' ? 'Vai trò' : 'Role',
    reviewer_id: locale === 'vi' ? 'Người duyệt' : 'Reviewer',
    reviewed_at: locale === 'vi' ? 'Thời gian duyệt' : 'Reviewed at',
    updated_at: locale === 'vi' ? 'Cập nhật lúc' : 'Updated at',
    resolved_at: locale === 'vi' ? 'Thời gian xử lý' : 'Resolved at',
    reason: locale === 'vi' ? 'Lý do' : 'Reason',
    message: locale === 'vi' ? 'Nội dung' : 'Message',
    is_resolved: locale === 'vi' ? 'Đã xử lý' : 'Resolved',
    alert_type: locale === 'vi' ? 'Loại cảnh báo' : 'Alert type',
    severity: locale === 'vi' ? 'Mức độ' : 'Severity',
    email: 'Email',
    phone_number: locale === 'vi' ? 'Số điện thoại' : 'Phone',
    avatar_path: locale === 'vi' ? 'Ảnh đại diện' : 'Avatar path',
  };
  return map[key] || key.replace(/_/g, ' ');
}

function formatFieldValue(value: any, locale: string) {
  if (value == null || value === '') return locale === 'vi' ? 'Không có' : 'N/A';
  const raw = String(value);
  const lowered = raw.toLowerCase();
  if (lowered === 'approved') return locale === 'vi' ? 'Đã duyệt' : 'Approved';
  if (lowered === 'pending') return locale === 'vi' ? 'Chờ duyệt' : 'Pending';
  if (lowered === 'rejected') return locale === 'vi' ? 'Từ chối' : 'Rejected';
  if (lowered === 'true') return locale === 'vi' ? 'Có' : 'Yes';
  if (lowered === 'false') return locale === 'vi' ? 'Không' : 'No';
  if (lowered === 'male') return locale === 'vi' ? 'Nam' : 'Male';
  if (lowered === 'female') return locale === 'vi' ? 'Nữ' : 'Female';
  if (lowered === 'high_pd') return locale === 'vi' ? 'Rủi ro PD cao' : 'High PD risk';
  if (lowered === 'medium_pd') return locale === 'vi' ? 'Rủi ro PD trung bình' : 'Medium PD risk';
  if (lowered === 'low_pd') return locale === 'vi' ? 'Rủi ro PD thấp' : 'Low PD risk';
  if (lowered === 'high') return locale === 'vi' ? 'Cao' : 'High';
  if (lowered === 'medium') return locale === 'vi' ? 'Trung bình' : 'Medium';
  if (lowered === 'low') return locale === 'vi' ? 'Thấp' : 'Low';
  if (lowered === 'disabled' || lowered === 'inactive') return locale === 'vi' ? 'Đã vô hiệu hóa' : 'Disabled';
  if (lowered === 'enabled' || lowered === 'active') return locale === 'vi' ? 'Đang kích hoạt' : 'Enabled';
  if (lowered === 'resolved from dashboard') return locale === 'vi' ? 'Đã xử lý từ dashboard' : 'Resolved from dashboard';
  if (/^\d{4}-\d{2}-\d{2}t/i.test(raw) || /^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return formatDateTimeVietnam(raw, locale);
  }
  return raw;
}

export default function AdminAuditLogsPage() {
  const PAGE_SIZE = 15;
  const { t, locale } = useI18n();
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [actorNameMap, setActorNameMap] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditLogRow | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [auditData, usersData] = await Promise.all([
        browserApiFetchAuth<any>('/admin/audit-logs', { method: 'GET' }),
        browserApiFetchAuth<any>('/admin/users', { method: 'GET' }),
      ]);
      const rawList = Array.isArray(auditData)
        ? auditData
        : Array.isArray(auditData?.items)
          ? auditData.items
          : Array.isArray(auditData?.value)
            ? auditData.value
            : [];
      const users = Array.isArray(usersData)
        ? usersData
        : Array.isArray(usersData?.items)
          ? usersData.items
          : Array.isArray(usersData?.value)
            ? usersData.value
            : [];
      const map: Record<string, string> = {};
      for (const u of users) {
        const id = String(u?.user_id ?? u?.userId ?? u?.id ?? '').trim();
        const email = String(u?.email ?? '').trim().toLowerCase();
        const name = String(u?.name ?? u?.full_name ?? u?.fullName ?? u?.username ?? '').trim();
        if (!name) continue;
        if (id) map[id] = name;
        if (email) map[email] = name;
      }
      setActorNameMap(map);
      setRows(rawList.map(normalizeAuditLog));
    } catch (err) {
      setRows([]);
      setActorNameMap({});
      setError(formatApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = `${r.id} ${r.ts} ${r.actor} ${r.action} ${r.target} ${JSON.stringify(r.raw)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query]);
  useEffect(() => {
    setPage(1);
  }, [query, rows.length]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const selectedRaw = (selected?.raw ?? {}) as Record<string, any>;
  const selectedOld = parseAuditPayload(selectedRaw.old_value ?? selectedRaw.oldValue);
  const selectedNew = parseAuditPayload(selectedRaw.new_value ?? selectedRaw.newValue);

  const prettyEntries = (obj: Record<string, any>) => {
    const entries = Object.entries(obj || {});
    return entries.length > 0 ? entries : [['value', '-']];
  };
  const oldEntries = prettyEntries(selectedOld);
  const newEntries = prettyEntries(selectedNew);
  const hasMeaningfulNewData = Object.keys(selectedNew || {}).length > 0;
  const resolveActorDisplay = (row: AuditLogRow | null) => {
    if (!row) return '-';
    const actorKey = String(row.actorRaw || '').trim();
    const byId = actorNameMap[actorKey];
    const byEmail = actorNameMap[actorKey.toLowerCase()];
    return byId || byEmail || row.actor;
  };
  const handleExportCsv = () => {
    downloadCsvFile(
      'audit-logs',
      [
        locale === 'vi' ? 'Mã log' : 'Log ID',
        locale === 'vi' ? 'Thời gian' : 'Timestamp',
        locale === 'vi' ? 'Người thực hiện' : 'Actor',
        locale === 'vi' ? 'Hành động' : 'Action',
        locale === 'vi' ? 'Đối tượng' : 'Target',
      ],
      filtered.map((r) => [
        r.id,
        formatAuditTs(r.ts, locale),
        resolveActorDisplay(r),
        getActionLabel(r.action, locale),
        r.target,
      ]),
    );
  };

  return (
    <div className="flex min-h-[calc(100vh-72px)] flex-col gap-4 p-6 bg-[#f4f7fc]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('admin.audit.title')}</h1>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          {t('common.refresh')}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="whitespace-pre-wrap">{error}</AlertDescription>
        </Alert>
      )}

      <Card className="flex-1 border-border/80 bg-card shadow-sm">
        <CardHeader className="space-y-2 pb-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle>{t('admin.audit.list_title')}</CardTitle>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={handleExportCsv}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="w-full md:w-96">
              <Input placeholder={t('common.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 pb-3">
          <div className="overflow-x-auto rounded-xl border border-black/70 bg-white min-h-[620px]">
            <Table className="w-full min-w-[1100px] table-fixed">
              <colgroup>
                <col className="w-[15%]" />
                <col className="w-[12%]" />
                <col className="w-[21%]" />
                <col className="w-[22%]" />
                <col />
              </colgroup>
              <TableHeader>
                <TableRow className="bg-muted/35 hover:bg-muted/35">
                  <TableHead className="px-6 py-3.5 text-[13px] font-semibold">{t('common.date')}</TableHead>
                  <TableHead className="px-6 py-3.5 text-[13px] font-semibold">{locale === 'vi' ? 'Giờ' : 'Time'}</TableHead>
                  <TableHead className="px-6 py-3.5 text-[13px] font-semibold">{t('admin.audit.actor')}</TableHead>
                  <TableHead className="px-6 py-3.5 text-[13px] font-semibold">{t('admin.audit.action')}</TableHead>
                  <TableHead className="px-6 py-3.5 text-[13px] font-semibold">{locale === 'vi' ? 'Mô tả ngắn' : 'Short description'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer border-b border-black/15 hover:bg-muted/30"
                    onClick={() => setSelected(r)}
                  >
                    <TableCell className="px-6 py-3 whitespace-nowrap text-[13px]">{formatAuditDateOnly(r.ts, locale)}</TableCell>
                    <TableCell className="px-6 py-3 whitespace-nowrap text-[13px]">{formatAuditTimeOnly(r.ts, locale)}</TableCell>
                    <TableCell className="px-6 py-3 text-[13px] font-medium">
                      {resolveActorDisplay(r)}
                    </TableCell>
                    <TableCell className="px-6 py-3">
                      <Badge variant="outline" className={getActionBadgeClass(r.action)}>
                        {getActionLabel(r.action, locale)}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 py-3 text-[13px] text-muted-foreground">
                      {getActionShortDescription(r.action, locale)}
                    </TableCell>
                  </TableRow>
                ))}
                {paged.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      {isLoading ? t('common.loading') : t('common.no_results')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {filtered.length > 0 && (
            <div className="mt-3">
            <ListPagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="!w-[95vw] !max-w-[1500px] max-h-[92vh] overflow-hidden p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Chi tiết</DialogTitle>
          </DialogHeader>

          <div className="overflow-x-auto xl:overflow-x-visible">
            <div
              className={
                hasMeaningfulNewData
                  ? 'grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)_minmax(0,1fr)] gap-4'
                  : 'grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-4'
              }
            >
            <div className="space-y-3">
              {[
                { label: 'ACTOR', value: resolveActorDisplay(selected), icon: User },
                { label: 'ACTION', value: getActionLabel(selected?.action ?? '-', locale) },
                { label: 'NGÀY', value: formatAuditTs(String(selected?.ts ?? ''), locale), icon: Clock3 },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border p-3">
                  <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                    {item.icon ? <item.icon className="h-3.5 w-3.5" /> : null}
                    {item.label}
                  </p>
                  {item.label === 'ACTION' ? (
                    <div className="mt-2">
                      <Badge variant="outline" className={getActionBadgeClass(String(selected?.action ?? ''))}>
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {String(item.value)}
                      </Badge>
                    </div>
                  ) : (
                    <p className="mt-2 font-medium">{item.value}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="rounded-xl border p-3 min-w-0">
              <p className="mb-3 flex items-center gap-2 font-medium"><User className="h-4 w-4 text-muted-foreground" />Dữ liệu trước thay đổi</p>
              <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
                {oldEntries.map(([key, value]) => (
                  <div key={key} className="rounded-lg border p-2">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{fieldLabel(key, locale)}</p>
                    <p className="mt-1 text-sm break-words">{formatFieldValue(value, locale)}</p>
                  </div>
                ))}
              </div>
            </div>

            {hasMeaningfulNewData && (
              <div className="rounded-xl border p-3 min-w-0">
                <p className="mb-3 flex items-center gap-2 font-medium"><User className="h-4 w-4 text-muted-foreground" />Dữ liệu sau thay đổi</p>
                <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
                  {newEntries.map(([key, value]) => (
                    <div key={key} className="rounded-lg border p-2">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{fieldLabel(key, locale)}</p>
                      <p className="mt-1 text-sm break-words">{formatFieldValue(value, locale)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

