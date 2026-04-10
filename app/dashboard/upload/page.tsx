'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, CheckCircle, AlertCircle, File, Loader2 } from 'lucide-react';
import { authHeaders } from '@/lib/auth/token';
import { getUserRole } from '@/lib/auth/token';
import { useI18n } from '@/components/i18n-provider';
import { browserApiFetchAuth } from '@/lib/api/browser';
import { ApiError } from '@/lib/api/shared';
import { formatUserFacingFetchError } from '@/lib/api/format-api-error';
import { notifyError, notifySuccess } from '@/lib/notify';
import { CRAIDB_UPLOAD_COMPLETED_EVENT } from '@/lib/profile-sync-event';
import { formatDateTimeVietnam } from '@/lib/datetime';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
  const { t, locale } = useI18n();
  const role = getUserRole();
  const isViewer = role === 'viewer';
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [jobError, setJobError] = useState<string | null>(null);
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const formatApiError = (err: unknown) => {
    if (err instanceof ApiError) {
      return `${err.message} — ${err.url}${err.bodyText ? `\n${err.bodyText}` : ''}`;
    }
    return err instanceof Error ? err.message : String(err);
  };

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
        throw new Error(formatUserFacingFetchError(response.status, bodyText));
      }
      return (await response.json()) as T;
    }
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
    setJobError(null);

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
        throw new Error(formatUserFacingFetchError(response.status, bodyText));
      }

      const data = await response.json();
      setUploadResult(data);
      setFile(null);
      setUploadProgress(100);
      window.dispatchEvent(new Event(CRAIDB_UPLOAD_COMPLETED_EVENT));
      notifySuccess(t('upload.upload_file'), {
        details: [
          `File: ${file.name}`,
          `Size: ${(file.size / 1024 / 1024).toFixed(2)} MB`,
          String(data?.job_id ?? data?.jobId ?? '').trim() ? `Job ID: ${String(data?.job_id ?? data?.jobId ?? '').trim()}` : '',
        ].filter(Boolean),
      });

      // Reset after 2 seconds
      setTimeout(() => {
        setUploadProgress(0);
        setIsUploading(false);
      }, 2000);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setJobError(message);
      notifyError(message, {
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
      setJobError(formatApiError(err));
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
    setJobError(null);
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
      setJobError(formatApiError(err));
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
    <div className="flex flex-col gap-8 p-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('upload.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('upload.desc')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upload Area */}
        <div className="lg:col-span-2 space-y-6">
          {isViewer && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t('upload.viewer_notice_prefix')}{' '}
                <span className="font-medium">{t('role.viewer')}</span>. {t('upload.viewer_notice_suffix')}
              </AlertDescription>
            </Alert>
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

              {uploadResult && (
                <Alert className="mt-6">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    {t('upload.success_prefix')} {uploadResult.records_processed || 0} {t('upload.success_suffix')}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Import Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Kết quả import</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border bg-secondary p-3 text-sm">
                <p>Tổng số dòng trong file: <span className="font-semibold">{summary.totalRows}</span></p>
                <p>Dòng import thành công: <span className="font-semibold text-emerald-700">{summary.successRows}</span></p>
                <p>Dòng import thất bại: <span className="font-semibold text-rose-700">{summary.failedRows}</span></p>
              </div>
              {jobError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="whitespace-pre-wrap">{jobError}</AlertDescription>
                </Alert>
              )}
              <div className="rounded-md border bg-secondary p-3 text-sm">
                <p>Thất bại do trùng ID: <span className="font-semibold text-rose-700">{duplicateCounts.duplicateId}</span></p>
                <p>Thất bại do trùng email: <span className="font-semibold text-rose-700">{duplicateCounts.duplicateEmail}</span></p>
                <p>Thất bại do trùng tên: <span className="font-semibold text-rose-700">{duplicateCounts.duplicateName}</span></p>
                <p className="mt-2 text-muted-foreground text-xs">
                  Các lỗi khác (thiếu cột, sai kiểu dữ liệu, vi phạm validation…) không nằm trong ba nhóm trên — xem bảng chi tiết bên dưới.
                </p>
              </div>

              {isLoadingErrors && summary.failedRows > 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang tải chi tiết lỗi từng dòng…
                </div>
              ) : null}

              {!isLoadingErrors && summary.failedRows > 0 && importErrors.length === 0 && derivedJobId ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Có {summary.failedRows} dòng lỗi nhưng không lấy được danh sách từ API{' '}
                    <code className="text-xs">/jobs/{derivedJobId}/errors</code>. Kiểm tra backend hoặc quyền truy cập.
                  </AlertDescription>
                </Alert>
              ) : null}

              {importErrors.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Chi tiết lỗi theo dòng</p>
                  <div className="max-h-[320px] overflow-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Dòng</TableHead>
                          <TableHead>Tên / Email</TableHead>
                          <TableHead>Lý do</TableHead>
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
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {/* History Sidebar */}
        <Card>
          <CardHeader>
            <CardTitle>{t('upload.history_title')}</CardTitle>
            <CardDescription>
              5 lần tải lên gần nhất
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {uploadHistory.map((item) => (
              <div
                key={item.audit_id}
                className={`border border-border rounded-lg p-3 space-y-2 cursor-pointer transition-colors hover:bg-muted/30 ${
                  selectedHistoryAuditId === item.audit_id ? 'bg-muted/30 border-accent/40' : ''
                }`}
                onClick={() => {
                  setSelectedHistoryAuditId(item.audit_id);
                  if (item.job_id) {
                    setIsFileDetailOpen(true);
                    void loadFileDetailByJobId(String(item.job_id), item.file_name || null);
                  }
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm truncate">{item.file_name || '-'}</p>
                    <p className="text-xs text-muted-foreground">{item.status === 'completed' ? 'Import thành công' : 'Import thất bại'}</p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {item.status === 'completed' ? <CheckCircle className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
                    {item.status === 'completed' ? t('common.done') : (t('common.error') || 'Lỗi')}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>
                    {Number(item.success_count || 0)} / {Number(item.processed_count || 0)} {t('common.records')}
                  </p>
                  <p>{formatDateTimeVietnam(item.created_at, locale)}</p>
                </div>
              </div>
            ))}
            {uploadHistory.length === 0 ? (
              <p className="text-xs text-muted-foreground">Chưa có lịch sử tải lên.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isFileDetailOpen} onOpenChange={setIsFileDetailOpen}>
        <DialogContent className="!w-[98vw] !max-w-none h-[92vh] overflow-hidden p-0">
          <DialogHeader className="px-6 pt-5 pb-2">
            <DialogTitle>Chi tiết file đã tải lên</DialogTitle>
            <DialogDescription>
              {historyFileDetail?.fileName
                ? `${historyFileDetail.fileName} (${historyFileDetail.rows.length} dòng, ${historyFileDetail.columns.length} cột)`
                : 'Đang tải chi tiết file...'}
            </DialogDescription>
          </DialogHeader>
          <div className="h-[calc(92vh-88px)] px-6 pb-5 overflow-hidden">
            {isLoadingFileDetail ? (
              <p className="text-sm text-muted-foreground">Đang tải chi tiết file...</p>
            ) : historyFileDetail ? (
              <div className="h-full w-full rounded-md border bg-slate-50 p-3">
                <div className="h-full w-full overflow-scroll rounded-md border bg-white">
                  <table className="w-max min-w-[1600px] table-fixed border-separate border-spacing-0 text-xs leading-5">
                    <colgroup>
                      <col className="w-[56px]" />
                      {historyFileDetail.columns.map((col) => (
                        <col key={`col-${col}`} className="w-[180px]" />
                      ))}
                    </colgroup>
                    <thead>
                      <tr>
                        <th className="sticky top-0 z-20 bg-slate-100 px-2 py-2 text-left font-semibold w-14 shadow-[0_1px_0_0_rgba(0,0,0,0.08)]">#</th>
                        {historyFileDetail.columns.map((col) => (
                          <th
                            key={col}
                            title={col}
                            className="sticky top-0 z-20 bg-slate-100 px-2 py-2 text-left font-semibold shadow-[0_1px_0_0_rgba(0,0,0,0.08)]"
                          >
                            <span className="block truncate">{col}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {historyFileDetail.rows.map((row, idx) => (
                        <tr key={`${idx}-${historyFileDetail.jobId}`} className="border-t">
                          <td className="px-2 py-1.5 text-muted-foreground align-top bg-white">{idx + 1}</td>
                          {historyFileDetail.columns.map((col) => (
                            <td key={`${idx}-${col}`} title={row?.[col] == null ? '-' : String(row[col])} className="px-2 py-1.5 align-top bg-white">
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
              <p className="text-sm text-muted-foreground">Không có dữ liệu chi tiết.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
