'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, MoreHorizontal, Loader2, RefreshCw, AlertCircle, Download, Trash2, UserCheck, UserX } from 'lucide-react';
import { browserApiFetchAuth } from '@/lib/api/browser';
import { ApiError } from '@/lib/api/shared';
import { useI18n } from '@/components/i18n-provider';
import { ListPagination } from '@/components/list-pagination';
import { downloadCsvFile } from '@/lib/export/csv';
import { notifyError, notifySuccess } from '@/lib/notify';

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  raw: unknown;
};

function normalizeUser(item: any): AdminUser | null {
  if (!item || typeof item !== 'object') return null;
  const id = String(item.user_id ?? item.userId ?? item.id ?? '').trim();
  if (!id) return null;
  const name = String(item.name ?? item.full_name ?? item.fullName ?? item.username ?? id).trim();
  const email = String(item.email ?? '').trim() || '—';
  const role = String(item.role ?? item.user_role ?? item.userRole ?? '').trim().toLowerCase() || '—';
  const isActiveRaw = item.is_active ?? item.isActive ?? item.active ?? item.status;
  const isActive =
    typeof isActiveRaw === 'boolean'
      ? isActiveRaw
      : String(isActiveRaw ?? '').toLowerCase() === 'active' || String(isActiveRaw ?? '').toLowerCase() === 'true';
  return { id, name, email, role, isActive, raw: item };
}

function formatApiError(err: unknown) {
  if (err instanceof ApiError) {
    return `${err.message} — ${err.url}${err.bodyText ? `\n${err.bodyText}` : ''}`;
  }
  return err instanceof Error ? err.message : String(err);
}

function getRoleBadgeClass(role: string) {
  const normalized = String(role || '').toLowerCase();
  if (normalized === 'admin') return 'border-violet-300 bg-violet-50 text-violet-700';
  if (normalized === 'manager') return 'border-sky-300 bg-sky-50 text-sky-700';
  if (normalized === 'analyst') return 'border-indigo-300 bg-indigo-50 text-indigo-700';
  if (normalized === 'viewer') return 'border-slate-300 bg-slate-50 text-slate-700';
  return 'border-slate-300 bg-slate-50 text-slate-700';
}

function getStatusBadgeClass(isActive: boolean) {
  return isActive
    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
    : 'border-amber-300 bg-amber-50 text-amber-700';
}

