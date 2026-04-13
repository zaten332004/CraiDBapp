'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/components/i18n-provider';
import { browserApiFetchAuth } from '@/lib/api/browser';
import { formatUserFacingApiError, type UserFacingLocale } from '@/lib/api/format-api-error';
import { notifyApiError, notifyError, notifySuccess } from '@/lib/notify';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Search } from 'lucide-react';
import { formatVnd, parseVndDigitsToNumber } from '@/lib/money';
import { VndAmountInput } from '@/components/vnd-amount-input';
import { ScrollableTableRegion, scrollableTableHeaderRowClass } from '@/components/scrollable-table-region';

type WorkbenchRow = {
  application_id: number;
  application_ref_no?: string | null;
  customer_id?: number | null;
  customer_name?: string | null;
  loan_status?: string | null;
  loan_type?: string | null;
  loan_purpose?: string | null;
  loan_amount?: number | null;
  loan_term?: number | null;
  facility_id?: number | null;
  next_installment_no?: number | null;
  next_due_date?: string | null;
  installment_state?: string | null;
  installment_dpd?: number;
  next_total_due?: number | null;
  next_paid?: number | null;
};

function formatDueDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US');
}

function installmentStateLabel(
  t: (key: string) => string,
  state: string | null | undefined,
): string {
  if (!state) return '-';
  const key = `loans.workbench.installment_state.${state}`;
  const label = t(key);
  return label === key ? state : label;
}

/** Lowercase + strip combining marks so "Nguyen" matches "Nguyễn". */
function normalizeForSearch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function rowMatchesQuery(row: WorkbenchRow, rawQuery: string): boolean {
  const q = normalizeForSearch(rawQuery.trim());
  if (!q) return true;
  const name = normalizeForSearch(row.customer_name ?? '');
  const ref = normalizeForSearch(String(row.application_ref_no ?? ''));
  const id = normalizeForSearch(String(row.application_id ?? ''));
  return name.includes(q) || ref.includes(q) || id.includes(q);
}

