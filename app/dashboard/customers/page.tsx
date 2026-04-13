'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Plus, Download, Eye } from 'lucide-react';
import { getUserRole } from '@/lib/auth/token';
import { useI18n } from '@/components/i18n-provider';
import { browserApiFetchAuth } from '@/lib/api/browser';
import { notifyError, notifySuccess } from '@/lib/notify';
import { formatUserFacingApiError, type UserFacingLocale } from '@/lib/api/format-api-error';
import { ListPagination } from '@/components/list-pagination';
import { getAccessToken } from '@/lib/auth/token';
import { formatVnd } from '@/lib/money';
import { rowNavigationPointerHandlers } from '@/lib/ui/row-navigation-click';
import { CRAIDB_UPLOAD_COMPLETED_EVENT } from '@/lib/profile-sync-event';
import { badgeTone } from '@/lib/dashboard-badge-tones';
import { ScrollableTableRegion, scrollableTableHeaderRowClass } from '@/components/scrollable-table-region';

function getRiskBadgeClass(level: string) {
  const normalized = String(level || '').toLowerCase();
  if (normalized === 'low') return badgeTone.emerald;
  if (normalized === 'medium') return badgeTone.blue;
  if (normalized === 'high') return badgeTone.rose;
  return badgeTone.slate;
}

type PortfolioSummary = {
  application_count: number;
  total_loan_amount: number;
  pending_count: number;
  approved_count: number;
  disbursed_count: number;
  rejected_count: number;
  has_overdue_installment: boolean;
};

function formatPortfolioSummary(
  t: (key: string) => string,
  s: PortfolioSummary | null | undefined,
  locale: string,
): string {
  if (!s || s.application_count <= 0) return t('customers.portfolio.none');
  const sep = locale === 'vi' ? ' · ' : ' · ';
  const parts: string[] = [];
  if (s.pending_count) parts.push(`${s.pending_count} ${t('customers.portfolio.pending')}`);
  if (s.approved_count) parts.push(`${s.approved_count} ${t('customers.portfolio.approved')}`);
  if (s.disbursed_count) parts.push(`${s.disbursed_count} ${t('customers.portfolio.disbursed')}`);
  if (s.rejected_count) parts.push(`${s.rejected_count} ${t('customers.portfolio.rejected')}`);
  return parts.length ? parts.join(sep) : t('customers.portfolio.none');
}

