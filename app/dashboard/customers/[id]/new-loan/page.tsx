'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useI18n } from '@/components/i18n-provider';
import { browserApiFetchAuth } from '@/lib/api/browser';
import { type UserFacingLocale } from '@/lib/api/format-api-error';
import { notifyApiError, notifyError, notifySuccess } from '@/lib/notify';
import { sanitizeDashboardReturnTo } from '@/lib/dashboard-return-to';
import { formatVnd, parseVndDigitsToNumber } from '@/lib/money';
import {
  interestRateRangeByPurpose,
  minimumLoanAmountByType,
  normalizeLoanPurposePolicy,
} from '@/lib/loans/policy';
import { VndAmountInput } from '@/components/vnd-amount-input';

const LOAN_TYPE_OPTIONS = [
  { value: 'unsecured', labelVi: 'Tín chấp', labelEn: 'Unsecured' },
  { value: 'mortgage', labelVi: 'Thế chấp', labelEn: 'Mortgage' },
] as const;
const LOAN_PURPOSE_OPTIONS = [
  { value: 'installment', labelVi: 'Vay trả góp', labelEn: 'Installment loan' },
  { value: 'overdraft', labelVi: 'Vay thấu chi', labelEn: 'Overdraft' },
  { value: 'credit_card', labelVi: 'Thẻ tín dụng', labelEn: 'Credit card' },
] as const;

function RequiredMark() {
  return (
    <span className="text-destructive font-semibold" aria-hidden="true">
      *
    </span>
  );
}

