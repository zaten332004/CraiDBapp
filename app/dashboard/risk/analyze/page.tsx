'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';
import { useI18n } from '@/components/i18n-provider';

const riskFactorData = [
  { factorKey: 'risk.factor.income', impact: 25 },
  { factorKey: 'risk.factor.debt_ratio', impact: 20 },
  { factorKey: 'risk.factor.credit_history', impact: 18 },
  { factorKey: 'risk.factor.employment', impact: 15 },
  { factorKey: 'risk.factor.loan_amount', impact: 12 },
  { factorKey: 'risk.factor.other', impact: 10 },
] as const;

const portfolioDistribution = [
  { riskLevel: 'low', count: 145, percentage: 45 },
  { riskLevel: 'medium', count: 120, percentage: 35 },
  { riskLevel: 'high', count: 70, percentage: 20 },
] as const;

const customerScatter = [
  { income: 50000, loanAmount: 25000, score: 85 },
  { income: 60000, loanAmount: 20000, score: 88 },
  { income: 40000, loanAmount: 35000, score: 42 },
  { income: 75000, loanAmount: 30000, score: 75 },
  { income: 45000, loanAmount: 40000, score: 35 },
  { income: 80000, loanAmount: 25000, score: 92 },
  { income: 35000, loanAmount: 50000, score: 28 },
  { income: 90000, loanAmount: 20000, score: 95 },
];

export default function RiskAnalyzePage() {
  const { t } = useI18n();
  const riskFactorDataLocalized = riskFactorData.map((x) => ({ ...x, factor: t(x.factorKey) }));

  const riskLabel = (level: string) => {
    switch (level) {
      case 'low':
      case 'medium':
      case 'high':
        return t(`risk.level.${level}`);
      default:
        return level;
    }
  };

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('risk.analyze.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('risk.analyze.desc')}
        </p>
      </div>

      <Tabs defaultValue="factors" className="w-full">
        <TabsList>
          <TabsTrigger value="factors">{t('risk.analyze.factors_tab')}</TabsTrigger>
          <TabsTrigger value="distribution">{t('risk.analyze.distribution_tab')}</TabsTrigger>
          <TabsTrigger value="correlation">{t('risk.analyze.correlation_tab')}</TabsTrigger>
        </TabsList>

        {/* Risk Factors */}
        <TabsContent value="factors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('risk.analyze.factors_title')}</CardTitle>
              <CardDescription>
                {t('risk.analyze.factors_desc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={riskFactorDataLocalized}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="factor" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="impact" fill="#06b6d4" name={t('risk.analyze.impact_pct')} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('risk.analyze.insights')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                t('risk.analyze.insight_1'),
                t('risk.analyze.insight_2'),
                t('risk.analyze.insight_3'),
                t('risk.analyze.insight_4'),
              ].map((insight, idx) => (
                <div key={idx} className="flex gap-3">
                  <div className="h-2 w-2 rounded-full bg-accent mt-2 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">{insight}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Distribution */}
        <TabsContent value="distribution" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('risk.analyze.portfolio_dist_title')}</CardTitle>
              <CardDescription>
                {t('risk.analyze.portfolio_dist_desc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {portfolioDistribution.map((item, idx) => (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{riskLabel(item.riskLevel)}</span>
                      <span className="text-sm text-muted-foreground">
                        {item.count} {t('customers.items')} ({item.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="bg-accent rounded-full h-2 transition-all"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('risk.analyze.key_metrics')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t('customers.total')}</p>
                  <p className="text-2xl font-bold mt-2">335</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('customers.avg_score')}</p>
                  <p className="text-2xl font-bold mt-2">68.5</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('risk.analyze.portfolio_risk')}</p>
                  <p className="text-2xl font-bold mt-2">Medium</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Correlation */}
        <TabsContent value="correlation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('risk.analyze.correlation_title')}</CardTitle>
              <CardDescription>
                {t('risk.analyze.correlation_desc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="income" name={t('customers.annual_income_short')} unit="$" />
                  <YAxis dataKey="loanAmount" name={t('customers.loan_amount_short')} unit="$" />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter
                    name={t('customers.title')}
                    data={customerScatter}
                    fill="#06b6d4"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('risk.analyze.findings_title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('risk.analyze.findings_desc')}
              </p>
              <div className="bg-secondary p-4 rounded-lg space-y-2">
                <p className="text-sm font-medium">{t('risk.analyze.strong_indicators')}</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• {t('risk.analyze.indicator_low')}</li>
                  <li>• {t('risk.analyze.indicator_medium')}</li>
                  <li>• {t('risk.analyze.indicator_high')}</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