function parsePortfolioSummary(raw: unknown): PortfolioSummary | null {
  if (raw == null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  return {
    application_count: Number(o.application_count ?? 0),
    total_loan_amount: Number(o.total_loan_amount ?? 0),
    pending_count: Number(o.pending_count ?? 0),
    approved_count: Number(o.approved_count ?? 0),
    disbursed_count: Number(o.disbursed_count ?? 0),
    rejected_count: Number(o.rejected_count ?? 0),
    has_overdue_installment: Boolean(o.has_overdue_installment),
  };
}

/** Backend có thể trả `items`, `customers`, `data` hoặc `results`. */
function normalizeCustomerListResponse(data: unknown): { items: any[]; total: number } {
  if (data == null || typeof data !== 'object') return { items: [], total: 0 };
  const d = data as Record<string, unknown>;
  let items: any[] = [];
  if (Array.isArray(d.items)) items = d.items;
  else if (Array.isArray(d.customers)) items = d.customers;
  else if (Array.isArray(d.data)) items = d.data;
  else if (Array.isArray(d.results)) items = d.results;
  const rawTotal = d.total ?? d.total_count ?? d.count ?? d.totalCount;
  let total = 0;
  if (typeof rawTotal === 'number' && Number.isFinite(rawTotal)) total = rawTotal;
  else if (typeof rawTotal === 'string' && rawTotal.trim() !== '') {
    const n = Number(rawTotal);
    if (Number.isFinite(n)) total = n;
  }
  if (total <= 0 && items.length > 0) total = items.length;
  return { items, total: Math.max(0, total) };
}

export default function CustomersPage() {
  const PAGE_SIZE = 15;
  const { t, locale } = useI18n();
  const msgLocale: UserFacingLocale = locale === 'en' ? 'en' : 'vi';
  const router = useRouter();
  const role = getUserRole();
  const isViewer = role === 'viewer';
  const isAdmin = role === 'admin';
  const [customers, setCustomers] = useState<
    Array<{
      id: string;
      name: string;
      email: string;
      riskLevel: string;
      listEffectiveRiskLevel: string;
      portfolioSummary: PortfolioSummary | null;
    }>
  >([]);

  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [appStatusFilter, setAppStatusFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const loadCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams();
      query.set('page', String(page));
      query.set('limit', String(PAGE_SIZE));
      if (search.trim()) query.set('search_name', search.trim());
      if (riskFilter !== 'all') query.set('risk_level', riskFilter);
      if (appStatusFilter !== 'all') query.set('application_status', appStatusFilter);
      const raw = await browserApiFetchAuth<Record<string, unknown>>(`/customers?${query.toString()}`, {
        method: 'GET',
      });
      const { items, total } = normalizeCustomerListResponse(raw);
      const mapped = items.map((item) => ({
        id: String(item.customer_id ?? item.id ?? ''),
        name: String(item.full_name ?? item.name ?? '-'),
        email: String(item.email || '-'),
        riskLevel: String(item.risk_level || 'medium').toLowerCase(),
        listEffectiveRiskLevel: String(item.list_effective_risk_level ?? item.risk_level ?? 'medium').toLowerCase(),
        portfolioSummary: parsePortfolioSummary(item.portfolio_summary),
      }));

      setCustomers(mapped);
      setTotalCount(total);
    } catch (err) {
      notifyError(t('toast.load_failed'), { description: formatUserFacingApiError(err, msgLocale) });
    } finally {
      setIsLoading(false);
    }
  }, [page, search, riskFilter, appStatusFilter, t, msgLocale]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    const onUploadDone = () => void loadCustomers();
    window.addEventListener(CRAIDB_UPLOAD_COMPLETED_EVENT, onUploadDone);
    return () => window.removeEventListener(CRAIDB_UPLOAD_COMPLETED_EVENT, onUploadDone);
  }, [loadCustomers]);

  const riskLabel = (level: string) => {
    switch (level) {
      case 'low':
        return t('risk.level.low');
      case 'medium':
        return t('risk.level.medium');
      case 'high':
        return t('risk.level.high');
      default:
        return level;
    }
  };

  const effectiveTotal = Math.max(totalCount, customers.length);
  const totalPages = Math.max(1, Math.ceil(effectiveTotal / PAGE_SIZE));

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const exportRes = await browserApiFetchAuth<{ file_url?: string; url?: string; download_url?: string }>(
        '/admin/export',
        {
          method: 'POST',
          body: {
            type: 'customers',
            filters: {},
          },
        },
      );

      const fileUrl = String(exportRes.file_url || exportRes.url || exportRes.download_url || '').trim();
      if (!fileUrl) {
        throw new Error(t('toast.export_no_url'));
      }

      const token = getAccessToken();
      const normalizedPath = (() => {
        if (fileUrl.startsWith('/api/')) return fileUrl;
        if (fileUrl.startsWith('/')) return `/api/v1${fileUrl}`;
        return `/api/v1/${fileUrl}`;
      })();
      const response = await fetch(normalizedPath, {
        method: 'GET',
        headers: token ? { authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) {
        throw new Error(t('toast.export_download_http_failed'));
      }

      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') || '';
      const matched = disposition.match(/filename="?([^"]+)"?/i);
      const fallbackName = `customers-export-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
      const fileName = matched?.[1] || fallbackName;

      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);

      notifySuccess(t('toast.export_downloading'));
    } catch (err) {
      notifyError(t('toast.export_failed'), { description: formatUserFacingApiError(err, msgLocale) });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 bg-background p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('customers.title')}</h1>
          <p className="text-muted-foreground mt-2">
            {t('customers.desc')}
          </p>
        </div>
        {!isViewer && (
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/dashboard/upload">
                {t('sidebar.upload')}
              </Link>
            </Button>
            {isAdmin && (
              <Button variant="outline" onClick={() => void handleExport()} disabled={isExporting}>
                <Download className="mr-2 h-4 w-4" />
                {isExporting ? (locale === 'vi' ? 'Đang xuất...' : 'Exporting...') : t('sidebar.admin.export')}
              </Button>
            )}
            <Button asChild>
              <Link href="/dashboard/customers/new">
                <Plus className="mr-2 h-4 w-4" />
                {t('customers.add')}
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card className="border-border/80 bg-card shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('customers.search_ph')}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
            <Select
              value={appStatusFilter}
              onValueChange={(v) => {
                setAppStatusFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder={t('customers.app_status_filter_all')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('customers.app_status_filter_all')}</SelectItem>
                <SelectItem value="pending">{t('status.pending')}</SelectItem>
                <SelectItem value="approved">{t('status.approved')}</SelectItem>
                <SelectItem value="rejected">{t('status.rejected')}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={riskFilter}
              onValueChange={(v) => {
                setRiskFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full md:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('customers.risk_filter_all')}</SelectItem>
                <SelectItem value="low">{t('risk.level.low')}</SelectItem>
                <SelectItem value="medium">{t('risk.level.medium')}</SelectItem>
                <SelectItem value="high">{t('risk.level.high')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-border/80 bg-card shadow-sm">
        <CardHeader>
          <CardTitle>{t('customers.list_title')}</CardTitle>
        </CardHeader>
        <CardContent className="pb-5">
          <ScrollableTableRegion className="max-h-[min(48vh,32rem,calc(100dvh-17rem))] shadow-sm">
            <Table className="w-full table-fixed text-sm">
              <colgroup>
                {Array.from({ length: 6 }, (_, i) => (
                  <col key={i} style={{ width: `${100 / 6}%` }} />
                ))}
              </colgroup>
              <TableHeader>
                <TableRow className={scrollableTableHeaderRowClass}>
                  <TableHead className="py-1.5 pr-2">{t('customers.col_name_mail')}</TableHead>
                  <TableHead className="py-1.5 whitespace-nowrap px-2">{t('customers.col_app_count')}</TableHead>
                  <TableHead className="py-1.5 whitespace-nowrap px-2">{t('customers.col_total_loan')}</TableHead>
                  <TableHead className="py-1.5 whitespace-nowrap px-2">{t('customers.risk_level')}</TableHead>
                  <TableHead className="py-1.5 px-2">{t('customers.col_status_portfolio')}</TableHead>
                  <TableHead className="py-1.5 whitespace-nowrap pl-2 text-left">{t('customers.col_actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell>
                  </TableRow>
                ) : customers.map((customer, rowIdx) => (
                  <TableRow
                    key={customer.id ? customer.id : `row-${rowIdx}`}
                    className="cursor-pointer border-b border-border/70 hover:bg-muted/35"
                    {...rowNavigationPointerHandlers(() => {
                      void router.push(`/dashboard/customers/${customer.id}`);
                    })}
                  >
                    <TableCell className="py-1.5 pr-2 font-medium whitespace-normal">
                      <div className="leading-tight">
                        <p>{customer.name}</p>
                        <p className="text-xs text-muted-foreground">{customer.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="py-1.5 px-2 text-[13px] tabular-nums">
                      {customer.portfolioSummary?.application_count ?? 0}
                    </TableCell>
                    <TableCell className="py-1.5 px-2 text-[13px] tabular-nums">
                      {formatVnd(
                        customer.portfolioSummary?.total_loan_amount ?? 0,
                        locale === 'vi' ? 'vi' : 'en',
                      )}
                    </TableCell>
                    <TableCell className="py-1.5 px-2">
                      <Badge
                        variant="outline"
                        className={getRiskBadgeClass(customer.listEffectiveRiskLevel)}
                        title={
                          customer.portfolioSummary?.has_overdue_installment &&
                          customer.listEffectiveRiskLevel !== customer.riskLevel
                            ? t('customers.risk_elevated_overdue_hint')
                            : undefined
                        }
                      >
                        {riskLabel(customer.listEffectiveRiskLevel)}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-1.5 px-2 text-[13px] text-muted-foreground break-words align-middle whitespace-normal">
                      {formatPortfolioSummary(t, customer.portfolioSummary, locale)}
                    </TableCell>
                    <TableCell className="py-1.5 pl-2 align-middle whitespace-normal">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 px-2.5 font-normal"
                        asChild
                      >
                        <Link
                          href={`/dashboard/customers/${customer.id}`}
                          aria-label={t('customers.action_view_details')}
                          title={t('customers.action_view_details')}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center"
                        >
                          <Eye className="h-4 w-4 shrink-0" />
                          <span className="max-w-[9rem] truncate sm:max-w-none sm:whitespace-nowrap">
                            {t('customers.action_view_details')}
                          </span>
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollableTableRegion>
          <ListPagination
            className="mt-4 flex items-center justify-end gap-1"
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>
    </div>
  );
}