export default function ApprovedLoanWorkbenchPage() {
  const { t, locale } = useI18n();
  const msgLocale: UserFacingLocale = locale === 'en' ? 'en' : 'vi';
  const [rows, setRows] = useState<WorkbenchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);
  const [payRow, setPayRow] = useState<WorkbenchRow | null>(null);
  const [payAmountDigits, setPayAmountDigits] = useState('');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payScheduleId, setPayScheduleId] = useState('');
  const [paySaving, setPaySaving] = useState(false);
  const [ensuringApplicationId, setEnsuringApplicationId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await browserApiFetchAuth<WorkbenchRow[]>('/customers/approved-loan-workbench', { method: 'GET' });
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      notifyError(t('toast.load_failed'), { description: formatUserFacingApiError(e, msgLocale) });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [msgLocale, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(
    () => rows.filter((r) => rowMatchesQuery(r, searchQuery)),
    [rows, searchQuery],
  );

  const openPay = async (row: WorkbenchRow) => {
    let facilityId = row.facility_id;
    if (!facilityId) {
      setEnsuringApplicationId(row.application_id);
      try {
        const ensured = await browserApiFetchAuth<{ facility_id: number }>(
          `/customers/loan-applications/${row.application_id}/ensure-repayment-schedule`,
          { method: 'POST' },
        );
        facilityId = ensured.facility_id;
      } catch (e) {
        notifyApiError(e, msgLocale);
        return;
      } finally {
        setEnsuringApplicationId(null);
      }
    }
    const rowForDialog: WorkbenchRow = { ...row, facility_id: facilityId };
    setPayRow(rowForDialog);
    setPayAmountDigits(
      rowForDialog.next_total_due != null && Number.isFinite(Number(rowForDialog.next_total_due))
        ? String(Math.round(Number(rowForDialog.next_total_due)))
        : '',
    );
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayScheduleId('');
    setPayOpen(true);
  };

  const submitPayment = async () => {
    if (!payRow?.facility_id) {
      notifyError(t('toast.payment_error_title'), { description: t('toast.payment_missing_facility') });
      return;
    }
    const amt = parseVndDigitsToNumber(payAmountDigits);
    if (!Number.isFinite(amt) || amt <= 0) {
      notifyError(t('toast.payment_error_title'), { description: t('toast.payment_invalid_amount') });
      return;
    }
    setPaySaving(true);
    try {
      await browserApiFetchAuth('/loan-payments', {
        method: 'POST',
        body: {
          facility_id: payRow.facility_id,
          schedule_id: payScheduleId.trim() ? Number(payScheduleId) : null,
          payment_date: payDate,
          amount_paid: amt,
          status: 'paid',
        },
      });
      notifySuccess(t('loans.workbench.toast_payment_ok'));
      setPayOpen(false);
      await load();
    } catch (e) {
      notifyApiError(e, msgLocale);
    } finally {
      setPaySaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/customers">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('common.back')}
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('loans.workbench.title')}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t('loans.workbench.desc')}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('loans.workbench.title')}</CardTitle>
          <CardDescription>{t('loans.workbench.desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">{t('customers.detail.loading')}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('loans.workbench.empty')}</p>
          ) : (
            <>
              <div className="relative max-w-md">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('loans.workbench.search_placeholder')}
                  aria-label={t('loans.workbench.search_placeholder')}
                  autoComplete="off"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t('loans.workbench.list_meta')
                  .replace('{shown}', String(filteredRows.length))
                  .replace('{total}', String(rows.length))}
              </p>
              {filteredRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('loans.workbench.no_match')}</p>
              ) : (
                <div className="rounded-lg border border-border bg-muted/30 shadow-sm overflow-hidden">
                  <ScrollableTableRegion className="rounded-lg border-0 bg-transparent">
                    <Table>
                      <TableHeader>
                        <TableRow className={scrollableTableHeaderRowClass}>
                          <TableHead>{t('loans.workbench.col.customer')}</TableHead>
                          <TableHead>{t('loans.workbench.col.ref')}</TableHead>
                          <TableHead>{t('loans.workbench.col.amount')}</TableHead>
                          <TableHead>{t('loans.workbench.col.due')}</TableHead>
                          <TableHead>{t('loans.workbench.col.state')}</TableHead>
                          <TableHead>{t('loans.workbench.col.dpd')}</TableHead>
                          <TableHead className="text-right">{t('loans.workbench.record_payment')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRows.map((r) => (
                          <TableRow key={r.application_id}>
                            <TableCell className="font-medium">{r.customer_name || '-'}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {r.application_ref_no || r.application_id}
                            </TableCell>
                            <TableCell>
                              {r.loan_amount != null
                                ? formatVnd(Number(r.loan_amount), locale === 'vi' ? 'vi' : 'en')
                                : '-'}
                            </TableCell>
                            <TableCell>{formatDueDate(r.next_due_date, locale)}</TableCell>
                            <TableCell>{installmentStateLabel(t, r.installment_state)}</TableCell>
                            <TableCell>{r.installment_dpd ?? 0}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" asChild>
                                  <Link
                                    href={`/dashboard/customers/${r.customer_id}?application_id=${r.application_id}&returnTo=${encodeURIComponent('/dashboard/loans/approved-workbench')}`}
                                  >
                                    {t('loans.workbench.open_customer')}
                                  </Link>
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => void openPay(r)}
                                  disabled={ensuringApplicationId === r.application_id}
                                >
                                  {t('loans.workbench.record_payment')}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollableTableRegion>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('loans.workbench.record_payment')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <p className="text-xs text-muted-foreground font-mono">
              facility_id: {payRow?.facility_id ?? '-'} | {payRow?.application_ref_no}
            </p>
            <div className="space-y-2">
              <Label>{t('loans.workbench.payment_amount')}</Label>
              <VndAmountInput
                valueDigits={payAmountDigits}
                onDigitsChange={setPayAmountDigits}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('loans.workbench.payment_date')}</Label>
              <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('loans.workbench.schedule_id')}</Label>
              <Input value={payScheduleId} onChange={(e) => setPayScheduleId(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)} disabled={paySaving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => void submitPayment()} disabled={paySaving}>
              {t('loans.workbench.save_payment')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
