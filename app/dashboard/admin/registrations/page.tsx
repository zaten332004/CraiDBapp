'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, XCircle, AlertCircle, Eye, Loader2, RefreshCw } from 'lucide-react';
import { browserApiFetchAuth } from '@/lib/api/browser';
import { ApiError } from '@/lib/api/shared';
import { useI18n } from '@/components/i18n-provider';

type RegistrationType = 'manager' | 'analyst';

type RegistrationRow = {
  id: string;
  name: string;
  email: string;
  type: string;
  company?: string | null;
  requestedAt?: string | null;
  raw: unknown;
};

function normalizeRegistration(item: any, fallbackType: RegistrationType): RegistrationRow | null {
  if (!item || typeof item !== 'object') return null;
  const id = String(item.user_id ?? item.userId ?? item.id ?? item.registration_id ?? item.registrationId ?? '').trim();
  if (!id) return null;
  const name = String(item.name ?? item.full_name ?? item.fullName ?? item.username ?? '').trim() || id;
  const email = String(item.email ?? '').trim() || '—';
  const type = String(item.reg_type ?? item.type ?? item.role ?? fallbackType).trim().toLowerCase() || fallbackType;
  const company = (item.company ?? item.org ?? item.organization ?? null) as string | null;
  const requestedAt = String(item.requested_at ?? item.requestedAt ?? item.created_at ?? item.createdAt ?? '') || null;
  return { id, name, email, type, company, requestedAt, raw: item };
}

function formatApiError(err: unknown) {
  if (err instanceof ApiError) {
    return `${err.message} — ${err.url}${err.bodyText ? `\n${err.bodyText}` : ''}`;
  }
  return err instanceof Error ? err.message : String(err);
}

export default function AdminRegistrationsPage() {
  const { t } = useI18n();
  const [regType, setRegType] = useState<RegistrationType>('manager');
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const loadPending = async (type: RegistrationType) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await browserApiFetchAuth<any>(`/auth/register/pending?reg_type=${encodeURIComponent(type)}`, {
        method: 'GET',
      });
      const rawList = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.value)
            ? data.value
            : [];
      const rows = rawList.map((x: any) => normalizeRegistration(x, type)).filter(Boolean) as RegistrationRow[];
      setRegistrations(rows);
    } catch (err) {
      setError(formatApiError(err));
      setRegistrations([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = (regId: string, actionType: 'approve' | 'reject') => {
    setSelectedId(regId);
    setAction(actionType);
    setIsDialogOpen(true);
  };

  const confirmAction = async () => {
    if (!selectedId || !action) return;

    setIsLoading(true);
    setError(null);
    try {
      const approved = action === 'approve';

      if (approved) {
        try {
          await browserApiFetchAuth('/auth/register/approve', {
            method: 'POST',
            body: { user_id: selectedId, userId: selectedId },
          });
        } catch (err) {
          if (err instanceof ApiError && (err.status === 404 || err.status === 405)) {
            await browserApiFetchAuth('/admin/manager-registrations/decision', {
              method: 'POST',
              body: { registration_id: selectedId, approved: true },
            });
          } else {
            throw err;
          }
        }
      } else {
        try {
          await browserApiFetchAuth('/auth/register/reject', {
            method: 'POST',
            body: { user_id: selectedId, userId: selectedId },
          });
        } catch (err) {
          if (err instanceof ApiError && (err.status === 404 || err.status === 405)) {
            await browserApiFetchAuth('/admin/manager-registrations/decision', {
              method: 'POST',
              body: { registration_id: selectedId, approved: false },
            });
          } else {
            throw err;
          }
        }
      }

      setRegistrations((prev) => prev.filter((reg) => reg.id !== selectedId));
      setIsDialogOpen(false);
      setSelectedId(null);
      setAction(null);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPending(regType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regType]);

  const filtered = useMemo(() => {
    if (!search.trim()) return registrations;
    const q = search.trim().toLowerCase();
    return registrations.filter((r) => {
      return (
        r.id.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        String(r.company ?? '').toLowerCase().includes(q)
      );
    });
  }, [registrations, search]);

  const selected = registrations.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-8 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('admin.reg.title')}</h1>
        <p className="text-muted-foreground mt-2">{t('admin.reg.desc')}</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="whitespace-pre-wrap">{error}</AlertDescription>
        </Alert>
      )}

      {registrations.length > 0 && !error && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t('admin.reg.pending_prefix')} {registrations.length} {t('admin.reg.pending_suffix')}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>{t('admin.reg.list_title')}</CardTitle>
              <CardDescription>
                {filtered.length} {t('admin.reg.waiting')}
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => void loadPending(regType)} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {t('common.refresh')}
            </Button>
          </div>

          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <Tabs value={regType} onValueChange={(v) => setRegType(v as RegistrationType)}>
              <TabsList>
                <TabsTrigger value="manager">{t('role.manager')}</TabsTrigger>
                <TabsTrigger value="analyst">{t('role.analyst')}</TabsTrigger>
              </TabsList>
              <TabsContent value="manager" />
              <TabsContent value="analyst" />
            </Tabs>

            <div className="w-full md:w-80">
              <Input placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>

        <CardContent>
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.name')}</TableHead>
                    <TableHead>{t('common.email')}</TableHead>
                    <TableHead>{t('admin.reg.type')}</TableHead>
                    <TableHead>{t('common.company')}</TableHead>
                    <TableHead>{t('admin.reg.requested')}</TableHead>
                    <TableHead className="text-right">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((reg) => (
                    <TableRow key={reg.id}>
                      <TableCell className="font-medium">{reg.name}</TableCell>
                      <TableCell>{reg.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{t(`role.${reg.type}`)}</Badge>
                      </TableCell>
                      <TableCell>{reg.company || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{reg.requestedAt || '—'}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            setIsLoading(true);
                            setError(null);
                            setDetails(null);
                            try {
                              const data = await browserApiFetchAuth<any>(
                                `/auth/register/registration/${encodeURIComponent(reg.id)}`,
                                { method: 'GET' },
                              );
                              setDetails(data);
                              setIsDetailsOpen(true);
                            } catch (err) {
                              setError(formatApiError(err));
                            } finally {
                              setIsLoading(false);
                            }
                          }}
                          disabled={isLoading}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          {t('common.view')}
                        </Button>
                        <Button size="sm" variant="default" onClick={() => handleAction(reg.id, 'approve')} disabled={isLoading}>
                          <CheckCircle className="h-4 w-4 mr-1" />
                          {t('common.approve')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleAction(reg.id, 'reject')}
                          disabled={isLoading}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          {t('common.reject')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
          <div className="rounded-md border bg-secondary p-3">
            <pre className="max-h-[60vh] overflow-auto text-xs text-muted-foreground whitespace-pre-wrap">
              {JSON.stringify(details, null, 2)}
            </pre>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
