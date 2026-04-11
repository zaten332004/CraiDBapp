'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CheckCircle, XCircle, Loader2, RefreshCw, MoreHorizontal } from 'lucide-react';
import { browserApiFetchAuth } from '@/lib/api/browser';
import { ApiError } from '@/lib/api/shared';
import { useI18n } from '@/components/i18n-provider';
import { ListPagination } from '@/components/list-pagination';
import { formatDateTimeVietnam } from '@/lib/datetime';
import { notifyError, notifySuccess } from '@/lib/notify';

type RegistrationType = 'manager' | 'analyst';

type RegistrationRow = {
  id: string;
  name: string;
  email: string;
  type: string;
  requestedAt?: string | null;
  raw: unknown;
};

function usernameFromEmail(email: unknown) {
  const raw = String(email ?? '').trim();
  if (!raw) return '';
  const atIndex = raw.indexOf('@');
  if (atIndex <= 0) return raw;
  return raw.slice(0, atIndex).trim();
}

function normalizeRegistration(item: any, fallbackType: RegistrationType = 'analyst'): RegistrationRow | null {
  if (!item || typeof item !== 'object') return null;
  const id = String(item.user_id ?? item.userId ?? item.id ?? item.registration_id ?? item.registrationId ?? '').trim();
  if (!id) return null;
  const email = String(item.email ?? '').trim() || '—';
  const preferredUsername =
    usernameFromEmail(email) ||
    String(item.username ?? '').trim() ||
    String(item.name ?? item.full_name ?? item.fullName ?? '').trim();
  const name = preferredUsername || id;
  const typeRaw = String(
    item.user_type ?? item.userType ?? item.reg_type ?? item.type ?? item.role ?? fallbackType,
  )
    .trim()
    .toLowerCase();
  const type: RegistrationType = typeRaw === 'manager' ? 'manager' : 'analyst';
  const requestedAt = String(item.requested_at ?? item.requestedAt ?? item.created_at ?? item.createdAt ?? '') || null;
  return { id, name, email, type, requestedAt, raw: item };
}

function formatApiError(err: unknown) {
  if (err instanceof ApiError) {
    return `${err.message} — ${err.url}${err.bodyText ? `\n${err.bodyText}` : ''}`;
  }
  return err instanceof Error ? err.message : String(err);
}

function formatDateTime(value: unknown, locale: string) {
  const raw = String(value ?? '').trim();
  if (!raw) return locale === 'vi' ? 'Không có' : 'N/A';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return formatDateTimeVietnam(date, locale);
}

function formatStatusLabel(value: unknown, locale: string) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'pending') return locale === 'vi' ? 'Chờ duyệt' : 'Pending';
  if (normalized === 'approved') return locale === 'vi' ? 'Đã duyệt' : 'Approved';
  if (normalized === 'rejected') return locale === 'vi' ? 'Từ chối' : 'Rejected';
  return String(value ?? (locale === 'vi' ? 'Không có' : 'N/A'));
}

function statusBadgeClass(status: string) {
  if (status === 'approved') return 'border-emerald-300 bg-emerald-50 text-emerald-700';
  if (status === 'rejected') return 'border-red-300 bg-red-50 text-red-700';
  return 'border-amber-300 bg-amber-50 text-amber-800';
}

