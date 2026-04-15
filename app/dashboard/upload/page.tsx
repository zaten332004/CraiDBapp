'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Upload, CheckCircle, AlertCircle, File, Loader2, Trash2 } from 'lucide-react';
import { authHeaders, getAccessToken, getUserRole } from '@/lib/auth/token';
import { useI18n } from '@/components/i18n-provider';
import { browserApiFetchAuth } from '@/lib/api/browser';
import { ApiError } from '@/lib/api/shared';
import { formatUserFacingApiError, formatUserFacingFetchError, type UserFacingLocale } from '@/lib/api/format-api-error';
import { notifyError, notifySuccess } from '@/lib/notify';
import { CRAIDB_UPLOAD_COMPLETED_EVENT } from '@/lib/profile-sync-event';
import { formatDateTimeVietnam } from '@/lib/datetime';
import { rowNavigationPointerHandlers } from '@/lib/ui/row-navigation-click';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollableListRegion, ScrollableTableRegion, scrollableTableHeaderRowClass } from '@/components/scrollable-table-region';

function normalizeJobErrorRow(item: any) {
  let msg = item?.message ?? item?.error_message ?? item?.reason ?? item?.error;
  if (msg == null || String(msg).trim() === '') {
    const d = item?.detail;
    if (d != null) msg = typeof d === 'string' ? d : JSON.stringify(d);
  }
  return {
    row_number: item?.row ?? item?.row_number ?? item?.line,
    error_message: String(msg ?? '').trim() || '—',
    customer_name: item?.customer_name ?? item?.full_name,
    email: item?.email,
  };
}

