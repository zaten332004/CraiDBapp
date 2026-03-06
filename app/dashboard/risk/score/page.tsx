'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, TrendingUp } from 'lucide-react';
import { authJsonHeaders } from '@/lib/auth/token';
import { useI18n } from '@/components/i18n-provider';

export default function RiskScorePage() {
  const { t } = useI18n();
  const [formData, setFormData] = useState({
    customerId: '',
    name: '',
    income: '',
    loanAmount: '',
    creditHistory: '',
    notes: '',
  });
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/v1/risk/score', {
        method: 'POST',
        headers: authJsonHeaders(),
        body: JSON.stringify({
          customer_id: formData.customerId,
          name: formData.name,
          income: parseFloat(formData.income),
          loan_amount: parseFloat(formData.loanAmount),
          credit_history_months: parseInt(formData.creditHistory),
          additional_notes: formData.notes,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || t('risk.score.failed'));
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setIsLoading(false);
    }
  };

  const getRiskLevel = (score: number) => {
    if (score >= 80) return 'low';
    if (score >= 60) return 'medium';
    return 'high';
  };

  const riskLevelLabel = (level: string) => {
    switch (level) {
      case 'low':
      case 'medium':
      case 'high':
        return t(`risk.level.${level}`);
      default:
        return level;
    }
  };

  const getRiskBadgeVariant = (level: string): 'default' | 'destructive' | 'outline' | 'secondary' => {
    switch (level) {
      case 'low':
        return 'secondary';
      case 'medium':
        return 'default';
      case 'high':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('risk.score.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('risk.score.desc')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>{t('risk.score.card_title')}</CardTitle>
            <CardDescription>
              {t('risk.score.card_desc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customerId">{t('customers.customer_id')}</Label>
                <Input
                  id="customerId"
                  name="customerId"
                  placeholder={t('customers.customer_id_ph')}
                  value={formData.customerId}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">{t('customers.customer_name')}</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder={t('customers.customer_name_ph')}
                  value={formData.name}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="income">{t('customers.annual_income')}</Label>
                  <Input
                    id="income"
                    name="income"
                    type="number"
                    placeholder={t('customers.annual_income_ph')}
                    value={formData.income}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loanAmount">{t('customers.loan_amount')}</Label>
                  <Input
                    id="loanAmount"
                    name="loanAmount"
                    type="number"
                    placeholder={t('customers.loan_amount_ph')}
                    value={formData.loanAmount}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="creditHistory">{t('customers.credit_history')}</Label>
                <Input
                  id="creditHistory"
                  name="creditHistory"
                  type="number"
                  placeholder={t('customers.credit_history_ph')}
                  value={formData.creditHistory}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">{t('common.additional_notes')}</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder={t('common.additional_notes_ph')}
                  value={formData.notes}
                  onChange={handleChange}
                  disabled={isLoading}
                  rows={3}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('common.calculating')}
                  </>
                ) : (
                  <>
                    <TrendingUp className="mr-2 h-4 w-4" />
                    {t('risk.score.calculate')}
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
                <CardTitle>{t('risk.score.result_title')}</CardTitle>
                <CardDescription>
                  {t('risk.score.calculated_for')}{' '}
                  {result.name || t('customers.customer')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('customers.risk_score')}</p>
                    <p className="text-4xl font-bold text-accent mt-2">
                      {typeof result.score === 'number' ? result.score.toFixed(1) : 'N/A'}
                    </p>
                  </div>
                  <Badge variant={getRiskBadgeVariant(getRiskLevel(result.score || 0))} className="text-lg px-4 py-2">
                    {riskLevelLabel(getRiskLevel(result.score || 0))}
                  </Badge>
                </div>

                {result.model_version && (
                  <div>
                    <p className="text-sm text-muted-foreground">{t('risk.score.model_version')}</p>
                    <p className="font-medium mt-1">{result.model_version}</p>
                  </div>
                )}

                {result.factors && (
                  <div>
                    <p className="text-sm font-medium text-foreground mb-3">{t('risk.analyze.factors_tab')}</p>
                    <div className="space-y-2">
                      {Object.entries(result.factors).map(([key, value]: [string, any]) => (
                        <div key={key} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                          <span className="font-medium">{typeof value === 'number' ? value.toFixed(2) : value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button className="w-full" variant="outline">
                  {t('risk.score.view_detailed')}
                </Button>
              </CardContent>
            </Card>
          )}

          {!result && !error && (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <p className="text-muted-foreground">
                  {t('risk.score.empty')}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
