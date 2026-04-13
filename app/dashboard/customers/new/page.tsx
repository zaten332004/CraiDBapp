'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowLeft } from 'lucide-react';
import { authJsonHeaders } from '@/lib/auth/token';
import { getUserRole } from '@/lib/auth/token';
import { useI18n } from '@/components/i18n-provider';
import { formatUserFacingFetchError, type UserFacingLocale } from '@/lib/api/format-api-error';
import { notifyError, notifySuccess } from '@/lib/notify';
import {
  isValidEmail,
  isValidVietnamNationalId,
  sanitizeVietnamNationalId,
} from '@/lib/validation/account';
import { parseVndDigitsToNumber } from '@/lib/money';
import { VndAmountInput } from '@/components/vnd-amount-input';

function getAgeFromDateOfBirth(dateOfBirth: string): number | null {
  const normalized = String(dateOfBirth || '').trim();
  if (!normalized) return null;
  const birth = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

function getAdultDateMax(): string {
  const now = new Date();
  const adult = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
  const year = adult.getFullYear();
  const month = String(adult.getMonth() + 1).padStart(2, '0');
  const day = String(adult.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function NewCustomerPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const role = getUserRole();
  const isViewer = role === 'viewer';
  const msgLocale: UserFacingLocale = locale === 'en' ? 'en' : 'vi';
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    external_customer_ref: '',
    email: '',
    phone_number: '',
    date_of_birth: '',
    gender: '',
    national_id: '',
    id_issue_date: '',
    id_issue_place: '',
    nationality: '',
    marital_status: '',
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
    notes: '',
  });

  const LOAN_TYPE_OPTIONS = [
    { value: 'secured', labelVi: 'Có tài sản bảo đảm', labelEn: 'Secured' },
    { value: 'unsecured', labelVi: 'Tín chấp', labelEn: 'Unsecured' },
    { value: 'mortgage', labelVi: 'Thế chấp', labelEn: 'Mortgage' },
    { value: 'business', labelVi: 'Kinh doanh', labelEn: 'Business' },
  ] as const;

  const normalizeLoanType = (value: string) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return '';
    if (['secured', 'unsecured', 'mortgage', 'business'].includes(normalized)) return normalized;
    if (normalized.includes('tài sản')) return 'secured';
    if (normalized.includes('tín chấp')) return 'unsecured';
    if (normalized.includes('thế chấp')) return 'mortgage';
    if (normalized.includes('kinh doanh')) return 'business';
    return normalized;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'phone_number') {
      setFormData((prev) => ({ ...prev, [name]: value.replace(/[^\d+]/g, '').slice(0, 15) }));
      return;
    }
    if (name === 'requested_term_months' || name === 'annual_interest_rate') {
      setFormData((prev) => ({ ...prev, [name]: value.replace(/[^\d.]/g, '') }));
      return;
    }
    if (name === 'national_id') {
      setFormData((prev) => ({ ...prev, [name]: sanitizeVietnamNationalId(value) }));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const checkDuplicateNationalId = async (nationalId: string) => {
    const response = await fetch(
      `/api/v1/customers?page=1&limit=50&search_name=${encodeURIComponent(nationalId)}`,
      {
        method: 'GET',
        headers: authJsonHeaders(),
      },
    );
    if (!response.ok) return false;
    const data = (await response.json()) as Record<string, unknown>;
    const candidates = Array.isArray(data.items)
      ? data.items
      : Array.isArray(data.customers)
        ? data.customers
        : Array.isArray(data.results)
          ? data.results
          : [];
    return candidates.some((item) => {
      if (!item || typeof item !== 'object') return false;
      const existing = sanitizeVietnamNationalId(String((item as Record<string, unknown>).national_id ?? ''));
      return existing === nationalId;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isViewer) {
        throw new Error(t('common.viewer_readonly'));
      }
      const trimmedFullName = formData.full_name.trim();
      const trimmedEmail = formData.email.trim();
      const normalizedLoanType = normalizeLoanType(formData.loan_type);
      const trimmedLoanPurpose = formData.loan_purpose.trim();
      const normalizedNationalId = sanitizeVietnamNationalId(formData.national_id);
      const monthlyIncome = parseVndDigitsToNumber(formData.monthly_income);
      const requestedLoanAmount = parseVndDigitsToNumber(formData.requested_loan_amount);
      const requestedTermMonths = Number(formData.requested_term_months);
      const age = getAgeFromDateOfBirth(formData.date_of_birth);

      if (!trimmedFullName) {
        throw new Error(t('customers.new.err.full_name'));
      }
      if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
        throw new Error(t('customers.new.err.email'));
      }
      if (!isValidVietnamNationalId(normalizedNationalId)) {
        throw new Error(t('customers.new.err.national_id'));
      }
      if (!formData.id_issue_date.trim()) {
        throw new Error(t('customers.new.err.id_issue_date'));
      }
      if (!formData.id_issue_place.trim()) {
        throw new Error(t('customers.new.err.id_issue_place'));
      }
      if (!formData.nationality.trim()) {
        throw new Error(t('customers.new.err.nationality'));
      }
      if (formData.date_of_birth.trim() && (age == null || age < 18)) {
        throw new Error(t('customers.new.err.age'));
      }
      if (!normalizedLoanType) {
        throw new Error(t('customers.new.err.loan_type'));
      }
      if (!trimmedLoanPurpose) {
        throw new Error(t('customers.new.err.loan_purpose'));
      }
      if (!Number.isFinite(monthlyIncome) || monthlyIncome <= 0) {
        throw new Error(t('customers.new.err.income'));
      }
      if (!Number.isFinite(requestedLoanAmount) || requestedLoanAmount <= 0) {
        throw new Error(t('customers.new.err.loan_amount'));
      }
      if (!Number.isInteger(requestedTermMonths) || requestedTermMonths <= 0) {
        throw new Error(t('customers.new.err.term'));
      }
      if (await checkDuplicateNationalId(normalizedNationalId)) {
        throw new Error(t('customers.new.err.duplicate_id'));
      }

      const response = await fetch('/api/v1/customers', {
        method: 'POST',
        headers: authJsonHeaders(),
        body: JSON.stringify({
          full_name: trimmedFullName,
          email: trimmedEmail,
          external_customer_ref: formData.external_customer_ref.trim() || undefined,
          phone_number: formData.phone_number || undefined,
          date_of_birth: formData.date_of_birth || undefined,
          gender: formData.gender || undefined,
          national_id: normalizedNationalId,
          id_issue_date: formData.id_issue_date.trim(),
          id_issue_place: formData.id_issue_place.trim(),
          nationality: formData.nationality.trim(),
          marital_status: formData.marital_status.trim() || undefined,
          occupation: formData.occupation.trim() || undefined,
          employment_status: formData.employment_status.trim() || undefined,
          monthly_income: monthlyIncome,
          permanent_address: formData.permanent_address.trim() || undefined,
          current_address: formData.current_address.trim() || undefined,
          loan_type: normalizedLoanType,
          product_type: normalizedLoanType,
          loan_purpose: trimmedLoanPurpose,
          requested_loan_amount: requestedLoanAmount,
          loan_amount: requestedLoanAmount,
          requested_term_months: requestedTermMonths,
          loan_term_months: requestedTermMonths,
          annual_interest_rate: formData.annual_interest_rate ? parseFloat(formData.annual_interest_rate) : undefined,
          interest_rate: formData.annual_interest_rate ? parseFloat(formData.annual_interest_rate) : undefined,
          application_status: 'pending',
          collateral_id: formData.collateral_id.trim() || undefined,
          collateral_value: formData.collateral_value ? parseVndDigitsToNumber(formData.collateral_value) : undefined,
          notes: formData.notes.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const bodyText = await response.text();
        throw new Error(formatUserFacingFetchError(response.status, bodyText, msgLocale));
      }

      notifySuccess(t('customers.new.create'), {
        details: [
          `${t('common.full_name')}: ${formData.full_name || '-'}`,
          `${t('common.email')}: ${formData.email || '-'}`,
          `${t('common.phone')}: ${formData.phone_number || '-'}`,
        ],
      });
      router.push('/dashboard/customers');
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.error');
      notifyError(t('toast.customer_create_failed'), {
        description: message,
        details: [
          `${t('common.full_name')}: ${formData.full_name || '-'}`,
          `${t('common.email')}: ${formData.email || '-'}`,
        ],
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/customers">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('common.back')}
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('customers.new.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('customers.new.desc')}
          </p>
        </div>
      </div>

      {isViewer && (
        <div className="rounded-lg border border-border/80 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {t('customers.new.viewer_notice_prefix')}{' '}
          <span className="font-medium text-foreground">{t('role.viewer')}</span>. {t('customers.new.viewer_notice_suffix')}
        </div>
      )}

      <div className="grid max-w-6xl grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('customers.new.card_title')}</CardTitle>
            <CardDescription>{t('customers.new.card_desc')}</CardDescription>
          </CardHeader>

          <CardContent>
            <form id="new-customer-form" onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name" required>
                    {t('common.full_name')}
                  </Label>
                  <Input
                    id="full_name"
                    name="full_name"
                    placeholder={t('common.full_name_ph')}
                    value={formData.full_name}
                    onChange={handleChange}
                    disabled={isLoading}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" required>
                    {t('common.email')}
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder={t('common.email_ph')}
                    value={formData.email}
                    onChange={handleChange}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="external_customer_ref">{t('customers.new.label.external_ref')}</Label>
                  <Input
                    id="external_customer_ref"
                    name="external_customer_ref"
                    placeholder={t('customers.new.ph.external_ref')}
                    value={formData.external_customer_ref}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone_number">{t('common.phone')}</Label>
                  <Input
                    id="phone_number"
                    name="phone_number"
                    placeholder={t('common.phone_ph')}
                    value={formData.phone_number}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date_of_birth">{t('customers.new.label.date_of_birth')}</Label>
                  <Input
                    id="date_of_birth"
                    name="date_of_birth"
                    type="date"
                    max={getAdultDateMax()}
                    value={formData.date_of_birth}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">{t('customers.new.label.gender')}</Label>
                  <Input
                    id="gender"
                    name="gender"
                    placeholder={t('customers.new.ph.gender')}
                    value={formData.gender}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="national_id" required>
                    {t('customers.new.label.national_id')}
                  </Label>
                  <Input
                    id="national_id"
                    name="national_id"
                    inputMode="numeric"
                    placeholder={t('customers.new.ph.national_id')}
                    value={formData.national_id}
                    onChange={handleChange}
                    disabled={isLoading}
                    className="placeholder:text-muted-foreground/55"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="id_issue_date" required>
                    {t('customers.new.label.id_issue_date')}
                  </Label>
                  <Input
                    id="id_issue_date"
                    name="id_issue_date"
                    type="date"
                    value={formData.id_issue_date}
                    onChange={handleChange}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="id_issue_place" required>
                    {t('customers.new.label.id_issue_place')}
                  </Label>
                  <Input
                    id="id_issue_place"
                    name="id_issue_place"
                    placeholder={t('customers.new.ph.id_issue_place')}
                    value={formData.id_issue_place}
                    onChange={handleChange}
                    disabled={isLoading}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nationality" required>
                    {t('customers.new.label.nationality')}
                  </Label>
                  <Input
                    id="nationality"
                    name="nationality"
                    placeholder={t('customers.new.ph.nationality')}
                    value={formData.nationality}
                    onChange={handleChange}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="marital_status">{t('customers.new.label.marital_status')}</Label>
                  <Input
                    id="marital_status"
                    name="marital_status"
                    placeholder={t('customers.new.ph.marital_status')}
                    value={formData.marital_status}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="occupation">{t('customers.new.label.occupation')}</Label>
                  <Input
                    id="occupation"
                    name="occupation"
                    placeholder={t('customers.new.ph.occupation')}
                    value={formData.occupation}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="employment_status">{t('customers.new.label.employment_status')}</Label>
                  <Input
                    id="employment_status"
                    name="employment_status"
                    placeholder={t('customers.new.ph.employment_status')}
                    value={formData.employment_status}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="monthly_income" required>
                    {t('customers.new.income')}
                  </Label>
                  <VndAmountInput
                    id="monthly_income"
                    name="monthly_income"
                    form="new-customer-form"
                    valueDigits={formData.monthly_income}
                    onDigitsChange={(digits) => setFormData((prev) => ({ ...prev, monthly_income: digits }))}
                    placeholderDigits="20000000"
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="permanent_address">{t('customers.new.label.permanent_address')}</Label>
                <Input
                  id="permanent_address"
                  name="permanent_address"
                  placeholder={t('customers.new.ph.permanent_address')}
                  value={formData.permanent_address}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="current_address">{t('customers.new.label.current_address')}</Label>
                <Input
                  id="current_address"
                  name="current_address"
                  placeholder={t('customers.new.ph.current_address')}
                  value={formData.current_address}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">{t('common.additional_notes')}</Label>
                <Textarea id="notes" name="notes" placeholder={t('common.additional_notes_ph')} value={formData.notes} onChange={handleChange} disabled={isLoading} rows={3} />
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('customers.new.loan_section_title')}</CardTitle>
            <CardDescription>{t('customers.new.loan_section_desc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="loan_type" required>
                  {t('customers.new.label.loan_type')}
                </Label>
                <Select
                  value={formData.loan_type}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, loan_type: value }))}
                  disabled={isLoading}
                >
                  <SelectTrigger id="loan_type" className="w-full">
                    <SelectValue placeholder={t('customers.new.loan_type_ph')} />
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
              <div className="space-y-2">
                <Label htmlFor="loan_purpose" required>
                  {t('customers.new.label.loan_purpose')}
                </Label>
                <Input
                  id="loan_purpose"
                  name="loan_purpose"
                  form="new-customer-form"
                  placeholder={t('customers.new.ph.loan_purpose')}
                  value={formData.loan_purpose}
                  onChange={handleChange}
                  disabled={isLoading}
                  className="placeholder:text-muted-foreground/55"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="requested_loan_amount" required>
                  {t('customers.new.label.requested_loan_amount')}
                </Label>
                <VndAmountInput
                  id="requested_loan_amount"
                  name="requested_loan_amount"
                  form="new-customer-form"
                  valueDigits={formData.requested_loan_amount}
                  onDigitsChange={(digits) => setFormData((prev) => ({ ...prev, requested_loan_amount: digits }))}
                  placeholderDigits="500000000"
                  disabled={isLoading}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="requested_term_months" required>
                  {t('customers.new.label.requested_term_months')}
                </Label>
                <Input
                  id="requested_term_months"
                  name="requested_term_months"
                  form="new-customer-form"
                  inputMode="numeric"
                  placeholder={t('customers.new.ph.term_example')}
                  value={formData.requested_term_months}
                  onChange={handleChange}
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="annual_interest_rate">{t('customers.new.label.annual_interest_rate')}</Label>
                <Input
                  id="annual_interest_rate"
                  name="annual_interest_rate"
                  form="new-customer-form"
                  inputMode="decimal"
                  placeholder={t('customers.new.ph.annual_rate_example')}
                  value={formData.annual_interest_rate}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="collateral_id">{t('customers.new.label.collateral_id')}</Label>
                <Input
                  id="collateral_id"
                  name="collateral_id"
                  form="new-customer-form"
                  placeholder={t('customers.new.ph.collateral_id')}
                  value={formData.collateral_id}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="collateral_value">{t('customers.new.label.collateral_value')}</Label>
              <VndAmountInput
                id="collateral_value"
                name="collateral_value"
                form="new-customer-form"
                valueDigits={formData.collateral_value}
                onDigitsChange={(digits) => setFormData((prev) => ({ ...prev, collateral_value: digits }))}
                placeholder={t('customers.new.ph.collateral_value')}
                disabled={isLoading}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Link href="/dashboard/customers" className="flex-1">
                <Button variant="outline" className="w-full" disabled={isLoading}>
                  {t('common.cancel')}
                </Button>
              </Link>
              <Button type="submit" form="new-customer-form" className="flex-1" disabled={isLoading || isViewer}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('common.creating')}
                  </>
                ) : (
                  t('customers.new.create')
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
