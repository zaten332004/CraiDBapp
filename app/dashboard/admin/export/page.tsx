'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { browserApiFetchAuth } from '@/lib/api/browser';
import { useI18n } from '@/components/i18n-provider';
import { formatUserFacingApiError, type UserFacingLocale } from '@/lib/api/format-api-error';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Download, Loader2 } from 'lucide-react';

export default function AdminExportPage() {
  const { t, locale } = useI18n();
  const msgLocale: UserFacingLocale = locale === 'en' ? 'en' : 'vi';
  const [kind, setKind] = useState('users');
  const [format, setFormat] = useState<'json' | 'csv'>('csv');
  const [extraJson, setExtraJson] = useState('{\n  \n}');
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const parsedExtra = useMemo(() => {
    try {
      return extraJson.trim() ? JSON.parse(extraJson) : {};
    } catch {
      return null;
    }
  }, [extraJson]);

  const runExport = async () => {
    setIsLoading(true);
    setResult(null);
    try {
      if (parsedExtra === null) {
        notifyError(t('toast.export_failed'), { description: t('admin.export.invalid_json') });
        return;
      }

      const body = {
        kind,
        type: kind,
        format,
        file_name: fileName || undefined,
        fileName: fileName || undefined,
        ...(parsedExtra ?? {}),
      };
      const res = await browserApiFetchAuth<any>('/admin/export', { method: 'POST', body });
      setResult(res);
      const url = String(res?.url ?? res?.download_url ?? res?.downloadUrl ?? '').trim();
      if (url) {
        notifySuccess(t('toast.export_ready'), { description: url });
      }
    } catch (err) {
      notifyError(t('toast.export_failed'), { description: formatUserFacingApiError(err, msgLocale) });
    } finally {
      setIsLoading(false);
    }
  };

  const downloadUrl = String(result?.url ?? result?.download_url ?? result?.downloadUrl ?? '').trim() || null;

  return (
    <div className="motion-enter flex flex-col gap-5 p-4 sm:p-5 lg:p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('admin.export.title')}</h1>
        <p className="text-muted-foreground mt-2">{t('admin.export.desc')}</p>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.export.config_title')}</CardTitle>
            <CardDescription>{t('admin.export.config_desc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('admin.export.kind')}</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger>
                  <SelectValue placeholder={t('common.select')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="users">{t('admin.export.kind_users')}</SelectItem>
                  <SelectItem value="audit-logs">{t('admin.export.kind_audit')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('admin.export.format')}</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('common.select')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="export-file-name">{t('admin.export.file_name')}</Label>
              <Input
                id="export-file-name"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder={t('admin.export.file_name_ph')}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('admin.export.extra')}</Label>
              <Textarea
                value={extraJson}
                onChange={(e) => setExtraJson(e.target.value)}
                className="font-mono text-xs min-h-40"
                placeholder={`{\n  "from": "2026-01-01",\n  "to": "2026-01-31"\n}`}
              />
              {parsedExtra === null && (
                <p className="text-sm text-red-600">{t('admin.export.invalid_json')}</p>
              )}
            </div>

            <Button onClick={() => void runExport()} disabled={isLoading} className="w-full">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {t('admin.export.run')}
            </Button>
          </CardContent>
        </Card>

        <Card className="flex flex-col min-h-0">
          <CardHeader>
            <CardTitle>{t('common.result')}</CardTitle>
            <CardDescription>{t('admin.export.result_desc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 flex-1 min-h-0">
            {downloadUrl ? (
              <p className="text-sm text-muted-foreground">
                {t('admin.export.download_ready')}{' '}
                <a className="text-accent underline" href={downloadUrl} target="_blank" rel="noreferrer">
                  {downloadUrl}
                </a>
              </p>
            ) : null}

            <div className="rounded-md border bg-secondary p-3 flex-1 min-h-0">
              <pre className="max-h-[60vh] overflow-auto text-xs text-muted-foreground whitespace-pre-wrap">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