export default function UploadPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const msgLocale: UserFacingLocale = locale === 'en' ? 'en' : 'vi';
  const apiErr = (err: unknown) => formatUserFacingApiError(err, msgLocale);
  const role = getUserRole();
  const isViewer = role === 'viewer';
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [importErrors, setImportErrors] = useState<Array<Record<string, any>>>([]);
  const [isLoadingErrors, setIsLoadingErrors] = useState(false);
  const [uploadHistory, setUploadHistory] = useState<Array<{
    audit_id: number;
    job_id?: string | null;
    file_name?: string | null;
    status: string;
    success_count?: number | null;
    processed_count?: number | null;
    created_at: string;
  }>>([]);
  const [selectedHistoryAuditId, setSelectedHistoryAuditId] = useState<number | null>(null);
  const [historyFileDetail, setHistoryFileDetail] = useState<{
    jobId: string;
    fileName?: string | null;
    columns: string[];
    rows: Array<Record<string, any>>;
  } | null>(null);
  const [isLoadingFileDetail, setIsLoadingFileDetail] = useState(false);
  const [isFileDetailOpen, setIsFileDetailOpen] = useState(false);
  const [deletingAuditId, setDeletingAuditId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const getJsonWithAuthFallback = async <T,>(path: string): Promise<T> => {
    try {
      return await browserApiFetchAuth<T>(path, { method: 'GET' });
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 401) {
        throw err;
      }
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      const response = await fetch(`/api/v1${cleanPath}`, {
        method: 'GET',
        headers: authHeaders(),
        credentials: 'include',
      });
      if (!response.ok) {
        const bodyText = await response.text();
        throw new Error(formatUserFacingFetchError(response.status, bodyText, msgLocale));
      }
      return (await response.json()) as T;
    }
  };

  const deleteUploadHistoryWithAuthFallback = async (auditId: number): Promise<void> => {
    const url = `/api/v1/upload/history/${auditId}`;
    const fail = async (response: Response): Promise<never> => {
      const bodyText = await response.text();
      throw new Error(formatUserFacingFetchError(response.status, bodyText, msgLocale));
    };
    const token = getAccessToken();
    let response = await fetch(url, {
      method: 'DELETE',
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}) },
      credentials: 'include',
    });
    if (response.status === 401 && token) {
      response = await fetch(url, {
        method: 'DELETE',
        headers: authHeaders(),
        credentials: 'include',
      });
    }
    if (!response.ok) await fail(response);
  };

  const derivedJobId = String(uploadResult?.job_id ?? uploadResult?.jobId ?? '').trim();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    if (isViewer) return;

    setIsUploading(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/v1/upload/data', {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      });

      if (!response.ok) {
        const bodyText = await response.text();
        throw new Error(formatUserFacingFetchError(response.status, bodyText, msgLocale));
      }

      const data = await response.json();
      setUploadResult(data);
      setFile(null);
      setUploadProgress(100);
      window.dispatchEvent(new Event(CRAIDB_UPLOAD_COMPLETED_EVENT));
      const proc = Number(data?.processed_count ?? data?.import_summary?.processed_count ?? 0);
      const okc = Number(data?.success_count ?? data?.import_summary?.success_count ?? 0);
      const badc = Number(data?.error_count ?? data?.import_summary?.error_count ?? 0);
      notifySuccess(t('upload.upload_file'), {
        details: [
          `File: ${file.name}`,
          `Size: ${(file.size / 1024 / 1024).toFixed(2)} MB`,
          String(data?.job_id ?? data?.jobId ?? '').trim() ? `Job ID: ${String(data?.job_id ?? data?.jobId ?? '').trim()}` : '',
          proc ? `${t('common.processed')}: ${proc}` : '',
          `${t('common.successful')}: ${okc}`,
          `${t('common.failed')}: ${badc}`,
        ].filter(Boolean),
      });

      // Reset after 2 seconds
      setTimeout(() => {
        setUploadProgress(0);
        setIsUploading(false);
      }, 2000);
    } catch (error) {
      notifyError(t('toast.upload_import_failed'), {
        description: apiErr(error),
        details: [
          `File: ${file?.name || '-'}`,
          `Size: ${file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : '-'}`,
        ],
      });
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const loadAllImportErrors = async (jobIdValue: string) => {
    const clean = jobIdValue.trim();
    if (!clean) return;
    setIsLoadingErrors(true);
    try {
      const firstPage = await getJsonWithAuthFallback<any>(`/jobs/${encodeURIComponent(clean)}/errors?offset=0`);
      const total = Number(firstPage?.total_errors ?? firstPage?.total ?? 0);
      const firstItems = Array.isArray(firstPage?.errors)
        ? firstPage.errors
        : Array.isArray(firstPage?.items)
          ? firstPage.items
          : [];
      if (total <= firstItems.length || total === 0) {
        setImportErrors(firstItems.map((item: any) => normalizeJobErrorRow(item)));
        return;
      }
      const pageSize = Number(firstPage?.limit || firstItems.length || 200);
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const requests = [];
      for (let page = 1; page < totalPages; page += 1) {
        const offset = page * pageSize;
        requests.push(getJsonWithAuthFallback<any>(`/jobs/${encodeURIComponent(clean)}/errors?offset=${offset}`));
      }
      const rest = await Promise.all(requests);
      const merged = [...firstItems].map((item: any) => normalizeJobErrorRow(item));
      for (const pageData of rest) {
        const rows = Array.isArray(pageData?.errors)
          ? pageData.errors
          : Array.isArray(pageData?.items)
            ? pageData.items
            : [];
        merged.push(...rows.map((item: any) => normalizeJobErrorRow(item)));
      }
      setImportErrors(merged);
    } catch (err) {
      notifyError(t('toast.load_failed'), { description: apiErr(err) });
    } finally {
      setIsLoadingErrors(false);
    }
  };

  useEffect(() => {
    const currentJobId = String(uploadResult?.job_id ?? uploadResult?.jobId ?? '').trim();
    const totalErrors = Number(uploadResult?.error_count ?? uploadResult?.import_summary?.error_count ?? 0);
    if (!currentJobId) return;
    if (totalErrors <= 0) {
      setImportErrors([]);
      return;
    }
    void loadAllImportErrors(currentJobId);
  }, [uploadResult]);

  useEffect(() => {
    let cancelled = false;
    const loadHistory = async () => {
      try {
        const rows = await getJsonWithAuthFallback<any[]>('/upload/history?limit=5');
        if (cancelled) return;
        setUploadHistory(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancelled) setUploadHistory([]);
      }
    };
    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [uploadResult]);

  const handleDeleteUploadHistory = async (item: (typeof uploadHistory)[number]) => {
    if (isViewer) return;
    setDeletingAuditId(item.audit_id);
    try {
      await deleteUploadHistoryWithAuthFallback(item.audit_id);
      setUploadHistory((prev) => prev.filter((x) => x.audit_id !== item.audit_id));
      if (selectedHistoryAuditId === item.audit_id) {
        setSelectedHistoryAuditId(null);
        setIsFileDetailOpen(false);
        setHistoryFileDetail(null);
      }
      notifySuccess(t('upload.history_deleted'));
    } catch (err) {
      notifyError(t('upload.history_delete_failed'), { description: apiErr(err) });
    } finally {
      setDeletingAuditId(null);
    }
  };

  const getCountsByDuplicateType = () => {
    const counts = { duplicateId: 0, duplicateEmail: 0, duplicateName: 0 };
    for (const item of importErrors) {
      const msg = String(item.error_message ?? '').toLowerCase();
      if (
        msg.includes('trùng id') ||
        msg.includes('trùng mã khách hàng') ||
        msg.includes('duplicate id') ||
        msg.includes('duplicate key') ||
        /unique.*(id|customer|reference)/i.test(msg)
      ) {
        counts.duplicateId += 1;
      }
      if (msg.includes('trùng email') || msg.includes('duplicate email') || msg.includes('email already')) {
        counts.duplicateEmail += 1;
      }
      if (
        msg.includes('trùng tên') ||
        msg.includes('duplicate name') ||
        msg.includes('duplicate full name')
      ) {
        counts.duplicateName += 1;
      }
    }
    return counts;
  };

  const checkJob = async (id: string) => {
    const clean = id.trim();
    if (!clean) return;
    void loadAllImportErrors(clean);
  };

  const loadFileDetailByJobId = async (jobIdValue: string, fileName?: string | null) => {
    const clean = String(jobIdValue || '').trim();
    if (!clean) return;
    setIsLoadingFileDetail(true);
    try {
      const first = await getJsonWithAuthFallback<any>(`/jobs/${encodeURIComponent(clean)}/content?offset=0&limit=500`);
      const columns = Array.isArray(first?.columns) ? first.columns : [];
      const mergedRows: Array<Record<string, any>> = Array.isArray(first?.rows) ? first.rows : [];
      let offset = Number(first?.offset || 0) + Number(first?.limit || mergedRows.length || 500);
      let hasMore = Boolean(first?.has_more);

      while (hasMore) {
        const next = await getJsonWithAuthFallback<any>(`/jobs/${encodeURIComponent(clean)}/content?offset=${offset}&limit=500`);
        const nextRows = Array.isArray(next?.rows) ? next.rows : [];
        mergedRows.push(...nextRows);
        hasMore = Boolean(next?.has_more);
        offset += Number(next?.limit || nextRows.length || 500);
      }

      // Ensure no column is lost: merge declared columns with actual row keys.
      const mergedColumns: string[] = [...columns];
      const seen = new Set(mergedColumns);
      for (const row of mergedRows) {
        if (!row || typeof row !== 'object') continue;
        for (const key of Object.keys(row)) {
          const normalizedKey = String(key || '').trim();
          if (!normalizedKey || seen.has(normalizedKey)) continue;
          seen.add(normalizedKey);
          mergedColumns.push(normalizedKey);
        }
      }

      setHistoryFileDetail({
        jobId: clean,
        fileName: fileName || first?.file_name || null,
        columns: mergedColumns,
        rows: mergedRows,
      });
    } catch (err) {
      setHistoryFileDetail(null);
      notifyError(t('toast.load_failed'), { description: apiErr(err) });
    } finally {
      setIsLoadingFileDetail(false);
    }
  };

  const summary = {
    totalRows: Number(uploadResult?.processed_count ?? uploadResult?.import_summary?.processed_count ?? 0),
    successRows: Number(uploadResult?.success_count ?? uploadResult?.import_summary?.success_count ?? 0),
    failedRows: Number(uploadResult?.error_count ?? uploadResult?.import_summary?.error_count ?? 0),
  };
  const duplicateCounts = getCountsByDuplicateType();

  return (
    <div className="flex flex-col gap-6 lg:gap-8 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('upload.title')}</h1>
          <Button type="button" variant="outline" size="sm" className="gap-2 shrink-0" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t('upload.back')}
          </Button>
        </div>
        <p className="text-muted-foreground mt-2">
          {t('upload.desc')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Upload Area */}
        <div className="lg:col-span-2 space-y-6">
          {isViewer && (
            <div className="rounded-lg border border-border/80 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              {t('upload.viewer_notice_prefix')}{' '}
              <span className="font-medium text-foreground">{t('role.viewer')}</span>. {t('upload.viewer_notice_suffix')}
            </div>
          )}
          <Card>
            <CardHeader>
              <CardTitle>{t('upload.card_title')}</CardTitle>
              <CardDescription>
                {t('upload.card_desc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                  isDragging ? 'border-accent bg-accent/10' : 'border-border hover:border-accent'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  id="file-upload"
                  onChange={handleFileChange}
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  disabled={isUploading || isViewer}
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium">
                    {file ? file.name : t('upload.drop_prompt')}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {t('upload.drop_meta')}
                  </p>
                </label>
              </div>

              {file && (
                <div className="mt-6 space-y-4">
                  <div className="bg-secondary p-4 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <File className="h-5 w-5 text-accent" />
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                    onClick={() => setFile(null)}
                    disabled={isUploading}
                  >
                      {t('common.remove')}
                    </Button>
                  </div>

                  {isUploading && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{t('common.uploading')}</span>
                        <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
                      </div>
                      <Progress value={uploadProgress} />
                    </div>
                  )}

                  <Button
                    onClick={handleUpload}
                    disabled={isUploading || isViewer}
                    className="w-full"
                    size="lg"
                  >
                    {isUploading ? t('common.uploading') : t('upload.upload_file')}
                  </Button>
                </div>
              )}

            </CardContent>
          </Card>

          {/* Import Summary */}
          <Card>
            <CardHeader>
              <CardTitle>{t('upload.import_result_title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border bg-secondary p-3 text-sm">
                <p>
                  {t('upload.total_rows')}: <span className="font-semibold">{summary.totalRows}</span>
                </p>
                <p>
                  {t('upload.success_rows')}: <span className="font-semibold text-emerald-700">{summary.successRows}</span>
                </p>
                <p>
                  {t('upload.failed_rows')}: <span className="font-semibold text-rose-700">{summary.failedRows}</span>
                </p>
              </div>
              <div className="rounded-md border bg-secondary p-3 text-sm">
                <p>
                  {t('upload.fail_duplicate_id')}: <span className="font-semibold text-rose-700">{duplicateCounts.duplicateId}</span>
                </p>
                <p>
                  {t('upload.fail_duplicate_email')}: <span className="font-semibold text-rose-700">{duplicateCounts.duplicateEmail}</span>
                </p>
                <p>
                  {t('upload.fail_duplicate_name')}: <span className="font-semibold text-rose-700">{duplicateCounts.duplicateName}</span>
                </p>
                <p className="mt-2 text-muted-foreground text-xs">{t('upload.fail_other_note')}</p>
              </div>

              {isLoadingErrors && summary.failedRows > 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('upload.loading_row_errors')}
                </div>
              ) : null}

              {!isLoadingErrors && summary.failedRows > 0 && importErrors.length === 0 && derivedJobId ? (
                <p className="text-sm text-muted-foreground">
                  {t('upload.errors_list_failed')
                    .replace('{count}', String(summary.failedRows))
                    .replace('{job}', String(derivedJobId))}
                </p>
              ) : null}

              {importErrors.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{t('upload.row_errors_title')}</p>
                  <ScrollableTableRegion className="max-h-[min(52vh,22rem)] rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow className={scrollableTableHeaderRowClass}>
                          <TableHead className="w-16">{t('upload.col_row')}</TableHead>
                          <TableHead>{t('upload.col_name_email')}</TableHead>
                          <TableHead>{t('upload.col_reason')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importErrors.map((row, idx) => (
                          <TableRow key={`${row.row_number ?? idx}-${idx}`}>
                            <TableCell className="tabular-nums text-muted-foreground">
                              {row.row_number != null ? row.row_number : '—'}
                            </TableCell>
                            <TableCell className="text-sm">
                              <div className="font-medium">{String(row.customer_name || '—')}</div>
                              <div className="text-xs text-muted-foreground">{String(row.email || '')}</div>
                            </TableCell>
                            <TableCell className="text-sm whitespace-pre-wrap break-words max-w-[480px]">
                              {String(row.error_message || '—')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollableTableRegion>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {/* History Sidebar */}
        <Card>
          <CardHeader>
            <CardTitle>{t('upload.history_title')}</CardTitle>
            <CardDescription>{t('upload.history_recent_count')}</CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-col space-y-3">
            {uploadHistory.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('upload.no_history')}</p>
            ) : (
              <ScrollableListRegion className="max-h-[min(72vh,30rem)] border-border/80 bg-muted/20 p-2 shadow-none">
                <div className="space-y-3 pr-1">
                  {uploadHistory.map((item) => (
                    <div
                      key={item.audit_id}
                      className={`border border-border rounded-lg bg-card p-3 space-y-2 cursor-pointer transition-colors hover:bg-muted/30 ${
                        selectedHistoryAuditId === item.audit_id ? 'bg-muted/30 border-accent/40' : ''
                      }`}
                      {...rowNavigationPointerHandlers(() => {
                        setSelectedHistoryAuditId(item.audit_id);
                        if (item.job_id) {
                          setIsFileDetailOpen(true);
                          void loadFileDetailByJobId(String(item.job_id), item.file_name || null);
                        }
                      })}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{item.file_name || '-'}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.status === 'completed' ? t('upload.import_status_ok') : t('upload.import_status_fail')}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {!isViewer ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              disabled={deletingAuditId === item.audit_id}
                              aria-label={t('upload.history_delete_aria')}
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleDeleteUploadHistory(item);
                              }}
                            >
                              {deletingAuditId === item.audit_id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                              )}
                            </Button>
                          ) : null}
                          <Badge variant="secondary" className="shrink-0">
                            {item.status === 'completed' ? <CheckCircle className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
                            {item.status === 'completed' ? t('common.done') : (t('common.error') || 'Lỗi')}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>
                          {Number(item.success_count || 0)} / {Number(item.processed_count || 0)} {t('common.records')}
                        </p>
                        <p>{formatDateTimeVietnam(item.created_at, locale)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollableListRegion>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isFileDetailOpen} onOpenChange={setIsFileDetailOpen}>
        <DialogContent className="!w-[98vw] !max-w-none h-[92vh] overflow-hidden p-0">
          <DialogHeader className="px-6 pt-5 pb-2">
            <DialogTitle>{t('upload.file_detail_title')}</DialogTitle>
            <DialogDescription>
              {historyFileDetail?.fileName
                ? `${historyFileDetail.fileName} (${historyFileDetail.rows.length} ${t('upload.rows_unit')}, ${historyFileDetail.columns.length} ${t('upload.columns_unit')})`
                : t('upload.file_detail_loading')}
            </DialogDescription>
          </DialogHeader>
          <div className="h-[calc(92vh-88px)] px-6 pb-5 overflow-hidden">
            {isLoadingFileDetail ? (
              <p className="text-sm text-muted-foreground">{t('upload.file_detail_loading')}</p>
            ) : historyFileDetail ? (
              <div className="h-full w-full rounded-md border border-border bg-muted/25 p-3 dark:bg-muted/35">
                <div className="h-full w-full overflow-scroll rounded-md border border-border bg-card">
                  <table className="w-max min-w-[1600px] table-fixed border-separate border-spacing-0 text-xs leading-5 text-foreground">
                    <colgroup>
                      <col className="w-[56px]" />
                      {historyFileDetail.columns.map((col) => (
                        <col key={`col-${col}`} className="w-[180px]" />
                      ))}
                    </colgroup>
                    <thead>
                      <tr>
                        <th className="sticky top-0 z-20 w-14 bg-muted px-2 py-2 text-left font-semibold shadow-[0_1px_0_0_var(--border)]">#</th>
                        {historyFileDetail.columns.map((col) => (
                          <th
                            key={col}
                            title={col}
                            className="sticky top-0 z-20 bg-muted px-2 py-2 text-left font-semibold shadow-[0_1px_0_0_var(--border)]"
                          >
                            <span className="block truncate">{col}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-card">
                      {historyFileDetail.rows.map((row, idx) => (
                        <tr key={`${idx}-${historyFileDetail.jobId}`} className="border-t border-border/80">
                          <td className="bg-card px-2 py-1.5 align-top text-muted-foreground">{idx + 1}</td>
                          {historyFileDetail.columns.map((col) => (
                            <td
                              key={`${idx}-${col}`}
                              title={row?.[col] == null ? '-' : String(row[col])}
                              className="bg-card px-2 py-1.5 align-top"
                            >
                              <span className="block truncate">{row?.[col] == null ? '-' : String(row[col])}</span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('upload.file_detail_empty')}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
