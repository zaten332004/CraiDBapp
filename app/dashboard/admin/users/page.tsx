'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, MoreHorizontal, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { browserApiFetchAuth } from '@/lib/api/browser';
import { ApiError } from '@/lib/api/shared';
import { useI18n } from '@/components/i18n-provider';

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

export default function AdminUsersPage() {
  const { t } = useI18n();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'all' | 'active' | 'inactive'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const searchUsers = async () => {
    const q = query.trim();
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
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (scope === 'all') return users;
    if (scope === 'active') return users.filter((u) => u.isActive);
    return users.filter((u) => !u.isActive);
  }, [users, scope]);

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.isActive).length;
    const managers = users.filter((u) => u.role === 'manager').length;
    const analysts = users.filter((u) => u.role === 'analyst').length;
    return { total, active, managers, analysts };
  }, [users]);

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

  return (
    <div className="flex flex-col gap-8 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('admin.users.title')}</h1>
          <p className="text-muted-foreground mt-2">{t('admin.users.desc')}</p>
        </div>
        <Button variant="outline" onClick={() => void loadUsers()} disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          {t('common.refresh')}
        </Button>
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

      <Card>
        <CardHeader className="space-y-4">
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void searchUsers();
                  }}
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

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void searchUsers()} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t('common.search')}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setQuery('');
                  void loadUsers();
                }}
                disabled={isLoading}
              >
                {t('common.reset')}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.name')}</TableHead>
                  <TableHead>{t('common.email')}</TableHead>
                  <TableHead>{t('common.role')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{user.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">{user.id}</span>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{roleLabel(user.role)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? 'secondary' : 'outline'}>{t(user.isActive ? 'status.active' : 'status.inactive')}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" disabled={isLoading}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => void setUserActive(user.id, !user.isActive)}
                            className={!user.isActive ? 'text-green-700' : 'text-red-600'}
                          >
                            {user.isActive ? t('admin.users.deactivate') : t('admin.users.activate')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}

                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      {isLoading ? t('common.loading') : t('common.no_results')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
