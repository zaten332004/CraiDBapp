'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AlertCircle, CheckCircle, Clock, MoreHorizontal, UserRound } from 'lucide-react';
import { useI18n } from '@/components/i18n-provider';
import { browserApiFetchAuth } from '@/lib/api/browser';
import { notifyError, notifySuccess } from '@/lib/notify';
import { formatUserFacingApiError, type UserFacingLocale } from '@/lib/api/format-api-error';
import { ListPagination } from '@/components/list-pagination';
import { formatDateTimeVietnam } from '@/lib/datetime';
import { cn } from '@/lib/utils';

const ALERTS_LIST_PATH = '/dashboard/alerts';

function customerDetailHrefFromAlerts(customerId: number) {
  return `/dashboard/customers/${customerId}?returnTo=${encodeURIComponent(ALERTS_LIST_PATH)}`;
}

type AlertRow = {
  alert_id: number;
  alert_type: string;
  severity: string;
  status: string;
  is_resolved?: boolean;
  created_at: string;
  message: string;
  customer_id?: number | null;
  customer_name?: string | null;
};

const getSeverityVariant = (severity: string): 'default' | 'destructive' | 'outline' | 'secondary' => {
  switch (severity) {
    case 'critical':
      return 'destructive';
    case 'high':
      return 'default';
    case 'medium':
      return 'default';
    case 'low':
      return 'secondary';
    default:
      return 'outline';
  }
};

const getSeverityClass = (severity: string) => {
  const normalized = String(severity || '').toLowerCase();
  if (normalized === 'critical') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (normalized === 'high') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (normalized === 'medium') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (normalized === 'low') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return 'border-slate-200 bg-slate-50 text-slate-700';
};

const getStatusClass = (status: string) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'open') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (normalized === 'resolved') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (normalized === 'pending') return 'border-slate-200 bg-slate-50 text-slate-700';
  return 'border-slate-200 bg-slate-50 text-slate-700';
};

const normalizeAlertStatus = (input: unknown, isResolved?: boolean): 'open' | 'resolved' | 'pending' => {
  const raw = String(input ?? '').trim().toLowerCase();
  if (raw === 'open' || raw === 'resolved' || raw === 'pending') return raw;
  if (raw === 'active') return 'open';
  if (raw === 'closed' || raw === 'done') return 'resolved';
  if (typeof isResolved === 'boolean') return isResolved ? 'resolved' : 'open';
  return 'open';
};

const formatStatusLabel = (status: string, locale: string) => {
  const normalized = normalizeAlertStatus(status);
  if (locale === 'vi') {
    if (normalized === 'open') return 'Mở';
    if (normalized === 'resolved') return 'Đã xử lý';
    return 'Chờ xử lý';
  }
  if (normalized === 'open') return 'Open';
  if (normalized === 'resolved') return 'Resolved';
  return 'Pending';
};

/** Bỏ hậu tố "(resolved: ...)" khỏi nội dung hiển thị; trạng thái đã có cột riêng. */
const alertMessageDisplayCore = (raw: string) => {
  const full = String(raw ?? '').trim();
  const idx = full.search(/\s*\(resolved:/i);
  if (idx < 0) return full;
  return full.slice(0, idx).trim() || full;
};

const formatAlertTypeLabel = (alertType: string, locale: string) => {
  const raw = String(alertType || '').trim().toLowerCase();
  if (locale === 'vi') {
    if (raw === 'high_pd') return 'Rủi ro tín dụng tăng cao';
    if (raw === 'delinquency') return 'Nợ xấu / quá hạn nghiêm trọng';
    if (raw === 'overdue') return 'Khoản vay quá hạn';
    return alertType || 'Cảnh báo';
  }
  if (raw === 'high_pd') return 'Elevated credit risk';
  if (raw === 'delinquency') return 'Delinquency risk';
  if (raw === 'overdue') return 'Overdue loan risk';
  return alertType || 'Alert';
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'open':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case 'resolved':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'pending':
      return <Clock className="h-4 w-4 text-yellow-500" />;
    default:
      return null;
  }
};

