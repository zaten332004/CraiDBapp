'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Upload, CheckCircle, AlertCircle, File, Loader2, RefreshCw } from 'lucide-react';
import { authHeaders } from '@/lib/auth/token';
import { getUserRole } from '@/lib/auth/token';
import { useI18n } from '@/components/i18n-provider';
import { browserApiFetchAuth } from '@/lib/api/browser';
import { ApiError } from '@/lib/api/shared';

const uploadHistory = [
  {
    id: '1',
    name: 'customers_batch_20240205.csv',
    size: '2.4 MB',
    status: 'completed',
    records: 150,
    uploadedAt: '2024-02-05 10:30 AM',
  },
  {
    id: '2',
    name: 'portfolio_update_20240204.xlsx',
    size: '1.8 MB',
    status: 'completed',
    records: 335,
    uploadedAt: '2024-02-04 02:15 PM',
  },
  {
    id: '3',
    name: 'financial_data_20240203.csv',
    size: '950 KB',
    status: 'completed',
    records: 200,
    uploadedAt: '2024-02-03 08:45 AM',
  },
];

export default function UploadPage() {
  const { t } = useI18n();
  const role = getUserRole();
  const isViewer = role === 'viewer';
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [jobId, setJobId] = useState('');
  const [jobStatus, setJobStatus] = useState<any>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [isCheckingJob, setIsCheckingJob] = useState(false);
  const [autoPoll, setAutoPoll] = useState(true);

  const formatApiError = (err: unknown) => {
    if (err instanceof ApiError) {
      return `${err.message} — ${err.url}${err.bodyText ? `\n${err.bodyText}` : ''}`;
    }
    return err instanceof Error ? err.message : String(err);
  };

  const derivedJobId = useMemo(() => {
    const fromResult = String(uploadResult?.job_id ?? uploadResult?.jobId ?? '').trim();
    return jobId.trim() || fromResult;
  }, [jobId, uploadResult]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      setFile(e.dataTransfer.files[0]);
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
        throw new Error('Upload failed');
      }

      const data = await response.json();
      setUploadResult(data);
      const nextJobId = String(data?.job_id ?? data?.jobId ?? '').trim();
      if (nextJobId) setJobId(nextJobId);
      setFile(null);
      setUploadProgress(100);

      // Reset after 2 seconds
      setTimeout(() => {
        setUploadProgress(0);
        setIsUploading(false);
      }, 2000);
    } catch (error) {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const checkJob = async (id: string) => {
    const clean = id.trim();
    if (!clean) return;
    setIsCheckingJob(true);
    setJobError(null);
    try {
      const data = await browserApiFetchAuth<any>(`/jobs/${encodeURIComponent(clean)}`, { method: 'GET' });
      setJobStatus(data);
    } catch (err) {
      setJobError(formatApiError(err));
    } finally {
      setIsCheckingJob(false);
    }
  };

  useEffect(() => {
    if (!autoPoll) return;
    if (!derivedJobId) return;

    const interval = setInterval(() => {
      void checkJob(derivedJobId);
    }, 2500);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPoll, derivedJobId]);

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
                className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                  isDragging ? 'border-accent bg-accent/10' : 'border-border hover:border-accent'
                }`}
              >
                <input
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

          {/* Format Guide */}
          <Card>
            <CardHeader>
              <CardTitle>{t('upload.csv_guide')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-secondary p-4 rounded-lg font-mono text-sm space-y-2">
                <p className="text-muted-foreground">customer_id,name,email,income,loan_amount,credit_history</p>
                <p className="text-muted-foreground">CUST-001,John Smith,john@example.com,50000,25000,60</p>
                <p className="text-muted-foreground">CUST-002,Jane Doe,jane@example.com,75000,30000,84</p>
              </div>
            </CardContent>
          </Card>

          {/* Job Status */}
          <Card>
            <CardHeader>
              <CardTitle>{t('upload.jobs_title')}</CardTitle>
              <CardDescription>{t('upload.jobs_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {jobError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="whitespace-pre-wrap">{jobError}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div className="md:col-span-2">
                  <label className="text-sm font-medium">{t('upload.job_id')}</label>
                  <Input
                    value={jobId}
                    onChange={(e) => setJobId(e.target.value)}
                    placeholder={t('upload.job_id_ph')}
                    className="mt-2"
                  />
                  {uploadResult?.job_id && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {t('upload.job_id_from_upload')}: <span className="font-mono">{String(uploadResult.job_id)}</span>
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => void checkJob(derivedJobId)}
                    disabled={!derivedJobId || isCheckingJob}
                    className="flex-1"
                  >
                    {isCheckingJob ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    {t('common.check')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setAutoPoll((v) => !v)}
                    disabled={!derivedJobId}
                  >
                    {autoPoll ? t('common.auto_on') : t('common.auto_off')}
                  </Button>
                </div>
              </div>

              {jobStatus && (
                <div className="rounded-md border bg-secondary p-3">
                  <p className="text-sm font-medium">{t('upload.job_status')}</p>
                  <pre className="mt-2 max-h-72 overflow-auto text-xs text-muted-foreground">
                    {JSON.stringify(jobStatus, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* History Sidebar */}
        <Card>
          <CardHeader>
            <CardTitle>{t('upload.history_title')}</CardTitle>
            <CardDescription>
              {t('upload.history_desc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {uploadHistory.map((item) => (
              <div
                key={item.id}
                className="border border-border rounded-lg p-3 space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.size}</p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {item.status === 'completed' && <CheckCircle className="h-3 w-3 mr-1" />}
                    {item.status === 'completed' && t('common.done')}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>
                    {item.records} {t('common.records')}
                  </p>
                  <p>{item.uploadedAt}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
