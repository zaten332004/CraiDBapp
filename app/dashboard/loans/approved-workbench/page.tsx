'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/components/i18n-provider';
import { browserApiFetchAuth } from '@/lib/api/browser';
import { formatUserFacingApiError, type UserFacingLocale } from '@/lib/api/format-api-error';
import { notifyApiError, notifyError, notifySuccess } from '@/lib/notify';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Search } from 'lucide-react';
import { formatVnd, parseVndDigitsToNumber } from '@/lib/money';
import { VndAmountInput } from '@/components/vnd-amount-input';
import { ScrollableTableRegion, scrollableTableHeaderRowClass } from '@/components/scrollable-table-region';
import { badgeTone } from '@/lib/dashboard-badge-tones';
import { cn } from '@/lib/utils';

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
  /** Annual rate in percent (e.g. 12 = 12% p.a.), same semantics as customer forms. */
  annual_interest_rate?: number | null;
  interest_rate?: number | null;
  /** When the API returns cumulative paid on the facility, it overrides the installment-based estimate. */
  total_paid?: number | null;
  total_amount_paid?: number | null;
  facility_id?: number | null;
  next_installment_no?: number | null;
  next_schedule_id?: number | null;
  next_due_date?: string | null;
  installment_state?: string | null;
  installment_dpd?: number;
  next_total_due?: number | null;
  next_paid?: number | null;
};

function principalVnd(row: WorkbenchRow): number | null {
  const p = row.loan_amount;
  if (p == null || !Number.isFinite(Number(p)) || Number(p) <= 0) return null;
  return Math.round(Number(p));
}

function annualRatePct(row: WorkbenchRow): number {
  const r = row.annual_interest_rate ?? row.interest_rate;
  if (r == null || !Number.isFinite(Number(r))) return 0;
  return Number(r);
}

/** Tổng gốc + lãi (lãi = gốc × lãi suất năm / 100). */
function totalContractRepaymentVnd(row: WorkbenchRow): number | null {
  const p = principalVnd(row);
  if (p == null) return null;
  const rate = annualRatePct(row);
  return Math.round(p * (1 + rate / 100));
}

function termMonths(row: WorkbenchRow): number | null {
  const n = row.loan_term;
  if (n == null || !Number.isFinite(Number(n)) || Number(n) < 1) return null;
  return Math.max(1, Math.round(Number(n)));
}

/** Số tiền mỗi kỳ = tổng phải trả / số tháng. */
function flatPeriodPaymentVnd(row: WorkbenchRow): number | null {
  const total = totalContractRepaymentVnd(row);
  const months = termMonths(row);
  if (total == null || months == null) return null;
  return Math.round(total / months);
}

function currentInstallmentIndex1(row: WorkbenchRow): number {
  const raw = row.next_installment_no;
  if (raw == null || !Number.isFinite(Number(raw))) return 1;
  return Math.max(1, Math.round(Number(raw)));
}

/**
 * Ưu tiên total_paid / total_amount_paid từ API; nếu không có thì ước lượng theo kỳ đang xét
 * và số đã trả cho kỳ hiện tại (next_paid).
 */
function cumulativePaidTowardLoanVnd(row: WorkbenchRow): number | null {
  const total = totalContractRepaymentVnd(row);
  const per = flatPeriodPaymentVnd(row);
  if (total == null || per == null) return null;

  const explicit = row.total_paid ?? row.total_amount_paid;
  if (explicit != null && Number.isFinite(Number(explicit))) {
    const v = Math.round(Number(explicit));
    return Math.min(total, Math.max(0, v));
  }

  const inst = currentInstallmentIndex1(row);
  const prior = (inst - 1) * per;
  const cur = row.next_paid != null && Number.isFinite(Number(row.next_paid)) ? Math.round(Number(row.next_paid)) : 0;
  return Math.min(total, Math.max(0, prior + Math.max(0, cur)));
}

/** Tổng còn phải trả cả khoản vay (giảm khi ghi nhận thanh toán). */
function remainingTotalRepaymentVnd(row: WorkbenchRow): number | null {
  const total = totalContractRepaymentVnd(row);
  const paid = cumulativePaidTowardLoanVnd(row);
  if (total == null || paid == null) return null;
  return Math.max(0, total - paid);
}

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

function installmentStateBadgeClass(state: string | null | undefined): string {
  const s = String(state || '')
    .trim()
    .toLowerCase();
  if (s === 'paid') return badgeTone.emerald;
  if (s === 'overdue') return badgeTone.red;
  if (s === 'partial') return badgeTone.amber;
  if (s === 'upcoming') return badgeTone.sky;
  return badgeTone.slate;
}

function canRecordInstallmentPayment(row: WorkbenchRow): boolean {
  return String(row.installment_state || '')
    .trim()
    .toLowerCase() !== 'paid';
}