export default function AlertsPage() {
  const PAGE_SIZE = 7;
  const router = useRouter();
  const { locale, t } = useI18n();
  const msgLocale: UserFacingLocale = locale === 'en' ? 'en' : 'vi';
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  /** true until first fetch finishes — avoids flashing empty state before request runs */
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);

  const loadAlerts = async () => {
    setIsLoading(true);
    try {
      const data = await browserApiFetchAuth<unknown>('/alerts', { method: 'GET' });
      const rawList = Array.isArray(data)
        ? data
        : data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)
          ? (data as { items: AlertRow[] }).items
          : [];
      const normalized = rawList.map((item) => ({
        ...(item as AlertRow),
        status: normalizeAlertStatus((item as AlertRow).status, (item as AlertRow).is_resolved),
      }));
      setAlerts(normalized);
    } catch (err) {
      notifyError(t('toast.load_failed'), { description: formatUserFacingApiError(err, msgLocale) });
      setAlerts([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAlerts();
  }, []);

  const filteredAlerts = useMemo(() => {
    const byStatus = alerts.filter((alert) => (filter === 'all' ? true : alert.status === filter));
    const q = searchQuery.trim().toLowerCase();
    if (!q) return byStatus;
    return byStatus.filter((alert) => {
      const typeLabel = formatAlertTypeLabel(alert.alert_type, locale).toLowerCase();
      const hay = [
        String(alert.alert_id),
        String(alert.customer_id ?? ''),
        String(alert.customer_name ?? ''),
        String(alert.alert_type ?? ''),
        typeLabel,
        String(alert.message ?? ''),
        String(alert.severity ?? ''),
        formatStatusLabel(alert.status, locale).toLowerCase(),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [alerts, filter, searchQuery, locale]);
  useEffect(() => {
    setPage(1);
  }, [filter, alerts.length, searchQuery]);
  const totalPages = Math.ceil(filteredAlerts.length / PAGE_SIZE) || 1;
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pagedAlerts = filteredAlerts.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const resolveAlert = async (alertId: number) => {
    try {
      const target = alerts.find((item) => item.alert_id === alertId);
      await browserApiFetchAuth(`/alerts/${alertId}/resolve`, {
        method: 'PUT',
        body: { reason: locale === 'vi' ? 'Đã xác nhận xử lý trên dashboard' : 'Resolved from dashboard' },
      });
      notifySuccess(
        locale === 'vi' ? 'Đã cập nhật trạng thái cảnh báo.' : 'Alert status updated.',
        {
          details: locale === 'vi'
            ? [
                `Mã cảnh báo: #${alertId}`,
                `Khách hàng: ${target?.customer_name || '-'}`,
                'Trạng thái mới: Đã xử lý',
              ]
            : [
                `Alert ID: #${alertId}`,
                `Customer: ${target?.customer_name || '-'}`,
                'New status: Resolved',
              ],
        },
      );
      await loadAlerts();
    } catch (err) {
      notifyError(t('toast.action_failed'), { description: formatUserFacingApiError(err, msgLocale) });
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-72px)] flex-col gap-4 bg-[#f4f7fc] p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('alerts.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('alerts.desc')}
        </p>
      </div>

      {/* Alerts Summary */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {[
          { titleKey: 'alerts.total', count: alerts.length, variant: 'outline' as const },
          { titleKey: 'status.open', count: alerts.filter((a) => a.status === 'open').length, variant: 'destructive' as const },
          { titleKey: 'status.resolved', count: alerts.filter((a) => a.status === 'resolved').length, variant: 'secondary' as const },
          { titleKey: 'severity.critical', count: alerts.filter((a) => a.severity === 'critical').length, variant: 'destructive' as const },
        ].map((item, idx) => (
          <Card key={idx} className="border-border/80 bg-card shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t(item.titleKey)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{isLoading ? '...' : item.count}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alerts Table */}
      <Card className="border-border/80 bg-card shadow-sm">
        <CardHeader className="space-y-3 pb-3">
          <div>
            <CardTitle>{t('alerts.active')}</CardTitle>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:max-w-md sm:flex-1">
              <Input
                placeholder={t('common.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white"
              />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-full bg-white sm:w-40 sm:shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                <SelectItem value="open">{t('status.open')}</SelectItem>
                <SelectItem value="resolved">{t('status.resolved')}</SelectItem>
                <SelectItem value="pending">{t('status.pending')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="pt-0 pb-3">
          {isLoading && alerts.length === 0 ? (
            <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-black/70 bg-white py-12 text-muted-foreground">
              {t('common.loading')}
            </div>
          ) : !isLoading && filteredAlerts.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-4 rounded-xl border border-black/70 bg-white py-12">
              <CheckCircle className="h-16 w-16 shrink-0 text-emerald-500" strokeWidth={1.75} aria-hidden />
              <p className="text-center text-[15px] text-muted-foreground">{t('alerts.empty_list')}</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-black/70 bg-white">
                <Table className="w-full table-fixed">
                  <colgroup>
                    <col className="w-[4%]" />
                    <col className="w-[29%]" />
                    <col className="w-[19%]" />
                    <col className="w-[11%]" />
                    <col className="w-[11%]" />
                    <col className="w-[14%]" />
                    <col className="w-[12%]" />
                  </colgroup>
                  <TableHeader>
                    <TableRow className="bg-muted/35 hover:bg-muted/35">
                      <TableHead></TableHead>
                      <TableHead className="py-2.5 text-[13px] font-semibold">{t('alerts.type')}</TableHead>
                      <TableHead className="py-2.5 text-[13px] font-semibold">{t('alerts.customer')}</TableHead>
                      <TableHead className="py-2.5 text-[13px] font-semibold">{t('alerts.severity')}</TableHead>
                      <TableHead className="py-2.5 text-[13px] font-semibold">{t('common.status')}</TableHead>
                      <TableHead className="py-2.5 text-[13px] font-semibold">{t('common.date')}</TableHead>
                      <TableHead className="py-2.5 text-right text-[13px] font-semibold">{t('common.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedAlerts.map((alert) => {
                      const cid =
                        alert.customer_id != null && Number(alert.customer_id) > 0
                          ? Number(alert.customer_id)
                          : null;
                      const rowOpensProfile = cid != null;
                      return (
                      <TableRow
                        key={alert.alert_id}
                        className={cn(
                          'border-b border-black/15 hover:bg-muted/30',
                          rowOpensProfile && 'cursor-pointer',
                        )}
                        onClick={() => {
                          if (cid != null) router.push(customerDetailHrefFromAlerts(cid));
                        }}
                      >
                        <TableCell className="py-2">{getStatusIcon(alert.status)}</TableCell>
                        <TableCell className="max-w-0 py-2">
                          <div className="min-w-0 pr-1">
                            <p className="truncate font-medium text-[13px]">
                              {formatAlertTypeLabel(alert.alert_type, locale)}
                            </p>
                            <p
                              className="line-clamp-2 break-words text-[13px] text-muted-foreground"
                              title={alertMessageDisplayCore(alert.message)}
                            >
                              {alertMessageDisplayCore(alert.message)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 text-[13px] font-medium">{alert.customer_name || `#${alert.alert_id}`}</TableCell>
                        <TableCell className="py-2">
                          <Badge variant={getSeverityVariant(alert.severity)} className={getSeverityClass(alert.severity)}>
                            {t(`severity.${alert.severity}`)}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge variant="outline" className={getStatusClass(alert.status)}>
                            {formatStatusLabel(alert.status, locale)}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 text-[13px] text-muted-foreground whitespace-nowrap">
                          {formatDateTimeVietnam(alert.created_at, locale)}
                        </TableCell>
                        <TableCell
                          className="py-2 text-right align-middle"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <div className="flex justify-end">
                            {cid != null || alert.status === 'open' ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0"
                                    aria-label={t('common.actions')}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  {cid != null ? (
                                    <DropdownMenuItem asChild>
                                      <Link href={customerDetailHrefFromAlerts(cid)}>
                                        <UserRound className="mr-2 h-4 w-4 opacity-80" />
                                        {t('alerts.view_customer')}
                                      </Link>
                                    </DropdownMenuItem>
                                  ) : null}
                                  {alert.status === 'open' ? (
                                    <DropdownMenuItem
                                      onClick={() => void resolveAlert(alert.alert_id)}
                                      className="text-accent focus:text-accent"
                                    >
                                      <CheckCircle className="mr-2 h-4 w-4 opacity-80" />
                                      {t('alerts.resolve')}
                                    </DropdownMenuItem>
                                  ) : null}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                    })}
                  </TableBody>
                </Table>
              </div>
              {filteredAlerts.length > PAGE_SIZE && (
                <div className="mt-3">
                  <ListPagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
