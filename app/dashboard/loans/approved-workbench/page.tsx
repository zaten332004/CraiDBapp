'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/components/i18n-provider';
import { browserApiFetchAuth } from '@/lib/api/browser';
import { formatUserFacingApiError, type UserFacingLocale } from '@/lib/api/format-api-error';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft } from 'lucide-react';
import { formatVnd } from '@/lib/money';

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

export default function ApprovedLoanWorkbenchPage() {
  const { t, locale } = useI18n();
  const msgLocale: UserFacingLocale = locale === 'en' ? 'en' : 'vi';
  const [rows, setRows] = useState<WorkbenchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);
  const [payRow, setPayRow] = useState<WorkbenchRow | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payScheduleId, setPayScheduleId] = useState('');
  const [paySaving, setPaySaving] = useState(false);

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

  const openPay = (row: WorkbenchRow) => {
    setPayRow(row);
    setPayAmount(row.next_total_due != null ? String(row.next_total_due) : '');
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayScheduleId('');
    setPayOpen(true);
  };

  const submitPayment = async () => {
    if (!payRow?.facility_id) {
      notifyError(t('toast.action_failed'), { description: 'Missing facility_id' });
      return;
    }
    const amt = Number(payAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      notifyError(t('toast.action_failed'), { description: 'Invalid amount' });
      return;
    }
    setPaySaving(true);
    try {
      await browserApiFetchAuth('/loan-payments', {
        method: 'POST',
        body: JSON.stringify({
          facility_id: payRow.facility_id,
          schedule_id: payScheduleId.trim() ? Number(payScheduleId) : null,
          payment_date: payDate,
          amount_paid: amt,
          status: 'paid',
        }),
      });
      notifySuccess(t('loans.workbench.toast_payment_ok'));
      setPayOpen(false);
      await load();
    } catch (e) {
      notifyError(t('toast.action_failed'), { description: formatUserFacingApiError(e, msgLocale) });
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
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">{t('customers.detail.loading')}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('loans.workbench.empty')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
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
                {rows.map((r) => (
                  <TableRow key={r.application_id}>
                    <TableCell className="font-medium">{r.customer_name || '-'}</TableCell>
                    <TableCell className="font-mono text-xs">{r.application_ref_no || r.application_id}</TableCell>
                    <TableCell>
                      {r.loan_amount != null ? formatVnd(Number(r.loan_amount), locale === 'vi' ? 'vi' : 'en') : '-'}
                    </TableCell>
                    <TableCell>{r.next_due_date || '-'}</TableCell>
                    <TableCell>{r.installment_state || '-'}</TableCell>
                    <TableCell>{r.installment_dpd ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/dashboard/customers/${r.customer_id}?application_id=${r.application_id}`}>
                            {t('loans.workbench.open_customer')}
                          </Link>
                        </Button>
                        <Button size="sm" onClick={() => openPay(r)} disabled={!r.facility_id}>
                          {t('loans.workbench.record_payment')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
              <Input value={payAmount} onChange={(e) => setPayAmount(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" />
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
