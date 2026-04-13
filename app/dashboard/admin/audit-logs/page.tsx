'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { browserApiFetchAuth } from '@/lib/api/browser';
import { useI18n } from '@/components/i18n-provider';
import { formatUserFacingApiError, type UserFacingLocale } from '@/lib/api/format-api-error';
import { notifyError } from '@/lib/notify';
import { Clock3, Download, Hash, Loader2, RefreshCw, ShieldCheck, User } from 'lucide-react';
import { ListPagination } from '@/components/list-pagination';
import { downloadCsvFile } from '@/lib/export/csv';
import { formatDateTimeVietnam, formatDateVietnam } from '@/lib/datetime';
import { badgeTone } from '@/lib/dashboard-badge-tones';
import { cn } from '@/lib/utils';
import { ScrollableTableRegion, scrollableTableHeaderRowClass } from '@/components/scrollable-table-region';

type AuditLogRow = {
  id: string;
  ts: string;
  actor: string;
  actorRaw: string;
  action: string;
  target: string;
  entityType: string;
  entityId: number | null;
  raw: unknown;
};

function normalizeAuditLog(item: any, idx: number): AuditLogRow {
  const id = String(item?.audit_id ?? item?.auditId ?? item?.id ?? item?.log_id ?? item?.logId ?? idx);
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
  const entityType = String(item?.entity_type ?? item?.entityType ?? '').trim();
  const rawEntityId = item?.entity_id ?? item?.entityId;
  let entityId: number | null = null;
  if (rawEntityId != null && rawEntityId !== '') {
    const n = Number(rawEntityId);
    if (!Number.isNaN(n)) entityId = n;
  }
  const userIdRaw = item?.user_id ?? item?.userId;
  const actorNameApi = String(item?.actor_name ?? item?.actorName ?? '').trim();
  const actorRaw = String(userIdRaw ?? item?.email ?? item?.actor ?? item?.user ?? '').trim() || '—';
  const actor = actorNameApi
    ? actorNameApi
    : !actorRaw || actorRaw === '—'
      ? 'System Admin'
      : /^\d+$/.test(actorRaw)
        ? `User #${actorRaw}`
        : actorRaw;
  const action = String(item?.action ?? item?.event ?? item?.type ?? '—');
  const targetFromApi =
    entityType && entityId != null
      ? `${entityType} #${entityId}`
      : entityType || String(item?.target ?? item?.resource ?? item?.entity ?? item?.path ?? '—');
  return {
    id,
    ts,
    actor,
    actorRaw,
    action,
    target: targetFromApi,
    entityType,
    entityId,
    raw: item,
  };
}

/** Human-readable entity name in Vietnamese and English (for audit badges). */
function entityLabelsViEn(entityType: string): { vi: string; en: string } {
  const t = String(entityType || '').trim();
  const map: Record<string, { vi: string; en: string }> = {
    Customer: { vi: 'khách hàng', en: 'customer' },
    User: { vi: 'người dùng', en: 'user' },
    UserProfile: { vi: 'hồ sơ người dùng', en: 'user profile' },
    Alert: { vi: 'cảnh báo', en: 'alert' },
    CustomerImport: { vi: 'lô nhập khách hàng', en: 'customer import batch' },
    Loan_Application: { vi: 'hồ sơ vay', en: 'loan application' },
    Loan_Payment: { vi: 'ghi nhận thanh toán', en: 'loan payment' },
    Loan_Facility: { vi: 'khoản vay (facility)', en: 'loan facility' },
    Loan_Repayment_Schedule: { vi: 'dòng lịch trả nợ', en: 'repayment schedule row' },
    ChatSession: { vi: 'phiên chat AI', en: 'AI chat session' },
    Chat_Session: { vi: 'phiên chat AI', en: 'AI chat session' },
  };
  if (map[t]) return map[t];
  const human = t.replace(/_/g, ' ').trim() || (t ? t : 'record');
  return { vi: human, en: human };
}

function localeText(locale: string, viPart: string, enPart: string): string {
  return locale === 'vi' ? viPart : enPart;
}

function idPart(entityId: number | null): string {
  if (entityId == null || Number.isNaN(entityId)) return '';
  return ` #${entityId}`;
}

