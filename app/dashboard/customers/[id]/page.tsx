'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { ArrowLeft, Edit, PlusCircle, Trash2 } from 'lucide-react';
import { useI18n } from '@/components/i18n-provider';
import { browserApiFetchAuth } from '@/lib/api/browser';
import { notifyApiError, notifyError, notifySuccess } from '@/lib/notify';
import { formatUserFacingApiError, type UserFacingLocale } from '@/lib/api/format-api-error';
import { formatDateTimeVietnam } from '@/lib/datetime';
import { formatVnd, parseVndDigitsToNumber, vndDigitsFromUnknown } from '@/lib/money';
import { VndAmountInput } from '@/components/vnd-amount-input';
import { getUserRole } from '@/lib/auth/token';
import { badgeTone } from '@/lib/dashboard-badge-tones';
import { sanitizeDashboardReturnTo } from '@/lib/dashboard-return-to';

export default function CustomerDetailPage() {
  const { locale, t } = useI18n();
  const isVi = locale === 'vi';
  const msgLocale: UserFacingLocale = locale === 'en' ? 'en' : 'vi';
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const customerId = Number(params.id);
  const applicationIdFromUrl = searchParams.get('application_id');
  const applicationIdQuery =
    applicationIdFromUrl && /^\d+$/.test(applicationIdFromUrl.trim()) ? Number(applicationIdFromUrl.trim()) : undefined;
  const returnToParam = searchParams.get('returnTo');
  const backHref = useMemo(() => {
    return sanitizeDashboardReturnTo(returnToParam) ?? '/dashboard/customers';
  }, [returnToParam]);

  const buildCustomerUrl = useMemo(() => {
    return (applicationId: string | number) => {
      const p = new URLSearchParams();
      p.set('application_id', String(applicationId));
      const safeReturn = sanitizeDashboardReturnTo(returnToParam);
      if (safeReturn) p.set('returnTo', safeReturn);
      return `/dashboard/customers/${customerId}?${p.toString()}`;
    };
  }, [customerId, returnToParam]);

  const newLoanHref = useMemo(() => {
    const p = new URLSearchParams();
    if (applicationIdQuery != null) p.set('application_id', String(applicationIdQuery));
    const safeReturn = sanitizeDashboardReturnTo(returnToParam);
    if (safeReturn) p.set('returnTo', safeReturn);
    const q = p.toString();
    return q ? `/dashboard/customers/${customerId}/new-loan?${q}` : `/dashboard/customers/${customerId}/new-loan`;
  }, [customerId, applicationIdQuery, returnToParam]);
  const role = getUserRole();
  const canManageProfile = role !== 'viewer';
  /** Duyệt / từ chối hồ sơ: manager & admin; analyst chỉ sửa & xóa. */
  const canReviewCustomer = canManageProfile && role !== 'analyst';
  const [customer, setCustomer] = useState<any | null>(null);
  const [loanApplications, setLoanApplications] = useState<any[]>([]);
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
        const qs = applicationIdQuery != null ? `?application_id=${applicationIdQuery}` : '';
        const customerData = await browserApiFetchAuth<any>(`/customers/${customerId}${qs}`, { method: 'GET' });
        if (cancelled) return;
        setCustomer(customerData);
        setEditForm({
          phone_number: String(customerData.phone_number ?? customerData.phone ?? ''),
          email: String(customerData.email ?? ''),
          occupation: String(customerData.occupation ?? ''),
          employment_status: String(customerData.employment_status ?? '').trim(),
          monthly_income: vndDigitsFromUnknown(customerData.monthly_income),
          permanent_address: String(customerData.permanent_address ?? ''),
          current_address: String(customerData.current_address ?? ''),
          loan_type: normalizeLoanType(customerData.loan_type ?? customerData.product_type),
          loan_purpose: String(customerData.loan_purpose ?? ''),
          requested_loan_amount: vndDigitsFromUnknown(
            customerData.requested_loan_amount ?? customerData.loan_amount,
          ),
          requested_term_months: customerData.requested_term_months != null ? String(customerData.requested_term_months) : customerData.loan_term_months != null ? String(customerData.loan_term_months) : '',
          annual_interest_rate: customerData.annual_interest_rate != null ? String(customerData.annual_interest_rate) : customerData.interest_rate != null ? String(customerData.interest_rate) : '',
          collateral_id: String(customerData.collateral_id ?? ''),
          collateral_value: vndDigitsFromUnknown(customerData.collateral_value ?? customerData.collateral_amount),
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
  }, [customerId, applicationIdQuery, msgLocale, t]);

  useEffect(() => {
    let cancelled = false;
    const loadApps = async () => {
      if (!Number.isFinite(customerId) || customerId <= 0) return;
      try {
        const apps = await browserApiFetchAuth<any[]>(`/customers/${customerId}/loan-applications`, { method: 'GET' });
        if (!cancelled) setLoanApplications(Array.isArray(apps) ? apps : []);
      } catch {
        if (!cancelled) setLoanApplications([]);
      }
    };
    void loadApps();
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const riskBadgeClass = useMemo(() => {
    const level = String(customer?.risk_level || '').toLowerCase();
    if (level === 'high') return badgeTone.rose;
    if (level === 'medium') return badgeTone.blue;
    if (level === 'low') return badgeTone.emerald;
    return badgeTone.slate;
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
    if (status === 'disbursed') return badgeTone.sky;
    if (status === 'approved') return badgeTone.emerald;
    if (status === 'rejected') return badgeTone.rose;
    if (status === 'pending') return badgeTone.slate;
    return badgeTone.slate;
  }, [customer?.application_status]);

  const statusBadgeLabel = useMemo(() => {
    const status = String(customer?.application_status || '').toLowerCase();
    if (status === 'disbursed') return t('status.disbursed');
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

  const toVietnameseValue = (value: unknown, fieldId?: string) => {
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
      contract: 'Hợp đồng / bán thời gian',
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

    if (fieldId === 'gender') {
      if (normalized.startsWith('m')) return 'Nam';
      if (normalized.startsWith('f')) return 'Nữ';
    }

    if (fieldId === 'phone') return formatPhoneViDisplay(raw);
    if (/[0-9@._-]/.test(raw)) return raw;
    return raw;
  };

  const handleUpdateProfile = async () => {
    if (!customer) return;
    setIsSaving(true);
    try {
      const payload: Record<string, any> = {
        application_id: customer.application_id ?? undefined,
        phone_number: sanitizePhoneInput(editForm.phone_number || ''),
        email: editForm.email || null,
        occupation: editForm.occupation || null,
        employment_status: normalizeEmploymentStatus(editForm.employment_status) || null,
        monthly_income: editForm.monthly_income ? parseVndDigitsToNumber(editForm.monthly_income) : null,
        permanent_address: editForm.permanent_address || null,
        current_address: editForm.current_address || null,
        loan_type: normalizeLoanType(editForm.loan_type) || null,
        product_type: normalizeLoanType(editForm.loan_type) || null,
        loan_purpose: editForm.loan_purpose || null,
        requested_loan_amount: editForm.requested_loan_amount ? parseVndDigitsToNumber(editForm.requested_loan_amount) : null,
        loan_amount: editForm.requested_loan_amount ? parseVndDigitsToNumber(editForm.requested_loan_amount) : null,
        requested_term_months: editForm.requested_term_months ? Number(editForm.requested_term_months) : null,
        loan_term_months: editForm.requested_term_months ? Number(editForm.requested_term_months) : null,
        annual_interest_rate: editForm.annual_interest_rate ? Number(editForm.annual_interest_rate) : null,
        interest_rate: editForm.annual_interest_rate ? Number(editForm.annual_interest_rate) : null,
        collateral_id: editForm.collateral_id || null,
        collateral_value: editForm.collateral_value ? parseVndDigitsToNumber(editForm.collateral_value) : null,
        collateral_amount: editForm.collateral_value ? parseVndDigitsToNumber(editForm.collateral_value) : null,
      };
      const updated = await browserApiFetchAuth<any>(`/customers/${customerId}`, {
        method: 'PUT',
        body: payload,
      });
      setCustomer(updated);
      setIsEditing(false);
      notifySuccess(t('customers.detail.toast_updated'));
    } catch (err) {
      notifyApiError(err, msgLocale);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReview = async (nextStatus: 'approved' | 'rejected', reason?: string) => {
    if (!customer || !canReviewCustomer) return;
    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        application_status: nextStatus,
        application_id: customer.application_id ?? undefined,
      };
      if (nextStatus === 'rejected') payload.rejection_reason = String(reason || '').trim();
      const updated = await browserApiFetchAuth<any>(`/customers/${customerId}/status`, {
        method: 'PATCH',
        body: payload,
      });
      setCustomer(updated);
      setIsEditing(false);
      notifySuccess(
        nextStatus === 'approved' ? t('customers.detail.toast_approved') : t('customers.detail.toast_rejected'),
      );
    } catch (err) {
      notifyApiError(err, msgLocale);
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
      notifyError(t('customers.detail.toast_reject_reason_required'));
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
      notifySuccess(response?.message || t('customers.detail.toast_deleted'));
      setConfirmDeleteOpen(false);
      router.push('/dashboard/customers');
    } catch (err) {
      notifyApiError(err, msgLocale);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!customer) {
    return <div className="p-8 text-sm text-muted-foreground">{t('customers.detail.loading')}</div>;
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
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={newLoanHref}>
              <PlusCircle className="mr-2 h-4 w-4" />
              {t('customers.detail.new_application')}
            </Link>
          </Button>
          {isPending && canReviewCustomer ? (
            <>
              <Button variant="outline" onClick={handleOpenRejectDialog} disabled={isSaving}>
                {t('customers.detail.reject')}
              </Button>
              <Button onClick={() => void handleReview('approved')} disabled={isSaving}>
                {t('customers.detail.approve')}
              </Button>
            </>
          ) : null}
          <Button variant="secondary" onClick={() => setIsEditing((prev) => !prev)} disabled={!isPending || isSaving || !canManageProfile}>
            <Edit className="mr-2 h-4 w-4" />
            {isEditing ? t('customers.detail.cancel_edit') : t('customers.detail.edit')}
          </Button>
          {isEditing && isPending && canManageProfile ? (
            <Button onClick={() => void handleUpdateProfile()} disabled={isSaving || isDeleting}>
              {t('customers.detail.update_profile')}
            </Button>
          ) : null}
          <Button
            variant="destructive"
            onClick={() => setConfirmDeleteOpen(true)}
            disabled={!canManageProfile || isSaving || isDeleting}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t('customers.detail.delete_profile')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('customers.detail.info_title')}</CardTitle>
            <CardDescription>{t('customers.detail.identity_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(
                [
                  ['full_name', 'customers.field.full_name', customer.full_name],
                  ['external_ref', 'customers.field.external_ref', customer.external_customer_ref],
                  ['date_of_birth', 'customers.field.date_of_birth', customer.date_of_birth],
                  ['age', 'customers.field.age', customer.age],
                  ['gender', 'customers.field.gender', customer.gender],
                  ['nationality', 'customers.field.nationality', customer.nationality],
                  ['national_id', 'customers.field.national_id', customer.national_id],
                  ['id_issue_date', 'customers.field.id_issue_date', customer.id_issue_date],
                  ['id_issue_place', 'customers.field.id_issue_place', customer.id_issue_place],
                  ['marital_status', 'customers.field.marital_status', customer.marital_status],
                  ['phone', 'customers.field.phone', customer.phone_number || customer.phone],
                  ['email', 'customers.field.email', customer.email],
                  ['occupation', 'customers.field.occupation', customer.occupation],
                  ['employment_status', 'customers.field.employment_status', customer.employment_status],
                  ['monthly_income', 'customers.field.monthly_income', customer.monthly_income],
                  ['credit_score', 'customers.field.credit_score_internal', customer.credit_score],
                  ['permanent_address', 'customers.field.permanent_address', customer.permanent_address],
                  ['current_address', 'customers.field.current_address', customer.current_address],
                ] as const
              ).map(([fieldId, labelKey, rawValue]) => {
                const label = t(labelKey);
                const editableRow =
                  isEditing &&
                  isPending &&
                  canManageProfile &&
                  ['phone', 'email', 'occupation', 'employment_status', 'monthly_income', 'permanent_address', 'current_address'].includes(
                    fieldId,
                  );
                const readDisplay =
                  fieldId === 'monthly_income'
                    ? customer.monthly_income != null
                      ? formatVnd(Number(customer.monthly_income), locale === 'vi' ? 'vi' : 'en')
                      : '-'
                    : String(toVietnameseValue(rawValue, fieldId));
                return (
                  <div key={fieldId} className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    {editableRow ? (
                      fieldId === 'monthly_income' ? (
                        <VndAmountInput
                          className="mt-1 h-9"
                          valueDigits={editForm.monthly_income}
                          onDigitsChange={(digits) => setEditForm((p) => ({ ...p, monthly_income: digits }))}
                        />
                      ) : (
                        <Input
                          className="mt-1 h-9"
                          placeholder={fieldId === 'employment_status' ? t('customers.detail.employment_ph') : undefined}
                          value={
                            fieldId === 'phone'
                              ? editForm.phone_number
                              : fieldId === 'email'
                                ? editForm.email
                                : fieldId === 'occupation'
                                  ? editForm.occupation
                                  : fieldId === 'employment_status'
                                    ? editForm.employment_status
                                    : fieldId === 'permanent_address'
                                      ? editForm.permanent_address
                                      : editForm.current_address
                          }
                          onChange={(e) => {
                            const v = e.target.value;
                            if (fieldId === 'phone') setEditForm((p) => ({ ...p, phone_number: sanitizePhoneInput(v) }));
                            else if (fieldId === 'email') setEditForm((p) => ({ ...p, email: v }));
                            else if (fieldId === 'occupation') setEditForm((p) => ({ ...p, occupation: v }));
                            else if (fieldId === 'employment_status') setEditForm((p) => ({ ...p, employment_status: v }));
                            else if (fieldId === 'permanent_address') setEditForm((p) => ({ ...p, permanent_address: v }));
                            else setEditForm((p) => ({ ...p, current_address: v }));
                          }}
                        />
                      )
                    ) : (
                      <p className="mt-1 text-sm font-medium break-words">{readDisplay}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('customers.detail.loan_section_title')}</CardTitle>
            <CardDescription>{t('customers.detail.loan_section_desc')}</CardDescription>
            {loanApplications.length > 1 ? (
              <div className="mt-4 space-y-2">
                <Label className="text-xs text-muted-foreground">{t('customers.detail.select_application')}</Label>
                <Select
                  value={String(customer.application_id ?? '')}
                  onValueChange={(v) => router.replace(buildCustomerUrl(v))}
                >
                  <SelectTrigger className="max-w-md">
                    <SelectValue placeholder={t('customers.detail.select_application')} />
                  </SelectTrigger>
                  <SelectContent>
                    {loanApplications.map((a) => (
                      <SelectItem key={String(a.application_id)} value={String(a.application_id)}>
                        {(a.application_ref_no as string) || `#${a.application_id}`} — {String(a.loan_status || '')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(
                [
                  ['application_ref', 'customers.field.application_ref', customer.application_ref_no],
                  ['application_date', 'customers.field.application_date', customer.application_date],
                  ['created_by', 'customers.field.created_by', customer.created_by || '-'],
                  [
                    'approved_by',
                    'customers.field.approved_by',
                    customer.approved_by
                      ? `${customer.approved_by}${customer.approved_at ? ` (${formatDateTimeVietnam(customer.approved_at, locale)})` : ''}`
                      : '-',
                  ],
                  [
                    'loan_type',
                    'customers.field.loan_type',
                    customer.loan_type ?? customer.product_type ?? customer.loanType ?? customer.productType,
                  ],
                  ['loan_purpose', 'customers.field.loan_purpose', customer.loan_purpose],
                  [
                    'loan_amount',
                    'customers.field.loan_amount_display',
                    (customer.requested_loan_amount ?? customer.loan_amount) != null
                      ? formatVnd(Number(customer.requested_loan_amount ?? customer.loan_amount), locale === 'vi' ? 'vi' : 'en')
                      : '-',
                  ],
                  [
                    'loan_term',
                    'customers.field.loan_term_display',
                    (customer.requested_term_months ?? customer.loan_term_months) != null
                      ? `${customer.requested_term_months ?? customer.loan_term_months} ${t('common.months')}`
                      : '-',
                  ],
                  [
                    'interest_rate',
                    'customers.field.interest_rate_display',
                    (customer.annual_interest_rate ?? customer.interest_rate) != null
                      ? `${customer.annual_interest_rate ?? customer.interest_rate}${t('customers.detail.apr_suffix')}`
                      : '-',
                  ],
                  ['risk_score', 'customers.field.risk_score_raw', customer.risk_score != null ? Number(customer.risk_score).toFixed(4) : '-'],
                  ['risk_level', 'customers.detail.risk_level', '__risk_badge__'],
                  ['application_status', 'customers.field.application_status', '__status_badge__'],
                  ['collateral_id', 'customers.field.collateral_id', customer.collateral_id],
                  [
                    'collateral_value',
                    'customers.field.collateral_value',
                    (customer.collateral_value ?? customer.collateral_amount) != null
                      ? formatVnd(Number(customer.collateral_value ?? customer.collateral_amount), locale === 'vi' ? 'vi' : 'en')
                      : '-',
                  ],
                ] as const
              ).map(([fieldId, labelKey, value]) => {
                const label = t(labelKey);
                const editableLoan =
                  isEditing &&
                  isPending &&
                  canManageProfile &&
                  ['loan_type', 'loan_purpose', 'loan_amount', 'loan_term', 'interest_rate', 'collateral_id', 'collateral_value'].includes(
                    fieldId,
                  );
                return (
                  <div key={fieldId} className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <div className="mt-1 text-sm font-medium break-words">
                      {editableLoan ? (
                        fieldId === 'loan_type' ? (
                          <Select value={editForm.loan_type || ''} onValueChange={(v) => setEditForm((p) => ({ ...p, loan_type: v }))}>
                            <SelectTrigger className="h-9 w-full">
                              <SelectValue placeholder={t('customers.detail.loan_type_ph')} />
                            </SelectTrigger>
                            <SelectContent>
                              {LOAN_TYPE_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {isVi ? opt.labelVi : opt.labelEn}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : fieldId === 'loan_amount' ? (
                          <VndAmountInput
                            className="h-9"
                            valueDigits={editForm.requested_loan_amount}
                            onDigitsChange={(d) => setEditForm((p) => ({ ...p, requested_loan_amount: d }))}
                          />
                        ) : fieldId === 'collateral_value' ? (
                          <VndAmountInput
                            className="h-9"
                            valueDigits={editForm.collateral_value}
                            onDigitsChange={(d) => setEditForm((p) => ({ ...p, collateral_value: d }))}
                          />
                        ) : (
                          <Input
                            className="h-9"
                            value={
                              fieldId === 'loan_purpose'
                                ? editForm.loan_purpose
                                : fieldId === 'loan_term'
                                  ? editForm.requested_term_months
                                  : fieldId === 'interest_rate'
                                    ? editForm.annual_interest_rate
                                    : editForm.collateral_id
                            }
                            onChange={(e) => {
                              const v = e.target.value;
                              if (fieldId === 'loan_purpose') setEditForm((p) => ({ ...p, loan_purpose: v }));
                              else if (fieldId === 'loan_term') setEditForm((p) => ({ ...p, requested_term_months: v.replace(/[^\d]/g, '') }));
                              else if (fieldId === 'interest_rate') setEditForm((p) => ({ ...p, annual_interest_rate: v.replace(/[^\d.]/g, '') }));
                              else setEditForm((p) => ({ ...p, collateral_id: v }));
                            }}
                          />
                        )
                      ) : fieldId === 'risk_level' ? (
                        <Badge variant="outline" className={riskBadgeClass}>
                          {riskBadgeLabel}
                        </Badge>
                      ) : fieldId === 'application_status' ? (
                        <Badge variant="outline" className={statusBadgeClass}>
                          {statusBadgeLabel}
                        </Badge>
                      ) : typeof value === 'string' || typeof value === 'number' ? (
                        toVietnameseValue(value, fieldId)
                      ) : (
                        String(value ?? '-')
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('customers.detail.delete_title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('customers.detail.delete_desc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteCustomer();
              }}
              disabled={isDeleting}
            >
              {isDeleting ? t('customers.detail.deleting') : t('customers.detail.delete_confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('customers.detail.reject_title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t('customers.detail.reject_hint')}</p>
            <Textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder={t('customers.detail.reject_ph')}
              rows={4}
              disabled={isSaving}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)} disabled={isSaving}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={() => void handleConfirmReject()} disabled={isSaving}>
              {t('customers.detail.confirm_reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