export default function AdminRegistrationsPage() {
  const PAGE_SIZE = 15;
  const { t, locale } = useI18n();
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [roleFilter, setRoleFilter] = useState<'all' | RegistrationType>('all');
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [details, setDetails] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [page, setPage] = useState(1);

  const extractList = (data: any) =>
    Array.isArray(data)
      ? data
      : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.value)
          ? data.value
          : [];

  const loadPending = async (status: 'pending' | 'approved' | 'rejected' = statusFilter) => {
    setIsLoading(true);
    try {
      const data = await browserApiFetchAuth<any>(`/auth/register/list?status_filter=${status}`, {
        method: 'GET',
      });

      const rows = extractList(data)
        .map((x: any) => normalizeRegistration(x))
        .filter(Boolean) as RegistrationRow[];

      const sorted = rows
        .sort((a, b) => {
          const ta = Date.parse(String(a.requestedAt || ''));
          const tb = Date.parse(String(b.requestedAt || ''));
          return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
        });
      setRegistrations(sorted);
    } catch (err) {
      notifyError(locale === 'vi' ? 'Không tải được danh sách đăng ký.' : 'Could not load registration list.', formatApiError(err));
      setRegistrations([]);
    } finally {
      setIsLoading(false);
    }
  };

  const openRegistrationDetails = async (regId: string) => {
    setIsLoading(true);
    setDetails(null);
    setSelectedId(regId);
    try {
      const data = await browserApiFetchAuth<any>(
        `/auth/register/registration/${encodeURIComponent(regId)}`,
        { method: 'GET' },
      );
      setDetails(data);
      setIsDetailsOpen(true);
    } catch (err) {
      notifyError(locale === 'vi' ? 'Không tải được chi tiết hồ sơ.' : 'Could not load registration details.', formatApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = (regId: string, actionType: 'approve' | 'reject') => {
    setSelectedId(regId);
    setAction(actionType);
    setRejectionReason('');
    setIsDialogOpen(true);
  };

  const confirmAction = async () => {
    if (!selectedId || !action) return;

    setIsLoading(true);
    try {
      const approved = action === 'approve';
      if (!approved && !rejectionReason.trim()) {
        notifyError(locale === 'vi' ? 'Vui lòng nhập lý do từ chối.' : 'Please provide a rejection reason.');
        setIsLoading(false);
        return;
      }
      await browserApiFetchAuth('/auth/register/approve', {
        method: 'POST',
        body: {
          registration_id: Number(selectedId),
          action: approved ? 'approve' : 'reject',
          rejection_reason: approved ? undefined : rejectionReason.trim(),
        },
      });

      setRegistrations((prev) =>
        prev.map((reg) =>
          reg.id === selectedId
            ? { ...reg, raw: { ...(reg.raw as any), status: approved ? 'approved' : 'rejected', rejection_reason: rejectionReason.trim() || null } }
            : reg,
        ),
      );
      await loadPending(statusFilter);
      setIsDialogOpen(false);
      setSelectedId(null);
      setAction(null);
      notifySuccess(
        approved
          ? (locale === 'vi' ? 'Đã duyệt hồ sơ thành công.' : 'Registration approved successfully.')
          : (locale === 'vi' ? 'Đã từ chối hồ sơ.' : 'Registration rejected.'),
      );
    } catch (err) {
      notifyError(locale === 'vi' ? 'Không thể cập nhật trạng thái hồ sơ.' : 'Could not update registration status.', formatApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPending(statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const filtered = useMemo(() => {
    const byRole = roleFilter === 'all'
      ? registrations
      : registrations.filter((r) => String(r.type).trim().toLowerCase() === roleFilter);

    if (!search.trim()) return byRole;
    const q = search.trim().toLowerCase();
    return byRole.filter((r) => (
      r.id.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q)
    ));
  }, [registrations, roleFilter, search]);
  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, registrations.length]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const selected = registrations.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-4 p-6 bg-[#f4f7fc]">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('admin.reg.title')}</h1>
        <p className="text-muted-foreground mt-2">{t('admin.reg.desc')}</p>
      </div>

      <Card className="border-border/80 bg-card shadow-sm">
        <CardHeader className="space-y-2 pb-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>{t('admin.reg.list_title')}</CardTitle>
              <CardDescription>
                {paged.length} / {filtered.length} {t('admin.reg.waiting')}
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => void loadPending()} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {t('common.refresh')}
            </Button>
          </div>

          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={roleFilter} onValueChange={(v: 'all' | RegistrationType) => setRoleFilter(v)}>
                <SelectTrigger className="h-8 w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.all')}</SelectItem>
                  <SelectItem value="manager">{t('role.manager')}</SelectItem>
                  <SelectItem value="analyst">{t('role.analyst')}</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant={statusFilter === 'pending' ? 'default' : 'outline'}
                className="h-8 min-w-[110px] justify-center"
                onClick={() => setStatusFilter('pending')}
              >
                {locale === 'vi' ? 'Chưa duyệt' : 'Pending'}
              </Button>
              <Button
                size="sm"
                variant={statusFilter === 'approved' ? 'default' : 'outline'}
                className="h-8 min-w-[110px] justify-center"
                onClick={() => setStatusFilter('approved')}
              >
                {locale === 'vi' ? 'Đã duyệt' : 'Approved'}
              </Button>
              <Button
                size="sm"
                variant={statusFilter === 'rejected' ? 'default' : 'outline'}
                className="h-8 min-w-[110px] justify-center"
                onClick={() => setStatusFilter('rejected')}
              >
                {locale === 'vi' ? 'Từ chối' : 'Rejected'}
              </Button>
            </div>

            <div className="w-full md:w-80">
              <Input placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {isLoading && registrations.length === 0 ? (
            <div className="text-center py-12">
              <Loader2 className="h-10 w-10 mx-auto mb-4 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">{t('common.loading')}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <p className="text-foreground font-medium">{t('admin.reg.none_title')}</p>
              <p className="text-muted-foreground mt-1">{t('admin.reg.none_desc')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-black/70 bg-white">
              <Table className="min-w-[760px] w-full">
                <TableHeader>
                  <TableRow className="bg-muted/35 hover:bg-muted/35">
                    <TableHead className="py-1.5">{t('common.name')}</TableHead>
                    <TableHead className="py-1.5">{t('common.email')}</TableHead>
                    <TableHead className="py-1.5">{t('admin.reg.type')}</TableHead>
                    <TableHead className="py-1.5">{t('admin.reg.requested')}</TableHead>
                    <TableHead className="py-1.5 text-right">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((reg) => (
                    <TableRow
                      key={reg.id}
                      className="cursor-pointer border-b border-black/15 hover:bg-muted/30"
                      onClick={() => void openRegistrationDetails(reg.id)}
                    >
                      <TableCell className="py-1.5 text-[12px] font-medium">{reg.name}</TableCell>
                      <TableCell className="py-1.5 text-[12px]">{reg.email}</TableCell>
                      <TableCell className="py-1.5">
                        <Badge variant="outline">{t(`role.${reg.type}`)}</Badge>
                      </TableCell>
                      <TableCell className="py-1.5 text-[12px] text-muted-foreground whitespace-nowrap">{reg.requestedAt || '—'}</TableCell>
                      <TableCell className="py-1.5 text-right">
                        {(() => {
                          const rowStatus = String((reg.raw as any)?.status ?? statusFilter).trim().toLowerCase();
                          return (
                            <div className="flex items-center justify-end gap-2 min-h-8">
                              <Badge variant="outline" className={statusBadgeClass(rowStatus)}>
                                {formatStatusLabel(rowStatus, locale)}
                              </Badge>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    disabled={isLoading}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void openRegistrationDetails(reg.id);
                                    }}
                                  >
                                    {locale === 'vi' ? 'Xem chi tiết' : 'View details'}
                                  </DropdownMenuItem>
                                  {rowStatus === 'pending' && (
                                    <>
                                      <DropdownMenuItem
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleAction(reg.id, 'approve');
                                        }}
                                        className="text-emerald-700 focus:text-emerald-800"
                                      >
                                        <CheckCircle className="mr-2 h-4 w-4" />
                                        {t('common.approve')}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleAction(reg.id, 'reject');
                                        }}
                                        className="text-red-600 focus:text-red-700"
                                      >
                                        <XCircle className="mr-2 h-4 w-4" />
                                        {t('common.reject')}
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          );
                        })()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {filtered.length > 0 && (
            <ListPagination page={page} totalPages={totalPages} onPageChange={setPage} />
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{action === 'approve' ? t('admin.reg.dialog_approve_title') : t('admin.reg.dialog_reject_title')}</DialogTitle>
            <DialogDescription>
              {selected ? (
                <>
                  {action === 'approve' ? (
                    <>
                      {t('admin.reg.dialog_approve_prefix')} {selected.name} {t('admin.reg.dialog_approve_mid')}{' '}
                      {t(`role.${selected.type}`)}?
                    </>
                  ) : (
                    <>
                      {t('admin.reg.dialog_reject_prefix')} {selected.name}?
                    </>
                  )}
                </>
              ) : (
                t('common.na')
              )}
            </DialogDescription>
          </DialogHeader>
          {action === 'reject' && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{locale === 'vi' ? 'Lý do từ chối' : 'Rejection reason'}</p>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder={locale === 'vi' ? 'Nhập lý do từ chối hồ sơ' : 'Enter rejection reason'}
                rows={3}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isLoading}>
              {t('common.cancel')}
            </Button>
            <Button variant={action === 'approve' ? 'default' : 'destructive'} onClick={confirmAction} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('common.working')}
                </>
              ) : action === 'approve' ? (
                t('common.approve')
              ) : (
                t('common.reject')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('admin.reg.details_title')}</DialogTitle>
            <DialogDescription>{t('admin.reg.details_desc')}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
            {[
              { label: locale === 'vi' ? 'Mã người dùng' : 'User ID', value: details?.user_id ?? details?.userId },
              {
                label: locale === 'vi' ? 'Tên đăng nhập' : 'Username',
                value:
                  usernameFromEmail(details?.email) ||
                  details?.username ||
                  details?.user_name ||
                  details?.userName,
              },
              { label: locale === 'vi' ? 'Họ và tên' : 'Full name', value: details?.full_name ?? details?.fullName },
              { label: 'Email', value: details?.email },
              { label: locale === 'vi' ? 'Số điện thoại' : 'Phone', value: details?.phone },
              { label: locale === 'vi' ? 'Loại người dùng' : 'User type', value: details?.user_type ?? details?.userType },
              { label: locale === 'vi' ? 'Trạng thái' : 'Status', value: formatStatusLabel(details?.status, locale) },
              { label: locale === 'vi' ? 'Thời gian tạo' : 'Created at', value: formatDateTime(details?.created_at ?? details?.createdAt, locale) },
              { label: locale === 'vi' ? 'Người duyệt' : 'Approved by', value: details?.approved_by_name ?? details?.approved_by ?? details?.approvedBy },
              { label: locale === 'vi' ? 'Thời gian duyệt' : 'Approved at', value: formatDateTime(details?.approved_at ?? details?.approvedAt, locale) },
              { label: locale === 'vi' ? 'Lý do từ chối' : 'Rejection reason', value: details?.rejection_reason ?? details?.rejectionReason },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border bg-secondary/40 p-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-sm font-medium break-words">
                  {String(item.value ?? (locale === 'vi' ? 'Không có' : 'N/A'))}
                </p>
              </div>
            ))}
          </div>
          <DialogFooter>
            {String(details?.status ?? '').trim().toLowerCase() === 'pending' && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => {
                    const targetId = String(details?.user_id ?? details?.userId ?? selectedId ?? '').trim();
                    if (!targetId) return;
                    setIsDetailsOpen(false);
                    handleAction(targetId, 'reject');
                  }}
                  disabled={isLoading}
                >
                  {t('common.reject')}
                </Button>
                <Button
                  onClick={() => {
                    const targetId = String(details?.user_id ?? details?.userId ?? selectedId ?? '').trim();
                    if (!targetId) return;
                    setIsDetailsOpen(false);
                    handleAction(targetId, 'approve');
                  }}
                  disabled={isLoading}
                >
                  {t('common.approve')}
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
