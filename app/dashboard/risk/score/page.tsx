'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, TrendingUp } from 'lucide-react';
import { authJsonHeaders } from '@/lib/auth/token';
import { useI18n } from '@/components/i18n-provider';
import { formatUserFacingApiError, formatUserFacingFetchError, type UserFacingLocale } from '@/lib/api/format-api-error';
import { notifyApiError, notifyError } from '@/lib/notify';
import { browserApiFetchAuth } from '@/lib/api/browser';
import { parseVndDigitsToNumber } from '@/lib/money';
import { VndAmountInput } from '@/components/vnd-amount-input';
import { cn } from '@/lib/utils';
import {
  RiskScoreExplanationPanel,
  parseExplanationDetail,
  riskBadgeOutlineClass,
  riskExplanationFrameClass,
} from '@/components/risk-score-explanation';

/** Ô chỉ đọc sau khi load khách: gỡ opacity mờ của `disabled`, chữ rõ và đậm hơn một chút. */
const RISK_SCORE_LOADED_FIELD_CLASS =
  'disabled:cursor-not-allowed disabled:opacity-100 disabled:text-foreground font-medium disabled:bg-muted/45';

type ScoreForm = {
  customerLookup: string;
  name: string;
  incomeDigits: string;
  loanDigits: string;
  creditHistory: string;
  age: string;
  creditScore: string;
  loanType: string;
  interestRate: string;
  loanTermMonths: string;
  collateralDigits: string;
  employmentStatus: string;
  /** Hiển thị theo hồ sơ (read-only), không chỉnh tay */
  employmentDisplay: string;
  notes: string;
};

const initialForm: ScoreForm = {
  customerLookup: '',
  name: '',
  incomeDigits: '',
  loanDigits: '',
  creditHistory: '',
  age: '',
  creditScore: '',
  loanType: '',
  interestRate: '',
  loanTermMonths: '',
  collateralDigits: '',
  employmentStatus: '',
  employmentDisplay: '',
  notes: '',
};

function deriveAgeFromCustomer(c: Record<string, unknown>): number {
  const a = c.age;
  if (a != null && Number.isFinite(Number(a))) {
    return Math.max(18, Math.min(120, Math.round(Number(a))));
  }
  const dob = c.date_of_birth;
  if (dob) {
    const born = new Date(String(dob));
    if (!Number.isNaN(born.getTime())) {
      const t = new Date();
      let y = t.getFullYear() - born.getFullYear();
      const m = t.getMonth() - born.getMonth();
      if (m < 0 || (m === 0 && t.getDate() < born.getDate())) y -= 1;
      return Math.max(18, Math.min(120, y));
    }
  }
  return 30;
}

function normalizeEmployment(raw: unknown): string {
  const s = String(raw || '')
    .trim()
    .toLowerCase();
  if (!s) return '';
  if (/(employed|permanent|full_time|đang làm)/i.test(s)) return 'employed';
  if (/(self|tự kinh|freelance)/i.test(s)) return 'self_employed';
  if (/(unemploy|thất nghiệp)/i.test(s)) return 'unemployed';
  if (/(contract|part_time|hợp đồng|bán thời)/i.test(s)) return 'contract';
  return '';
}

function normalizeLoanType(raw: unknown): string {
  const s = String(raw || '')
    .trim()
    .toLowerCase();
  if (!s) return '';
  if (['secured', 'unsecured', 'mortgage', 'business'].includes(s)) return s;
  return s;
}