export default function AdminUsersPage() {
  const PAGE_SIZE = 15;
  const { t, locale } = useI18n();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'all' | 'active' | 'inactive'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  const loadUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await browserApiFetchAuth<any>('/admin/users', { method: 'GET' });
      const rawList = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : Array.isArray(data?.value) ? data.value : [];
      const rows = rawList.map(normalizeUser).filter(Boolean) as AdminUser[];
      setUsers(rows);
    } catch (err) {
      setError(formatApiError(err));
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const searchUsers = async (rawQuery: string) => {
    const q = rawQuery.trim();
    if (!q) return loadUsers();

    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.includes('@')) params.set('name_contains', q); // best-effort; backend may ignore
      else params.set('name_contains', q);

      const data = await browserApiFetchAuth<any>(`/admin/users/search?${params.toString()}`, { method: 'GET' });
      const rawList = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : Array.isArray(data?.value) ? data.value : [];
      const rows = rawList.map(normalizeUser).filter(Boolean) as AdminUser[];
      setUsers(rows);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const setUserActive = async (userId: string, isActive: boolean) => {
    setIsLoading(true);
    setError(null);
    try {
      await browserApiFetchAuth(`/admin/users/${encodeURIComponent(userId)}/status?is_active=${isActive ? 'true' : 'false'}`, {
        method: 'PATCH',
      });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, isActive } : u)));
      setSelectedUser((prev) => (prev && prev.id === userId ? { ...prev, isActive } : prev));
      notifySuccess(
        isActive
          ? (locale === 'vi' ? 'Đã kích hoạt người dùng.' : 'User has been activated.')
          : (locale === 'vi' ? 'Đã vô hiệu hóa người dùng.' : 'User has been deactivated.'),
      );
    } catch (err) {
      const message = formatApiError(err);
      setError(message);
      notifyError(locale === 'vi' ? 'Không thể cập nhật trạng thái người dùng.' : 'Could not update user status.', message);
    } finally {
      setIsLoading(false);
    }
  };

  const setUserRole = async (userId: string, role: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await browserApiFetchAuth<{ role?: string }>(`/admin/users/${encodeURIComponent(userId)}/role`, {
        method: 'PATCH',
        body: { role },
      });
      const updatedRole = String(response?.role || role).toLowerCase();
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: updatedRole } : u)));
      setSelectedUser((prev) => (prev && prev.id === userId ? { ...prev, role: updatedRole } : prev));
      setSelectedRole(updatedRole);
      notifySuccess(locale === 'vi' ? 'Đã cập nhật vai trò người dùng.' : 'User role updated successfully.');
    } catch (err) {
      const message = formatApiError(err);
      setError(message);
      notifyError(locale === 'vi' ? 'Không thể cập nhật vai trò người dùng.' : 'Could not update user role.', message);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteUser = async (user: AdminUser) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await browserApiFetchAuth<{ message?: string }>(`/admin/users/${encodeURIComponent(user.id)}`, {
        method: 'DELETE',
      });
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setSelectedUser((prev) => (prev?.id === user.id ? null : prev));
      setDeleteTarget(null);
      notifySuccess(
        response?.message ||
          (locale === 'vi' ? `Đã xóa người dùng ${user.name}.` : `User ${user.name} was deleted successfully.`),
      );
    } catch (err) {
      const message = formatApiError(err);
      setError(message);
      notifyError(locale === 'vi' ? 'Không thể xóa người dùng.' : 'Could not delete user.', message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void searchUsers(query);
    }, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const filtered = useMemo(() => {
    if (scope === 'all') return users;
    if (scope === 'active') return users.filter((u) => u.isActive);
    return users.filter((u) => !u.isActive);
  }, [users, scope]);
  useEffect(() => {
    setPage(1);
  }, [query, scope, users.length]);
  useEffect(() => {
    setSelectedRole(selectedUser?.role ?? '');
  }, [selectedUser]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.isActive).length;
    const managers = filtered.filter((u) => u.role === 'manager').length;
    const analysts = filtered.filter((u) => u.role === 'analyst').length;
    return { total, active, managers, analysts };
  }, [users, filtered]);

  const roleLabel = (role: string) => {
    switch (role.toLowerCase()) {
      case 'manager':
        return t('role.manager');
      case 'analyst':
        return t('role.analyst');
      case 'admin':
        return t('role.admin');
      case 'viewer':
        return t('role.viewer');
      default:
        return role;
    }
  };

  const handleExportCsv = () => {
    downloadCsvFile(
      'admin-users',
      [
        t('common.name'),
        t('common.email'),
        t('common.role'),
        t('common.status'),
        'ID',
      ],
      filtered.map((user) => [
        user.name,
        user.email,
        roleLabel(user.role),
        t(user.isActive ? 'status.active' : 'status.inactive'),
        user.id,
      ]),
    );
  };

  const detailRows = useMemo(() => {
    if (!selectedUser) return [];
    const raw = (selectedUser.raw ?? {}) as Record<string, any>;
    return [
      { label: 'ID', value: selectedUser.id },
      { label: t('common.name'), value: selectedUser.name },
      { label: t('common.email'), value: selectedUser.email },
      { label: t('common.role'), value: roleLabel(selectedUser.role) },
      { label: t('common.status'), value: t(selectedUser.isActive ? 'status.active' : 'status.inactive') },
      { label: 'Username', value: raw.username ?? raw.user_name ?? '—' },
      { label: 'Created at', value: String(raw.created_at ?? raw.createdAt ?? '—') },
    ];
  }, [selectedUser, t]);

  return (
    <div className="flex flex-col gap-6 p-6 bg-[#f4f7fc]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('admin.users.title')}</h1>
          <p className="text-muted-foreground mt-2">{t('admin.users.desc')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleExportCsv} aria-label="Export CSV">
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => void loadUsers()} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {t('common.refresh')}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="whitespace-pre-wrap">{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { titleKey: 'admin.users.total', count: stats.total },
          { titleKey: 'common.active', count: stats.active },
          { titleKey: 'admin.users.managers', count: stats.managers },
          { titleKey: 'admin.users.analysts', count: stats.analysts },
        ].map((stat, idx) => (
          <Card key={idx}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t(stat.titleKey)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.count}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/80 bg-card shadow-sm">
        <CardHeader className="space-y-3 pb-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <CardTitle>{t('admin.users.list_title')}</CardTitle>
              <CardDescription>
                {t('common.showing')} {filtered.length} {t('admin.users.items')}
              </CardDescription>
            </div>

            <div className="w-full md:w-80">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('admin.users.search_ph')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <Tabs value={scope} onValueChange={(v) => setScope(v as any)}>
              <TabsList>
                <TabsTrigger value="all">{t('common.all')}</TabsTrigger>
                <TabsTrigger value="active">{t('common.active')}</TabsTrigger>
                <TabsTrigger value="inactive">{t('common.inactive')}</TabsTrigger>
              </TabsList>
              <TabsContent value="all" />
              <TabsContent value="active" />
              <TabsContent value="inactive" />
            </Tabs>

            <div />
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="overflow-x-auto rounded-xl border border-black/70 bg-white">
            <Table className="min-w-[820px] w-full">
              <TableHeader>
                <TableRow className="bg-muted/35 hover:bg-muted/35">
                  <TableHead className="py-1.5">{t('common.name')}</TableHead>
                  <TableHead className="py-1.5">{t('common.email')}</TableHead>
                  <TableHead className="py-1.5">{t('common.role')}</TableHead>
                  <TableHead className="py-1.5">{t('common.status')}</TableHead>
                  <TableHead className="py-1.5 text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((user) => (
                  <TableRow
                    key={user.id}
                    className="cursor-pointer border-b border-black/15 hover:bg-muted/30"
                    onClick={() => setSelectedUser(user)}
                  >
                    <TableCell className="py-1.5 font-medium">
                      <div className="flex flex-col">
                        <span>{user.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">{user.id}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-1.5">{user.email}</TableCell>
                    <TableCell className="py-1.5">
                      <Badge variant="outline" className={getRoleBadgeClass(user.role)}>
                        {roleLabel(user.role)}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Badge variant="outline" className={getStatusBadgeClass(user.isActive)}>
                        {t(user.isActive ? 'status.active' : 'status.inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-1.5 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5"
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
                              void setUserActive(user.id, !user.isActive);
                            }}
                            className={!user.isActive ? 'text-green-700' : 'text-red-600'}
                          >
                            {user.isActive ? (
                              <UserX className="mr-2 h-4 w-4" />
                            ) : (
                              <UserCheck className="mr-2 h-4 w-4" />
                            )}
                            {user.isActive ? t('admin.users.deactivate') : t('admin.users.activate')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(user);
                            }}
                            className="text-red-600 focus:text-red-700"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {locale === 'vi' ? 'Xóa người dùng' : 'Delete user'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}

                {paged.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      {isLoading ? t('common.loading') : t('common.no_results')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="mt-1">
            <ListPagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedUser)} onOpenChange={(open) => { if (!open) setSelectedUser(null); }}>
        <DialogContent className="!w-[94vw] !max-w-[1150px] max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{t('admin.users.list_title')} - {selectedUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[68vh] overflow-y-auto pr-1">
            {detailRows.map((item) => (
              <div key={item.label} className="rounded-lg border bg-secondary/40 p-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-sm font-medium break-words">{String(item.value ?? '—')}</p>
              </div>
            ))}
          </div>
          <DialogFooter>
            {selectedUser ? (
              <div className="mr-auto flex items-center gap-2">
                <Select value={selectedRole || selectedUser.role} onValueChange={setSelectedRole}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder={t('common.role')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">{t('role.admin')}</SelectItem>
                    <SelectItem value="manager">{t('role.manager')}</SelectItem>
                    <SelectItem value="analyst">{t('role.analyst')}</SelectItem>
                    <SelectItem value="viewer">{t('role.viewer')}</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  className="min-w-[140px]"
                  onClick={() => void setUserRole(selectedUser.id, selectedRole || selectedUser.role)}
                  disabled={isLoading || !(selectedRole || selectedUser.role) || (selectedRole || selectedUser.role) === selectedUser.role}
                >
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {t('common.save_changes')}
                </Button>
              </div>
            ) : null}
            {selectedUser ? (
              <Button
                variant={selectedUser.isActive ? 'destructive' : 'default'}
                onClick={() => void setUserActive(selectedUser.id, !selectedUser.isActive)}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {selectedUser.isActive ? t('admin.users.deactivate') : t('admin.users.activate')}
              </Button>
            ) : null}
            {selectedUser ? (
              <Button
                variant="destructive"
                onClick={() => setDeleteTarget(selectedUser)}
                disabled={isLoading}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {locale === 'vi' ? 'Xóa người dùng' : 'Delete user'}
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setSelectedUser(null)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{locale === 'vi' ? 'Xác nhận xóa người dùng' : 'Confirm user deletion'}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {locale === 'vi'
              ? `Bạn có chắc chắn muốn xóa tài khoản "${deleteTarget?.name ?? ''}" (${deleteTarget?.email ?? ''})? Hành động này không thể hoàn tác.`
              : `Are you sure you want to delete "${deleteTarget?.name ?? ''}" (${deleteTarget?.email ?? ''})? This action cannot be undone.`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isLoading}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => { if (deleteTarget) void deleteUser(deleteTarget); }}
              disabled={isLoading || !deleteTarget}
            >
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              {locale === 'vi' ? 'Xóa vĩnh viễn' : 'Delete permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
