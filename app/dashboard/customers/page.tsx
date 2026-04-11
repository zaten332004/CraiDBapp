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
import { Search, Plus, Download } from 'lucide-react';
import { getUserRole } from '@/lib/auth/token';
import { useI18n } from '@/components/i18n-provider';
import { browserApiFetchAuth } from '@/lib/api/browser';
import { notifyError, notifySuccess } from '@/lib/notify';
import { formatUserFacingApiError, type UserFacingLocale } from '@/lib/api/format-api-error';
import { ListPagination } from '@/components/list-pagination';
import { getAccessToken } from '@/lib/auth/token';
import { formatVnd } from '@/lib/money';
import { CRAIDB_UPLOAD_COMPLETED_EVENT } from '@/lib/profile-sync-event';

function getRiskBadgeClass(level: string) {
  const normalized = String(level || '').toLowerCase();
  if (normalized === 'low') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (normalized === 'medium') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (normalized === 'high') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function normalizeStatusKey(status: string) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'approved') return 'status.approved';
  if (normalized === 'rejected') return 'status.rejected';
  if (normalized === 'pending') return 'status.pending';
  if (normalized === 'active') return 'status.active';
  if (normalized === 'inactive') return 'status.inactive';
  return null;
}

function getStatusBadgeClass(status: string) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'approved') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (normalized === 'rejected') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (normalized === 'pending') return 'border-slate-200 bg-slate-50 text-slate-700';
  if (normalized === 'active') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (normalized === 'inactive') return 'border-slate-200 bg-slate-50 text-slate-700';
  return 'border-slate-200 bg-slate-50 text-slate-700';
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
  const [customers, setCustomers] = useState<Array<{
    id: string;
    name: string;
    email: string;
    loanType: string;
    loanAmount: number | null;
    termMonths: number | null;
    annualRate: number | null;
    riskLevel: string;
    status: string;
  }>>([]);

  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('all');
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
      const raw = await browserApiFetchAuth<Record<string, unknown>>(`/customers?${query.toString()}`, {
        method: 'GET',
      });
      const { items, total } = normalizeCustomerListResponse(raw);
      const mapped = items.map((item) => ({
          id: String(item.customer_id ?? item.id ?? ''),
          name: String(item.full_name ?? item.name ?? '-'),
          email: String(item.email || '-'),
          loanType: String(item.loan_type || item.product_type || '-'),
          loanAmount: item.requested_loan_amount != null ? Number(item.requested_loan_amount) : null,
          termMonths: item.requested_term_months != null ? Number(item.requested_term_months) : null,
          annualRate: item.annual_interest_rate != null ? Number(item.annual_interest_rate) : null,
          riskLevel: String(item.risk_level || 'medium').toLowerCase(),
          status: String(item.application_status || item.status || 'active').toLowerCase(),
      }));
      const normalizedSearch = search.trim().toLowerCase();
      const filtered = !normalizedSearch
        ? mapped
        : mapped.filter((customer) =>
            [customer.id, customer.name, customer.email, customer.loanType]
              .filter(Boolean)
              .some((field) => String(field).toLowerCase().includes(normalizedSearch)),
          );

      setCustomers(filtered);
      setTotalCount(total);
    } catch (err) {
      notifyError(t('toast.load_failed'), { description: formatUserFacingApiError(err, msgLocale) });
    } finally {
      setIsLoading(false);
    }
  }, [page, search, riskFilter, t, msgLocale]);

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

  const loanTypeLabel = (value: string) => {
    const normalized = String(value || '').toLowerCase();
    if (normalized === 'secured') return locale === 'vi' ? 'Có tài sản bảo đảm' : 'Secured';
    if (normalized === 'unsecured') return locale === 'vi' ? 'Tín chấp' : 'Unsecured';
    if (normalized === 'mortgage') return locale === 'vi' ? 'Thế chấp' : 'Mortgage';
    if (normalized === 'business') return locale === 'vi' ? 'Kinh doanh' : 'Business';
    return value || '-';
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
        throw new Error(locale === 'vi' ? 'Không nhận được đường dẫn file export.' : 'No export file URL returned.');
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
        throw new Error(locale === 'vi' ? 'Tải file export thất bại.' : 'Failed to download export file.');
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

      notifySuccess(locale === 'vi' ? 'Đang tải file export.' : 'Downloading export file.');
    } catch (err) {
      notifyError(t('toast.export_failed'), { description: formatUserFacingApiError(err, msgLocale) });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 bg-[#f4f7fc]">
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
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
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
        <CardContent>
          <div className="overflow-x-auto rounded-xl border border-black/70 bg-white">
            <Table className="min-w-[980px] w-full">
              <TableHeader>
                <TableRow className="bg-muted/35 hover:bg-muted/35">
                  <TableHead className="py-1.5">{t('common.name')}</TableHead>
                  <TableHead className="py-1.5">{t('customers.loan_type')}</TableHead>
                  <TableHead className="py-1.5">{t('customers.loan_amount')}</TableHead>
                  <TableHead className="py-1.5">{t('customers.loan_term')}</TableHead>
                  <TableHead className="py-1.5">{t('customers.interest_rate')}</TableHead>
                  <TableHead className="py-1.5">{t('customers.risk_level')}</TableHead>
                  <TableHead className="py-1.5">{t('common.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7}><Skeleton className="h-6 w-full" /></TableCell>
                  </TableRow>
                ) : customers.map((customer, rowIdx) => (
                  <TableRow
                    key={customer.id ? customer.id : `row-${rowIdx}`}
                    className="cursor-pointer border-b border-black/15 hover:bg-muted/30"
                    onClick={() => router.push(`/dashboard/customers/${customer.id}`)}
                  >
                    <TableCell className="py-1.5 font-medium">
                      <div className="leading-tight">
                        <p>{customer.name}</p>
                        <p className="text-xs text-muted-foreground">{customer.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="py-1.5 text-[13px]">{loanTypeLabel(customer.loanType)}</TableCell>
                    <TableCell className="py-1.5 text-[13px]">{formatVnd(customer.loanAmount, locale === 'vi' ? 'vi' : 'en')}</TableCell>
                    <TableCell className="py-1.5 text-[13px]">
                      {customer.termMonths != null ? `${customer.termMonths} ${locale === 'vi' ? 'tháng' : 'months'}` : '-'}
                    </TableCell>
                    <TableCell className="py-1.5 text-[13px]">{customer.annualRate != null ? `${customer.annualRate}%` : '-'}</TableCell>
                    <TableCell className="py-1.5">
                      <Badge variant="outline" className={getRiskBadgeClass(customer.riskLevel)}>
                        {riskLabel(customer.riskLevel)}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Badge variant="outline" className={getStatusBadgeClass(customer.status)}>
                        {normalizeStatusKey(customer.status) ? t(normalizeStatusKey(customer.status) as string) : customer.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ListPagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </CardContent>
      </Card>
    </div>
  );
}
