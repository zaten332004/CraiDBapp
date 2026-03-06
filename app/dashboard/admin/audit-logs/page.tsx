'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { browserApiFetchAuth } from '@/lib/api/browser';
import { ApiError } from '@/lib/api/shared';
import { useI18n } from '@/components/i18n-provider';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';

type AuditLogRow = {
  id: string;
  ts: string;
  actor: string;
  action: string;
  target: string;
  raw: unknown;
};

function formatApiError(err: unknown) {
  if (err instanceof ApiError) {
    return `${err.message} — ${err.url}${err.bodyText ? `\n${err.bodyText}` : ''}`;
  }
  return err instanceof Error ? err.message : String(err);
}

function normalizeAuditLog(item: any, idx: number): AuditLogRow {
  const id = String(item?.id ?? item?.log_id ?? item?.logId ?? idx);
  const ts =
    String(item?.timestamp ?? item?.ts ?? item?.created_at ?? item?.createdAt ?? item?.time ?? '').trim() ||
    '—';
  const actor = String(item?.actor ?? item?.user ?? item?.user_id ?? item?.userId ?? item?.email ?? '—');
  const action = String(item?.action ?? item?.event ?? item?.type ?? '—');
  const target = String(item?.target ?? item?.resource ?? item?.entity ?? item?.path ?? '—');
  return { id, ts, actor, action, target, raw: item };
}

export default function AdminAuditLogsPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await browserApiFetchAuth<any>('/admin/audit-logs', { method: 'GET' });
      const rawList = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.value)
            ? data.value
            : [];
      setRows(rawList.map(normalizeAuditLog));
    } catch (err) {
      setRows([]);
      setError(formatApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = `${r.id} ${r.ts} ${r.actor} ${r.action} ${r.target} ${JSON.stringify(r.raw)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query]);

  return (
    <div className="flex flex-col gap-8 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('admin.audit.title')}</h1>
          <p className="text-muted-foreground mt-2">{t('admin.audit.desc')}</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={isLoading}>
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

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <CardTitle>{t('admin.audit.list_title')}</CardTitle>
              <CardDescription>
                {t('common.showing')} {filtered.length} {t('admin.audit.items')}
              </CardDescription>
            </div>
            <div className="w-full md:w-96">
              <Input placeholder={t('common.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.date')}</TableHead>
                  <TableHead>{t('admin.audit.actor')}</TableHead>
                  <TableHead>{t('admin.audit.action')}</TableHead>
                  <TableHead>{t('admin.audit.target')}</TableHead>
                  <TableHead className="text-right">{t('common.view')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{r.ts}</TableCell>
                    <TableCell className="font-mono text-xs">{r.actor}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.action}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[36rem] truncate">{r.target}</TableCell>
                    <TableCell className="text-right">
                      <details>
                        <summary className="cursor-pointer text-sm text-accent">{t('admin.audit.details')}</summary>
                        <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
                          {JSON.stringify(r.raw, null, 2)}
                        </pre>
                      </details>
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

