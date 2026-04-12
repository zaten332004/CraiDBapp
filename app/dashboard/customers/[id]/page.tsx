'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';
import { useI18n } from '@/components/i18n-provider';
import { browserApiFetchAuth } from '@/lib/api/browser';
import { notifyError, notifySuccess } from '@/lib/notify';
import { formatUserFacingApiError, type UserFacingLocale } from '@/lib/api/format-api-error';
import { formatDateTimeVietnam } from '@/lib/datetime';
import { formatVnd } from '@/lib/money';
import { getUserRole } from '@/lib/auth/token';

function sanitizeDashboardReturnTo(raw: string | null): string | null {
  if (!raw) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (decoded.length > 256) return null;
  if (!decoded.startsWith('/dashboard')) return null;
  if (decoded.includes('//') || decoded.includes('\\')) return null;
  return decoded;
}

export default function CustomerDetailPage() {
  const { locale, t } = useI18n();
  const isVi = locale === 'vi';
  const msgLocale: UserFacingLocale = locale === 'en' ? 'en' : 'vi';
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const customerId = Number(params.id);
  const returnToParam = searchParams.get('returnTo');
  const backHref = useMemo(() => {
    return sanitizeDashboardReturnTo(returnToParam) ?? '/dashboard/customers';
  }, [returnToParam]);
  const role = getUserRole();
  const canManageProfile = role !== 'viewer';
  /** Duyệt / từ chối hồ sơ: manager & admin; analyst chỉ sửa & xóa. */
  const canReviewCustomer = canManageProfile && role !== 'analyst';
  const [customer, setCustomer] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [editForm, setEditForm] = useState({
    phone_number: '',
    email: '',
    occupation: '',
    employment_status: '',
    monthly_income: '',
    permanent_address: '',
    current_address: '',
    loan_type: '',
    loan_purpose: '',
    requested_loan_amount: '',
    requested_term_months: '',
    annual_interest_rate: '',
    collateral_id: '',
    collateral_value: '',
  });

  const LOAN_TYPE_OPTIONS = [
    { value: 'secured', labelVi: 'Có tài sản bảo đảm', labelEn: 'Secured' },
    { value: 'unsecured', labelVi: 'Tín chấp', labelEn: 'Unsecured' },
    { value: 'mortgage', labelVi: 'Thế chấp', labelEn: 'Mortgage' },
    { value: 'business', labelVi: 'Kinh doanh', labelEn: 'Business' },
  ] as const;

  const EMPLOYMENT_STATUS_OPTIONS = [
    { value: 'employed', labelVi: 'Đang làm việc', labelEn: 'Employed' },
    { value: 'self_employed', labelVi: 'Tự kinh doanh', labelEn: 'Self-employed' },
    { value: 'contract', labelVi: 'Hợp đồng / bán thời gian', labelEn: 'Contract / part-time' },
    { value: 'unemployed', labelVi: 'Thất nghiệp', labelEn: 'Unemployed' },
  ] as const;

  const normalizeLoanType = (value: unknown): string => {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (!normalized) return '';
    if (['secured', 'unsecured', 'mortgage', 'business'].includes(normalized)) return normalized;
    if (normalized.includes('tài sản')) return 'secured';
    if (normalized.includes('tín chấp')) return 'unsecured';
    if (normalized.includes('thế chấp')) return 'mortgage';
    if (normalized.includes('kinh doanh')) return 'business';
    return normalized;
  };

  const normalizeEmploymentStatus = (value: unknown): string => {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (!normalized) return '';
    if (['employed', 'self_employed', 'contract', 'unemployed'].includes(normalized)) return normalized;
    if (normalized.includes('tự kinh doanh')) return 'self_employed';
    if (normalized.includes('hợp đồng') || normalized.includes('bán thời gian')) return 'contract';
    if (normalized.includes('thất nghiệp')) return 'unemployed';
    if (normalized.includes('đang làm việc')) return 'employed';
    return normalized;
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const customerData = await browserApiFetchAuth<any>(`/customers/${customerId}`, { method: 'GET' });
        if (cancelled) return;
        setCustomer(customerData);
        setEditForm({
          phone_number: String(customerData.phone_number ?? customerData.phone ?? ''),
          email: String(customerData.email ?? ''),
          occupation: String(customerData.occupation ?? ''),
          employment_status: normalizeEmploymentStatus(customerData.employment_status),
          monthly_income: customerData.monthly_income != null ? String(customerData.monthly_income) : '',
          permanent_address: String(customerData.permanent_address ?? ''),
          current_address: String(customerData.current_address ?? ''),
          loan_type: normalizeLoanType(customerData.loan_type ?? customerData.product_type),
          loan_purpose: String(customerData.loan_purpose ?? ''),
          requested_loan_amount: customerData.requested_loan_amount != null ? String(customerData.requested_loan_amount) : customerData.loan_amount != null ? String(customerData.loan_amount) : '',
          requested_term_months: customerData.requested_term_months != null ? String(customerData.requested_term_months) : customerData.loan_term_months != null ? String(customerData.loan_term_months) : '',
          annual_interest_rate: customerData.annual_interest_rate != null ? String(customerData.annual_interest_rate) : customerData.interest_rate != null ? String(customerData.interest_rate) : '',
          collateral_id: String(customerData.collateral_id ?? ''),
          collateral_value: customerData.collateral_value != null ? String(customerData.collateral_value) : customerData.collateral_amount != null ? String(customerData.collateral_amount) : '',
        });
      } catch (err) {
        if (!cancelled) {
          notifyError(t('toast.load_failed'), { description: formatUserFacingApiError(err, msgLocale) });
        }
      }
    };
    if (Number.isFinite(customerId) && customerId > 0) void load();
    return () => {
      cancelled = true;
    };
  }, [customerId, msgLocale, t]);

  const riskBadgeClass = useMemo(() => {
    const level = String(customer?.risk_level || '').toLowerCase();
    if (level === 'high') return 'border-rose-200 bg-rose-50 text-rose-700';
    if (level === 'medium') return 'border-blue-200 bg-blue-50 text-blue-700';
    if (level === 'low') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    return 'border-slate-200 bg-slate-50 text-slate-700';
  }, [customer?.risk_level]);

  const riskBadgeLabel = useMemo(() => {
    const level = String(customer?.risk_level || '').toLowerCase();
    if (level === 'high') return t('risk.level.high');
    if (level === 'medium') return t('risk.level.medium');
    if (level === 'low') return t('risk.level.low');
    return String(customer?.risk_level || '-');
  }, [customer?.risk_level, t]);

  const statusBadgeClass = useMemo(() => {
    const status = String(customer?.application_status || '').toLowerCase();
    if (status === 'disbursed') return 'border-blue-200 bg-blue-50 text-blue-700';
    if (status === 'approved') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    if (status === 'rejected') return 'border-rose-200 bg-rose-50 text-rose-700';
    if (status === 'pending') return 'border-slate-200 bg-slate-50 text-slate-700';
    return 'border-slate-200 bg-slate-50 text-slate-700';
  }, [customer?.application_status]);

  const statusBadgeLabel = useMemo(() => {
    const status = String(customer?.application_status || '').toLowerCase();
    if (status === 'disbursed') return isVi ? 'Đã giải ngân' : 'Disbursed';
    if (status === 'approved') return t('status.approved');
    if (status === 'rejected') return t('status.rejected');
    if (status === 'pending') return t('status.pending');
    if (status === 'active') return t('status.active');
    if (status === 'inactive') return t('status.inactive');
    return String(customer?.application_status || '-');
  }, [customer?.application_status, t]);

  const isPending = String(customer?.application_status || '').toLowerCase() === 'pending';

  const sanitizePhoneInput = (value: string) => value.replace(/[^\d+]/g, '').slice(0, 15);

  const formatPhoneViDisplay = (value: unknown) => {
    const raw = String(value ?? '').replace(/\D/g, '');
    if (!raw) return '-';
    const normalized = raw.startsWith('84') && raw.length >= 11 ? `0${raw.slice(2)}` : raw;
    if (normalized.length === 10) {
      return `${normalized.slice(0, 4)} ${normalized.slice(4, 7)} ${normalized.slice(7)}`;
    }
    return normalized;
  };

  const toVietnameseValue = (value: unknown, fieldLabel?: string) => {
    if (value == null) return '-';
    const raw = String(value).trim();
    if (!raw) return '-';
    const normalized = raw.toLowerCase();

    const commonMap: Record<string, string> = {
      male: 'Nam',
      female: 'Nữ',
      other: 'Khác',
      secured: 'Có tài sản bảo đảm',
      unsecured: 'Tín chấp',
      mortgage: 'Thế chấp',
      business: 'Kinh doanh',
      personal: 'Cá nhân',
      employed: 'Đang làm việc',
      unemployed: 'Thất nghiệp',
      self_employed: 'Tự kinh doanh',
      single: 'Độc thân',
      married: 'Đã kết hôn',
      divorced: 'Ly hôn',
      widowed: 'Góa',
      approved: 'Đã duyệt',
      rejected: 'Từ chối',
      pending: 'Đang chờ',
      active: 'Hoạt động',
      inactive: 'Ngừng hoạt động',
      true: 'Có',
      false: 'Không',
    };
    if (commonMap[normalized]) return commonMap[normalized];

    if (fieldLabel === 'Giới tính') {
      if (normalized.startsWith('m')) return 'Nam';
      if (normalized.startsWith('f')) return 'Nữ';
    }

    if (fieldLabel === 'Số điện thoại') return formatPhoneViDisplay(raw);
    if (/[0-9@._-]/.test(raw)) return raw;
    return raw;
  };

  const handleUpdateProfile = async () => {
    if (!customer) return;
    setIsSaving(true);
    try {
      const payload: Record<string, any> = {
        phone_number: sanitizePhoneInput(editForm.phone_number || ''),
        email: editForm.email || null,
        occupation: editForm.occupation || null,
        employment_status: normalizeEmploymentStatus(editForm.employment_status) || null,
        monthly_income: editForm.monthly_income ? Number(editForm.monthly_income) : null,
        permanent_address: editForm.permanent_address || null,
        current_address: editForm.current_address || null,
        loan_type: normalizeLoanType(editForm.loan_type) || null,
        product_type: normalizeLoanType(editForm.loan_type) || null,
        loan_purpose: editForm.loan_purpose || null,
        requested_loan_amount: editForm.requested_loan_amount ? Number(editForm.requested_loan_amount) : null,
        loan_amount: editForm.requested_loan_amount ? Number(editForm.requested_loan_amount) : null,
        requested_term_months: editForm.requested_term_months ? Number(editForm.requested_term_months) : null,
        loan_term_months: editForm.requested_term_months ? Number(editForm.requested_term_months) : null,
        annual_interest_rate: editForm.annual_interest_rate ? Number(editForm.annual_interest_rate) : null,
        interest_rate: editForm.annual_interest_rate ? Number(editForm.annual_interest_rate) : null,
        collateral_id: editForm.collateral_id || null,
        collateral_value: editForm.collateral_value ? Number(editForm.collateral_value) : null,
        collateral_amount: editForm.collateral_value ? Number(editForm.collateral_value) : null,
      };
      const updated = await browserApiFetchAuth<any>(`/customers/${customerId}`, {
        method: 'PUT',
        body: payload,
      });
      setCustomer(updated);
      setIsEditing(false);
      notifySuccess(isVi ? 'Đã cập nhật hồ sơ.' : 'Profile updated.');
    } catch (err) {
      notifyError(t('toast.action_failed'), { description: formatUserFacingApiError(err, msgLocale) });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReview = async (nextStatus: 'approved' | 'rejected', reason?: string) => {
    if (!customer || !canReviewCustomer) return;
    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = { application_status: nextStatus };
      if (nextStatus === 'rejected') payload.rejection_reason = String(reason || '').trim();
      const updated = await browserApiFetchAuth<any>(`/customers/${customerId}/status`, {
        method: 'PATCH',
        body: payload,
      });
      setCustomer(updated);
      setIsEditing(false);
      notifySuccess(nextStatus === 'approved' ? (isVi ? 'Đã duyệt hồ sơ.' : 'Application approved.') : (isVi ? 'Đã từ chối hồ sơ.' : 'Application rejected.'));
    } catch (err) {
      notifyError(t('toast.action_failed'), { description: formatUserFacingApiError(err, msgLocale) });
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenRejectDialog = () => {
    setRejectReason('');
    setRejectDialogOpen(true);
  };

  const handleConfirmReject = async () => {
    const trimmed = rejectReason.trim();
    if (!trimmed) {
      notifyError(isVi ? 'Vui lòng nhập lý do từ chối hồ sơ.' : 'Please provide a rejection reason.');
      return;
    }
    await handleReview('rejected', trimmed);
    setRejectDialogOpen(false);
  };

  const handleDeleteCustomer = async () => {
    if (!customer || !canManageProfile) return;
    setIsDeleting(true);
    try {
      const response = await browserApiFetchAuth<{ message?: string }>(`/customers/${customerId}`, {
        method: 'DELETE',
      });
      notifySuccess(response?.message || (isVi ? 'Đã xóa hồ sơ khách hàng.' : 'Customer profile deleted.'));
      setConfirmDeleteOpen(false);
      router.push('/dashboard/customers');
    } catch (err) {
      notifyError(t('toast.action_failed'), { description: formatUserFacingApiError(err, msgLocale) });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!customer) {
    return <div className="p-8 text-sm text-muted-foreground">{isVi ? 'Đang tải dữ liệu khách hàng...' : 'Loading customer data...'}</div>;
  }

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={backHref}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('common.back')}
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{customer.full_name || '-'}</h1>
            <p className="text-muted-foreground mt-1">{customer.occupation || '-'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isPending && canReviewCustomer ? (
            <>
              <Button variant="outline" onClick={handleOpenRejectDialog} disabled={isSaving}>
                {isVi ? 'Từ chối' : 'Reject'}
              </Button>
              <Button onClick={() => void handleReview('approved')} disabled={isSaving}>
                {isVi ? 'Duyệt' : 'Approve'}
              </Button>
            </>
          ) : null}
          <Button variant="secondary" onClick={() => setIsEditing((prev) => !prev)} disabled={!isPending || isSaving || !canManageProfile}>
            <Edit className="mr-2 h-4 w-4" />
            {isEditing ? (isVi ? 'Hủy sửa' : 'Cancel') : t('customers.detail.edit')}
          </Button>
          {isEditing && isPending && canManageProfile ? (
            <Button onClick={() => void handleUpdateProfile()} disabled={isSaving || isDeleting}>
              {isVi ? 'Cập nhật hồ sơ' : 'Update profile'}
            </Button>
          ) : null}
          <Button
            variant="destructive"
            onClick={() => setConfirmDeleteOpen(true)}
            disabled={!canManageProfile || isSaving || isDeleting}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {isVi ? 'Xóa hồ sơ' : 'Delete profile'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Thông tin khách hàng</CardTitle>
            <CardDescription>Thông tin định danh, liên hệ và hồ sơ cơ bản của khách hàng.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                ['Họ và tên', customer.full_name],
                ['Mã tham chiếu ngoài', customer.external_customer_ref],
                ['Ngày sinh', customer.date_of_birth],
                ['Tuổi', customer.age],
                ['Giới tính', customer.gender],
                ['Quốc tịch', customer.nationality],
                ['Số giấy tờ', customer.national_id],
                ['Ngày cấp', customer.id_issue_date],
                ['Nơi cấp', customer.id_issue_place],
                ['Tình trạng hôn nhân', customer.marital_status],
                ['Số điện thoại', customer.phone_number || customer.phone],
                ['Email', customer.email],
                ['Nghề nghiệp', customer.occupation],
                ['Tình trạng nghề nghiệp', customer.employment_status],
                ['Thu nhập hàng tháng', customer.monthly_income != null ? formatVnd(Number(customer.monthly_income), locale === 'vi' ? 'vi' : 'en') : '-'],
                ['Điểm tín dụng', customer.credit_score],
                ['Địa chỉ thường trú', customer.permanent_address],
                ['Địa chỉ hiện tại', customer.current_address],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  {isEditing && isPending && ['Số điện thoại', 'Email', 'Nghề nghiệp', 'Tình trạng nghề nghiệp', 'Thu nhập hàng tháng', 'Địa chỉ thường trú', 'Địa chỉ hiện tại'].includes(String(label)) ? (
                    String(label) === 'Tình trạng nghề nghiệp' ? (
                      <Select
                        value={editForm.employment_status || ''}
                        onValueChange={(v) => setEditForm((p) => ({ ...p, employment_status: v }))}
                      >
                        <SelectTrigger className="mt-1 h-9 w-full">
                          <SelectValue placeholder={isVi ? 'Chọn tình trạng nghề nghiệp' : 'Select employment status'} />
                        </SelectTrigger>
                        <SelectContent>
                          {EMPLOYMENT_STATUS_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {isVi ? opt.labelVi : opt.labelEn}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        className="mt-1 h-9"
                        value={
                          String(label) === 'Số điện thoại' ? editForm.phone_number
                            : String(label) === 'Email' ? editForm.email
                            : String(label) === 'Nghề nghiệp' ? editForm.occupation
                            : String(label) === 'Thu nhập hàng tháng' ? editForm.monthly_income
                            : String(label) === 'Địa chỉ thường trú' ? editForm.permanent_address
                            : editForm.current_address
                        }
                        onChange={(e) => {
                          const v = e.target.value;
                          if (String(label) === 'Số điện thoại') setEditForm((p) => ({ ...p, phone_number: sanitizePhoneInput(v) }));
                          else if (String(label) === 'Email') setEditForm((p) => ({ ...p, email: v }));
                          else if (String(label) === 'Nghề nghiệp') setEditForm((p) => ({ ...p, occupation: v }));
                          else if (String(label) === 'Thu nhập hàng tháng') setEditForm((p) => ({ ...p, monthly_income: v.replace(/[^\d.]/g, '') }));
                          else if (String(label) === 'Địa chỉ thường trú') setEditForm((p) => ({ ...p, permanent_address: v }));
                          else setEditForm((p) => ({ ...p, current_address: v }));
                        }}
                      />
                    )
                  ) : (
                    <p className="mt-1 text-sm font-medium break-words">{toVietnameseValue(value, String(label))}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Thông tin hồ sơ vay</CardTitle>
            <CardDescription>Thông tin khoản vay, nguồn tiếp nhận và tài sản bảo đảm.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4">
              {[
                ['Mã hồ sơ', customer.application_ref_no],
                ['Ngày nộp hồ sơ', customer.application_date],
                ['Người tạo hồ sơ', customer.created_by || '-'],
                [
                  'Người duyệt',
                  customer.approved_by
                    ? `${customer.approved_by}${customer.approved_at ? ` (${formatDateTimeVietnam(customer.approved_at, locale)})` : ''}`
                    : '-',
                ],
                ['Loại vay', customer.loan_type ?? customer.product_type ?? customer.loanType ?? customer.productType],
                ['Mục đích vay', customer.loan_purpose],
                [
                  'Khoản vay',
                  (customer.requested_loan_amount ?? customer.loan_amount) != null
                    ? formatVnd(Number(customer.requested_loan_amount ?? customer.loan_amount), locale === 'vi' ? 'vi' : 'en')
                    : '-',
                ],
                [
                  'Thời hạn vay',
                  (customer.requested_term_months ?? customer.loan_term_months) != null
                    ? `${customer.requested_term_months ?? customer.loan_term_months} tháng`
                    : '-',
                ],
                [
                  'Lãi suất',
                  (customer.annual_interest_rate ?? customer.interest_rate) != null
                    ? `${customer.annual_interest_rate ?? customer.interest_rate}%/năm`
                    : '-',
                ],
                [
                  'Điểm rủi ro',
                  customer.risk_score != null ? Number(customer.risk_score).toFixed(4) : '-',
                ],
                ['Mức rủi ro', <Badge key="risk-badge" variant="outline" className={riskBadgeClass}>{riskBadgeLabel}</Badge>],
                ['Trạng thái hồ sơ', <Badge key="status-badge" variant="outline" className={statusBadgeClass}>{statusBadgeLabel}</Badge>],
                ['Mã tài sản bảo đảm', customer.collateral_id],
                [
                  'Giá trị tài sản bảo đảm',
                  (customer.collateral_value ?? customer.collateral_amount) != null
                    ? formatVnd(Number(customer.collateral_value ?? customer.collateral_amount), locale === 'vi' ? 'vi' : 'en')
                    : '-',
                ],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <div className="mt-1 text-sm font-medium break-words">
                    {isEditing && isPending && ['Loại vay', 'Mục đích vay', 'Khoản vay', 'Thời hạn vay', 'Lãi suất', 'Mã tài sản bảo đảm', 'Giá trị tài sản bảo đảm'].includes(String(label)) ? (
                      String(label) === 'Loại vay' ? (
                        <Select
                          value={editForm.loan_type || ''}
                          onValueChange={(v) => setEditForm((p) => ({ ...p, loan_type: v }))}
                        >
                          <SelectTrigger className="h-9 w-full">
                            <SelectValue placeholder={isVi ? 'Chọn loại vay' : 'Select loan type'} />
                          </SelectTrigger>
                          <SelectContent>
                            {LOAN_TYPE_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {isVi ? opt.labelVi : opt.labelEn}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          className="h-9"
                          value={
                            String(label) === 'Mục đích vay' ? editForm.loan_purpose
                              : String(label) === 'Khoản vay' ? editForm.requested_loan_amount
                              : String(label) === 'Thời hạn vay' ? editForm.requested_term_months
                              : String(label) === 'Lãi suất' ? editForm.annual_interest_rate
                              : String(label) === 'Mã tài sản bảo đảm' ? editForm.collateral_id
                              : editForm.collateral_value
                          }
                          onChange={(e) => {
                            const v = e.target.value;
                            if (String(label) === 'Mục đích vay') setEditForm((p) => ({ ...p, loan_purpose: v }));
                            else if (String(label) === 'Khoản vay') setEditForm((p) => ({ ...p, requested_loan_amount: v.replace(/[^\d.]/g, '') }));
                            else if (String(label) === 'Thời hạn vay') setEditForm((p) => ({ ...p, requested_term_months: v.replace(/[^\d]/g, '') }));
                            else if (String(label) === 'Lãi suất') setEditForm((p) => ({ ...p, annual_interest_rate: v.replace(/[^\d.]/g, '') }));
                            else if (String(label) === 'Mã tài sản bảo đảm') setEditForm((p) => ({ ...p, collateral_id: v }));
                            else setEditForm((p) => ({ ...p, collateral_value: v.replace(/[^\d.]/g, '') }));
                          }}
                        />
                      )
                    ) : typeof value === 'string' || typeof value === 'number' ? (
                      toVietnameseValue(value, String(label))
                    ) : (
                      (value as any ?? '-')
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isVi ? 'Xóa hồ sơ khách hàng?' : 'Delete customer profile?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isVi
                ? 'Thao tác này sẽ xóa toàn bộ dữ liệu hồ sơ vay liên quan. Bạn có chắc chắn muốn tiếp tục?'
                : 'This action deletes the profile and related loan records. Are you sure you want to continue?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {isVi ? 'Hủy' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteCustomer();
              }}
              disabled={isDeleting}
            >
              {isDeleting ? (isVi ? 'Đang xóa...' : 'Deleting...') : (isVi ? 'Xóa hồ sơ' : 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isVi ? 'Lý do từ chối hồ sơ' : 'Rejection reason'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {isVi ? 'Vui lòng nhập lý do cụ thể trước khi từ chối hồ sơ.' : 'Please provide a specific reason before rejecting this dossier.'}
            </p>
            <Textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder={isVi ? 'Nhập lý do từ chối...' : 'Enter rejection reason...'}
              rows={4}
              disabled={isSaving}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)} disabled={isSaving}>
              {isVi ? 'Hủy' : 'Cancel'}
            </Button>
            <Button variant="destructive" onClick={() => void handleConfirmReject()} disabled={isSaving}>
              {isVi ? 'Xác nhận từ chối' : 'Confirm reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
