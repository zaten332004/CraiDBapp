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
import { CheckCircle, XCircle, Loader2, RefreshCw, MoreHorizontal, Copy } from 'lucide-react';
import { browserApiFetchAuth } from '@/lib/api/browser';
import { useI18n } from '@/components/i18n-provider';
import { formatUserFacingApiError, type UserFacingLocale } from '@/lib/api/format-api-error';
import { ListPagination } from '@/components/list-pagination';
import { formatDateTimeVietnam } from '@/lib/datetime';
import { notifyError, notifySuccess } from '@/lib/notify';
import { badgeTone } from '@/lib/dashboard-badge-tones';
import { rowNavigationPointerHandlers } from '@/lib/ui/row-navigation-click';
import { ScrollableTableRegion, scrollableTableHeaderRowClass } from '@/components/scrollable-table-region';
import {
  extractRegistrationList,
  normalizeRegistrationRow,
  usernameFromEmail,
  type RegistrationRow,
  type RegistrationType,
} from '@/lib/admin/registration-list';

type PinResetRequestRow = {
  userId: string;
  fullName: string;
  email: string;
  requestedAt: string | null;
};

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
  if (status === 'approved') return badgeTone.emerald;
  if (status === 'rejected') return badgeTone.rose;
  return badgeTone.amber;
}

function registrationRoleBadgeClass(type: string) {
  const n = String(type || '').toLowerCase();
  if (n === 'admin') return badgeTone.violet;
  if (n === 'manager') return badgeTone.sky;
  if (n === 'analyst') return badgeTone.indigo;
  return badgeTone.slate;
}