function customerToForm(c: Record<string, unknown>): ScoreForm {
  const monthly = Math.round(Number(c.monthly_income ?? 0));
  const loan = Math.round(Number(c.requested_loan_amount ?? 0));
  const coll = c.collateral_value != null ? Math.round(Number(c.collateral_value)) : 0;
  return {
    customerLookup: String(c.external_customer_ref || c.customer_id || ''),
    name: String(c.full_name || ''),
    incomeDigits: monthly > 0 ? String(monthly) : '',
    loanDigits: loan > 0 ? String(loan) : '',
    creditHistory: '60',
    age: String(deriveAgeFromCustomer(c)),
    creditScore: c.credit_score != null ? String(c.credit_score) : '',
    loanType: normalizeLoanType(c.loan_type),
    interestRate: c.annual_interest_rate != null ? String(c.annual_interest_rate) : '',
    loanTermMonths: c.requested_term_months != null ? String(c.requested_term_months) : '',
    collateralDigits: coll > 0 ? String(coll) : '',
    employmentStatus: normalizeEmployment(c.employment_status),
    employmentDisplay: String(c.employment_status ?? '').trim(),
    notes: String(c.notes || ''),
  };
}

function VndDigitField(props: {
  id: string;
  label: string;
  hint?: string;
  valueDigits: string;
  onDigitsChange: (digits: string) => void;
  disabled?: boolean;
  placeholderDigits?: string;
}) {
  const { id, label, hint, valueDigits, onDigitsChange, disabled, placeholderDigits } = props;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <VndAmountInput
        id={id}
        valueDigits={valueDigits}
        onDigitsChange={onDigitsChange}
        disabled={disabled}
        placeholderDigits={placeholderDigits}
        className={disabled ? RISK_SCORE_LOADED_FIELD_CLASS : undefined}
      />
    </div>
  );
}

