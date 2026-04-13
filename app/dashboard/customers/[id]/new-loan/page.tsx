'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useI18n } from '@/components/i18n-provider';
import { browserApiFetchAuth } from '@/lib/api/browser';
import { formatUserFacingApiError, type UserFacingLocale } from '@/lib/api/format-api-error';
import { notifyError, notifySuccess } from '@/lib/notify';

const LOAN_TYPE_OPTIONS = [
  { value: 'secured', labelVi: 'Có tài sản bảo đảm', labelEn: 'Secured' },
  { value: 'unsecured', labelVi: 'Tín chấp', labelEn: 'Unsecured' },
  { value: 'mortgage', labelVi: 'Thế chấp', labelEn: 'Mortgage' },
  { value: 'business', labelVi: 'Kinh doanh', labelEn: 'Business' },
] as const;

export default function NewLoanApplicationPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const params = useParams();
  const customerId = Number(params.id);
  const msgLocale: UserFacingLocale = locale === 'en' ? 'en' : 'vi';
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const amt = Number(form.requested_loan_amount);
      const term = Number(form.requested_term_months);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error('Invalid amount');
      if (!Number.isInteger(term) || term <= 0) throw new Error('Invalid term');
      if (!form.loan_purpose.trim()) throw new Error('Purpose required');
      await browserApiFetchAuth(`/customers/${customerId}/loan-applications`, {
        method: 'POST',
        body: JSON.stringify({
          loan_purpose: form.loan_purpose.trim(),
          loan_type: form.loan_type || undefined,
          requested_loan_amount: amt,
          requested_term_months: term,
          annual_interest_rate: form.annual_interest_rate ? Number(form.annual_interest_rate) : undefined,
          collateral_id: form.collateral_id.trim() || undefined,
          collateral_value: form.collateral_value ? Number(form.collateral_value) : undefined,
        }),
      });
      notifySuccess(t('customers.new_loan.toast_ok'));
      router.push(`/dashboard/customers/${customerId}`);
    } catch (err) {
      notifyError(t('toast.action_failed'), { description: formatUserFacingApiError(err, msgLocale) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 p-8 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/customers/${customerId}`}>
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
              <Label>{t('customers.field.loan_purpose')}</Label>
              <Input value={form.loan_purpose} onChange={(e) => setForm((p) => ({ ...p, loan_purpose: e.target.value }))} required />
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
                <Label>{t('customers.field.loan_amount_display')}</Label>
                <Input
                  inputMode="decimal"
                  value={form.requested_loan_amount}
                  onChange={(e) => setForm((p) => ({ ...p, requested_loan_amount: e.target.value.replace(/[^\d.]/g, '') }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t('customers.field.loan_term_display')}</Label>
                <Input
                  inputMode="numeric"
                  value={form.requested_term_months}
                  onChange={(e) => setForm((p) => ({ ...p, requested_term_months: e.target.value.replace(/\D/g, '') }))}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('customers.field.interest_rate_display')}</Label>
              <Input
                inputMode="decimal"
                value={form.annual_interest_rate}
                onChange={(e) => setForm((p) => ({ ...p, annual_interest_rate: e.target.value.replace(/[^\d.]/g, '') }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('customers.field.collateral_id')}</Label>
                <Input value={form.collateral_id} onChange={(e) => setForm((p) => ({ ...p, collateral_id: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t('customers.field.collateral_value')}</Label>
                <Input
                  inputMode="decimal"
                  value={form.collateral_value}
                  onChange={(e) => setForm((p) => ({ ...p, collateral_value: e.target.value.replace(/[^\d.]/g, '') }))}
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