export default function AdminRegistrationsPage() {
  const PAGE_SIZE = 15;
  const { t, locale } = useI18n();
  const msgLocale: UserFacingLocale = locale === 'en' ? 'en' : 'vi';
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
  const [pinResetRequests, setPinResetRequests] = useState<PinResetRequestRow[]>([]);
  const [pinResetLoading, setPinResetLoading] = useState(false);
  const [pinResetDialogOpen, setPinResetDialogOpen] = useState(false);
  const [pinResetAction, setPinResetAction] = useState<'approve' | 'reject' | null>(null);
  const [pinResetTarget, setPinResetTarget] = useState<PinResetRequestRow | null>(null);
  const [pinResetPin, setPinResetPin] = useState('');
  const [pinResetReason, setPinResetReason] = useState('');

  const loadPending = async (status: 'pending' | 'approved' | 'rejected' = statusFilter) => {
    setIsLoading(true);
    try {
      const data = await browserApiFetchAuth<any>(`/auth/register/list?status_filter=${status}`, {
        method: 'GET',
      });

      const rows = extractRegistrationList(data)
        .map((x) => normalizeRegistrationRow(x))
        .filter(Boolean) as RegistrationRow[];

      const sorted = rows
        .sort((a, b) => {
          const ta = Date.parse(String(a.requestedAt || ''));
          const tb = Date.parse(String(b.requestedAt || ''));
          return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
        });
      setRegistrations(sorted);
    } catch (err) {
      notifyError(locale === 'vi' ? 'Không tải được danh sách đăng ký.' : 'Could not load registration list.', {
        description: formatUserFacingApiError(err, msgLocale),
      });
      setRegistrations([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPinResetRequests = async () => {
    setPinResetLoading(true);
    try {
      const data = await browserApiFetchAuth<any[]>('/admin/pin-reset-requests', { method: 'GET' });
      const rows = (Array.isArray(data) ? data : [])
        .map((item) => ({
          userId: String(item?.user_id ?? item?.userId ?? '').trim(),
          fullName: String(item?.full_name ?? item?.fullName ?? item?.name ?? '').trim() || '—',
          email: String(item?.email ?? '').trim() || '—',
          requestedAt: String(item?.requested_at ?? item?.requestedAt ?? '').trim() || null,
        }))
        .filter((item) => item.userId);
      setPinResetRequests(rows);
    } catch (err) {
      notifyError(locale === 'vi' ? 'Không tải được yêu cầu quên PIN.' : 'Could not load forgot-PIN requests.', {
        description: formatUserFacingApiError(err, msgLocale),
      });
      setPinResetRequests([]);
    } finally {
      setPinResetLoading(false);
    }
  };

  const openPinResetAction = (row: PinResetRequestRow, actionType: 'approve' | 'reject') => {
    setPinResetTarget(row);
    setPinResetAction(actionType);
    setPinResetPin('');
    setPinResetReason('');
    setPinResetDialogOpen(true);
  };

  const copyPinForManualShare = async () => {
    const normalized = pinResetPin.replace(/\D/g, '').slice(0, 6);
    if (normalized.length !== 6) {
      notifyError(locale === 'vi' ? 'Vui lòng nhập đủ 6 chữ số PIN trước khi copy.' : 'Enter exactly 6 digits before copying.');
      return;
    }
    try {
      await navigator.clipboard.writeText(normalized);
      notifySuccess(
        locale === 'vi' ? 'Đã copy PIN mới.' : 'New PIN copied.',
        locale === 'vi'
          ? 'Hãy gửi PIN này thủ công cho người dùng (chat/điện thoại).'
          : 'Send this PIN to the user manually (chat/phone).',
      );
    } catch {
      notifyError(locale === 'vi' ? 'Không thể copy PIN.' : 'Could not copy PIN.');
    }
  };

  const confirmPinResetAction = async () => {
    if (!pinResetTarget || !pinResetAction) return;
    if (pinResetAction === 'approve') {
      const normalized = pinResetPin.replace(/\D/g, '');
      if (normalized.length !== 6) {
        notifyError(locale === 'vi' ? 'PIN mới phải gồm đúng 6 chữ số.' : 'New PIN must be exactly 6 digits.');
        return;
      }
    }
    setPinResetLoading(true);
    try {
      const userId = encodeURIComponent(pinResetTarget.userId);
      if (pinResetAction === 'approve') {
        const issuedPin = pinResetPin.replace(/\D/g, '').slice(0, 6);
        await browserApiFetchAuth(`/admin/pin-reset-requests/${userId}/approve`, {
          method: 'POST',
          body: { pin: issuedPin },
        });
        notifySuccess(
          locale === 'vi' ? 'Đã duyệt và cấp PIN mới.' : 'Approved and issued a new PIN.',
          {
            details: [
              locale === 'vi'
                ? `PIN vừa cấp: ${issuedPin}`
                : `Issued PIN: ${issuedPin}`,
              locale === 'vi'
                ? 'Hãy gửi PIN này thủ công cho người dùng (chat/điện thoại).'
                : 'Send this PIN to the user manually (chat/phone).',
            ],
          },
        );
      } else {
        await browserApiFetchAuth(`/admin/pin-reset-requests/${userId}/reject`, {
          method: 'POST',
          body: { reason: pinResetReason.trim() || undefined },
        });
        notifySuccess(locale === 'vi' ? 'Đã từ chối yêu cầu quên PIN.' : 'Forgot-PIN request rejected.');
      }
      setPinResetDialogOpen(false);
      setPinResetTarget(null);
      setPinResetAction(null);
      setPinResetPin('');
      setPinResetReason('');
      await loadPinResetRequests();
    } catch (err) {
      notifyError(locale === 'vi' ? 'Không thể xử lý yêu cầu quên PIN.' : 'Could not process forgot-PIN request.', {
        description: formatUserFacingApiError(err, msgLocale),
      });
    } finally {
      setPinResetLoading(false);
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
      notifyError(locale === 'vi' ? 'Không tải được chi tiết hồ sơ.' : 'Could not load registration details.', {
        description: formatUserFacingApiError(err, msgLocale),
      });
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
      notifyError(locale === 'vi' ? 'Không thể cập nhật trạng thái hồ sơ.' : 'Could not update registration status.', {
        description: formatUserFacingApiError(err, msgLocale),
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPending(statusFilter);
    void loadPinResetRequests();
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
    <div className="motion-enter flex flex-col gap-4 bg-background p-4 sm:p-5 lg:p-6">
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
            <ScrollableTableRegion className="overflow-x-hidden">
              <Table className="w-full table-fixed text-xs">
                <colgroup>
                  <col className="w-[22%]" />
                  <col className="w-[26%]" />
                  <col className="w-[14%]" />
                  <col className="w-[20%]" />
                  <col className="w-[18%]" />
                </colgroup>
                <TableHeader>
                  <TableRow className={scrollableTableHeaderRowClass}>
                    <TableHead className="py-2 text-[12px] truncate">{t('common.name')}</TableHead>
                    <TableHead className="py-2 text-[12px] truncate">{t('common.email')}</TableHead>
                    <TableHead className="py-2 text-[12px] truncate">{t('admin.reg.type')}</TableHead>
                    <TableHead className="py-2 text-[12px] truncate">{t('admin.reg.requested')}</TableHead>
                    <TableHead className="py-2 text-[12px] truncate text-right">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((reg) => (
                    <TableRow
                      key={reg.id}
                      className="cursor-pointer border-b border-border/70 hover:bg-muted/35"
                      {...rowNavigationPointerHandlers(() => {
                        void openRegistrationDetails(reg.id);
                      })}
                    >
                      <TableCell className="py-2 text-[12px] font-medium">
                        <span className="block truncate" title={reg.name}>{reg.name}</span>
                      </TableCell>
                      <TableCell className="py-2 text-[12px]">
                        <span className="block truncate" title={reg.email}>{reg.email}</span>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge variant="outline" className={`text-[11px] ${registrationRoleBadgeClass(reg.type)}`}>
                          {t(`role.${reg.type}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 text-[12px] text-muted-foreground whitespace-nowrap">
                        <span className="block truncate" title={reg.requestedAt || '—'}>{reg.requestedAt || '—'}</span>
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        {(() => {
                          const rowStatus = String((reg.raw as any)?.status ?? statusFilter).trim().toLowerCase();
                          return (
                            <div className="flex items-center justify-end gap-2 min-h-8">
                              <Badge variant="outline" className={`text-[11px] ${statusBadgeClass(rowStatus)}`}>
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
            </ScrollableTableRegion>
          )}
          {filtered.length > 0 && (
            <ListPagination page={page} totalPages={totalPages} onPageChange={setPage} />
          )}
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card shadow-sm">
        <CardHeader className="space-y-2 pb-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>{locale === 'vi' ? 'Yêu cầu quên mã PIN' : 'Forgot PIN requests'}</CardTitle>
              <CardDescription>
                {locale === 'vi'
                  ? 'Người dùng yêu cầu admin cấp mã PIN mới. Duyệt và cấp PIN trực tiếp tại đây.'
                  : 'Users requested a new PIN. Review and issue a new PIN directly here.'}
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => void loadPinResetRequests()} disabled={pinResetLoading}>
              {pinResetLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {t('common.refresh')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {pinResetRequests.length === 0 ? (
            <div className="rounded-xl border border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
              {locale === 'vi' ? 'Không có yêu cầu quên PIN đang chờ.' : 'No pending forgot-PIN requests.'}
            </div>
          ) : (
            <ScrollableTableRegion className="overflow-x-hidden">
              <Table className="w-full table-fixed text-xs">
                <colgroup>
                  <col className="w-[28%]" />
                  <col className="w-[28%]" />
                  <col className="w-[24%]" />
                  <col className="w-[20%]" />
                </colgroup>
                <TableHeader>
                  <TableRow className={scrollableTableHeaderRowClass}>
                    <TableHead className="py-2 text-[12px] truncate">{locale === 'vi' ? 'Người dùng' : 'User'}</TableHead>
                    <TableHead className="py-2 text-[12px] truncate">{t('common.email')}</TableHead>
                    <TableHead className="py-2 text-[12px] truncate">{locale === 'vi' ? 'Thời gian yêu cầu' : 'Requested at'}</TableHead>
                    <TableHead className="py-2 text-[12px] truncate text-right">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pinResetRequests.map((row) => (
                    <TableRow key={row.userId} className="border-b border-border/70">
                      <TableCell className="py-2 text-[12px] font-medium">
                        <span className="block truncate" title={row.fullName}>{row.fullName}</span>
                        <span className="block truncate text-[11px] text-muted-foreground font-mono" title={`#${row.userId}`}>#{row.userId}</span>
                      </TableCell>
                      <TableCell className="py-2 text-[12px]">
                        <span className="block truncate" title={row.email}>{row.email}</span>
                      </TableCell>
                      <TableCell className="py-2 text-[12px] text-muted-foreground whitespace-nowrap">
                        <span className="block truncate" title={formatDateTime(row.requestedAt, locale)}>{formatDateTime(row.requestedAt, locale)}</span>
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Button
                            size="sm"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => openPinResetAction(row, 'approve')}
                            disabled={pinResetLoading}
                          >
                            {locale === 'vi' ? 'Duyệt & cấp PIN' : 'Approve & issue PIN'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => openPinResetAction(row, 'reject')}
                            disabled={pinResetLoading}
                          >
                            {t('common.reject')}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollableTableRegion>
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

      <Dialog open={pinResetDialogOpen} onOpenChange={setPinResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pinResetAction === 'approve'
                ? (locale === 'vi' ? 'Duyệt yêu cầu quên PIN' : 'Approve forgot-PIN request')
                : (locale === 'vi' ? 'Từ chối yêu cầu quên PIN' : 'Reject forgot-PIN request')}
            </DialogTitle>
            <DialogDescription>
              {pinResetTarget
                ? `${pinResetTarget.fullName} (${pinResetTarget.email})`
                : (locale === 'vi' ? 'Không có dữ liệu.' : 'No data available.')}
            </DialogDescription>
          </DialogHeader>
          {pinResetAction === 'approve' ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">{locale === 'vi' ? 'Mã PIN mới (6 số)' : 'New PIN (6 digits)'}</p>
              <div className="flex items-center gap-2">
                <Input
                  value={pinResetPin}
                  onChange={(e) => setPinResetPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder={locale === 'vi' ? 'Nhập PIN mới' : 'Enter new PIN'}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void copyPinForManualShare()}
                  disabled={pinResetLoading}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  {locale === 'vi' ? 'Copy PIN' : 'Copy PIN'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {locale === 'vi'
                  ? 'Sau khi duyệt, hãy gửi PIN này thủ công cho người dùng (chat/điện thoại).'
                  : 'After approval, send this PIN to the user manually (chat/phone).'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium">{locale === 'vi' ? 'Lý do từ chối (tuỳ chọn)' : 'Rejection reason (optional)'}</p>
              <Textarea
                value={pinResetReason}
                onChange={(e) => setPinResetReason(e.target.value)}
                placeholder={locale === 'vi' ? 'Nhập lý do từ chối' : 'Enter rejection reason'}
                rows={3}
              />
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPinResetDialogOpen(false);
                setPinResetTarget(null);
                setPinResetAction(null);
                setPinResetPin('');
                setPinResetReason('');
              }}
              disabled={pinResetLoading}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant={pinResetAction === 'approve' ? 'default' : 'destructive'}
              onClick={() => void confirmPinResetAction()}
              disabled={pinResetLoading}
            >
              {pinResetLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {pinResetAction === 'approve'
                ? (locale === 'vi' ? 'Duyệt & cấp PIN' : 'Approve & issue PIN')
                : t('common.reject')}
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