export default function RiskScorePage() {
  const { t, locale } = useI18n();
  const msgLocale: UserFacingLocale = locale === 'en' ? 'en' : 'vi';
  const apiErr = (err: unknown) => formatUserFacingApiError(err, msgLocale);
  const [formData, setFormData] = useState<ScoreForm>(initialForm);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isSyncingCustomer, setIsSyncingCustomer] = useState(false);
  const [loadedCustomerId, setLoadedCustomerId] = useState<number | null>(null);
  const [isExplanationOpen, setIsExplanationOpen] = useState(false);
  const lastFetchedLookupRef = useRef<string>('');
  /** Khách đã có điểm nội bộ trên DB khi load hồ sơ — không ghi đè bằng kết quả CIC lần sau. */
  const hadCreditScoreWhenLoadedRef = useRef(false);
  /** Đã lưu điểm từ CIC ít nhất một lần sau khi load hồ sơ (cùng phiên / cùng lần load). */
  const cicCreditPersistedThisLoadRef = useRef(false);

  const applyCustomer = useCallback((c: Record<string, unknown>) => {
    const cs = c.credit_score;
    hadCreditScoreWhenLoadedRef.current =
      cs != null && String(cs).trim() !== '' && Number.isFinite(Number(cs));
    cicCreditPersistedThisLoadRef.current = false;
    setFormData(customerToForm(c));
    const resolvedCustomerId = Number(c.customer_id);
    setLoadedCustomerId(Number.isFinite(resolvedCustomerId) && resolvedCustomerId > 0 ? resolvedCustomerId : null);
  }, []);

  const loadCustomerByLookup = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (!q) return;
      if (lastFetchedLookupRef.current === q) return;
      setProfileLoading(true);
      try {
        let customer: Record<string, unknown>;
        if (/^\d+$/.test(q)) {
          customer = (await browserApiFetchAuth(`/customers/${parseInt(q, 10)}`, {
            method: 'GET',
          })) as Record<string, unknown>;
        } else {
          const search = await browserApiFetchAuth<{ items: Record<string, unknown>[] }>(
            `/customers?page=1&limit=20&search_name=${encodeURIComponent(q)}`,
            { method: 'GET' },
          );
          const items = search.items || [];
          const qLower = q.toLowerCase();
          const exactRef = items.find((c) => String(c.external_customer_ref || '').toLowerCase() === qLower);
          const exactEmail = items.find((c) => String(c.email || '').toLowerCase() === qLower);
          const picked = exactRef || exactEmail || (items.length === 1 ? items[0] : null);
          if (!picked) {
            if (items.length > 1) {
              throw new Error(t('risk.score.profile_ambiguous'));
            }
            throw new Error(t('risk.score.profile_not_found'));
          }
          customer = (await browserApiFetchAuth(`/customers/${Number(picked.customer_id)}`, {
            method: 'GET',
          })) as Record<string, unknown>;
        }
        applyCustomer(customer);
        const cid = Number((customer as Record<string, unknown>).customer_id);
        setLoadedCustomerId(Number.isFinite(cid) ? cid : null);
        lastFetchedLookupRef.current = q;
      } catch (e) {
        lastFetchedLookupRef.current = '';
        setLoadedCustomerId(null);
        notifyError(t('toast.load_failed'), { description: apiErr(e) });
      } finally {
        setProfileLoading(false);
      }
    },
    [applyCustomer, t, msgLocale],
  );

  useEffect(() => {
    const q = formData.customerLookup.trim();
    if (q.length < 2 && !/^\d+$/.test(q)) return undefined;
    const h = setTimeout(() => {
      void loadCustomerByLookup(q);
    }, 700);
    return () => clearTimeout(h);
  }, [formData.customerLookup, loadCustomerByLookup]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'customerLookup') {
      lastFetchedLookupRef.current = '';
      setLoadedCustomerId(null);
      setFormData((prev) => ({
        ...prev,
        customerLookup: value,
        employmentDisplay: '',
        employmentStatus: '',
      }));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const syncCustomerAfterScoring = useCallback(
    async (riskLabel: unknown, riskScore: unknown, cicScore: unknown) => {
      if (!loadedCustomerId) return;
      setIsSyncingCustomer(true);
      try {
        const normalizedRiskLabel = String(riskLabel || '').trim().toLowerCase();
        const scoreValue = Number(riskScore);
        const cicScoreValue = Number(cicScore);
        const shouldPersistCreditScore =
          !hadCreditScoreWhenLoadedRef.current && !cicCreditPersistedThisLoadRef.current;
        const nextCreditScore = Number.isFinite(cicScoreValue)
          ? Math.round(cicScoreValue)
          : formData.creditScore
            ? Number(formData.creditScore)
            : undefined;
        const body: Record<string, unknown> = {
          full_name: formData.name.trim() || undefined,
          monthly_income: parseVndDigitsToNumber(formData.incomeDigits),
          requested_loan_amount: parseVndDigitsToNumber(formData.loanDigits),
          age: Number(formData.age),
          loan_type: formData.loanType.trim() || undefined,
          requested_term_months: formData.loanTermMonths ? Number(formData.loanTermMonths) : undefined,
          annual_interest_rate: formData.interestRate ? Number(formData.interestRate.replace(',', '.')) : undefined,
          collateral_value: formData.collateralDigits ? parseVndDigitsToNumber(formData.collateralDigits) : undefined,
          employment_status: formData.employmentStatus.trim() || formData.employmentDisplay.trim() || undefined,
          notes: formData.notes.trim() || undefined,
          risk_level: ['low', 'medium', 'high'].includes(normalizedRiskLabel) ? normalizedRiskLabel : undefined,
          risk_score: Number.isFinite(scoreValue) ? scoreValue : undefined,
        };
        if (
          shouldPersistCreditScore &&
          nextCreditScore !== undefined &&
          Number.isFinite(nextCreditScore)
        ) {
          body.credit_score = nextCreditScore;
        }
        await browserApiFetchAuth(`/customers/${loadedCustomerId}`, {
          method: 'PUT',
          body,
        });
        if ('credit_score' in body && Number.isFinite(Number(body.credit_score))) {
          cicCreditPersistedThisLoadRef.current = true;
        }
      } catch (err) {
        notifyApiError(err, msgLocale);
      } finally {
        setIsSyncingCustomer(false);
      }
    },
    [formData, loadedCustomerId, t, msgLocale],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!loadedCustomerId) {
      const msg = locale === 'vi'
        ? 'Vui lòng nhập mã khách hàng hợp lệ để tải hồ sơ trước khi chấm điểm.'
        : 'Please enter a valid customer code to load profile data before scoring.';
      setIsLoading(false);
      notifyError(t('toast.risk_score_failed'), { description: msg });
      return;
    }

    const income = parseVndDigitsToNumber(formData.incomeDigits);
    const debt = parseVndDigitsToNumber(formData.loanDigits);
    const age = parseInt(formData.age, 10);
    const creditHistory = parseInt(formData.creditHistory, 10) || 60;

    if (!Number.isFinite(income) || income <= 0) {
      setIsLoading(false);
      notifyError(t('toast.risk_score_failed'), { description: t('risk.score.validation_income') });
      return;
    }
    if (!Number.isFinite(debt) || debt < 0) {
      setIsLoading(false);
      notifyError(t('toast.risk_score_failed'), { description: t('risk.score.validation_loan') });
      return;
    }
    if (!Number.isFinite(age) || age < 18 || age > 120) {
      setIsLoading(false);
      notifyError(t('toast.risk_score_failed'), { description: t('risk.score.validation_age') });
      return;
    }

    const body: Record<string, unknown> = {
      income,
      debt,
      age,
      credit_history_months: Math.max(0, creditHistory),
    };

    const csRaw = formData.creditScore.trim();
    if (csRaw) {
      const cs = parseInt(csRaw, 10);
      if (Number.isFinite(cs) && cs >= 0 && cs <= 1000) body.credit_score = cs;
    }
    if (formData.loanType.trim()) body.loan_type = formData.loanType.trim();
    const irRaw = formData.interestRate.replace(',', '.').trim();
    if (irRaw) {
      const ir = parseFloat(irRaw);
      if (Number.isFinite(ir) && ir >= 0 && ir <= 100) body.interest_rate = ir;
    }
    const termRaw = formData.loanTermMonths.trim();
    if (termRaw) {
      const tm = parseInt(termRaw, 10);
      if (Number.isFinite(tm) && tm >= 0) body.loan_term_months = tm;
    }
    const coll = parseVndDigitsToNumber(formData.collateralDigits);
    if (Number.isFinite(coll) && coll > 0) body.collateral_value = coll;
    const empPayload = formData.employmentStatus.trim() || formData.employmentDisplay.trim();
    if (empPayload) body.employment_status = empPayload;

    try {
      const response = await fetch('/api/v1/risk/score', {
        method: 'POST',
        headers: authJsonHeaders(),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const bodyText = await response.text();
        throw new Error(formatUserFacingFetchError(response.status, bodyText, msgLocale));
      }

      const data = await response.json();
      setResult(data);
      setIsExplanationOpen(false);
      await syncCustomerAfterScoring(data?.risk_label, data?.risk_score, data?.cic_score);
    } catch (err) {
      const message = err instanceof Error ? err.message : apiErr(err);
      notifyError(t('toast.risk_score_failed'), { description: message });
    } finally {
      setIsLoading(false);
    }
  };

  const uiScore = typeof result?.risk_score === 'number'
    ? Math.max(0, Math.min(100, (1 - Number(result.risk_score)) * 100))
    : null;

  const getRiskLevel = () => String(result?.risk_label || 'medium');

  const riskLevelLabel = (level: string) => {
    switch (level) {
      case 'low':
      case 'medium':
      case 'high':
        return t(`risk.level.${level}`);
      default:
        return level;
    }
  };

  let explanationText = '';
  if (result && typeof result.explanation === 'string') {
    const en =
      typeof result.explanation_en === 'string' && result.explanation_en.trim()
        ? result.explanation_en
        : '';
    explanationText = locale === 'en' && en ? en : result.explanation;
  }

  const structuredExplanation = result ? parseExplanationDetail(result.explanation_detail) : null;
  const hasExplanation = Boolean(structuredExplanation || explanationText);

  return (
    <div className="flex flex-col gap-8 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('risk.score.title')}</h1>
        <p className="text-muted-foreground mt-2">{t('risk.score.desc')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>{t('risk.score.card_title')}</CardTitle>
            <CardDescription>{t('risk.score.card_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customerLookup" required>
                  {t('customers.customer_id')}
                </Label>
                <div className="relative">
                  <Input
                    id="customerLookup"
                    name="customerLookup"
                    placeholder={t('customers.customer_id_ph')}
                    value={formData.customerLookup}
                    onChange={handleChange}
                    disabled={isLoading}
                    className="pr-10"
                    autoComplete="off"
                  />
                  {profileLoading ? (
                    <Loader2
                      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
                      aria-hidden
                    />
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">{t('customers.customer_name')}</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder={t('customers.customer_name_ph')}
                  value={formData.name}
                  onChange={handleChange}
                  disabled
                  className={RISK_SCORE_LOADED_FIELD_CLASS}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <VndDigitField
                  id="incomeDigits"
                  label={t('risk.score.monthly_income')}
                  valueDigits={formData.incomeDigits}
                  onDigitsChange={(d) => setFormData((p) => ({ ...p, incomeDigits: d }))}
                  disabled
                  placeholderDigits="20000000"
                />
                <VndDigitField
                  id="loanDigits"
                  label={t('risk.score.loan_amount')}
                  valueDigits={formData.loanDigits}
                  onDigitsChange={(d) => setFormData((p) => ({ ...p, loanDigits: d }))}
                  disabled
                  placeholderDigits="500000000"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="age">{t('risk.score.age')}</Label>
                  <Input
                    id="age"
                    name="age"
                    type="number"
                    min={18}
                    max={120}
                    placeholder="30"
                    value={formData.age}
                    onChange={handleChange}
                    disabled
                    className={RISK_SCORE_LOADED_FIELD_CLASS}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="creditHistory">{t('customers.credit_history')}</Label>
                  <Input
                    id="creditHistory"
                    name="creditHistory"
                    type="number"
                    min={0}
                    placeholder={t('customers.credit_history_ph')}
                    value={formData.creditHistory}
                    onChange={handleChange}
                    disabled
                    className={RISK_SCORE_LOADED_FIELD_CLASS}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="creditScore">{t('risk.score.credit_score')}</Label>
                <Input
                  id="creditScore"
                  name="creditScore"
                  type="number"
                  min={0}
                  max={1000}
                  placeholder={t('risk.score.credit_score_ph')}
                  value={formData.creditScore}
                  onChange={handleChange}
                  disabled
                  className={RISK_SCORE_LOADED_FIELD_CLASS}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('customers.loan_type')}</Label>
                  <Select
                    value={formData.loanType || '__none__'}
                    onValueChange={(v) => setFormData((p) => ({ ...p, loanType: v === '__none__' ? '' : v }))}
                    disabled
                  >
                    <SelectTrigger className={cn('w-full', RISK_SCORE_LOADED_FIELD_CLASS)}>
                      <SelectValue placeholder={t('risk.score.loan_type_opt.unspecified')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t('risk.score.loan_type_opt.unspecified')}</SelectItem>
                      <SelectItem value="secured">{t('risk.score.loan_type_opt.secured')}</SelectItem>
                      <SelectItem value="unsecured">{t('risk.score.loan_type_opt.unsecured')}</SelectItem>
                      <SelectItem value="mortgage">{t('risk.score.loan_type_opt.mortgage')}</SelectItem>
                      <SelectItem value="business">{t('risk.score.loan_type_opt.business')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="interestRate">{t('risk.score.interest_rate')}</Label>
                  <Input
                    id="interestRate"
                    name="interestRate"
                    inputMode="decimal"
                    placeholder="12"
                    value={formData.interestRate}
                    onChange={handleChange}
                    disabled
                    className={RISK_SCORE_LOADED_FIELD_CLASS}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="loanTermMonths">{t('risk.score.loan_term_months')}</Label>
                  <Input
                    id="loanTermMonths"
                    name="loanTermMonths"
                    type="number"
                    min={0}
                    placeholder="36"
                    value={formData.loanTermMonths}
                    onChange={handleChange}
                    disabled
                    className={RISK_SCORE_LOADED_FIELD_CLASS}
                  />
                </div>
                <VndDigitField
                  id="collateralDigits"
                  label={t('risk.score.collateral_value')}
                  valueDigits={formData.collateralDigits}
                  onDigitsChange={(d) => setFormData((p) => ({ ...p, collateralDigits: d }))}
                  disabled
                />
              </div>

              <div className="space-y-2">
                <Label>{t('risk.score.employment')}</Label>
                <div className="flex min-h-10 w-full items-center rounded-md border border-input bg-muted/50 px-3 py-2 text-sm font-medium text-foreground">
                  {formData.employmentDisplay.trim() ? formData.employmentDisplay : '—'}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">{t('common.additional_notes')}</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder={t('common.additional_notes_ph')}
                  value={formData.notes}
                  onChange={handleChange}
                  disabled={isLoading}
                  rows={3}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('common.calculating')}
                  </>
                ) : (
                  <>
                    <TrendingUp className="mr-2 h-4 w-4" />
                    {t('risk.score.calculate')}
                  </>
                )}
              </Button>
              {isSyncingCustomer ? (
                <p className="text-xs text-muted-foreground">{locale === 'vi' ? 'Đang đồng bộ hồ sơ khách hàng...' : 'Syncing customer profile...'}</p>
              ) : null}
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {result && (
            <Card>
              <CardHeader>
                <CardTitle>{t('risk.score.result_title')}</CardTitle>
                <CardDescription>
                  {t('risk.score.calculated_for')} {formData.name || t('customers.customer')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('customers.risk_score')}</p>
                    <p className="text-4xl font-bold text-accent mt-2">
                      {typeof uiScore === 'number' ? uiScore.toFixed(1) : t('common.na')}
                    </p>
                  </div>
                  <Badge variant="outline" className={riskBadgeOutlineClass(getRiskLevel())}>
                    {riskLevelLabel(getRiskLevel())}
                  </Badge>
                </div>

                {result.cic_score != null && (
                  <div>
                    <p className="text-sm text-muted-foreground">{t('risk.score.cic_label')}</p>
                    <p className="font-medium mt-1">
                      {String(result.cic_score)} ({String(result.cic_group)})
                    </p>
                    {result.cic_rating != null ? (
                      <p className="text-sm text-muted-foreground mt-1">
                        {t('risk.score.cic_rating')}: {String(result.cic_rating)}
                      </p>
                    ) : null}
                  </div>
                )}

                {hasExplanation ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsExplanationOpen(true)}
                    className="w-full justify-start"
                  >
                    {t('risk.score.view_details_short')}
                  </Button>
                ) : null}
                {isSyncingCustomer ? (
                  <p className="text-xs text-muted-foreground">
                    {locale === 'vi' ? 'Đang đồng bộ hồ sơ khách hàng...' : 'Syncing customer profile...'}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          )}

          {!result && (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <p className="text-muted-foreground">{t('risk.score.empty')}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={isExplanationOpen} onOpenChange={setIsExplanationOpen}>
        <DialogContent className="flex max-h-[92vh] w-[calc(100%-1.5rem)] max-w-[min(92vw,42rem)] flex-col gap-4 overflow-hidden sm:max-w-[42rem]">
          <DialogHeader className="shrink-0">
            <DialogTitle>{t('risk.score.explanation')}</DialogTitle>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col items-stretch">
            {structuredExplanation ? (
              <RiskScoreExplanationPanel
                d={structuredExplanation}
                locale={locale}
                t={t}
                riskLevelLabel={riskLevelLabel(getRiskLevel())}
                riskLevel={getRiskLevel()}
              />
            ) : explanationText ? (
              <div className={cn('mx-auto w-full max-w-full', riskExplanationFrameClass(getRiskLevel()))}>
                <div className="max-h-[min(75vh,640px)] overflow-y-auto overscroll-y-contain p-4">
                  <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">{explanationText}</div>
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