export default function NewLoanApplicationPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const customerId = Number(params.id);
  const msgLocale: UserFacingLocale = locale === 'en' ? 'en' : 'vi';

  const backToCustomerHref = useMemo(() => {
    const p = new URLSearchParams();
    const appId = searchParams.get('application_id');
    if (appId?.trim() && /^\d+$/.test(appId.trim())) p.set('application_id', appId.trim());
    const safeReturn = sanitizeDashboardReturnTo(searchParams.get('returnTo'));
    if (safeReturn) p.set('returnTo', safeReturn);
    const q = p.toString();
    return q ? `/dashboard/customers/${customerId}?${q}` : `/dashboard/customers/${customerId}`;
  }, [customerId, searchParams]);

  const afterCreateCustomerHref = useMemo(() => {
    const p = new URLSearchParams();
    const safeReturn = sanitizeDashboardReturnTo(searchParams.get('returnTo'));
    if (safeReturn) p.set('returnTo', safeReturn);
    const q = p.toString();
    return q ? `/dashboard/customers/${customerId}?${q}` : `/dashboard/customers/${customerId}`;
  }, [customerId, searchParams]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    loan_purpose: '',
    loan_type: '',
    requested_loan_amount: '',
    requested_term_months: '',
    annual_interest_rate: '',
    collateral_id: '',
    collateral_value: '',
  });

  const minimumLoanAmount = minimumLoanAmountByType(form.loan_type);
  const normalizedLoanPurpose = normalizeLoanPurposePolicy(form.loan_purpose);
  const interestRateRange = interestRateRangeByPurpose(normalizedLoanPurpose);
  const collateralFieldsRequired = form.loan_type === 'mortgage';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const amt = parseVndDigitsToNumber(form.requested_loan_amount);
      const term = Number(form.requested_term_months);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error(t('customers.new_loan.err_invalid_amount'));
      if (minimumLoanAmount != null && amt < minimumLoanAmount) {
        const minLabel = formatVnd(minimumLoanAmount, locale === 'vi' ? 'vi' : 'en');
        const msg =
          locale === 'vi'
            ? `Khoản vay tối thiểu cho loại vay đã chọn là ${minLabel}.`
            : `Minimum loan amount for the selected loan type is ${minLabel}.`;
        throw new Error(msg);
      }
      if (!Number.isInteger(term) || term <= 0) throw new Error(t('customers.new_loan.err_invalid_term'));
      if (!normalizedLoanPurpose) throw new Error(t('customers.new_loan.err_purpose_required'));
      const annualRate = form.annual_interest_rate ? Number(form.annual_interest_rate) : NaN;
      if (!Number.isFinite(annualRate) || annualRate <= 0) throw new Error(t('customers.new.err.annual_interest_rate'));
      if (interestRateRange && (annualRate < interestRateRange.minAnnualRate || annualRate > interestRateRange.maxAnnualRate)) {
        const msg =
          locale === 'vi'
            ? `Lãi suất năm cho mục đích vay đã chọn phải trong khoảng ${interestRateRange.minAnnualRate}% - ${interestRateRange.maxAnnualRate}%.`
            : `Annual interest rate for selected loan purpose must be within ${interestRateRange.minAnnualRate}% - ${interestRateRange.maxAnnualRate}%.`;
        throw new Error(msg);
      }
      if (collateralFieldsRequired) {
        const cv = parseVndDigitsToNumber(form.collateral_value);
        if (!form.collateral_id.trim() || !Number.isFinite(cv) || cv <= 0) {
          notifyError(t('toast.new_loan_prereq_title'), { description: t('customers.new_loan.err_collateral') });
          return;
        }
      }
      await browserApiFetchAuth(`/customers/${customerId}/loan-applications`, {
        method: 'POST',
        body: {
          loan_purpose: normalizedLoanPurpose,
          loan_type: form.loan_type || undefined,
          requested_loan_amount: amt,
          requested_term_months: term,
          annual_interest_rate: annualRate,
          collateral_id: form.collateral_id.trim() || undefined,
          collateral_value: form.collateral_value ? parseVndDigitsToNumber(form.collateral_value) : undefined,
        },
      });
      notifySuccess(t('customers.new_loan.toast_ok'));
      router.push(afterCreateCustomerHref);
    } catch (err) {
      notifyApiError(err, msgLocale);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 lg:gap-8 p-4 sm:p-6 lg:p-8 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href={backToCustomerHref}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('common.back')}
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('customers.new_loan.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('customers.new_loan.desc')}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('customers.new_loan.title')}</CardTitle>
          <CardDescription>{t('customers.new_loan.desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1">
                {t('customers.field.loan_purpose')}
                <RequiredMark />
              </Label>
              <Select value={form.loan_purpose} onValueChange={(v) => setForm((p) => ({ ...p, loan_purpose: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder={locale === 'vi' ? 'Chọn mục đích vay' : 'Select loan purpose'} />
                </SelectTrigger>
                <SelectContent>
                  {LOAN_PURPOSE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {locale === 'vi' ? opt.labelVi : opt.labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('customers.field.loan_type')}</Label>
              <Select value={form.loan_type} onValueChange={(v) => setForm((p) => ({ ...p, loan_type: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder={t('customers.detail.loan_type_ph')} />
                </SelectTrigger>
                <SelectContent>
                  {LOAN_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {locale === 'vi' ? opt.labelVi : opt.labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="inline-flex items-center gap-1">
                  {t('customers.field.loan_amount_display')}
                  <RequiredMark />
                </Label>
                <VndAmountInput
                  className="w-full"
                  valueDigits={form.requested_loan_amount}
                  onDigitsChange={(digits) => setForm((p) => ({ ...p, requested_loan_amount: digits }))}
                  required
                />
                {minimumLoanAmount != null ? (
                  <p className="text-xs text-muted-foreground">
                    {locale === 'vi'
                      ? `Mức tối thiểu: ${formatVnd(minimumLoanAmount, 'vi')}`
                      : `Minimum: ${formatVnd(minimumLoanAmount, 'en')}`}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label className="inline-flex items-center gap-1">
                  {t('customers.field.loan_term_display')}
                  <RequiredMark />
                </Label>
                <Input
                  inputMode="numeric"
                  value={form.requested_term_months}
                  onChange={(e) => setForm((p) => ({ ...p, requested_term_months: e.target.value.replace(/\D/g, '') }))}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1">
                {t('customers.field.interest_rate_display')}
                <RequiredMark />
              </Label>
              <Input
                inputMode="decimal"
                value={form.annual_interest_rate}
                onChange={(e) => setForm((p) => ({ ...p, annual_interest_rate: e.target.value.replace(/[^\d.]/g, '') }))}
                required
              />
              {interestRateRange ? (
                <p className="text-xs text-muted-foreground">
                  {locale === 'vi'
                    ? `Khoảng lãi suất phù hợp: ${interestRateRange.minAnnualRate}% - ${interestRateRange.maxAnnualRate}%/năm`
                    : `Recommended annual rate: ${interestRateRange.minAnnualRate}% - ${interestRateRange.maxAnnualRate}%`}
                </p>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="inline-flex items-center gap-1">
                  {t('customers.field.collateral_id')}
                  {collateralFieldsRequired ? <RequiredMark /> : null}
                </Label>
                <Input value={form.collateral_id} onChange={(e) => setForm((p) => ({ ...p, collateral_id: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label className="inline-flex items-center gap-1">
                  {t('customers.field.collateral_value')}
                  {collateralFieldsRequired ? <RequiredMark /> : null}
                </Label>
                <VndAmountInput
                  className="w-full"
                  valueDigits={form.collateral_value}
                  onDigitsChange={(digits) => setForm((p) => ({ ...p, collateral_value: digits }))}
                />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('common.creating')}
                </>
              ) : (
                t('customers.new_loan.submit')
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
