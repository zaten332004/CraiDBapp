'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, CheckCircle } from 'lucide-react';
import { authHeaders } from '@/lib/auth/token';
import { useI18n } from '@/components/i18n-provider';

export default function BatchRiskPage() {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError(t('risk.batch.select_file'));
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/v1/risk/batch', {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || t('risk.batch.failed'));
      }

      const data = await response.json();
      setResult(data);
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('risk.batch.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('risk.batch.desc')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upload Form */}
        <Card>
          <CardHeader>
            <CardTitle>{t('risk.batch.card_title')}</CardTitle>
            <CardDescription>
              {t('risk.batch.card_desc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="file">{t('risk.batch.csv_file')}</Label>
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-accent transition-colors">
                  <input
                    id="file"
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    disabled={isLoading}
                    className="hidden"
                  />
                  <label htmlFor="file" className="cursor-pointer">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">{file?.name || t('upload.drop_prompt')}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t('risk.batch.csv_limit')}</p>
                  </label>
                </div>
              </div>

              <div className="bg-secondary p-4 rounded-lg">
                <p className="text-sm font-medium mb-2">{t('risk.batch.expected_format')}</p>
                <code className="text-xs text-muted-foreground">
                  customer_id,name,income,loan_amount,credit_history
                </code>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading || !file}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('common.processing')}
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    {t('risk.batch.process')}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Result */}
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {result && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  {t('risk.batch.complete')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('common.processed')}</p>
                    <p className="text-2xl font-bold mt-2">{result.processed_count || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('common.successful')}</p>
                    <p className="text-2xl font-bold text-green-500 mt-2">{result.success_count || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('common.failed')}</p>
                    <p className="text-2xl font-bold text-red-500 mt-2">{result.error_count || 0}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-3">{t('risk.batch.summary')}</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{t('customers.avg_score')}</span>
                      <span className="font-medium">{result.average_score?.toFixed(2) || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{t('risk.batch.max_score')}</span>
                      <span className="font-medium">{result.max_score || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{t('risk.batch.min_score')}</span>
                      <span className="font-medium">{result.min_score || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <Button className="w-full" variant="outline">
                  {t('risk.batch.download')}
                </Button>
              </CardContent>
            </Card>
          )}

          {!result && !error && (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <p className="text-muted-foreground">
                  {t('risk.batch.empty')}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