/** @deprecated prefer entityLabelsViEn + bilingualDot */
function entityDisplayName(entityType: string, locale: string): string {
  const { vi, en } = entityLabelsViEn(entityType);
  return locale === 'vi' ? vi : en;
}

function entityIdSuffix(entityId: number | null, locale: string): string {
  if (entityId == null || Number.isNaN(entityId)) return '';
  return locale === 'vi' ? ` #${entityId}` : ` #${entityId}`;
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

function getActionLabel(row: AuditLogRow, locale: string): string {
  const action = String(row.action || '').trim().toUpperCase();
  const et = String(row.entityType || '').trim();
  const idS = idPart(row.entityId);
  const L = entityLabelsViEn(et);

  if (action === 'INSERT' && et === 'Customer') {
    return localeText(locale, `Thêm ${L.vi}${idS}`, `Insert ${L.en}${idS}`);
  }
  if (action === 'UPDATE' && et === 'Customer') {
    return localeText(locale, `Cập nhật ${L.vi}${idS}`, `Update ${L.en}${idS}`);
  }
  if (action === 'DELETE' && et === 'Customer') {
    return localeText(locale, `Xóa ${L.vi}${idS}`, `Delete ${L.en}${idS}`);
  }
  if (action === 'APPROVE_CUSTOMER') {
    return localeText(locale, `Duyệt hồ sơ ${L.vi}${idS}`, `Approve ${L.en} dossier${idS}`);
  }
  if (action === 'REJECT_CUSTOMER') {
    return localeText(locale, `Từ chối hồ sơ ${L.vi}${idS}`, `Reject ${L.en} dossier${idS}`);
  }
  if (action === 'RESOLVE_ALERT') {
    return localeText(locale, `Xử lý ${L.vi}${idS}`, `Resolve ${L.en}${idS}`);
  }
  if (action === 'CREATE_USER') {
    return localeText(locale, `Tạo ${L.vi}${idS}`, `Create ${L.en}${idS}`);
  }
  if (action === 'DELETE_USER') {
    return localeText(locale, `Xóa ${L.vi}${idS}`, `Delete ${L.en}${idS}`);
  }
  if (action === 'UPDATE_USER_STATUS') {
    return localeText(locale, `Cập nhật trạng thái ${L.vi}${idS}`, `Update ${L.en} status${idS}`);
  }
  if (action === 'UPDATE_USER_ROLE') {
    return localeText(locale, `Cập nhật vai trò ${L.vi}${idS}`, `Update ${L.en} role${idS}`);
  }
  if (action === 'SET_PIN') {
    return localeText(locale, 'Thiết lập mã PIN', 'Set security PIN');
  }
  if (action === 'CHANGE_PIN') {
    return localeText(locale, 'Đổi mã PIN', 'Change PIN');
  }
  if (action === 'ADMIN_SET_USER_PIN') {
    return localeText(locale, `Admin đặt PIN cho ${L.vi}${idS}`, `Admin set PIN for ${L.en}${idS}`);
  }
  if (action === 'RESET_PASSWORD_WITH_PIN') {
    return localeText(locale, 'Đặt lại mật khẩu bằng PIN', 'Reset password with PIN');
  }
  if (action === 'CHANGE_EMAIL_WITH_PIN') {
    return localeText(locale, 'Đổi email (xác nhận PIN)', 'Change email (PIN verified)');
  }
  if (action === 'UPDATE_PROFILE') {
    return localeText(locale, 'Cập nhật hồ sơ (tên/SĐT)', 'Update profile (name/phone)');
  }
  if (action === 'UPDATE_AVATAR') {
    return localeText(locale, 'Cập nhật ảnh đại diện', 'Update avatar');
  }
  if (action === 'IMPORT_CUSTOMERS') {
    return localeText(locale, 'Nhập danh sách khách hàng', 'Import customers');
  }
  if (action === 'IMPORT_CUSTOMERS_FAILED' || action === 'UPLOAD_FAILED') {
    return localeText(locale, 'Nhập / tải tệp thất bại', 'Import or upload failed');
  }
  if (action === 'APPROVE_REGISTRATION') {
    return localeText(locale, 'Duyệt đăng ký người dùng', 'Approve user registration');
  }
  if (action === 'REJECT_REGISTRATION') {
    return localeText(locale, 'Từ chối đăng ký người dùng', 'Reject user registration');
  }

  const raw = String(row.action || '').trim();
  const normalized = raw.toLowerCase().replace(/_/g, ' ');
  if (normalized.includes('approve customer')) return localeText(locale, 'Duyệt hồ sơ khách hàng', 'Approve customer dossier');
  if (normalized.includes('reject customer')) return localeText(locale, 'Từ chối hồ sơ khách hàng', 'Reject customer dossier');
  if (normalized.includes('approve registration') || normalized.includes('approve user')) {
    return localeText(locale, 'Duyệt người dùng', 'Approve user');
  }
  if (normalized.includes('reject registration') || normalized.includes('reject user')) {
    return localeText(locale, 'Từ chối người dùng', 'Reject user');
  }
  if (normalized.includes('request password reset')) {
    return localeText(locale, 'Yêu cầu đặt lại mật khẩu', 'Request password reset');
  }
  if (normalized.includes('request email change')) {
    return localeText(locale, 'Yêu cầu đổi email', 'Request email change');
  }
  if (normalized.includes('reset password')) {
    return localeText(locale, 'Đặt lại mật khẩu', 'Reset password');
  }
  if (normalized.includes('change email')) {
    return localeText(locale, 'Đổi email', 'Change email');
  }
  if (normalized.includes('verify email')) {
    return localeText(locale, 'Xác nhận liên kết đăng ký', 'Confirm registration link');
  }
  if (normalized.includes('resend verification email')) {
    return localeText(locale, 'Gửi lại email xác nhận', 'Resend confirmation email');
  }
  if (normalized.includes('register user')) {
    return localeText(locale, 'Đăng ký người dùng', 'Register user');
  }
  if (normalized.includes('import customers')) {
    return localeText(locale, 'Nhập danh sách khách hàng', 'Import customers');
  }
  if (normalized.includes('import customers failed') || normalized.includes('upload failed')) {
    return localeText(locale, 'Nhập dữ liệu thất bại', 'Import failed');
  }
  if (normalized.includes('resolve alert')) return localeText(locale, 'Xử lý cảnh báo', 'Resolve alert');
  if (normalized.includes('update avatar')) return localeText(locale, 'Cập nhật ảnh đại diện', 'Update avatar');
  if (normalized.includes('update profile')) return localeText(locale, 'Cập nhật hồ sơ người dùng', 'Update user profile');
  if (normalized.includes('change password')) return localeText(locale, 'Đổi mật khẩu', 'Change password');
  if (normalized.includes('admin') && normalized.includes('status')) {
    return localeText(locale, 'Cập nhật trạng thái người dùng', 'Update user status');
  }
  if (normalized.includes('update user') || normalized.includes('user status')) {
    return localeText(locale, 'Cập nhật trạng thái người dùng', 'Update user status');
  }
  if (normalized.includes('delete')) {
    return localeText(locale, `Xóa ${L.vi}${idS}`, `Delete ${L.en}${idS}`);
  }
  if (normalized.includes('update')) {
    return localeText(locale, `Cập nhật ${L.vi}${idS}`, `Update ${L.en}${idS}`);
  }
  if (normalized.includes('create')) {
    return localeText(locale, `Tạo ${L.vi}${idS}`, `Create ${L.en}${idS}`);
  }
  if (normalized.includes('insert')) {
    return localeText(locale, `Thêm ${L.vi}${idS}`, `Insert ${L.en}${idS}`);
  }
  return raw.replace(/_/g, ' ');
}

function getActionShortDescription(row: AuditLogRow, locale: string): string {
  const action = String(row.action || '').trim().toUpperCase();
  const et = String(row.entityType || '').trim();
  const idS = idPart(row.entityId);
  const L = entityLabelsViEn(et);

  if (action === 'INSERT' && et === 'Customer') {
    return localeText(locale, `Đã thêm mới ${L.vi}${idS} vào hệ thống.`, `Created new ${L.en} record${idS}.`);
  }
  if (action === 'UPDATE' && et === 'Customer') {
    return localeText(locale, `Đã cập nhật dữ liệu ${L.vi}${idS}.`, `Updated ${L.en} data${idS}.`);
  }
  if (action === 'DELETE' && et === 'Customer') {
    return localeText(locale, `Đã xóa hồ sơ ${L.vi}${idS}.`, `Deleted ${L.en} record${idS}.`);
  }
  if (action === 'APPROVE_CUSTOMER') {
    return localeText(locale, `Phê duyệt hồ sơ ${L.vi}${idS}.`, `Approved ${L.en} dossier${idS}.`);
  }
  if (action === 'REJECT_CUSTOMER') {
    return localeText(locale, `Từ chối hồ sơ ${L.vi}${idS}.`, `Rejected ${L.en} dossier${idS}.`);
  }
  if (action === 'RESOLVE_ALERT') {
    return localeText(locale, `Đánh dấu đã xử lý ${L.vi}${idS}.`, `Marked ${L.en} as resolved${idS}.`);
  }
  if (action === 'CREATE_USER') {
    return localeText(locale, `Tạo tài khoản ${L.vi}${idS}.`, `Created ${L.en} account${idS}.`);
  }
  if (action === 'DELETE_USER') {
    return localeText(locale, `Xóa tài khoản ${L.vi}${idS}.`, `Deleted ${L.en} account${idS}.`);
  }
  if (action === 'UPDATE_USER_STATUS') {
    return localeText(locale, `Đổi trạng thái kích hoạt ${L.vi}${idS}.`, `Changed activation status for ${L.en}${idS}.`);
  }
  if (action === 'UPDATE_USER_ROLE') {
    return localeText(locale, `Đổi vai trò ${L.vi}${idS}.`, `Changed role for ${L.en}${idS}.`);
  }
  if (action === 'SET_PIN') {
    return localeText(locale, 'Người dùng thiết lập mã PIN bảo mật.', 'User set a security PIN.');
  }
  if (action === 'CHANGE_PIN') {
    return localeText(locale, 'Người dùng đổi mã PIN bảo mật.', 'User changed security PIN.');
  }
  if (action === 'ADMIN_SET_USER_PIN') {
    return localeText(locale, `Quản trị viên đặt lại PIN cho ${L.vi}${idS}.`, `Administrator set PIN for ${L.en}${idS}.`);
  }
  if (action === 'RESET_PASSWORD_WITH_PIN') {
    return localeText(locale, 'Đặt lại mật khẩu sau khi xác minh PIN.', 'Password reset after PIN verification.');
  }
  if (action === 'CHANGE_EMAIL_WITH_PIN') {
    return localeText(locale, 'Đổi email sau khi xác minh PIN.', 'Email changed after PIN verification.');
  }
  if (action === 'UPDATE_PROFILE') {
    return localeText(locale, 'Cập nhật họ tên hoặc số điện thoại trên hồ sơ.', 'Updated name or phone on the profile.');
  }
  if (action === 'UPDATE_AVATAR') {
    return localeText(locale, 'Cập nhật ảnh đại diện tài khoản.', 'Updated account avatar.');
  }
  if (action === 'IMPORT_CUSTOMERS') {
    return localeText(locale, 'Nhập khách hàng từ tệp (theo lô).', 'Imported customers from a file (batch).');
  }
  if (action === 'IMPORT_CUSTOMERS_FAILED' || action === 'UPLOAD_FAILED') {
    return localeText(locale, 'Nhập hoặc tải tệp thất bại.', 'Import or file upload failed.');
  }
  if (action === 'APPROVE_REGISTRATION') {
    return localeText(locale, 'Phê duyệt yêu cầu đăng ký người dùng.', 'Approved user registration request.');
  }
  if (action === 'REJECT_REGISTRATION') {
    return localeText(locale, 'Từ chối yêu cầu đăng ký người dùng.', 'Rejected user registration request.');
  }

  const normalized = String(row.action || '').toLowerCase().replace(/_/g, ' ');
  if (normalized.includes('approve customer')) return localeText(locale, 'Duyệt hồ sơ khách hàng.', 'Approved customer dossier.');
  if (normalized.includes('reject customer')) return localeText(locale, 'Từ chối hồ sơ khách hàng.', 'Rejected customer dossier.');
  if (normalized.includes('approve registration') || normalized.includes('approve user')) {
    return localeText(locale, 'Phê duyệt đăng ký người dùng.', 'Approved user registration.');
  }
  if (normalized.includes('reject registration') || normalized.includes('reject user')) {
    return localeText(locale, 'Từ chối đăng ký người dùng.', 'Rejected user registration.');
  }
  if (normalized.includes('request password reset')) return localeText(locale, 'Người dùng yêu cầu đặt lại mật khẩu.', 'User requested password reset.');
  if (normalized.includes('reset password')) return localeText(locale, 'Mật khẩu đã được đặt lại.', 'Password has been reset.');
  if (normalized.includes('request email change')) return localeText(locale, 'Người dùng yêu cầu thay đổi email.', 'User requested email change.');
  if (normalized.includes('change email')) return localeText(locale, 'Email tài khoản đã được cập nhật.', 'Account email has been updated.');
  if (normalized.includes('update avatar')) return localeText(locale, 'Cập nhật ảnh đại diện tài khoản.', 'Updated account avatar.');
  if (normalized.includes('update profile')) return localeText(locale, 'Cập nhật thông tin hồ sơ người dùng.', 'Updated user profile information.');
  if (normalized.includes('change password')) return localeText(locale, 'Đổi mật khẩu tài khoản.', 'Changed account password.');
  if (normalized.includes('update user') || normalized.includes('user status')) {
    return localeText(locale, 'Cập nhật trạng thái kích hoạt người dùng.', 'Updated user activation status.');
  }
  if (normalized.includes('verify email')) {
    return localeText(locale, 'Liên kết xác nhận trong email đăng ký đã được sử dụng.', 'The registration confirmation link was used.');
  }
  if (normalized.includes('resend verification email')) {
    return localeText(locale, 'Đã gửi lại email chứa liên kết xác nhận.', 'Confirmation email was resent.');
  }
  if (normalized.includes('register user')) return localeText(locale, 'Tạo mới yêu cầu đăng ký người dùng.', 'Created a new user registration request.');
  if (normalized.includes('import customers')) return localeText(locale, 'Nhập dữ liệu khách hàng từ tệp.', 'Imported customers from file.');
  if (normalized.includes('resolve alert')) return localeText(locale, 'Cảnh báo đã được xử lý.', 'Alert has been resolved.');
  if (normalized.includes('update')) {
    return idS
      ? localeText(locale, `Đã cập nhật ${L.vi}${idS}.`, `Updated ${L.en}${idS}.`)
      : localeText(locale, `Cập nhật ${L.vi || 'dữ liệu hệ thống'}.`, `Updated ${L.en || 'system data'}.`);
  }
  if (normalized.includes('delete')) {
    return idS
      ? localeText(locale, `Đã xóa ${L.vi}${idS}.`, `Deleted ${L.en}${idS}.`)
      : localeText(locale, `Xóa ${L.vi || 'dữ liệu'}.`, `Deleted ${L.en || 'data'}.`);
  }
  if (normalized.includes('create') || normalized.includes('insert')) {
    return idS
      ? localeText(locale, `Đã thêm ${L.vi}${idS}.`, `Inserted ${L.en}${idS}.`)
      : localeText(locale, `Thêm ${L.vi || 'bản ghi mới'}.`, `Inserted ${L.en || 'new record'}.`);
  }
  return localeText(locale, 'Thao tác hệ thống hoặc không phân loại.', 'System or unclassified action.');
}

function getActionBadgeClass(row: AuditLogRow): string {
  const action = String(row.action || '').trim().toUpperCase();
  const et = String(row.entityType || '').trim();
  const normalized = String(row.action || '').toLowerCase().replace(/_/g, ' ');

  if (action === 'APPROVE_CUSTOMER' || normalized.includes('approve customer')) {
    return badgeTone.emerald;
  }
  if (action === 'REJECT_CUSTOMER' || (normalized.includes('reject') && normalized.includes('customer'))) {
    return badgeTone.rose;
  }
  if (action === 'INSERT' && et === 'Customer') {
    return badgeTone.teal;
  }
  if (action === 'UPDATE' && et === 'Customer') {
    return badgeTone.indigo;
  }
  if (action === 'DELETE' && et === 'Customer') {
    return badgeTone.red;
  }
  if (action === 'RESOLVE_ALERT' || normalized.includes('resolve alert')) {
    return badgeTone.sky;
  }
  if (action === 'SET_PIN' || action === 'CHANGE_PIN' || action === 'ADMIN_SET_USER_PIN') {
    return badgeTone.violet;
  }
  if (action === 'RESET_PASSWORD_WITH_PIN' || action === 'REQUEST_PASSWORD_RESET' || normalized.includes('reset password')) {
    return badgeTone.amber;
  }
  if (action === 'CHANGE_EMAIL_WITH_PIN' || normalized.includes('request email change') || normalized.includes('change email')) {
    return badgeTone.cyan;
  }
  if (action === 'CHANGE_PASSWORD' || normalized.includes('change password')) {
    return badgeTone.orange;
  }
  if (action === 'CREATE_USER' || normalized.includes('register user')) {
    return badgeTone.lime;
  }
  if (action === 'DELETE_USER' || (normalized.includes('delete') && normalized.includes('user'))) {
    return badgeTone.red;
  }
  if (action === 'UPDATE_USER_ROLE') {
    return badgeTone.blue;
  }
  if (action === 'UPDATE_USER_STATUS' || normalized.includes('update user') || normalized.includes('user status')) {
    return badgeTone.amber;
  }
  if (action === 'UPDATE_PROFILE' || action === 'UPDATE_AVATAR' || normalized.includes('update profile') || normalized.includes('update avatar')) {
    return badgeTone.indigo;
  }
  if (action === 'IMPORT_CUSTOMERS_FAILED' || action === 'UPLOAD_FAILED' || normalized.includes('import customers failed') || normalized.includes('upload failed')) {
    return badgeTone.rose;
  }
  if (action === 'IMPORT_CUSTOMERS' || normalized.includes('import customers')) {
    return badgeTone.blue;
  }
  if (normalized.includes('verify email') || normalized.includes('resend verification email')) {
    return badgeTone.purple;
  }
  if (action === 'APPROVE_REGISTRATION' || normalized.includes('approve registration') || normalized.includes('approve user')) {
    return badgeTone.emerald;
  }
  if (action === 'REJECT_REGISTRATION' || normalized.includes('reject registration') || normalized.includes('reject user')) {
    return badgeTone.rose;
  }
  if (normalized.includes('reject')) {
    return badgeTone.rose;
  }
  if (normalized.includes('delete')) {
    return badgeTone.red;
  }
  if (normalized.includes('update')) {
    return badgeTone.indigo;
  }
  if (normalized.includes('insert') || normalized.includes('create')) {
    return badgeTone.emerald;
  }
  return badgeTone.slate;
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
    entity_type: locale === 'vi' ? 'Loại thực thể' : 'Entity type',
    entity_id: locale === 'vi' ? 'Mã thực thể' : 'Entity ID',
    user_id: locale === 'vi' ? 'Mã người dùng' : 'User ID',
    performed_at: locale === 'vi' ? 'Thời gian thực hiện' : 'Performed at',
    audit_id: locale === 'vi' ? 'Mã nhật ký' : 'Audit ID',
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
  const msgLocale: UserFacingLocale = locale === 'en' ? 'en' : 'vi';
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [actorNameMap, setActorNameMap] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditLogRow | null>(null);

  const load = async () => {
    setIsLoading(true);
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
      notifyError(t('toast.load_failed'), { description: formatUserFacingApiError(err, msgLocale) });
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
        locale === 'vi' ? 'Mô tả ngắn' : 'Short description',
      ],
      filtered.map((r) => [
        r.id,
        formatAuditTs(r.ts, locale),
        resolveActorDisplay(r),
        getActionLabel(r, locale),
        r.target,
        getActionShortDescription(r, locale),
      ]),
    );
  };

  return (
    <div className="flex min-h-[calc(100vh-72px)] flex-col gap-4 bg-background p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('admin.audit.title')}</h1>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          {t('common.refresh')}
        </Button>
      </div>

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
          <ScrollableTableRegion className="min-h-[200px]">
            <Table className="w-full min-w-[1280px] table-fixed">
              <colgroup>
                <col className="w-[11%]" />
                <col className="w-[9%]" />
                <col className="w-[16%]" />
                <col className="w-[20%]" />
                <col className="w-[22%]" />
                <col className="w-[10%]" />
              </colgroup>
              <TableHeader>
                <TableRow className={scrollableTableHeaderRowClass}>
                  <TableHead className="px-6 py-3.5 text-[13px] font-semibold">{t('common.date')}</TableHead>
                  <TableHead className="px-6 py-3.5 text-[13px] font-semibold">{locale === 'vi' ? 'Giờ' : 'Time'}</TableHead>
                  <TableHead className="px-6 py-3.5 text-[13px] font-semibold">{t('admin.audit.actor')}</TableHead>
                  <TableHead className="px-6 py-3.5 text-[13px] font-semibold">{t('admin.audit.action')}</TableHead>
                  <TableHead className="px-6 py-3.5 text-[13px] font-semibold">{t('admin.audit.short_desc')}</TableHead>
                  <TableHead className="px-4 py-3.5 text-[13px] font-semibold text-center">{t('admin.audit.details')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((r) => (
                  <TableRow key={r.id} className="border-b border-border/70 hover:bg-muted/35">
                    <TableCell className="px-6 py-3 whitespace-nowrap text-[13px]">{formatAuditDateOnly(r.ts, locale)}</TableCell>
                    <TableCell className="px-6 py-3 whitespace-nowrap text-[13px]">{formatAuditTimeOnly(r.ts, locale)}</TableCell>
                    <TableCell className="px-6 py-3 text-[13px] font-medium">
                      {resolveActorDisplay(r)}
                    </TableCell>
                    <TableCell className="px-6 py-3 align-top">
                      <Badge
                        variant="outline"
                        className={cn(
                          getActionBadgeClass(r),
                          'max-w-full whitespace-normal text-left font-normal leading-snug py-1.5 px-2.5',
                        )}
                      >
                        {getActionLabel(r, locale)}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 py-3 align-top text-[13px] text-muted-foreground whitespace-normal leading-snug">
                      {getActionShortDescription(r, locale)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-center">
                      <Button type="button" variant="outline" size="sm" className="text-[12px]" onClick={() => setSelected(r)}>
                        {t('admin.audit.view_details')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {paged.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      {isLoading ? t('common.loading') : t('common.no_results')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollableTableRegion>
          {filtered.length > 0 && (
            <div className="mt-3">
            <ListPagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="!w-[95vw] !max-w-[1500px] max-h-[92vh] overflow-hidden p-4 sm:p-6">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>{t('admin.audit.detail_title')}</DialogTitle>
              </DialogHeader>

              <div className="max-h-[calc(92vh-8rem)] overflow-y-auto space-y-4 pr-1">
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
                        {
                          label: t('admin.audit.actor'),
                          value: resolveActorDisplay(selected),
                          icon: User,
                          kind: 'text' as const,
                        },
                        {
                          label: t('admin.audit.action'),
                          value: getActionLabel(selected, locale),
                          kind: 'action' as const,
                        },
                        {
                          label: t('admin.audit.target'),
                          value:
                            selected.entityType || selected.entityId != null
                              ? `${entityDisplayName(selected.entityType, locale)}${entityIdSuffix(selected.entityId, locale)}`
                              : selected.target,
                          icon: Hash,
                          kind: 'text' as const,
                        },
                        {
                          label: locale === 'vi' ? 'Thời gian' : 'Timestamp',
                          value: formatAuditTs(String(selected.ts ?? ''), locale),
                          icon: Clock3,
                          kind: 'text' as const,
                        },
                      ].map((item) => (
                        <div key={item.label} className="rounded-xl border p-3">
                          <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                            {item.icon ? <item.icon className="h-3.5 w-3.5" /> : null}
                            {item.label}
                          </p>
                          {item.kind === 'action' ? (
                            <div className="mt-2">
                              <Badge variant="outline" className={getActionBadgeClass(selected)}>
                                <ShieldCheck className="h-3.5 w-3.5" />
                                {String(item.value)}
                              </Badge>
                            </div>
                          ) : (
                            <p className="mt-2 font-medium break-words">{item.value}</p>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="rounded-xl border p-3 min-w-0">
                      <p className="mb-3 flex items-center gap-2 font-medium">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {t('admin.audit.before')}
                      </p>
                      <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
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
                        <p className="mb-3 flex items-center gap-2 font-medium">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {t('admin.audit.after')}
                        </p>
                        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
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
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>{t('common.close')}</Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