/** Số còn phải trả trong kỳ hiện tại (kỳ cố định hoặc next_total_due từ API − đã ghi nhận next_paid). */
function currentPeriodRemainingVnd(row: WorkbenchRow): number | null {
  const paid = row.next_paid != null && Number.isFinite(Number(row.next_paid)) ? Math.round(Number(row.next_paid)) : 0;
  const per = flatPeriodPaymentVnd(row);
  if (per != null) return Math.max(0, per - Math.max(0, paid));
  if (row.next_total_due != null && Number.isFinite(Number(row.next_total_due))) {
    return Math.max(0, Math.round(Number(row.next_total_due)) - Math.max(0, paid));
  }
  return null;
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

type PeriodStateFilter = 'all' | 'upcoming' | 'overdue' | 'partial' | 'paid';

function rowMatchesPeriodState(row: WorkbenchRow, filter: PeriodStateFilter): boolean {
  if (filter === 'all') return true;
  const s = String(row.installment_state || '')
    .trim()
    .toLowerCase();
  return s === filter;
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
  const [periodStateFilter, setPeriodStateFilter] = useState<PeriodStateFilter>('all');

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
    () =>
      rows.filter(
        (r) => rowMatchesQuery(r, searchQuery) && rowMatchesPeriodState(r, periodStateFilter),
      ),
    [rows, searchQuery, periodStateFilter],
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
    const perRem = currentPeriodRemainingVnd(rowForDialog);
    const suggestDigits =
      perRem != null
        ? String(perRem)
        : rowForDialog.next_total_due != null && Number.isFinite(Number(rowForDialog.next_total_due))
          ? String(
              Math.max(
                0,
                Math.round(Number(rowForDialog.next_total_due)) -
                  (rowForDialog.next_paid != null && Number.isFinite(Number(rowForDialog.next_paid))
                    ? Math.round(Number(rowForDialog.next_paid))
                    : 0),
              ),
            )
          : '';
    setPayAmountDigits(suggestDigits);
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayScheduleId(
      rowForDialog.next_schedule_id != null && Number.isFinite(Number(rowForDialog.next_schedule_id))
        ? String(Math.round(Number(rowForDialog.next_schedule_id)))
        : '',
    );
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
      const remainingInPeriod = currentPeriodRemainingVnd(payRow);
      /** Backend thường chỉ giữ kỳ hiện tại khi partial; 'paid' có thể đóng kỳ và nhảy hạn. */
      const paymentStatus: 'paid' | 'partial' =
        remainingInPeriod != null && remainingInPeriod > 0 && amt < remainingInPeriod ? 'partial' : 'paid';

      await browserApiFetchAuth('/loan-payments', {
        method: 'POST',
        body: {
          facility_id: payRow.facility_id,
          schedule_id: payScheduleId.trim() ? Number(payScheduleId) : null,
          payment_date: payDate,
          amount_paid: amt,
          status: paymentStatus,
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
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('loans.workbench.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">{t('customers.detail.loading')}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('loans.workbench.empty')}</p>
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="relative min-w-[200px] max-w-md flex-1">
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
                <Select
                  value={periodStateFilter}
                  onValueChange={(v) => setPeriodStateFilter(v as PeriodStateFilter)}
                >
                  <SelectTrigger className="w-full sm:w-[220px]" aria-label={t('loans.workbench.filter_period_state')}>
                    <SelectValue placeholder={t('loans.workbench.filter_period_state')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('loans.workbench.filter_all')}</SelectItem>
                    <SelectItem value="upcoming">{t('loans.workbench.installment_state.upcoming')}</SelectItem>
                    <SelectItem value="partial">{t('loans.workbench.installment_state.partial')}</SelectItem>
                    <SelectItem value="overdue">{t('loans.workbench.installment_state.overdue')}</SelectItem>
                    <SelectItem value="paid">{t('loans.workbench.installment_state.paid')}</SelectItem>
                  </SelectContent>
                </Select>
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
                          <TableHead title={t('loans.workbench.col.amount_hint')}>{t('loans.workbench.col.amount')}</TableHead>
                          <TableHead>{t('loans.workbench.col.period_payment')}</TableHead>
                          <TableHead>{t('loans.workbench.col.installment_progress')}</TableHead>
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
                            <TableCell className="text-sm tabular-nums font-medium">
                              {(() => {
                                const rem = remainingTotalRepaymentVnd(r);
                                return rem != null
                                  ? formatVnd(rem, locale === 'vi' ? 'vi' : 'en')
                                  : '-';
                              })()}
                            </TableCell>
                            <TableCell className="text-sm tabular-nums font-medium">
                              {(() => {
                                const per = flatPeriodPaymentVnd(r);
                                return per != null
                                  ? formatVnd(per, locale === 'vi' ? 'vi' : 'en')
                                  : r.next_total_due != null && Number.isFinite(Number(r.next_total_due))
                                    ? formatVnd(Number(r.next_total_due), locale === 'vi' ? 'vi' : 'en')
                                    : '-';
                              })()}
                            </TableCell>
                            <TableCell className="text-sm tabular-nums">
                              {(() => {
                                const per = flatPeriodPaymentVnd(r);
                                const due = per ?? (r.next_total_due != null && Number.isFinite(Number(r.next_total_due))
                                  ? Math.round(Number(r.next_total_due))
                                  : null);
                                if (due == null) return '-';
                                return (
                                  <>
                                    {formatVnd(Number(r.next_paid ?? 0), locale === 'vi' ? 'vi' : 'en')}
                                    <span className="text-muted-foreground"> / </span>
                                    {formatVnd(due, locale === 'vi' ? 'vi' : 'en')}
                                  </>
                                );
                              })()}
                            </TableCell>
                            <TableCell>{formatDueDate(r.next_due_date, locale)}</TableCell>
                            <TableCell>
                              {r.installment_state ? (
                                <Badge
                                  variant="outline"
                                  className={cn('font-medium border', installmentStateBadgeClass(r.installment_state))}
                                >
                                  {installmentStateLabel(t, r.installment_state)}
                                </Badge>
                              ) : (
                                '-'
                              )}
                            </TableCell>
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
                                  disabled={
                                    ensuringApplicationId === r.application_id || !canRecordInstallmentPayment(r)
                                  }
                                  title={
                                    !canRecordInstallmentPayment(r)
                                      ? t('loans.workbench.record_payment_disabled_paid')
                                      : undefined
                                  }
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
