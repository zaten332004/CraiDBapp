'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useI18n } from '@/components/i18n-provider';

const riskData = [
  { level: 'low', value: 145, fill: '#10b981' },
  { level: 'medium', value: 120, fill: '#f59e0b' },
  { level: 'high', value: 70, fill: '#ef4444' },
];

const scoreDistribution = [
  { range: '0-20', count: 15 },
  { range: '20-40', count: 35 },
  { range: '40-60', count: 65 },
  { range: '60-80', count: 120 },
  { range: '80-100', count: 100 },
];

export default function RiskDistributionPage() {
  const { t } = useI18n();
  const riskDataLocalized = riskData.map((x) => ({ ...x, name: t(`risk.level.${x.level}`) }));
  return (
    <div className="flex flex-col gap-8 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('portfolio.risk_dist.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('portfolio.risk_dist.desc')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>{t('portfolio.risk_dist.level_title')}</CardTitle>
            <CardDescription>{t('portfolio.risk_dist.level_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={riskDataLocalized} cx="50%" cy="50%" label outerRadius={80} fill="#8884d8" dataKey="value">
                  {riskDataLocalized.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('portfolio.risk_dist.score_title')}</CardTitle>
            <CardDescription>{t('portfolio.risk_dist.score_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={scoreDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#06b6d4" name={t('customers.count')} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('portfolio.risk_dist.stats_title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { labelKey: 'customers.total', value: '335' },
              { labelKey: 'customers.avg_score', value: '68.5' },
              { labelKey: 'portfolio.risk_dist.median', value: '72' },
              { labelKey: 'portfolio.risk_dist.std_dev', value: '18.3' },
              { labelKey: 'portfolio.risk_dist.risk_index', value: t('risk.level.medium') },
            ].map((stat, idx) => (
              <div key={idx} className="text-center p-4 border border-border rounded-lg">
                <p className="text-sm text-muted-foreground">{t(stat.labelKey)}</p>
                <p className="text-2xl font-bold mt-2">{stat.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
